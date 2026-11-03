"""Play a MIDI file on the robot, section by section, with the hands moved by hand.

With a performance file saved from the site, it plays the site's plan (the hands, fingers and
timing seen in the rehearsal), with a new section at each move. With a MIDI file, the song is cut
into as few sections as possible, each with one place for each hand that reaches
all its notes (moved by octaves where needed). Before each section the script says where to put
the hands and waits for Enter, then plays that section with the solenoids alone over USB
(firmware/PROTOCOL.md). It sends no moves and turns the motor drivers off (FREE), so the carriages
can be pushed, and needs no homing or end stops.

    python3 play_fixed.py song.performance.json          (the site's plan: Robot → Save performance file…)
    python3 play_fixed.py ../site/local/song.mid
    python3 play_fixed.py song.mid --tracks Piano --bars 1-8 --speed 0.9
    python3 play_fixed.py song.mid --exact                   (every note as written: more moves)
    python3 play_fixed.py song.mid --dry                     (plan only, no robot)

No packages needed (macOS or Linux). At each prompt:
    Enter           the hands are there: play
    test b w1       strike one finger (W1–W7, B1–B6), to check the place
    !<command>      send a raw command, e.g. !POS
    q               quit
Ctrl+C stops everything, at any time.
"""

import argparse
import glob
import os
import re
import struct
import sys
import termios
import threading
import time
import tty

LEAD = 0.3  # s: strikes are sent this far ahead of time
START = 1.0  # s from ZERO to the first beat
MIN_RELEASE = 0.03  # s a finger is up before it strikes the same key again
MAX_HOLD = 2.0  # s, the firmware's limit
FOLDS = [0, -12, 12, -24, 24]

# ---------- MIDI ----------


def read_midi(path):
    """Notes [(start s, end s, midi, velocity 0–1, track name)], beats per bar, s per beat."""
    data = open(path, "rb").read()
    if data[:4] != b"MThd":
        sys.exit(f"{path}: not a MIDI file")
    _, ntracks, division = struct.unpack(">HHH", data[8:14])
    if division & 0x8000:
        sys.exit("SMPTE-timed MIDI files are not supported")
    pos, tempos, raw, beats_per_bar = 14, [], [], 4
    for _ in range(ntracks):
        assert data[pos : pos + 4] == b"MTrk", "bad track chunk"
        length = struct.unpack(">I", data[pos + 4 : pos + 8])[0]
        i, end, tick, status, name, on = pos + 8, pos + 8 + length, 0, 0, "", {}
        events = []
        while i < end:
            delta, i = varlen(data, i)
            tick += delta
            if data[i] & 0x80:
                status, i = data[i], i + 1
            if status == 0xFF:
                kind, (n, i) = data[i], varlen(data, i + 1)
                body, i = data[i : i + n], i + n
                if kind == 0x03:
                    name = body.decode("latin-1")
                elif kind == 0x51:
                    tempos.append((tick, int.from_bytes(body, "big")))
                elif kind == 0x58 and tick == 0:
                    beats_per_bar = body[0] * 4 / (2 ** body[1])
            elif status in (0xF0, 0xF7):
                n, i = varlen(data, i)
                i += n
            else:
                kind, channel = status & 0xF0, status & 0x0F
                size = 1 if kind in (0xC0, 0xD0) else 2
                a, b = data[i], data[i + 1] if size == 2 else 0
                i += size
                if channel == 9:
                    continue  # drums
                if kind == 0x90 and b > 0:
                    on[(channel, a)] = (tick, b)
                elif kind in (0x80, 0x90) and (channel, a) in on:
                    t0, v = on.pop((channel, a))
                    events.append((t0, tick, a, v / 127))
        raw += [(t0, t1, m, v, name) for t0, t1, m, v in events]
        pos = end
    tempos.sort(key=lambda x: x[0])
    if not tempos or tempos[0][0] > 0:
        tempos.insert(0, (0, 500000))  # MIDI default: 120 bpm

    def seconds(tick):
        s, last_tick, us = 0.0, 0, 500000
        for t, new in tempos:
            if t >= tick:
                break
            s += (t - last_tick) * us / division / 1e6
            last_tick, us = t, new
        return s + (tick - last_tick) * us / division / 1e6

    notes = sorted((seconds(t0), seconds(t1), m, v, name) for t0, t1, m, v, name in raw)
    return notes, beats_per_bar, tempos[0][1] / 1e6


def varlen(data, i):
    n = 0
    while True:
        b = data[i]
        i += 1
        n = (n << 7) | (b & 0x7F)
        if not b & 0x80:
            return n, i


