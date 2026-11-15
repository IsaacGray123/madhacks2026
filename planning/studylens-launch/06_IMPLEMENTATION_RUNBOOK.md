# Implementation and presentation runbook

## Execution order when you return

Work from a known functioning board/app combination. Confirm the current repository revision first because the inspected code already includes new attention and hand features beyond the earlier hardware setup.

| Order | Deliverable | Estimated effort | Evidence needed to continue |
|---|---|---|---|
| 1 | Freeze a working baseline and record a fallback | 15–25 min | Existing app, camera, report, and known connection work |
| 2 | Prepare board startup and a repeatable network | 15–30 min | Cold boot reaches camera ready |
| 3 | Automatic connection for the paired laptop | 30–60 min with an existing SSH key; longer for onboarding | Installed app reconnects after board restart without a terminal |
| 4 | Fast, gentle attention cue | 45–90 min | Fake-clock checks and a real look-away/return test |
| 5 | Companion in the active study experience | 45–90 min with reviewed simple assets | Four moods, pause/end, sensing-health behavior |
| 6 | Measure and tune camera schedule | 45–90 min | Before/after timing sheet with preview closed/open |
| 7 | Build and test the enclosure | 25–45 min | Stable touch, cable retention, ten-minute powered run |
| 8 | Package, rehearse, and freeze demo build | 30–45 min | Installed build and recovery recording both work |

These estimates overlap when a teammate handles physical assembly or rehearsal preparation. They do not assume that all items fit into one hour. If one person is implementing everything, prioritize the working demo and choose a cut line early.

## Baseline preservation

1. Record `git status` and the current commit. Preserve teammate edits.
2. Record the board App Lab app ID, image version, Python environments, and model checksums or filenames.
3. Verify actual laptop-to-board connectivity. Historical port-22 reachability does not prove today's Wi-Fi connection.
4. Save a short recording of the current known behavior. Store the recording locally for the demo.
5. Record the present settings, including camera preview, notification intervals, window behavior, and device connection address.
6. Keep the camera angle fixed for comparisons. Photograph the initial placement and wiring.

The current session owner and database remain the source of truth. A companion or connection manager should not create an independent session clock or duplicate reminder accounting.

## Suggested implementation batches

### Batch A — Connection and launch

- Add the connection controller around `DeviceLink`.
- Use a saved key for the first app-managed OpenSSH version if pairing is already available. Otherwise allocate time for the guided embedded-SSH route.
- Preserve legacy manual device settings and the mock-board connection.
- Give the user separate Board connected and Camera ready indicators.
- Verify the existing single-instance behavior and child/listener cleanup on quit.
- Configure default board startup and test without App Lab open on the laptop.
- Rebuild and test the installed app. Development success alone does not verify packaged launch behavior.

### Batch B — Camera feedback

- Add frame sequence and timing instrumentation.
- Add validity/source age to the relevant evidence.
- Implement a time-based attention gate with pause, snooze, break, and camera-health eligibility.
- Deliver the gentle cue on a transition instead of waiting for the session's next statistics tick.
- Preserve conservative session accounting and keep raw cue timing observable for tests.
- Fix stale slouch usage while touching that code path.

### Batch C — Creature

- Add pure mood mapping and a reusable rendered companion.
- Place it in the session view and confirm the visual design at small size.
- Add the floating window if it is part of the selected scope. The normal app minimizes on session start, so a creature confined to the main window would be hidden during normal use.
- Add pause/disconnected conditions and a hide control.
- Add the simplified LCD view only after its dirty-region drawing and touch behavior pass.

### Batch D — Performance and polish

- Test VIDEO tracking against current IMAGE calls using the pinned runtime.
- Apply one proposed performance preset at a time.
- Reduce preview encoding frequency independently of face analysis.
- Bound outgoing video work and expire stale secondary-model results.
- Run five-minute comparisons and preserve the setting with the best latency/accuracy tradeoff for the actual demo.
- Finish the stand, review the story, and record the new fallback once the build is frozen.

## Minimal checks per batch

| Area | Essential verification |
|---|---|
| State mapping | Every existing activity, inactive/paused session, screen-only mode, stale camera |
| Transport | Pair once, close/open app, occupied local port, board restart, network restart, lost SSH, quit cleanup |
| Attention | Dwell boundaries, brief glance, allowed note region, invalid data, duplicates, pause/break suppression, one cue per episode |
| Models | Existing Python 3.12 imports and model initialization, new VIDEO call timestamps, per-source TTL |
| Accounting | Segment durations, pause/resume, report correction, reminders through the connection |
| Physical screen | Pause/End/Done hit boxes, partial redraw, reminder priority, consistent rotation |
| Installed Windows app | Opens from shortcut, saved settings migrate, automatic transport works, tray remains accessible |

Write focused tests for new timing, transport lifecycle, and state precedence. Reuse the existing classifier and fusion tests. Avoid spending the remaining event time on tests that simply duplicate static artwork markup.

