# Pitch, slides, and interactive demo

## Presentation premise

StudyLens helps a student notice observable interruptions, receive a gentle cue, and review what happened during a study session. The physical screen gives the project a tangible presence. The proposed creature makes that presence personal and memorable.

Use the live system as the central evidence. A clear report, a visible physical reaction, and an audience choice give judges several ways to understand it. Competition placement depends on the judging and competing projects. This plan is designed around a credible, rehearsable demonstration.

The official MadHacks page lists November 14–15, 2026, with project judging from 1:00–2:30 PM and finalist presentations in the closing session. The reviewed page does not specify the per-team pitch limit or a full judging rubric. Treat the three-minute version below as a prepared format and confirm the actual instructions with organizers. [MadHacks schedule](https://www.madhacks.io/)

## Story

Open with an ordinary moment. A student starts a session, answers a phone notification, glances away, and returns. The clock keeps running through all of it. StudyLens makes those observable moments visible and gives the student a way to return and reflect.

The user remains in charge. A reminder can be dismissed, a break can be taken, and a report segment can be corrected. A creature should feel like company during that process. Avoid presenting camera estimates as direct access to thoughts or as a measured productivity improvement.

## Slide deliverable

This is an eight-slide storyboard with exact copy and speaker notes. Six slides form the main three-minute pitch. Slides seven and eight support questions. It is a planning deliverable ready to lay out in PowerPoint, Google Slides, or the deck-authoring tool when production begins.

Use a 16:9 canvas, the app's paper/teal/ink palette, and Inter or the app's existing font. Main titles should be around 36–44 pt and body text around 24–28 pt. Use one visual idea per slide and actual app/hardware screenshots where specified. Show a screenshot at a readable size. Presentation timing should leave space for the audience to observe the physical screen.

### Slide 1 — StudyLens

On-slide copy

> StudyLens
>
> Camera-assisted study tracking and gentle reminders

Visual direction is a large real photo of the powered prototype beside the laptop, against a tidy desk. Leave enough empty space for the title. Add team names when confirmed. If a companion concept is shown before implementation, label it as a concept and place it in the roadmap slide instead.

Speaker notes, approximately 15 seconds

> “Picture a study session where you check your phone, drift away for a moment, and come back. The timer keeps running through all of it. We built StudyLens to make those moments visible while giving you a gentle way to return.”

Transition by pointing to the physical device. Keep the opening free of setup commands.

### Slide 2 — A study session, observed

On-slide copy

> Phone and presence cues
>
> Laptop activity
>
> A report you can correct

Visual direction is one actual session screenshot. Enlarge the activity label and elapsed timer enough for the room. The three lines can sit on the left with the screenshot on the right. A report correction will be demonstrated later.

Speaker notes, approximately 15 seconds

> “A camera on the UNO Q estimates physical behavior, and the laptop adds the active application. The desktop app owns the session, reminders, and report. You can correct a segment when the estimate misses the context.”

The privacy detail belongs on slide five. This slide introduces what the judge is about to see.

### Slide 3 — Choose an interruption

On-slide copy

> Choose one
>
> Pick up the phone
>
> Open a distracting page

If the faster look-away alert has passed rehearsal, replace the second choice with “Look away.” The selected choices should match features that work in the frozen presentation build.

Visual direction is a sparse slide that gives attention to the tabletop hardware. The presenter holds up a phone and a paper cue card for the two choices. The judge chooses while the calibrated presenter performs the action.

Speaker notes and actions, total 75 seconds

- Start a short session and sit in the calibrated position.
- Say, “Choose the interruption. I'll perform it here so you can watch the response.”
- Show a brief normal-study interval so the starting activity is clear.
- Perform the selected action in the camera's tested visible area. Hold a phone long enough for the current rule to settle. Use the measured reaction time from rehearsal rather than rushing it.
- Point to the actual on-screen activity and physical screen.
- If the creature is implemented, say, “The companion reacts to the same session state.” Let one reaction finish.
- Return to normal studying, then end the session.

The current code uses an eight-second side-look dwell. A new 2.5-second cue belongs in the demo only after testing. A distracting-window choice is a more controllable current-build fallback. Configure a specific browser title and keyword in advance.

### Slide 4 — Your session, explained

On-slide copy

> See when it happened
>
> Review the interruption
>
> Correct the context

Visual direction is the actual report shown live. If a sample report supports the explanation, add a visible “Sample session” caption. Enlarge one timeline segment rather than showing unreadable detail.

Speaker notes, approximately 30 seconds

> “Here is the session we just ran. The timeline shows the interruption and return. If I was using my phone as a calculator, I can correct that segment. The report gives me something specific to reflect on and keeps that context under my control.”

If the live session is too short for an interesting chart, first show its actual interruption, then open a clearly labeled sample session to illustrate the longer report layout. The existing demo-data action imports sample history. It should be used once during preparation, with the presenter aware of which records are generated.

### Slide 5 — Inside StudyLens

On-slide copy

> Camera analysis on UNO Q
>
> Laptop owns the session
>
> Touchscreen closes the loop

Visual direction is a simple editable three-part architecture diagram or a wide photo with the three parts labeled. Keep it to camera/UNO Q, local link/laptop, and touchscreen. Place Python 3.12/3.13 details in the backup slide.

Speaker notes, approximately 30 seconds

> “The camera models run on the board. The laptop combines their estimates with window activity and stores session history locally. The touchscreen shows status and accepts controls. Optional live preview travels to the laptop while enabled. Our connection setup supports the local network and the SSH path we verified on this prototype.”

Only describe automatic pairing/tunneling as working after it has passed the installed-build test. Local storage and optional preview follow the currently inspected source. Avoid the outdated claim that video never leaves the board.

### Slide 6 — A calmer study routine

On-slide copy

> Power the companion
>
> Open StudyLens
>
> Start your session

If automatic connection is still planned, title the slide “Next release” and add a small “Planned startup flow” caption. If the full flow is tested, present it as the demo's closing workflow.

Visual direction is the prototype in its finished cardboard stand beside the app, or the four mood concepts with a clear concept label. Keep a single closing visual.

Speaker notes, approximately 15 seconds

> “We want this to fit the way people actually study. A small companion, a gentle response when attention drifts, and a report you can understand. We are using what we measured today to improve recognition, responsiveness, and everyday setup.”

End by offering the judge the phone or cue card for another short test if time permits. Avoid adding a new feature list during the closing sentence.

### Slide 7 — Recognition and latency

Backup slide copy

> Measured baseline
>
> Capture → models → rules → feedback
>
> Next test uses faster attention cues

Use a table containing only actual benchmark results when available. For an unmeasured metric, write “Measurement pending.” Keep proposed 6-Hz processing and 2.5-second dwell visibly labeled as targets. Show one example of a false positive and the corresponding negative training example.

Speaker notes

> “The current classifier combines pretrained landmarks and objects with rules. We are measuring each stage so improvements target the actual bottleneck. Our training plan holds out whole recording sessions and checks false prompts per hour and event delay.”

This slide supports technical questions. It does not need a fabricated accuracy percentage or a model leaderboard comparison.

### Slide 8 — Engineering and next steps

Backup slide copy

> Reliable local connection
>
> Personalized calibration
>
> Four expressive companion moods

Speaker notes

> “We worked through runtime compatibility on the UNO Q, isolated inference in a tested Python 3.12 environment, and kept the Bridge in the App Lab runtime. The next usability work manages pairing and forwarding inside the desktop app. The next recognition work uses labeled examples from the actual camera setup.”

Use this slide to distinguish existing engineering from proposed experience work. Put verified project/source links in speaker notes when the deck is authored. Add a repository QR only after verifying the exact public URL and scanning the generated code from a phone.

## Three-minute pacing

| Clock | Slide/action | Duration |
|---|---|---|
| 0:00–0:15 | Opening story and device | 15 sec |
| 0:15–0:30 | What the system observes | 15 sec |
| 0:30–1:45 | Judge chooses, live action, return, stop | 75 sec |
| 1:45–2:15 | Actual report and one correction | 30 sec |
| 2:15–2:45 | Architecture and local processing | 30 sec |
| 2:45–3:00 | Closing workflow | 15 sec |

For a five-minute slot, add time for one look-away test, the physical Pause/Resume button, and questions. For a two-minute slot, combine slides one/two, perform one controlled action, show its report segment, and give a short architecture explanation.

## Interactive tabletop setup

- Place the screen in the stand beside the laptop, within easy tapping reach.
- Mount the camera centered on the laptop and keep its position fixed after calibration.
- Place a notebook, a phone, and two printed choice cards on the table. Keep unrelated windows and notifications closed.
- Have the judge choose the action. Keep the presenter in the calibrated seat so the test does not require onboarding a new person.
- If a judge wants to sit down, run the short calibration and explain the visible area before starting.
- Show a quiet return reaction. Recovery makes the companion feel responsive and reinforces the user-controlled tone.
- End the session while the judge watches. Show the timeline entry that corresponds to the action they chose.

## Two presentation tracks

### Current-build track

Use existing phone detection, active-window distraction, reminder handling, and report correction. Show the physical screen's current status interface. The creature, automatic pairing, and faster alerts are clearly described as proposed work when still unfinished.

### Enhanced-build track

Use the companion and fast cue only after the checks in their plans pass. Keep the same story and report reveal so the presentation still works if a visual enhancement needs to be disabled.

## Fallback ladder

1. Continue live if only optional camera preview is slow. Turn preview off and keep low-bandwidth activity messages.
2. If recognition misses the action after the rehearsed wait, show the result honestly and move to the prepared recording. Explain that it is a recorded run.
3. If the board or network fails, play a local 30–45-second recording showing the physical action, app label, and screen together.
4. Open a clearly labeled sample report for the correction interaction.
5. If a state-driven companion needs demonstrating independently, use the existing mock board and state explicitly that this is simulated input exercising the app's UI.

Existing mock-board preparation commands follow. These are optional development/demo fallback steps, not the normal installed-app launch.

```powershell
python -m pip install websockets
python tools/mock_board.py --fast
```

Set the demo app's manual device address to `127.0.0.1:8765`. In the mock terminal, enter `p` for phone, `s` for present, `a` for away, `l` for looking away, and `auto` to resume the script. Each command is followed by Enter. The current tool also accepts touch actions such as `start`, `pause`, `resume`, and `stop`. Optional mock camera preview needs OpenCV; state messages work without it.

Use a separate demo profile/database if implemented. Until then, choose sample records deliberately and restore the real board address afterward. Avoid deleting user history as part of rehearsal preparation.

## Rehearsal checklist

- Record the installed build version and board revision being demonstrated.
- Run the whole presentation three times with the intended power supply, camera, connection, and stand.
- Time phone recognition, look-away cue if enabled, and return to studying. Write the actual wait on the presenter cue sheet.
- Verify the chosen browser title matches a configured keyword. Test it before judging.
- Set the window behavior so the app stays visible during the demo. The current default minimizes it on session start.
- Close camera preview during the main test if it reduces responsiveness. Reopen briefly when explaining the camera view.
- Rehearse one complete failure transition to the local recording, including its spoken disclosure.
- Open the recording and sample report before judges arrive. Verify playback and screen scaling.
- Set the display brightness and audience-facing layout so text and the physical device are readable.
- Turn off unrelated OS notifications. Keep the demo's deliberate cues enabled.

## Questions to prepare for

| Judge question | Suggested answer |
|---|---|
| How accurate is it? | “We have tested model initialization and specific rule cases. We are collecting labeled sessions to measure event recall, false prompts, and delay. We can show the current failure cases.” |
| Does it know whether I am concentrating? | “It estimates visible behavior and combines it with app activity. The report supports correction because context matters.” |
| Does the camera upload my video? | “Inference runs on the board. Optional preview is sent locally to the paired laptop while requested. Session history is stored locally in this prototype.” |
| Why use the UNO Q? | “It gives us local camera analysis plus a physical touchscreen and MCU interaction. The desktop remains the session owner.” |
| What happens if the board disconnects? | “The app has a screen/idle fallback and reconnection behavior. The companion plan adds an explicit sensing-health condition.” |
| Why a creature? | “It gives the state a small visible personality and makes returning to study feel welcoming. We would evaluate whether people find it helpful or distracting.” |
| What did you train? | “The current system uses pretrained perception models with our behavior rules and calibration. Personalized behavior training is the next stage described in our plan.” |
| What is next? | “Automatic pairing, measured faster attention feedback, and a labeled evaluation set.” |

## Assets to collect when you return

1. One clean landscape photograph of the actual assembled device and laptop.
2. One readable real session screenshot and one report screenshot.
3. One 30–45-second local recording of the rehearsed action and response.
4. Four reviewed companion poses if the feature enters the presentation build.
5. One short text file with exact measured response times and build versions.

The storyboard supplies the narrative and copy now. The real screenshots, measured results, and final pitch duration determine the final deck layout.