# ---------- Keyboard and fingers (same as site/src/engine/robot.ts) ----------

NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
BLACK = {1, 3, 6, 8, 10}
WHITE = [m for m in range(21, 109) if m % 12 not in BLACK]
WHITE_INDEX = {m: i for i, m in enumerate(WHITE)}
MAX_POS = len(WHITE) - 7
MIN_GAP = 12  # bass W1 to treble W1: 5 white keys free between the hands (firmware MIN_GAP_KEYS)


def name(m):
    return f"{NAMES[m % 12]}{m // 12 - 1}"


def finger(pos, m):
    """Finger of a hand at `pos` that plays `m`, or None."""
    if m % 12 not in BLACK:
        i = WHITE_INDEX.get(m, -99) - pos
        return f"W{i + 1}" if 0 <= i < 7 else None
    i = WHITE_INDEX.get(m - 1, -99) - pos
    return f"B{i + 1}" if 0 <= i < 6 else None


def channel(hand, f):
    """PCA9685 channel; the bass board is wired in reverse."""
    n, white = int(f[1:]), f[0] == "W"
    if hand == "T":
        return n - 1 if white else 6 + n
    return 7 - n if white else 13 - n


def assign(notes, bass, treble):
    """[(start, end, hand, finger, midi played, velocity, folded)] and the notes left out."""
    out, left = [], []
    for t0, t1, m, v, _ in notes:
        for fold in FOLDS:
            hands = [(h, finger(p, m + fold)) for h, p in (("B", bass), ("T", treble))]
            hands = [(h, f) for h, f in hands if f]
            if hands:
                h, f = hands[0] if len(hands) == 1 or m < WHITE[treble] else hands[-1]
                out.append((t0, t1, h, f, m + fold, v, fold != 0))
                break
        else:
            left.append(m)
    return out, left


def best_positions(notes):
    best = None
    for b in range(MAX_POS + 1):
        for t in range(b + MIN_GAP, MAX_POS + 1):
            played, _ = assign(notes, b, t)
            score = sum(0.6 if p[6] else 1 for p in played)
            if best is None or score > best[0]:
                best = (score, b, t)
    return best[1], best[2]


