// The manual: a short guide to every window, from a first song to playing it on the real robot.

import { type ReactNode, useState } from "react";

interface Chapter {
  id: string;
  title: string;
  body: ReactNode;
}

const CHAPTERS: Chapter[] = [
  {
    id: "about",
    title: "What it does",
    body: (
      <>
        <p>
          Vocal2Piano is a robot piano accompanist. A singer sings, and a robot sitting on a real keyboard plays the piano part along with them.
        </p>
        <p>
          The robot has two hands. Each hand is a carriage with 13 solenoid fingers (7 for white keys, 6 for black keys) and slides along the keyboard on a belt driven by a stepper motor. The left hand plays the low part and the right hand the high part. The hands always keep at least 5 white keys free between them.
        </p>
        <p>The site does all the planning. The whole path from a song to sound is:</p>
        <ol>
          <li>A song is opened or hummed in <b>Songs</b>.</li>
          <li>The key, speed, piano style and single notes are adjusted in <b>Rehearsal</b>, <b>Chords</b> and <b>My Voice</b>, and checked by ear on the computer's speakers.</li>
          <li>The site works out where each hand has to be and which finger plays each note. The <b>Robot</b> window shows how much of the song the robot can play.</li>
          <li>The robot is connected over USB and homed in the <b>Robot</b> window.</li>
          <li>
            <b>▶ Play</b> in Rehearsal sends the song to the robot as it plays. From here on the robot works on its own: the motors move the hands, and the solenoids strike the keys.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "start",
    title: "First song on the robot",
    body: (
      <>
        <p>The shortest path from opening the site to the robot playing a song:</p>
        <ol>
          <li>
            <b>Song.</b> In <b>Songs → Demo</b>, a click on any chord loop loads it. A MIDI file opens from <b>Songs → Song file</b>.
          </li>
          <li>
            <b>Listening first.</b> <b>▶ Play</b> in <b>Rehearsal</b> plays the song on the computer. The top view shows the two hands moving over the keyboard as the robot would.
          </li>
          <li>
            <b>Check.</b> The <b>Robot</b> window shows the playable share. 100 % means every note has a finger. The <b>Problems</b> tab lists anything the robot cannot play, and a click on a line jumps to that place in the song.
          </li>
          <li>
            <b>Power.</b> The robot's 12 V supply is switched on and its USB cable is plugged into the computer.
          </li>
          <li>
            <b>Connect.</b> <b>Robot → Connect…</b> opens the browser's port list; the Teensy is the entry to pick. The message log shows <code>V2P 1</code> when the robot answers.
          </li>
          <li>
            <b>Home.</b> With end stops wired, <b>Home</b> drives both hands to the ends of the keyboard. Without end stops, <b>Release motors</b> lets the hands slide freely; the left hand goes to the far left (finger W1 over the lowest A) and the right hand to the far right (finger W1 over the D near the top), then <b>Set home here</b>. The status line then reads <i>homed</i>.
          </li>
          <li>
            <b>Live.</b> <b>Play on the real robot</b> is ticked in the Robot window. The status bar in Rehearsal reads <i>Robot: live</i>.
          </li>
          <li>
            <b>Play.</b> <b>▶ Play</b> in Rehearsal. Both hands first travel to where the song starts, then the song plays. <b>❚❚ Pause</b> (or Space) releases every finger and stops the motors.
          </li>
        </ol>
        <p>
          Homing is needed once after the robot is switched on. It stays homed when the page is reloaded or reconnected, until it is switched off, <b>Release motors</b> is pressed, or it reports lost steps.
        </p>
      </>
    ),
  },
  {
    id: "songs",
    title: "Songs",
    body: (
      <>
        <p>Three ways to get a song:</p>
        <ul>
          <li>
            <b>Song file.</b> A MIDI file (<code>.mid</code>) or sheet music (<code>.musicxml</code>, <code>.mxl</code>). Each part in the file gets a role: <b>🎤 Me</b> (the singer sings it, the robot leaves it out), <b>🤖 Robot</b> (the robot plays it) or <b>Off</b>. A part named like a vocal or melody, with one note at a time, starts as <i>Me</i>; everything else starts as <i>Robot</i>. <b>I sing the top line of the piano</b> takes the highest notes of the piano part as the sung tune instead; it is off unless ticked.
          </li>
          <li>
            <b>Hum.</b> Four clicks count in, then the tune is hummed against the click. A lamp and a level meter show that the microphone hears the voice. <b>Done</b> turns the humming into notes, finds the key and picks chords for every half bar. The slider sets how closely the chords follow the tune: to the left, the most usual pop chord moves; to the right, chords that contain the sung notes.
          </li>
          <li>
            <b>Demo.</b> The most common chord loops in 739 Billboard hits. Local songs kept in <code>site/local/</code> appear under <i>My songs</i> when the site runs on the same computer.
          </li>
        </ul>
        <p>
          For hummed tunes and demos, the menus at the bottom pick the piano style (block chords, broken chords, Alberti bass, stride, bossa nova) and how many extra notes it adds (plain, pickups, ornate).
        </p>
      </>
    ),
  },
  {
    id: "voice",
    title: "My Voice",
    body: (
      <>
        <p>
          <b>Measure</b> records the singer going from their lowest comfortable note to their highest. The range is kept in this browser. The window then suggests a key change that puts the song's tune inside that range, and one click applies it.
        </p>
      </>
    ),
  },
  {
    id: "rehearsal",
    title: "Rehearsal",
    body: (
      <>
        <p>The main window. From left to right on the toolbar:</p>
        <ul>
          <li>
            <b>⏮</b> back to the start, <b>▶ Play</b> / <b>❚❚ Pause</b>, and the song clock.
          </li>
          <li>
            <b>Key</b> moves the whole song up or down in semitones. <b>Speed</b> plays it slower or faster. The robot plan follows both.
          </li>
          <li>
            <b>● Rec</b> records the singing along with the piano, until <b>■ Stop</b>. Afterwards the recording appears as its own track, and <b>How I Sang</b> shows how in tune and in time it was.
          </li>
          <li>
            <b>👂 Listen</b> makes the piano follow the singer: it waits for each entrance, stops when the singing stops, plays louder or softer with the voice, and moves to the key being sung. Each of these can be switched off in Settings.
          </li>
          <li>
            <b>Hear</b> chooses what plays on the speakers: the robot's version, or the original song.
          </li>
        </ul>
        <p>
          The top view shows the keyboard with the two hands (left in cyan, right in yellow) and the notes falling towards them. Below it is the timeline: the hands' positions over time, the piano notes, the sung tune (white outlines, with the pitch actually sung drawn on top), and the recording. Dragging the timeline scrubs through the song.
        </p>
        <p>
          <b>Changing one part.</b> Dragging across the bar numbers selects bars. The bar below the view then gives them their own speed, another piano style, or cuts them out. A cut bar keeps a ✂ mark on the ruler, and a click on it brings the bar back.
        </p>
        <p>
          <b>Changing one note.</b> A click on a note in the Piano track selects it. It can then be made shorter or longer, a quarter beat at a time, or left out (🔇 or the Delete key). Left-out notes stay as grey dashed outlines, and a click on one brings it back.
        </p>
      </>
    ),
  },
  {
    id: "chords",
    title: "Chords",
    body: (
      <>
        <p>
          For hummed tunes and demos. Every bar's chord can be changed, and each bar can be made louder or softer. An intro and a rolled final chord can be switched on. The piano part is rebuilt at once, and the robot plan with it.
        </p>
      </>
    ),
  },
  {
    id: "robot",
    title: "Robot",
    body: (
      <>
        <p>The numbers at the top describe the current plan:</p>
        <ul>
          <li>
            <b>playable</b>: the share of notes that have a finger. Notes out of reach of both hands move an octave (Settings), or are left out if that is switched off.
          </li>
          <li>
            <b>problems</b>: notes left out, moves that cannot finish in time, and similar. The <b>Problems</b> tab lists them with their times.
          </li>
          <li>
            <b>A</b>: the most solenoid current needed at one moment, against the 4 A the power supply allows. The robot skips any strike that would go over.
          </li>
        </ul>
        <p>The <b>Connect</b> tab:</p>
        <ul>
          <li>
            <b>Connect…</b> / <b>Disconnect</b>: the USB link. It needs Chrome or Edge.
          </li>
          <li>
            <b>Home</b>: both hands drive to their end stops, the left hand to the low end and the right hand to the high end.
          </li>
          <li>
            <b>Set home here</b>: takes the hands' current places as home, without moving. For a robot without end stops, after the hands were slid to the two ends by hand.
          </li>
          <li>
            <b>Release motors</b>: turns the motors off so the hands slide by hand. Homing is needed again afterwards.
          </li>
          <li>
            <b>Play on the real robot</b>: while ticked, ▶ Play in Rehearsal also plays on the robot. It can only be ticked once the robot is homed.
          </li>
          <li>The message log shows what the robot reports, including errors.</li>
        </ul>
        <p>
          <b>Save performance file…</b> writes the whole plan (start positions, every move and every strike, in milliseconds) as a JSON file, for playing without the site.
        </p>
        <p>The robot protects itself whatever the site sends:</p>
        <ul>
          <li>no finger stays on longer than 2 s;</li>
          <li>no more than 4 A of solenoid current at once;</li>
          <li>the hands never come closer than 5 free white keys;</li>
          <li>no move past either end of the keyboard;</li>
          <li>a pulled USB cable or a closed page stops everything.</li>
        </ul>
      </>
    ),
  },
  {
    id: "camera",
    title: "Camera",
    body: (
      <>
        <p>
          Shows a camera, at the same place and size as Rehearsal, so one screen recording catches both the site and the robot. <b>Mirror</b> flips the picture on screen only. <b>Rec</b> also saves the camera as a video file, with the microphone when <b>Sound</b> is ticked. Closing or minimizing the window stops the camera, and saves any recording in progress.
        </p>
      </>
    ),
  },
  {
    id: "settings",
    title: "Settings",
    body: (
      <>
        <ul>
          <li>
            <b>Color scheme</b>: the desktop colors.
          </li>
          <li>
            <b>Listening</b>: which of the three reactions 👂 Listen uses: waiting for the singer, following the singer's loudness, following the singer's key.
          </li>
          <li>
            <b>Left / right hand split</b>: notes below this go to the left hand, the rest to the right hand (C4 by default).
          </li>
          <li>
            <b>Most notes per hand</b>: big chords are thinned to this many notes, keeping the top and bottom ones.
          </li>
          <li>
            <b>Out-of-reach notes move an octave</b>: a note neither hand can reach moves up or down an octave instead of being left out.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "trouble",
    title: "When something is wrong",
    body: (
      <>
        <dl>
          <dt>Connect… shows no Teensy</dt>
          <dd>The USB cable is a charge-only cable, or the Teensy has no firmware yet (see firmware/README.md). Safari and Firefox have no USB support; Chrome or Edge does.</dd>
          <dt>Connected, but no V2P reply</dt>
          <dd>Another program (a serial monitor, a Python script) has the port open. Only one program can use it at a time.</dd>
          <dt>ERR no PCA9685 in the log</dt>
          <dd>A finger board did not answer at power-up: its cable, its 5 V, or the address jumper on the right-hand board. The robot has to be switched off and on again after fixing it.</dd>
          <dt>Play on the real robot cannot be ticked</dt>
          <dd>The robot is not homed yet: Home, or Set home here.</dd>
          <dt>ERR … lost steps; home again, or ERR carriages too close; home again</dt>
          <dd>A hand slipped or stalled, so the robot no longer knows where it is. It stops and needs homing again. Slower carriage speed in firmware/src/config.h helps if it keeps happening.</dd>
          <dt>Fingers hit the wrong keys</dt>
          <dd>The hands were not exactly at the two ends when Set home here was pressed. Release motors, slide them to the ends again, and Set home here.</dd>
          <dt>LATE in the log</dt>
          <dd>The computer was too busy to send in time (many tabs, a slow laptop). Notes up to 200 ms late are still played at once; later ones are skipped.</dd>
          <dt>A held note hums</dt>
          <dd>Notes held longer than 0.3 s switch to a lower holding power, which the coil makes audible. Short notes are silent.</dd>
        </dl>
      </>
    ),
  },
  {
    id: "keys",
    title: "Keyboard shortcuts",
    body: (
      <dl>
        <dt>Space</dt>
        <dd>Play / pause</dd>
        <dt>Home</dt>
        <dd>Back to the start</dd>
        <dt>Delete</dt>
        <dd>Leave the selected note out, or bring it back</dd>
        <dt>Esc</dt>
        <dd>Clear the selected bars or note</dd>
      </dl>
    ),
  },
];

export function ManualWindow() {
  const [id, setId] = useState(CHAPTERS[0].id);
  const chapter = CHAPTERS.find((c) => c.id === id)!;
  const i = CHAPTERS.indexOf(chapter);
  return (
    <div className="win-body manual">
      <ul className="manual-toc list sunken" role="tablist" aria-label="Chapters">
        {CHAPTERS.map((c, k) => (
          <li key={c.id} role="tab" aria-selected={c.id === id} className={`click ${c.id === id ? "sel" : ""}`} onClick={() => setId(c.id)}>
            {k + 1}. {c.title}
          </li>
        ))}
      </ul>
      <div className="manual-page">
        <article className="manual-text sunken">
          <h2>{chapter.title}</h2>
          {chapter.body}
        </article>
        <div className="row">
          <button className="btn" disabled={i === 0} onClick={() => setId(CHAPTERS[i - 1].id)}>
            ◀ Back
          </button>
          <span className="grow" />
          <button className="btn" disabled={i === CHAPTERS.length - 1} onClick={() => setId(CHAPTERS[i + 1].id)}>
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
}
