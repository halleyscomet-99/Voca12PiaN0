# Serial protocol

How the web app (`site/src/robotLink.ts`) talks to the Teensy over USB serial. The firmware (`src/`, see [`README.md`](README.md)) implements it.

The app streams commands while the song plays, 0.1 to 0.3 s before each one is due. A whole performance never has to fit on the device.

## Transport

- USB CDC serial. The Teensy ignores the baud rate; the app opens the port at 115200.
- Plain ASCII, one command per line, ending in `\n`. Fields are separated by single spaces.
- Carriages: `T` = treble (right hand, PCA9685 at `0x41`), `B` = bass (left hand, `0x40`).
- Times are integer milliseconds on the device clock, counted from the last `ZERO`.
- Positions are the white key under finger W1: 0 = A0, 23 = C4, 45 = D7 (the highest place a 7-key carriage reaches).

## App → device

| Command | Meaning |
|---|---|
| `HELLO` | Identify. Reply `V2P <protocol version>`, e.g. `V2P 1`, followed by `ERR no PCA9685 at …` for a finger board that did not answer at power-up. |
| `CFG <speed> <accel> <key> <strike> <hold>` | Motion and solenoid settings the planner assumed: speed in mm/s, acceleration in mm/s², white-key pitch in mm, strike time in ms, hold duty in %. Sent once after connecting, so the robot moves exactly as the rehearsal predicted. Speed and acceleration are capped by the firmware's limits. Reply `OK`. |
| `POS` | Reply `POS B <keys> T <keys> END <bass> <treble> homed\|not-homed`: where each W1 is, in white keys (fractions while moving), and the end stops (1 = pressed). The app sends it after connecting, after homing, after errors and after every stop. |
| `HOME` | Drive both carriages to their end stops and set their positions. Reply `HOMED` when done, or `ERR <reason>`. |
| `SETHOME` | Take the carriages' current places as home (bass W1 over A0, treble W1 over D7) without moving, for a robot without end stops. Reply `HOMED`. Without end stops, lost steps go unnoticed. |
| `FREE` | `STOP`, then turn both motor drivers off so the carriages slide by hand. The robot is no longer homed; strikes still work. Reply `OK`. |
| `ZERO` | Restart the device clock at 0. Sent at the start of every performance, right after `STOP`. |
| `M <c> <pos> <t>` | At time `t`, start moving carriage `c` so that finger W1 sits over white key `pos`, with the speed and acceleration from `CFG`. |
| `S <c> <ch> <t> <dur> <pwm>` | At time `t`, fire PCA9685 channel `ch` (0 to 12) on carriage `c`: at duty `pwm` (12-bit, sets how hard the key is struck; black-key channels 7–12 are scaled to 40 %) for the strike time, then fully on until 300 ms after `t`, then at the hold duty. Release `dur` ms after `t`. Striking a channel that is still on restarts its timing. |
| `STOP` | Release every solenoid, stop both motors, clear all queued commands. The robot stays homed. Reply `OK`. |

Commands may arrive out of time order, because moves and strikes are separate streams. The firmware keeps them in a queue sorted by time.

The finger-to-channel map is in [`README.md`](README.md#finger--pca9685-channel). The app sends channel numbers, so the firmware needs no finger names.

## Device → app

| Line | Meaning |
|---|---|
| `V2P <n>` | Reply to `HELLO`. |
| `OK` | Command accepted, where a reply is expected. |
| `HOMED` | Homing finished. |
| `POS …` | Reply to `POS`. |
| `ERR <text>` | Something went wrong: a bad command, a refused move, an end stop hit while playing, homing failed. Errors ending in `home again` leave the robot unhomed. |
| `LATE <ms>` | Commands arrived up to this many ms after their time (more than 10 ms late; sent at most every 250 ms). Those up to 200 ms late were played at once; later ones were dropped. |
| `LOG <text>` | Anything worth showing, such as a strike skipped for the current budget; the app prints the last few lines. |

## Safety the firmware enforces on its own

- No solenoid stays on longer than 2 s, whatever `dur` says.
- No carriage moves past its end stop or into the other carriage: the bass W1 stays at least 12 white keys left of the treble W1, which leaves 5 free white keys between the hands.
- No more than 4 A of solenoid current at once; a strike that would go over is skipped.
- A lost USB connection counts as `STOP`.

Details in [`README.md`](README.md#safety-rules).

## Bring-up commands

For a serial monitor while setting up the robot; the app does not send them.

| Command | Meaning |
|---|---|
| `JOG <c> <mm>` | Move a carriage by this many mm (+ = towards the treble), slowly, even before homing. |
| `GO <c> <pos>` | Move W1 over white key `pos` now, with the same checks as `M`. |
| `TEST <c> <finger>` | Fire one finger at full strength for 150 ms (black keys at 40 %). Fingers: `W1`–`W7`, `B1`–`B6` from left to right, or `C0`–`C12` for a raw channel ([channel map](README.md#finger--pca9685-channel)). Reply `OK <finger> ch <channel>`. With a length, `TEST <c> <finger> <ms> [<pct>]` is one flat pulse instead: `ms` (1–500) at `pct` (1–100, default 100), with no black-key scaling and no hold, to find the strike each finger needs. |
