# Firmware

Teensy 4.1 firmware for the C0nTrollER board. It receives timestamped commands from the web app over USB serial ([`PROTOCOL.md`](PROTOCOL.md)), moves the two carriages (TMC2209 drivers, NEMA17 motors) and fires the 26 solenoids through the two PLAyeRs boards (PCA9685 over I²C).

The web app decides what to play and when. The firmware's job is to do each command at the right moment and to keep the robot safe whatever it receives.

| File | Contents |
|---|---|
| `src/config.h` | Pins, I²C addresses, calibration and safety limits |
| `src/core.cpp` | The protocol, the time-sorted queue and the safety rules, with no hardware code |
| `src/main.cpp` | The hardware: steppers (stepped from a 50 kHz timer interrupt), PCA9685s, end stops, USB |
| `test/core_test.cpp` | Tests for `core.cpp` against a simulated robot, run on a computer |

## Build

With [PlatformIO](https://platformio.org/) (command line, or the VS Code extension):

```bash
cd firmware
pio run                 # build
pio run -t upload       # build and flash (the Teensy's button starts the loader if it does not start by itself)
pio device monitor      # serial monitor, for the bring-up commands below
```

Build output goes to `.pio.nosync/`, which iCloud does not sync and git ignores.

The tests run on a computer:

```bash
c++ -std=c++17 -Isrc test/core_test.cpp src/core.cpp -o /tmp/core_test && /tmp/core_test
```

## How a performance runs

1. On connecting, the app sends `HELLO`, the motion and solenoid settings it planned with (`CFG`), and `POS` to learn whether the robot is homed.
2. Homing sets the carriages' positions: `HOME` with end stops, or `SETHOME` when the carriages were put at their home ends by hand.
3. At the start of a song the app sends `STOP` and `ZERO`, which restarts the device clock at 0, then a move to the song's start position for each carriage.
4. During the song, moves (`M`) and strikes (`S`) arrive 0.1–0.3 s before they are due, each with the time it should happen. The firmware keeps them in a queue sorted by time and runs each one when the clock reaches it.
5. `STOP` (or a closed port) releases every solenoid, stops both motors and empties the queue. The robot stays homed.

## Strikes

Each strike has three phases:

1. **Strike**: the solenoid runs at the strike's own duty (`pwm`, which sets how hard the key is hit) for the strike time from `CFG` (50 ms).
2. **Press**: fully on until 300 ms after the strike started (`PRESS_MS`). Fully on is silent.
3. **Hold**: at the hold duty (35 %) until the note's end, at most 2 s after the strike.

Below 100 % duty the coil hums at the PWM frequency (1 kHz; the PCA9685 cannot go above about 1.5 kHz), so only notes held longer than 300 ms hum, and only while held. Black-key fingers (channels 7–12 on both boards) strike at 40 % of the requested `pwm`, because black keys need much less force.

## Safety rules

The firmware applies these whatever the app sends:

- **Hold time.** No solenoid stays on longer than 2 s.
- **Current budget.** At most 4 A of solenoid current at once. A strike counts its full 0.4 A for its first 300 ms and the hold current after that. A strike that would go over is skipped and reported with `LOG`.
- **Hand gap.** The hands always keep at least 5 free white keys between them, so the bass W1 stays at least 12 white keys (7 + 5) left of the treble W1 (`MIN_GAP_KEYS`). A move that would break this is refused with `ERR`. If the carriages ever get closer than 11.75 keys (a stalled or slipping carriage), both stop and the robot needs homing again.
- **End stops.** Each carriage has one switch at its home end (bass: low end, treble: high end); the far ends are guarded by the other carriage and the range check. Before homing, `JOG` stops at the switch. After homing, a switch pressed while the carriage should be more than 2 mm away means lost steps: everything stops and the robot needs homing again.
- **Range.** Positions outside 0–45 (W1 from A0 to D7), or past the end stop the carriage homed against, are refused. No moves are accepted before homing.
- **Speed.** At most 100 mm/s and 1000 mm/s² (`SPEED_LIMIT_MM`, `ACCEL_LIMIT_MM`), whatever `CFG` asks.
- **Drivers.** The motor drivers stay off from power-up until the first move, then hold position. `FREE` turns them off again.
- **Lost connection.** A closed port or a pulled cable acts as `STOP`.

## Finger → PCA9685 channel

The app sends channel numbers; this is the wiring they follow (`site/src/engine/robot.ts`, `pwmChannel`). W1–W7 are the white-key fingers from left to right, B1–B6 the black-key fingers (Bn sits between Wn and Wn+1).

| Finger | W1 | W2 | W3 | W4 | W5 | W6 | W7 | B1 | B2 | B3 | B4 | B5 | B6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Treble (`0x41`) | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| Bass (`0x40`) | 6 | 5 | 4 | 3 | 2 | 1 | 0 | 12 | 11 | 10 | 9 | 8 | 7 |

## Bring-up

The steps for a new robot, in order, with the serial monitor open. Each step only depends on the ones before it.

1. **Power.** Before the first power-up, the MP1584 is set to 5.0 V with the Teensy out, and the Teensy's VIN–VUSB trace is cut ([`hardware/PCB/README.md`](../hardware/PCB/README.md)).
2. **Link.** `HELLO` → `V2P 1`. An `ERR no PCA9685 at …` after it means that board did not answer on I²C at power-up (its cable, its 5 V, or the A0 jumper on the treble board).
3. **Solenoids.** With 12 V on, `TEST B W1` … `TEST B W7`, `TEST B B1` … `TEST B B6`, then the same for `T`, fire each finger once (150 ms, full strength on white keys, 40 % on black keys). The reply names the channel, e.g. `OK W1 ch 6` on the bass, and each name has to land on that finger. `C0`–`C12` fires a raw channel instead. `TEST T B1 30` (30 ms at full power) and `TEST T B1 30 60` (at 60 %) give one flat pulse, to find how much each finger needs. A wrong finger means the table above or the wiring is off; a dead channel shows on the board's LED (lit = the MOSFET switched).
4. **End stops.** `POS` prints `END <bass> <treble>`; each switch pressed by hand turns its number from 0 to 1.
5. **Direction and distance.** `JOG B 50` moves the bass carriage 50 mm to the right (towards the treble), and `JOG T -50` the treble 50 mm to the left. A carriage going the wrong way needs its `DIR_INVERT` flipped in `config.h`. A wrong distance needs `STEPS_PER_MM` × 50 / measured mm. The values in `config.h` were measured on the robot: 80 steps/mm for a GT2 belt on a 20-tooth pulley at 16 microsteps.
6. **Homing.** `HOME` drives the bass to the low end and the treble to the high end at 20 mm/s, then backs each off 3 mm → `HOMED`. `ERR homing failed` means a switch was not reached within 90 s: the direction (step 5) or the switch (step 4). A robot without end stops wired is homed by hand instead: with the drivers off (after power-up, or after `FREE`), the bass W1 goes over A0 and the treble W1 over D7, then `SETHOME`. `HOME` without switches would drive into the ends until the timeout.
7. **Key positions.** `GO B 0` puts the bass W1 over A0, and `GO T 45` the treble W1 over D7. An offset is corrected in `HOME_KEYS` in `config.h` (in white keys, fractions allowed), followed by homing again. A few positions in the middle check the distance, e.g. `GO B 23` (W1 over C4).
8. **Speed.** `GO` moves at the capped speed (100 mm/s). Higher limits are found by raising `SPEED_LIMIT_MM` and `ACCEL_LIMIT_MM` step by step, homing and running long `GO` moves each time; a carriage that skips steps stops with `ERR … lost steps` on its way back home. `carriageSpeedMm` and `carriageAccelMm` in `site/src/engine/robot.ts` then get the same values, so the planner's timing matches the robot.
9. **From the app.** **Robot → Connect…**, **Home** (or **Set home here**), **Play on the real robot**, then **▶ Play** in Rehearsal. From there the robot plays the song on its own.

The hold duty (35 %, the lowest that still keeps a key down) and the strike time (50 ms) are set in `site/src/engine/robot.ts`, which sends them with `CFG`.
