# Firmware

The first Teensy 4.1 firmware, replaced by [`firmware/`](../../firmware). It received serial commands from `MIDI2Piano.py` and controlled two solenoid driver boards and two stepper motors.

Built with [PlatformIO](https://platformio.org/).

## Build and flash

```bash
pip install platformio
cd firmware
pio run --target upload
pio device monitor --baud 115200
```

Red squiggles on the includes in VS Code come from a missing IntelliSense config, which `pio init --ide vscode` generates. They do not affect compilation.

## Pin assignments

| Pin | Signal |
|-----|--------|
| 2 | STEP_1 (right stepper) |
| 3 | DIR_1 |
| 4 | STEP_2 (left stepper) |
| 5 | DIR_2 |
| 6 | EN (shared, active LOW) |
| 7 | STOP_1 (right endstop) |
| 8 | STOP_2 (left endstop) |
| 10 | CS (shared 74HC595 latch) |
| 11 | SER_A (right board data) |
| 12 | SER_B (left board data) |
| 13 | SCK (shared clock) |

Both driver boards share SCK and CS. SER_A and SER_B are clocked together on every update so both boards latch simultaneously.

## Serial protocol

115200 baud, ASCII, newline-terminated. `MIDI2Piano.py` sends these; typing them by hand is only needed for testing.

```
MOVE R <semitone_offset> <rpm>   move right board to offset from home
MOVE L <semitone_offset> <rpm>   move left board
FIRE R <0xMASK> <hold_ms>        fire right solenoids (auto-release after hold_ms)
FIRE L <0xMASK> <hold_ms>        fire left solenoids
RELEASE R / RELEASE L            release immediately
HOME                             home both rails to endstops
STATUS                           reply: STATUS R <pos> L <pos>
```

Solenoid mask is 15-bit: bit 0 = SOL 1, bit 14 = SOL 15. Example: `0x0015` = SOL 1 + SOL 3 + SOL 5.

## Calibrating steps per semitone

`STEPS_PER_SEMITONE` in `src/main.cpp` depends on the belt, pulley and microstepping.

After `HOME`, `MOVE R 12 100` should move the board 12 semitone spacings (roughly 164 mm on a standard piano). From the distance it actually moved:

```
new value = 1096 × (164 / actual_mm)
```

The constant is then updated and the firmware flashed again.

The default of 1096 is for a NEMA17 with a GT2 belt, a 20-tooth pulley and 1/16 microstepping.

## Dependencies

PlatformIO installs these automatically:

- `waspinator/AccelStepper` — non-blocking stepper control
- `framework-arduinoteensy` — Teensy Arduino core