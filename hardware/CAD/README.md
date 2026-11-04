
# CAD & Mechanical Design

The robot features two independently moving carriages for bass and treble, each equipped with 13 solenoid-actuated fingers. Both carriages travel along the keyboard using belt-driven stepper motors, with the complete mechanism housed in an enclosure that sits over the keyboard. See the robot in action: [RobotiNaction](media/A%24embLE.mp4)

<img alt="PLAYeRob0T" src="https://github.com/user-attachments/assets/33d714bd-311d-43ae-b081-542f01303aa9" />

## Overview

| Specification | Details |
|:---|:---|
| CAD Software | Autodesk Fusion 360 |
| Carriages | 2 — Bass & Treble |
| Fingers per carriage | 13 (7 white + 6 black) |
| Actuators | 26 × JF-1039(B) push/pull solenoids |
| Carriage motion | 2 × NEMA 17 stepper motors, belt-driven |
| Overall dimensions | 1676 × 215 × 123 mm (L × W × H) |

---

## Mechanical Design

### Finger Mechanisms

Separate solenoid-actuated mechanisms are designed for white and black piano keys.

<table>
  <tr>
    <td width="50%" align="center">
      <img src="https://github.com/user-attachments/assets/984368cc-4921-4092-8dd8-0e5f46bd26c5" alt="Exploded view of the white-key finger" width="100%" />
      <br>
      <strong>White-Key Finger</strong>
      <br>
      <sub>Exploded view of the white-key actuation mechanism.</sub>
    </td>
    <td width="50%" align="center">
      <img src="https://github.com/user-attachments/assets/a4b2f620-c3d3-45c2-8641-a7ff8294ab9a" alt="Exploded view of the black-key finger" width="100%" />
      <br>
      <strong>Black-Key Finger</strong>
      <br>
      <sub>Exploded view of the black-key actuation mechanism.</sub>
    </td>
  </tr>
</table>

### Carriage Assembly

Each moving carriage houses 13 solenoid fingers (7 white-key and 6 black-key actuators), allowing the robot to press different notes as the carriage moves along the keyboard.

<p align="center">
  <img src="https://github.com/user-attachments/assets/1675ab57-f4de-499c-b6e5-cb75f68fb6c9" alt="Exploded view of a robotic hand carriage" width="720" />
  <br>
  <sub>Exploded view of the carriage assembly and its solenoid finger arrangement.</sub>
</p>

---

## CAD Files

All CAD models are provided in STEP format.

| File | Description |
|:---|:---|
| `PLAYeRob0T(assembled).step` | Complete robot assembly |
| `C0taINerr.step` | Enclosure model |
| `parts/` | Individual mechanical components |
