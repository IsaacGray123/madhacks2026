# Companion implementation plan

## Character direction

Working name “Moss.” Treat the name as a proposal. The creature is a small rounded mint woodland character with dark eyes, two leaf-shaped ears, and a paper-colored belly. It holds a tiny notebook while studying. Its silhouette should read at 48 pixels on the LCD and about 100 pixels on a laptop.

The personality is attentive, patient, and quietly pleased when you return. The character should remain appealing during every activity. Phone use gets a curious nudge. Away time gets a peaceful waiting pose. A distracted state gets a glance and a small wave.

The proposed visual palette follows the existing interface. Use mint/teal around `#0f9d8a`, paper around `#f7f7f5`, and ink around `#1b2b35`. Existing report/activity colors retain their current meanings. A red phone state can use a small accent instead of recoloring the entire creature.

## Four moods

| Mood | Pose and motion | Reaction on entering | Behavior while held | Gentle copy |
|---|---|---|---|---|
| Studying | Notebook open, small breathing motion, occasional blink | Small pleased nod | Reads, blinks, adjusts the notebook occasionally | “I'm here.” |
| Away | Notebook closed beside it, sits comfortably | Looks toward the edge of the display | Slow breathing and an occasional glance | “See you soon.” |
| Distracted | Head tilted, one leaf ear lifted | Looks up and gives one small wave | Settles after the cue, then waits | “Ready when you are.” |
| Phone | Glances at a tiny phone-shaped prop, then toward the user | One curious head tilt | Waits without repeated shaking or flashing | “Shall we get back to it?” |

Each mood has a short transition and a loop. Returning to studying triggers a single warm nod or small wave, then the quiet study loop resumes. Keep a transition under roughly 400 ms. Initial proposal for blinks is an irregular 3–7-second interval, with occasional longer pauses. Those are animation choices rather than detected user measurements.

## State mapping

Use the laptop's fused `LiveStatus.current` so a distracting application and camera attention can both influence the companion. Rendering the raw board camera state alone would miss the existing screen-distraction classification.

There are exactly four behavioral moods. Paused, inactive, disconnected, and low-quality sensing are presentation conditions. They should change visibility or add a small status label instead of turning a missing sensor into a behavioral accusation.

- Studying maps to studying.
- Phone maps to phone.
- Distracted maps to distracted.
- Away maps to away.
- Eating and sleeping use the calm away/rest pose while the existing activity label still says what was classified.
- Idle hides the floating companion. The main app may show a static welcome preview.
- Paused uses a frozen calm pose with a visible Paused label.
- Disconnected or stale telemetry uses a calm pose with a Connection lost or Camera waiting label. The companion can still represent laptop-only screen activity if the UI explicitly identifies that mode.
- Pomodoro breaks and eye-rest reminders suppress attention nudges and use a calm rest presentation.

Reference selector for a proposed `app/src/shared/companion.ts` follows. This is implementation guidance, stored here for later integration.

```ts
import type { Activity, SessionStatus } from './types'

export type CompanionMood = 'studying' | 'away' | 'distracted' | 'phone'

export function selectCompanionMood(activity: Activity | null): CompanionMood {
  switch (activity) {
    case 'phone': return 'phone'
    case 'distracted': return 'distracted'
    case 'away':
    case 'eating':
    case 'sleeping': return 'away'
    default: return 'studying'
  }
}

export function companionPresentation(
  status: SessionStatus,
  activity: Activity | null,
  cameraHealthy: boolean,
) {
  return {
    visible: status !== 'idle',
    animate: status === 'running' && cameraHealthy,
    mood: cameraHealthy ? selectCompanionMood(activity) : 'away' as const,
    label: status === 'paused' ? 'Paused' : cameraHealthy ? null : 'Camera waiting',
  }
}
```

Before using this selector for a screen-only session, add an explicit sensing-mode input so camera health does not erase the laptop's valid screen-distraction state.

## Make it feel alive

- Keep a continuous idle loop independent of incoming telemetry. The animation should continue smoothly between state messages.
- Use a small randomized blink schedule stored in component state. Recomputing random values on every render would produce twitchy behavior.
- Give each mood at least three animation frames. A blink and a head tilt can be shared across frames when the asset format supports layers.
- Play an entry reaction once, then a slower loop. A new status message with the same mood must preserve the current animation phase.
- Add a short neutral transition when changing moods. Interrupt the transition if the session pauses or sensing becomes unavailable.
- Use small secondary motions such as leaf ears settling after a nod. Avoid constant jumping, sounds, and flashing.
- Show copy on a state transition or an explicit alert. Keep the study loop quiet.
- Respect the OS reduced-motion preference. Freeze the bounce and breathing movement while preserving clear mood artwork.

## Laptop delivery

Implement the in-app session creature first. Put it near the elapsed timer without shrinking the report or camera view. A single `Companion` component receives a mood and presentation flags, so it can later be reused by a floating window.

Proposed file work is listed below.

| File | Planned work |
|---|---|
| `app/src/shared/companion.ts` | Pure four-mood mapping and transitions |
| `app/src/renderer/src/components/Companion.tsx` | Sprite/image layers, quiet animations, reduced-motion support |
| `app/src/renderer/src/pages/SessionLive.tsx` | In-app placement and state wiring |
| `app/src/renderer/src/pages/Companion.tsx` | Optional floating-window route |
| `app/src/main/windows.ts` | Optional transparent window using the existing helper patterns |
| `app/src/renderer/src/App.tsx` | Route for the floating surface |
| `app/src/shared/types.ts` and `defaults.ts` | Nested companion settings with backward-compatible defaults |
| `app/src/renderer/src/pages/Settings.tsx` | Enabled, reduced motion, size, and position controls |