Check whether the optional `hand_landmarker.task` asset is actually installed before planning a gesture-only phone demonstration. The core three-model initialization test does not establish that the newer hand path is enabled on the board.

## Release steps

Use Node 20 or 22 LTS. The earlier installation required Electron's binary installer to be run with Node 22, and the app process needed `ELECTRON_RUN_AS_NODE` cleared. Check the active interpreter rather than assuming a terminal inherited the desired one.

In the laptop's `app` directory, the normal release commands are

```powershell
node --version
npm.cmd run typecheck
npm.cmd test
npm.cmd run dist:win
```

The existing installer target is NSIS, with output under `app/dist`. Verify the actual versioned filename before handing it to the presenter. Current build configuration uses Electron 33.2.0 and electron-builder 25.1.8. Match implementation/API decisions to those pinned versions. [NSIS documentation](https://www.electron.build/docs/nsis/)

After installing the release candidate, test from the desktop shortcut. Confirm that only one instance runs. If the development app is already open, the single-instance behavior can bring that process forward and make an installer test misleading. Deliberately stop the development session during the packaged-build test.

For a development launch after the code is ready

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm.cmd run dev
```

On the board, transfer the approved `board/` files into the actual App Lab app folder. Updating the laptop repository or GitHub alone does not update that copy. Verify `class BoardApp` in the mounted `python/main.py` if old diagnostic logs appear. Rerun camera environment setup only when needed for provisioning or a deliberate dependency change.

## Three rehearsals

### Rehearsal 1 — Current known build

Record the app/board start sequence, one visible phone action or controlled distracting window, return to studying, and report reveal. Record approximate latency and identify one action that can be repeated reliably.

### Rehearsal 2 — Frozen enhanced build

Use the intended stand, camera angle, Wi-Fi setup, installed app, and power supply. Let another person choose one of the two printed actions. Time the full three-minute script. Confirm that the creature remains readable and quiet.

### Rehearsal 3 — Recovery

Practice a missed detection or lost connection. Move to the clearly labeled recording without trying to repair the system in front of the judge. Open the sample report and continue the interaction. Restore the real connection afterward.

## Demo-day checks

Before the final build cutoff, verify the event's current submission and judging instructions. The published MadHacks schedule reviewed for this plan places hacking end/lunch at noon and project judging at 1 PM. The per-team pitch duration still needs organizer confirmation. [Official schedule](https://www.madhacks.io/)

- Charged laptop, powered hub, correct power supply, and the tested camera cable are present.
- The default board app starts without a development terminal.
- The installed app opens, pairs/reconnects as supported by the selected build, and shows camera health.
- The presenter knows the current board address or the paired hostname.
- The camera framing includes head, shoulders, and the phone demonstration area.
- Preview is configured for the measured performance profile.
- The app's session window behavior supports the live demonstration.
- Sample reports and recordings are clearly identified and already accessible.
- The report correction action is rehearsed.
- No experimental model training or dependency upgrade is introduced into the presentation build.
- The stand and wire retention pass a gentle tap/cable movement test.
- A teammate can explain the fallback and the architecture in one sentence each.

## Suggested division of labor

If both project teammates are available, one can own the app connection, cue, and companion implementation while the other handles the stand, board cold-boot checks, calibration recordings, and rehearsal capture. They meet at the installed-app integration test. Training experiments can follow after the presentation build is stable.

## Additional features worth a small investment

| Feature | Proposed scope | Benefit |
|---|---|---|
| Readable readiness | Distinct network, board app, camera, and calibration conditions | Makes launch failures understandable |
| Recalibrate | One action that collects a short valid baseline | Handles user/camera changes |
| Screen plus notes | Allow a calibrated down/side study zone | Reduces legitimate-study prompts |
| Gentle return | One quiet creature nod on recovery | Makes the feedback loop feel supportive |
| Snooze | A short explicit pause for attention prompts | Supports intentional off-screen work |
| Demo profile | Isolated sample history and visible simulated-data state | Protects real records and simplifies rehearsal |

Choose additions only after the main path passes. Each new visible control should solve a specific observed problem.

## Rollback plan

- Connection changes can be disabled through manual transport mode while retaining the existing tunnel command.
- The creature can be hidden without affecting session tracking.
- The faster preset can revert to measured baseline settings while preserving timing instrumentation.
- The fast attention cue can be disabled independently of report classification.
- A trained candidate stays in shadow mode until its held-out results and live behavior justify activation.
- Keep a known working installed build and board file snapshot available. Record which one produced the fallback recording.

## Work prepared in this package

The companion selector, SSH forwarding helper, attention timing gate, model-mode reference, training script, and lightweight inference example are stored as fenced reference code in the plans. They have integration assumptions described beside them. They are not installed application features. The pitch document contains eight slide specifications and exact speaker copy. All hardware cut dimensions require measurement of the real assembly.
