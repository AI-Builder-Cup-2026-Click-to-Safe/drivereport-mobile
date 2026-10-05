# Motion handover

The code and `assets/navigation/morph-geometry.json` provide exact geometry. Recreate these moments in the chosen platform; use the same state and interruption rules.

| Moment | Current timing / mechanism | Trigger and fallback |
| --- | --- | --- |
| Home capture disc | 3.2s breathing loop, localized to disc | Idle invitation; pause hover/focus/disabled/hidden/offscreen. Static with reduced motion. |
| Bottom icons | 420ms matched-point interpolation; `cubic-bezier(.16,1,.3,1)` | Click/tap; labels and selection update immediately. Interrupted taps continue from the current pose. Retap active icon flexes then settles. |
| Page navigation | 280ms incoming scroll surface; opacity .58→1 and horizontal 24px→0 with existing state easing | Destination changes. Direction follows tab order or workflow forward/back intent; explicit Back reverses it. Header label fades for 160ms and footer for 180ms; chrome and glows stay anchored. |
| Previous/Next case | 220ms incoming case content; opacity .58→1 and horizontal 12px→0 | Previous enters from the left, Next from the right. Toolbar/live region stay still; selection, focus and announcement update immediately. |
| Analysis stage change | 180ms badge/check scale-and-opacity response and active-copy fade | Replace stage rows within the existing processing screen. Preserve Gemini/progress elements and scroll position; stage information updates immediately. |
| Status indicator | 280ms shared selection surface; 180ms result response | All / Needs you / Sent; keep focus, counts and geometry stable. Interrupt from current position. Reduced motion settles immediately. |
| Living intelligence | 72 Canvas points / at most 96 connections, 240ms exponential-follow time constant; CSS stage accents 650–1100ms | Intake → inspection → evidence/law clusters → receipt → complete. Retain one graphic through stages; exact Gemini mark stays steady. Hidden/offscreen pauses; reduced motion and unavailable Canvas show static stage geometry. |
| Intelligence completion | Field settles naturally or stops within 2.1s; receipt check appears over 650ms | Report completed, never Sent. Percent, five Done rows and Review report update immediately. |
| Review tracking/scrub | Synthetic static frame; UI time updates | Replace with real video seek + time-aligned normalized track data; never infer tracks from animation. |
| Recording timer | Wall-time elapsed, 1s UI refresh | Timer/red dot stay clear; no timer live announcement or flashing red dot. |
| Repeat-plate selection | 160ms color transition plus result reveal | Clear/toggle selected filter without moving card geometry; respect reduced motion. |

## Icon forms

Home: house→camera. Review: document→receipt/check. Impact: clock→archive. Developer: code brackets→terminal. Idle/selected SVG exports are in `assets/navigation/`; point sets and closed/smooth flags are in the JSON. `navSymbol`, `navPose`, `geometryPath`, and `setupNavMorph` in `prototype/app.js` are the source. The prototype's internal key for Impact is `history`.

## Living intelligence lifecycle

The user selected this direction after reviewing all three working motion options on 4 October 2026. Its renderer/controller lives in `prototype/app.js`, with stage CSS in `prototype/styles.css`; the comparison reuses that same implementation. The analysis region is 230px tall, reduced to 210px on narrow screens. Canvas backing resolution is capped at DPR 2; the genuine Gemini geometry, Manrope and pastel tokens are unchanged.

`setupUploadMotion` mounts only the main analysis graphic. Stage updates reuse its Canvas/SVG, while the existing progress, focus and scroll behavior remain intact. Both OS/in-app reduced motion and hidden/offscreen state stop the RAF loop. Returning to a running job resumes at its current stage. Render replacement/page exit disconnects IntersectionObserver/ResizeObserver and cancels RAF. The static SVG field is the no-Canvas fallback; neither field nor simulated job timing supplies real evidence.

## Page continuity

Tab direction uses **Home → Review → Impact → Developer**. Moving forward introduces the incoming content from the right; moving back introduces it from the left. Settings and capture/analysis/reporting transitions use their workflow direction, with explicit Back actions overriding tab order. Only incoming content translates; header/footer changes use opacity .65→1 and the surrounding chrome remains in place.

New page/case/stage effects cancel on reset, screen replacement, hidden document or either reduced-motion preference. Unsupported Web Animations API falls back to immediate content. Neither animation nor a delayed WhatsApp handoff may postpone focus/state or override later navigation; a queued handoff opens only while its original Review case is still selected.

## Authoring rules

- Keep motion within its component. The page-edge glow does not move.
- State updates are immediate; animation communicates the change rather than delaying it.
- Pause inactive/offscreen loops and cancel obsolete animation frames.
- Preserve stable hit targets, scroll position and focus when content rerenders.
- Test rapid repeated taps and navigation away mid-job.
- OS `prefers-reduced-motion` and in-app Reduce motion both stop decorative loops, morph interpolation and page/case/stage effects. Percent, stage labels, selected state and completion remain visible.

The prototype's job boundaries (3.2, 6.2, 8.2, 11 seconds) are demonstration pacing. They do not predict Gemini/backend latency. Read real upload/job state instead.

The page/case/stage pass passed twelve browser motion samples across 320×640, 390×844 and 1400×1100, rapid tab replacement, keyboard focus and in-app reduced motion. Analysis completion preserved footer focus; retained Gemini/progress DOM and cancellation/fallback behavior passed isolated Node VM checks. Evidence is separate from v9/v10 captures in `previews/motion-pass-2026-10-04/`. Final structural validation passed. Physical devices and browser OS preference emulation remain untested.