The first floating version can be about 160 by 180 CSS pixels. Anchor it to the lower corner of the active display's work area. Show it without taking keyboard focus, hide it on session end, and let the tray disable it. Position controls in Settings are sufficient for the first release.

Electron supports transparent windows and mouse-event forwarding. An always-visible creature must account for focus, display scaling, click-through behavior, and fullscreen applications. The existing edge bar and reminder windows provide useful local patterns. [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [custom window interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions)

For the fastest floating version, make the whole window click-through and move it using Settings. If dragging or a pet menu is added, enable pointer handling only within the creature's interactive region. Keep the pairing and SSH functionality in the main process. The companion renderer only receives sanitized status.

## LCD delivery

The MCU can animate its own creature independently of Linux inference. Start with a simplified 48-by-48-pixel version and redraw only its dirty rectangle. New commit `b9ec5eb` already reduces the session screen to four activity rows. Choose an intentional companion view rather than drawing over those existing rows.

Proposed touch behavior is a small, explicitly drawn view toggle that switches between the existing statistics view and a companion view. Companion view contains the creature, current activity, elapsed time, and the existing Pause/End controls. Keep reminder screens as the highest-priority UI. Touch hit boxes must come from the same layout constants used for drawing.

The four-mood mapping can reuse the existing laptop-to-board stats `current` field. The laptop already sends the fused current activity to the board. Extra per-frame bridge traffic is unnecessary for the mood itself.

Start with 4–6 LCD animation frames per second, scheduled using `millis()` with no long blocking delay. At 48 by 48 pixels, 16 bits per pixel, and a nominal 4-MHz SPI clock, raw pixel transfer alone has a lower bound around 9.2 ms per frame. CS toggles and drawing code add overhead. Measure actual redraw time and touch responsiveness before increasing the rate.

If the 48-pixel asset is too small on the physical screen, draw it at two-times scale in a 96-pixel region. The raw-transfer lower bound then grows to about 36.9 ms per frame. Start that version at a lower rate, around 2–3 frames/sec, and measure touch latency before choosing the final size. Laptop animation can remain much smoother because it uses the desktop renderer.

Three 48-by-48 RGB565 frames for four moods total 55,296 bytes, around 54 KiB, before metadata. A 16-color packed palette would reduce the raw frame indices to around 13.5 KiB, with additional decode work. Choose the simple format after confirming the sketch's compiled memory use. Store constant assets in the appropriate flash-backed representation for the UNO Q core.

Proposed sketch changes are a mood enum, a small asset renderer, an animation timer, a companion layout, and reminder/view arbitration. Keep the existing proven RPi 16-bit display transport. The code should never clear and repaint all 320 by 480 pixels for each blink.

Refactor stats handling into parse/update and render steps before adding the view toggle. The current `drawSession` combines parsing with the existing stats layout. Store one parsed session state, select the active view, and draw the relevant dirty regions. Otherwise the next one-second stats message could repaint rows over the creature. On entering a reminder, suspend creature redraw. On dismissal, restore the selected session view and reset its dirty-region cache.

## Artwork brief ready for production

Create a single reference illustration before generating or drawing animation variants. Keep silhouette, proportions, palette, lighting, camera angle, and ground position consistent. Request transparent PNG assets with generous padding. Export exact frame dimensions after review. A sprite sheet generator still needs inspection for alignment and missing frames.

Suggested art prompt follows.

> A small mint woodland study companion named Moss, rounded body, two leaf-like ears, dark expressive eyes, tiny paper-colored belly, warm and gentle personality, simple readable silhouette, front three-quarter view, soft flat illustration with restrained shading, transparent background. The character sits at the same ground level in every frame. Create four clearly distinguished poses for studying with a notebook, waiting calmly while the user is away, gently waving when distracted, and curiously tilting its head toward a small phone prop. Keep expressions supportive and suitable for a quiet study tool. No lettering or interface elements.

For pixel artwork, build a separate deliberate pixel version at the final size instead of downscaling a detailed illustration. Resolve laptop artwork before allocating LCD flash.

## Acceptance checks

1. Exercise all six existing activities and confirm exactly four mood outputs.
2. Pause, resume, close the main window, and end a session. The companion follows the session lifecycle.
3. Disconnect the board while studying. It shows a connection condition within the sensing-health timeout.
4. Keep the same activity for five minutes. The idle animation continues and entry reactions stay single-shot.
5. Alternate noisy inputs near a threshold. The creature avoids repeated mood changes within one second. Use a proposed 500–800-ms mood hold while keeping the explicit attention alert separately responsive.
6. Check Windows at 100% and 150% scaling and on a second monitor. Verify that it covers no action buttons and does not steal focus.
7. Check reduced motion and the hide control.
8. On the LCD, verify reminders, taps, and elapsed-time updates while the creature animates.

An estimated first in-app version is 45–75 minutes with simple reviewed assets. Floating-window polish and LCD layout work each need additional time. Use the physical bezel and laptop artwork as the first presentation milestone if the LCD implementation remains unfinished.