def sections(notes, bar):
    """[(first bar, last bar, bass, treble)]: as few as possible, each reaching all its notes."""
    bars = int(max(n[0] for n in notes) // bar) + 1
    in_bar = [[n for n in notes if int(n[0] // bar) == k] for k in range(bars)]
    pairs = [(b, t) for b in range(MAX_POS + 1) for t in range(b + MIN_GAP, MAX_POS + 1)]
    out, k, here = [], 0, None
    while k < bars:
        # The place that reaches every note for the most bars from here; then fewest folds, then
        # the shortest move.
        best = None
        for b, t in pairs:
            j, folds = k, 0
            while j < bars:
                played, left = assign(in_bar[j], b, t)
                if left:
                    break
                folds += sum(p[6] for p in played)
                j += 1
            move = 0 if here is None else abs(b - here[0]) + abs(t - here[1])
            key = (j, -folds, -move)
            if best is None or key > best[0]:
                best = (key, b, t)
        (j, _, _), b, t = best
        if j == k:  # nothing reaches every note of this bar: take the most
            b, t = best_positions(in_bar[k]) if in_bar[k] else (here or (b, t))
            j = k + 1
        if out and (b, t) == (out[-1][2], out[-1][3]):
            out[-1] = (out[-1][0], j - 1, b, t)
        else:
            out.append((k, j - 1, b, t))
        here, k = (b, t), j
    return out


def strikes(played, speed):
    """Firmware strikes [(t ms, hand, channel, dur ms, pwm)], released before each re-strike."""
    by_key = {}
    for t0, t1, h, f, m, v, _ in played:
        by_key.setdefault((h, channel(h, f)), []).append((t0 / speed, t1 / speed, v))
    out = []
    for (h, ch), hits in by_key.items():
        hits.sort()
        for i, (t0, t1, v) in enumerate(hits):
            end = min(t1, t0 + MAX_HOLD)
            if i + 1 < len(hits):
                end = min(end, hits[i + 1][0] - MIN_RELEASE)
            dur = max(0.04, end - t0)
            out.append((round((START + t0) * 1000), h, ch, round(dur * 1000), round(4095 * (0.6 + 0.4 * v))))
    return sorted(out)


# ---------- USB serial ----------


class Robot:
    def __init__(self, port):
        self.fd = os.open(port, os.O_RDWR | os.O_NOCTTY)
        tty.setraw(self.fd)
        attrs = termios.tcgetattr(self.fd)
        attrs[4] = attrs[5] = termios.B115200
        termios.tcsetattr(self.fd, termios.TCSANOW, attrs)
        self.lines = []
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        buf = b""
        while True:
            try:
                chunk = os.read(self.fd, 256)
            except OSError:
                return
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                line = line.decode(errors="replace").strip()
                if line:
                    self.lines.append(line)
                    print(f"  ← {line}")

    def send(self, line):
        os.write(self.fd, (line + "\n").encode())

    def hello(self):
        self.lines.clear()
        self.send("HELLO")
        time.sleep(0.5)
        return any(line.startswith("V2P") for line in self.lines)


def find_port():
    ports = sorted(glob.glob("/dev/cu.usbmodem*") + glob.glob("/dev/ttyACM*"))
    # Teensy serial numbers are digits only; other USB devices (sound cards) often aren't.
    ports.sort(key=lambda p: not re.search(r"(usbmodem\d+|ttyACM\d+)$", p))
    if not ports:
        sys.exit("No robot found on USB. Is the Teensy plugged in, and the serial monitor closed?")
    return ports[0]


# ---------- Performance file from the site ----------


def clock(ms):
    return f"{int(ms // 60000)}:{ms % 60000 / 1000:04.1f}"


def read_performance(path, speed):
    """Sections [(label, bass, treble, strikes)] from the site's performance file (Robot → Save
    performance file…): the same hands, fingers and timing as the rehearsal. A new section starts
    at each move (moves less than 1.5 s apart count as one)."""
    import json

    perf = json.load(open(path))
    if perf.get("format") != "vocal2piano-performance":
        sys.exit(f"{path}: not a performance file from the site")
    here = {"bass": perf["start"]["bass"], "treble": perf["start"]["treble"]}
    moves = sorted(perf["moves"], key=lambda m: m["t0"])
    groups = []
    for m in moves:
        if groups and m["t0"] - groups[-1][0] < 1500:
            groups[-1][1].append(m)
        else:
            groups.append((m["t0"], [m]))
    cuts = [0] + [g[0] for g in groups] + [float("inf")]
    places = [dict(here)]
    for _, group in groups:
        for m in group:
            here[m["carriage"]] = m["to"]
        places.append(dict(here))
    out = []
    for i, place in enumerate(places):
        lo, hi = cuts[i], cuts[i + 1]
        hits = sorted(
            (round(START * 1000 + (s["t"] - lo) / speed), "B" if s["carriage"] == "bass" else "T", s["channel"], max(1, round(s["dur"] / speed)), s["pwm"])
            for s in perf["strikes"]
            if lo <= s["t"] < hi
        )
        if not hits:
            continue
        end = max(s["t"] + s["dur"] for s in perf["strikes"] if lo <= s["t"] < hi)
        out.append((f"{clock(lo)}–{clock(end)}", place["bass"], place["treble"], hits))
    return perf.get("song", path), out


# ---------- Main ----------


def plan_midi(a):
    """Sections [(label, bass, treble, strikes)] planned here from a MIDI file."""
    notes, beats_per_bar, beat = read_midi(a.song)
    bar = beats_per_bar * beat
    tracks = sorted({n[4] for n in notes})
    if a.tracks:
        want = {t.strip().lower() for t in a.tracks.split(",")}
        notes = [n for n in notes if n[4].lower() in want]
        if not notes:
            sys.exit(f"No notes in tracks {a.tracks}. Tracks in the file: {', '.join(tracks)}")
    first = 1
    if a.bars:
        first, last = (int(x) for x in a.bars.split("-"))
        lo, hi = (first - 1) * bar, last * bar
        notes = [(t0 - lo, min(t1, hi) - lo, m, v, tr) for t0, t1, m, v, tr in notes if lo <= t0 < hi]
    if not notes:
        sys.exit("No notes to play.")

    plan = sections(notes, bar)
    print(f"Tracks: {', '.join(tracks)}" + (f"  (playing {a.tracks})" if a.tracks else ""))
    print(f"{len(notes)} notes, {max(n[1] for n in notes) / a.speed:.0f} s, {len(plan)} section(s):")
    parts = []
    for k0, k1, b, t in plan:
        part = [n for n in notes if k0 * bar <= n[0] < (k1 + 1) * bar]
        played, left = assign(part, b, t)
        folded = sum(p[6] for p in played)
        print(f"  bars {first + k0}–{first + k1}: bass {name(WHITE[b])}, treble {name(WHITE[t])}"
              + (f", {folded} moved by octaves" if folded else "") + (f", {len(left)} left out" if left else ""))
        start = k0 * bar
        shifted = [(t0 - start, t1 - start, h, f, m, v, fo) for t0, t1, h, f, m, v, fo in played]
        parts.append((f"bars {first + k0}–{first + k1}", b, t, strikes(shifted, a.speed)))
    return parts


def main():
    ap = argparse.ArgumentParser(description="Play a MIDI file section by section, the hands moved by hand.")
    ap.add_argument("song", help="a .mid file, or a performance file saved from the site (.json)")
    ap.add_argument("--port", help="serial port (default: the first Teensy-like USB port)")
    ap.add_argument("--tracks", help="MIDI only: comma-separated track names to play (default: all but drums)")
    ap.add_argument("--bars", help="MIDI only: bars to play, e.g. 1-8 (counted from the start of the file)")
    ap.add_argument("--speed", type=float, default=1.0, help="tempo factor, e.g. 0.8")
    ap.add_argument("--exact", action="store_true", help="MIDI only: no octave moves: play every note as written, moving more often")
    ap.add_argument("--dry", action="store_true", help="print the plan, don't connect")
    a = ap.parse_args()
    if a.exact:
        FOLDS[:] = [0]

    if a.song.endswith(".json"):
        title, parts = read_performance(a.song, a.speed)
        print(f"{title}: the site's plan, {sum(len(p[3]) for p in parts)} strikes, {len(parts)} section(s):")
        for label, b, t, _ in parts:
            print(f"  {label}: bass {name(WHITE[b])}, treble {name(WHITE[t])}")
    else:
        parts = plan_midi(a)
    print()
    if a.dry:
        return

    port = a.port or find_port()
    robot = Robot(port)
    if not robot.hello():
        sys.exit(f"No reply from the robot on {port}. Pass --port, and close the serial monitor and the site.")
    robot.lines.clear()
    robot.send("FREE")
    time.sleep(0.3)
    if not any(line == "OK" for line in robot.lines):
        print("  This firmware build has no FREE command: if the hands won't push, power-cycle the Teensy.")
    print(f"Connected on {port}. Motors off: the hands can be pushed.")

    def prompt(question):
        """True to go on, False to quit; strikes test fingers on the way."""
        while True:
            cmd = input(f"{question} > ").strip()
            if not cmd:
                return True
            if cmd.lower() == "q":
                return False
            if cmd.startswith("!"):
                robot.send(cmd[1:].strip())
            elif m := re.fullmatch(r"test\s+([bt])\s+([wb]\d+)", cmd, re.I):
                robot.send(f"TEST {m[1].upper()} {m[2].upper()}")
            else:
                print("  ? Enter · test b w1 · !<command> · q")
            time.sleep(0.2)

    try:
        here = None
        for i, (label, b, t, hits) in enumerate(parts):
            if (b, t) != here:
                print(f"\nSection {i + 1}/{len(parts)}, {label}. Put the hands here:")
                for hand, pos in (("Bass", b), ("Treble", t)):
                    moved = "" if here is None else f"   ({pos - here[hand == 'Treble']:+d} white keys)"
                    print(f"  {hand:6} W1 over {name(WHITE[pos])}, fingers {name(WHITE[pos])}–{name(WHITE[pos + 6])}{moved}")
                print(f"  check: test b w1 plays {name(WHITE[b])}, test t w1 plays {name(WHITE[t])}")
                if not prompt(f"Enter to play {label}"):
                    break
                here = (b, t)
            print(f"Playing {label} ({len(hits)} strikes). Ctrl+C to stop.")
            robot.send("STOP")
            robot.send("ZERO")
            t0 = time.monotonic()
            j = 0
            while j < len(hits):
                now = (time.monotonic() - t0) * 1000
                while j < len(hits) and hits[j][0] <= now + LEAD * 1000:
                    ms, h, ch, dur, pwm = hits[j]
                    robot.send(f"S {h} {ch} {ms} {dur} {pwm}")
                    j += 1
                time.sleep(0.005)
            end = max(ms + dur for ms, _, _, dur, _ in hits) / 1000 if hits else 0
            time.sleep(max(0, end - (time.monotonic() - t0)) + 0.3)
        else:
            print("Done.")
    except (KeyboardInterrupt, EOFError):
        print("\nStopped.")
    finally:
        robot.send("STOP")
        time.sleep(0.2)


if __name__ == "__main__":
    main()
