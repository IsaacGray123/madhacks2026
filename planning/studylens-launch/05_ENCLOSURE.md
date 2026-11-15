# Cute enclosure without 3D printing

## Recommended build

Make a small paper-and-foam-board desktop stand that resembles the creature's home. The portrait LCD is the front, a shallow open rear supports the board, and a mint bezel with two paper leaf ears supplies the character. A broad base hides the cable bundle and makes the screen stable when tapped.

Use existing materials first. Exact dimensions depend on your particular display PCB, pin-header position, cable bends, and board. Measure those pieces before cutting. The 320-by-480 pixel resolution does not determine the physical cutout size.

Adafruit has documented cardboard enclosures for working electronics, including a camera/ML project. These are useful construction references. [Cardboard enclosure guide](https://learn.adafruit.com/cardboard-box-for-circuit-playground-express), [camera project case](https://learn.adafruit.com/lobe-trash-classifier-machine-learning/optional-build-it-case)

## Options

All budgets and build times below are rough planning estimates in US dollars, using inexpensive supplies or items already on hand. Stock, exact prices, and fit have not been confirmed.

| Option | Appearance | Estimated build time | Estimated supplies | Why choose it |
|---|---|---|---|
| Foam-board A-frame with paper bezel | Small mint study creature on a desk | 25–45 min | About $5–15 | Custom shape, clean front, broad stable base |
| Existing phone stand plus cardboard backplate | Compact upright screen with removable ears | 10–20 min | About $0–15 | Fastest if a suitable stand is already available |
| Small gift box with removable lid/front | Creature's little study nook | 25–40 min | About $0–12 | Hides wiring and gives a finished silhouette |

A phone/tablet stand such as IKEA's BERGENES is an example of the off-the-shelf support idea. Check the groove and tilt against a protective backplate and the actual LCD. Local availability and same-day pickup have not been established. [Manufacturer example](https://www.ikea.com/us/en/p/bergenes-holder-for-mobile-phone-tablet-bamboo-10457999/)

The foam-board build is the recommendation because a ruler, craft knife/scissors, tape, and cardboard are often easier to obtain at an event than a correctly sized commercial enclosure. Laser cutting is an optional route if trained access is immediately available. It introduces facility, material, and queue dependencies. A hand-cut version is sufficient for this design. UW's nodeLab documents local laser-cutting work, including cardboard, but Sunday access and training eligibility were not verified. [UW nodeLab](https://nodelab.art.wisc.edu/laser-cutting-engraving)

## Materials for the A-frame

- Corrugated cardboard or about 5-mm foam board for front, rear support, and base.
- Mint/cream cardstock, colored paper, or a printed paper wrap.
- Ruler, pencil, scissors, and a craft knife with a cutting surface if available.
- Double-sided mounting tape or removable hook-and-loop pads.
- Nylon spacers or small nonconductive mounting blocks sized for the PCB's mounting holes.
- Small cable ties, hook-and-loop straps, or paper/tape cable saddles.
- Paper for two leaf ears and a small StudyLens label.
- Optional rubber feet or a nonslip pad under the base.

Use the working hub, power supply, camera, and existing proven wiring. Put the cosmetic effort into the outer structure. Changing the display wiring immediately before a demo adds avoidable debugging work.

## Measurement sheet

Record these before cutting.

| Measurement | What to measure |
|---|---|
| Display PCB width and height | Entire board including protruding connectors |
| Visible touch/display area | Actual active rectangular area |
| Mounting holes | Centers, hole sizes, and distance from edges |
| Header clearance | Space behind the connector plus a relaxed jumper-wire bend |
| UNO Q footprint | Board, connectors, and access for the powered hub |
| Cable direction | Exit route for power and USB camera |
| Viewing angle | Comfortable angle while sitting at the laptop |
| Front frame overlap | Enough to retain the protective backplate without covering the active touch area |

Use a paper mockup first. A useful starting front-panel margin is about 8–12 mm outside the LCD PCB outline, adjusted for the header and mount. Start with a base depth roughly 0.7–1 times the front-panel height and test stability by tapping. These are starting proportions, not final measured dimensions.

## Assembly sequence

1. Photograph the working wiring and label the display and touch connectors. Power down before mounting the hardware.
2. Trace the display PCB on paper. Mark the active screen, header, and holes. Cut the paper mockup and test the fit.
3. Cut a front frame using that mockup. The active display and touch region remain fully accessible. Keep the touch edges free of paper overhang.
4. Cut a backplate that supports the display PCB using its mounting holes or designated board edges. Use nonconductive spacers so solder joints and exposed pads have clearance.
5. Attach the front frame to the backplate. The frame carries its own weight rather than pressing on the glass.
6. Add a rear support and a broad base. A folded triangular brace can set the viewing angle. Add a second brace if taps make the front flex.
7. Mount the UNO Q on a separate rear support area using nonconductive spacers. Leave an open path around the processor and connectors. Keep inspection and cable access easy.
8. Route the jumper bundle with a small slack loop at each connector. Anchor the bundle to the structure so moving a power cable cannot pull a signal wire.
9. Route the USB hub and power cable through a side or rear opening. Strain-relieve the heavy cables near the base.
10. Add the paper wrap, two leaf ears, and the small label. Keep decorations away from the active touch surface and camera lens.
11. Apply nonslip feet. Power on, test touch controls, then gently move each external cable to confirm it cannot loosen the display wiring.
12. Run the complete demo for ten minutes in the finished enclosure, checking stability, heat buildup, camera connection, and display operation.

An open rear is a deliberate first design. It permits airflow and debugging while the front still looks finished. Use a removable flap if hiding the wiring for a photograph is important. Confirm temperature and connector access with that flap in place before a live demo.

## Electrical and mechanical details

- Keep exposed solder points clear of conductive objects, metallic tape, and metal fasteners. Black antistatic foam can be conductive, so choose ordinary nonconductive mounting materials with appropriate spacers.
- Add a cable saddle to the enclosure. Avoid putting adhesive into connectors or directly on hot components.
- Keep the jumper runs short and reuse the wiring arrangement that already drives the panel reliably.
- Keep the power hub and ports accessible. The existing board guide calls for the powered USB-C hub arrangement because the camera and screen add load.
- Retain the correct display orientation. Current `ROTATION 0` expects the header at the top. If physical orientation changes, verify display and touch calibration together.
- Check that a tap near Pause or End cannot tip the stand. Increase the base depth or add a low rear weight isolated from electronics if needed.

These details address the actual exposed-board and jumper-cable assembly. They are part of making the demo robust, as well as making it attractive.

## Visual direction

Use the same creature palette and leaf-ear shape as the laptop companion. Add one small notebook-shaped paper detail on the base. Keep the front uncluttered so the LCD remains the focus.

Two variations are ready to choose from.

- A woodland desk buddy uses mint and cream, rounded paper corners, two leaf ears, and a small paper plant beside the display.
- A tiny study nook uses a cream gift box, a mint roof/backplate, and a notebook or pencil detail. Keep the camera in its calibrated laptop position.

The woodland desk buddy is the faster route. A simple blank face on the paper bezel would compete with the LCD's creature, so keep the bezel decorative and let the screen provide expression.

## 15-minute fallback

1. Attach the LCD to a stiff cardboard backplate using its mounting points and spacers.
2. Secure that backplate to an existing phone/book stand.
3. Mount the UNO Q behind or beside it on an insulating support.
4. Bundle and anchor the jumper wires.
5. Add a mint paper frame and two leaf ears.
6. Test power, touch, and a gentle cable tug before moving it to the presentation table.

## Acceptance checks

- Every touch button is reachable, with no bezel over the active area.
- The screen remains stable during repeated taps at all four corners.
- The wire bundle stays retained when the external power cable moves.
- The camera sees the same calibrated framing as before mounting.
- The board runs through a ten-minute demo with the intended power supply and cable layout.
- The assembly can be picked up from its base without lifting a PCB or cable.
- Power and the USB hub remain reachable for recovery.
- A judge facing the table can identify the screen and creature immediately.
