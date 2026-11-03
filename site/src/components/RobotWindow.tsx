import { useMemo, useState } from "react";
import { ROBOT, WHITE_KEYS, noteName } from "../engine/robot";
import type { Plan, WarningKind } from "../engine/types";
import { RobotLink } from "../robotLink";
import { PROBLEM_LABEL, SEVERE } from "./problems";

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

interface Props {
  plan: Plan;
  link: RobotLink;
  live: boolean;
  onLive: (on: boolean) => void;
  onExport: () => void;
  onSeek: (t: number) => void;
}

export function RobotWindow({ plan, link, live, onLive, onExport, onSeek }: Props) {
  const [tab, setTab] = useState<"robot" | "problems">("robot");
  const [onlyBad, setOnlyBad] = useState(true);
  const playable = plan.stats.notes ? Math.round((plan.stats.played / plan.stats.notes) * 100) : 100;
  const severe = plan.warnings.filter((w) => SEVERE.has(w.kind));
  const shown = (onlyBad ? severe : plan.warnings).slice(0, 300);
  const counts = useMemo(() => {
    const c = new Map<WarningKind, number>();
    for (const w of plan.warnings) c.set(w.kind, (c.get(w.kind) ?? 0) + 1);
    return c;
  }, [plan]);
  const connected = link.status === "connected";
  const ready = connected && link.homed;
  const at = (k: number | undefined) => (k === undefined ? "?" : noteName(WHITE_KEYS[Math.max(0, Math.min(WHITE_KEYS.length - 1, Math.round(k)))]));
  const next = !connected
    ? "1. Connect the robot over USB."
    : !link.homed
      ? "2. Home the hands: Home with end stops, or Set home here with the bass W1 over A0 and the treble W1 over D7."
      : !live
        ? "3. Tick Play on the real robot, then press Play in Rehearsal."
        : "Ready: Play in Rehearsal moves the hands and plays the song.";

  return (
    <div className="win-body">
      <div className="stats">
        <div className={`sunken ${playable < 100 ? "bad" : ""}`}>
          <b>{playable}%</b>
          <span>playable</span>
        </div>
        <div className={`sunken ${severe.length ? "bad" : ""}`}>
          <b>{severe.length}</b>
          <span>problems</span>
        </div>
        <div className={`sunken ${plan.stats.peakAmps > ROBOT.solenoidBudgetAmps ? "bad" : ""}`}>
          <b>{plan.stats.peakAmps.toFixed(1)}A</b>
          <span>of {ROBOT.solenoidBudgetAmps}A</span>
        </div>
      </div>

      <div>
        <div className="tabs" role="tablist">
          <button role="tab" className={tab === "robot" ? "on" : ""} onClick={() => setTab("robot")}>
            Connect
          </button>
          <button role="tab" className={tab === "problems" ? "on" : ""} onClick={() => setTab("problems")}>
            Problems ({plan.warnings.length})
          </button>
        </div>
        <div className="tab-page">
          {tab === "robot" &&
            (!RobotLink.supported() ? (
              <span className="dim">USB needs Chrome or Edge on a computer.</span>
            ) : (
              <>
                <div className="row">
                  {connected ? (
                    <button className="btn" onClick={() => void link.disconnect()}>
                      Disconnect
                    </button>
                  ) : (
                    <button className="btn" onClick={() => void link.connect()} disabled={link.status === "connecting"}>
                      {link.status === "connecting" ? "Connecting…" : "Connect…"}
                    </button>
                  )}
                  <button className="btn" onClick={() => link.home()} disabled={!connected} title="Move both hands to their end stops">
                    Home
                  </button>
                  <button
                    className="btn"
                    onClick={() => link.setHome()}
                    disabled={!connected}
                    title="The hands are already at the far left and far right: take that as home without moving (when the end stops aren't wired)"
                  >
                    Set home here
                  </button>
                  <button className="btn" onClick={() => link.free()} disabled={!connected} title="Turn the motors off so the hands slide by hand (the robot then needs homing again)">
                    Release motors
                  </button>
                  <span className="dim">
                    {connected ? `${link.device ?? "waiting for robot…"} · ${link.homed ? `homed · left hand ${at(link.pos.bass)}, right hand ${at(link.pos.treble)}` : "not homed"}` : "not connected"}
                  </span>
                </div>
                <label className="check" title={ready ? "Play in Rehearsal moves the hands and fires the fingers" : "Connect and home the robot first"}>
                  <input type="checkbox" checked={live && ready} disabled={!ready} onChange={(e) => onLive(e.target.checked)} />
                  <span>Play on the real robot</span>
                </label>
                <span className="robot-next">{next}</span>
                <pre className="serial-log sunken" aria-label="Robot messages">
                  {link.log.slice(-8).join("\n") || " "}
                </pre>
              </>
            ))}
          {tab === "problems" && (
            <>
              <div className="row">
                <label className="check">
                  <input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} />
                  <span>Only real problems</span>
                </label>
                <span className="dim">
                  {[...counts].map(([k, n]) => `${PROBLEM_LABEL[k]} ${n}`).join(" · ") || "none"}
                </span>
              </div>
              <ul className="list sunken problems">
                {shown.length === 0 && <li>Nothing to fix.</li>}
                {shown.map((w, i) => (
                  <li key={i} className="click" onClick={() => onSeek(Math.max(0, w.time - 1))} title={w.message}>
                    <time>{fmt(w.time)}</time>
                    <span className={SEVERE.has(w.kind) ? "bad" : ""}>{PROBLEM_LABEL[w.kind]}</span>
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="row end">
        <button className="btn" onClick={onExport}>
          Save performance file…
        </button>
      </div>
    </div>
  );
}
