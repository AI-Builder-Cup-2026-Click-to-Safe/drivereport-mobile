# Motion handover

The code and `assets/navigation/morph-geometry.json` provide exact geometry. Recreate these moments in the chosen platform; use the same state and interruption rules.

| Moment | Current timing / mechanism | Trigger and fallback |
| --- | --- | --- |
| Capture arrives entrance | Black brand-only first paint → additional 1s splash hold and 1.5× entrance timing → central aperture opens over 885ms starting at 1255ms → iris rim lands on the measured record disc at 2875ms → phrase/tagline reveal settles by 3670ms | First Home presentation and explicit Reset only. Native actions are available immediately. Input, resize, hidden/offscreen state or either reduced-motion preference settles to final Home; busy jobs and unsupported Web Animations API skip the entrance. |
| Home capture invitation | 4.2s disc breath with two restrained expanding outline rings | Idle invitation after entrance or ordinary Home return; pause hover/focus/disabled/hidden/offscreen. Static with reduced motion. |
| Bottom icons | 420ms matched-point interpolation; `cubic-bezier(.16,1,.3,1)` | Click/tap; labels and selection update immediately. Interrupted taps continue from the current pose. Retap active icon flexes then settles. |
| Page navigation | 280ms incoming scroll surface; opacity .58→1 and horizontal 24px→0 with existing state easing | Destination changes. Direction follows tab order or workflow forward/back intent; explicit Back reverses it. Header label fades for 160ms and footer for 180ms; chrome and glows stay anchored. |
| Previous/Next case | 220ms incoming case content; opacity .58→1 and horizontal 12px→0 | Previous enters from the left, Next from the right. Toolbar/live region stay still; selection, focus and announcement update immediately. |
| Analysis stage change | 180ms badge/check scale-and-opacity response and active-copy fade | Replace stage rows within the existing processing screen. Preserve Gemini/progress elements and scroll position; stage information updates immediately. |
| Status indicator | 280ms shared selection surface; 180ms result response | All / Needs you / Sent; keep focus, counts and geometry stable. Interrupt from current position. Reduced motion settles immediately. |
| Impact offence bars | 360ms left-origin `scaleX` response per bar; 28ms stagger capped at 84ms, maximum 444ms total | Page arrival starts from zero; date changes move from the previous real ratios. Counts and selected state update immediately. Static final ratios under either reduced-motion preference or missing motion capability. |
| Shared control feedback | 160ms background/text response | Hover/focus/press treatment without changing target geometry. Static state under reduced motion. |
| Settings disclosures | 180ms chevron rotation | Native open/closed state is immediate. Saving closes the disclosure and focuses its visible summary. Reduced motion retains the final pose. |
| File picker / case thumbnail | 180ms/2px upload-icon lift; 240ms/1.035× image scale | Hover or keyboard focus; fixed targets/containers. Decorative response is removed under reduced motion. |
| Newly reportable case | 180ms report-action opacity .55→1 | An incident edit makes required facts complete with an included offence. The action is enabled immediately; no animation repeats on ordinary typing in an already reportable case. |
| Notices / recipient dialog | 180ms toast fade/6px settle, 180ms completion fade, 180ms dialog fade/8px settle | Current state and focus remain immediate; toast/notice occupy normal layout space. Reduced motion or unavailable Web Animations API skips the effect. |
| Living intelligence | 72 Canvas points / at most 96 connections, 240ms exponential-follow time constant; CSS stage accents 650–1100ms | Intake → inspection → evidence/law clusters → receipt → complete. Retain one graphic through stages; exact Gemini mark stays steady. Hidden/offscreen pauses; reduced motion and unavailable Canvas show static stage geometry. |
| Intelligence completion | Field settles naturally or stops within 2.1s; receipt check appears over 650ms | Report completed, never Sent. Percent, five Done rows and Review report update immediately. |
| Review tracking/scrub | Synthetic static frame; UI time updates immediately; 140ms timecode fade on offence seek | Timestamp within 0.5s receives `aria-current="time"`; range value explicitly says simulated timeline. Replace with real video seek + time-aligned normalized track data; never infer tracks from animation. |
| Recording timer | Wall-time elapsed, 1s UI refresh | Timer/red dot stay clear; no timer live announcement or flashing red dot. |
| Repeat-plate selection | 160ms color transition plus result reveal | Clear/toggle selected filter without moving card geometry; respect reduced motion. |

## Icon forms

Home: house→camera. Review: document→receipt/check. Impact: clock→archive. Developer: code brackets→terminal. Idle/selected SVG exports are in `assets/navigation/`; point sets and closed/smooth flags are in the JSON. `navSymbol`, `navPose`, `geometryPath`, and `setupNavMorph` in `prototype/app.js` are the source. The prototype's internal key for Impact is `history`.

## Capture arrives lifecycle

On 5 October 2026 the user selected Capture arrives and requested a stronger black opening. With the subsequent approved rename, the phone surface first shows only the original shield-and-road logo from `assets/brand/click-to-safe-mark.svg` and exact **Click-to-Safe** name. The single-color mark uses three paths: a rounded protective shield, two converging road edges and a dashed center line. A circular hole then reveals the existing pastel Home from the screen center. The aperture stays open; only its outline and three iris arcs contract and travel to the actual 128px recording disc. The dark 42px core, exact headline, two tagline beats and Start recording label resolve around that landing. No second blackout or new page is introduced. The brand replacement changes no entrance timing, navigation morph or Gemini geometry.

The renderer/controller is shared by the main Home and the Capture arrives comparison preview through `window.RRHomeDirections.capture` in `prototype/app.js`. It uses finite SVG/Web Animations API effects and CSS for the 4.2s idle invitation, without Canvas or an added dependency. The brand cover, hole and iris are noninteractive decoration over the existing controls; the native recording button keeps its stable hit area and is never gated by the entrance. Headline/tagline accessibility names expose the complete approved copy throughout.

`setupHomeMotion` plays the full entrance once per page session and after explicit Reset. Ordinary return navigation keeps the existing 280ms page arrival and final Home composition. Busy analysis skips the entrance, disables recording and retains See analysis progress. Pointer/keyboard input, focus on an actionable control, resize, hidden/offscreen state and reduced motion cancel finite effects, remove the overlay and reveal the final composition immediately. The normal programmatic heading focus does not interrupt the first arrival. Idle motion pauses under hover/focus and resumes only when visible and motion is allowed.

Render replacement/page exit destroys the controller and disconnects its observers/listeners. A persisted page restore remounts the final Home without replaying the opening. Either OS or in-app reduced motion, missing Web Animations API or an animation error retains the readable final Home with an operable recording action. This entrance changes presentation only; capture and the analysis pipeline remain synthetic.

## Living intelligence lifecycle

The user selected this direction after reviewing all three working motion options on 4 October 2026. Its renderer/controller lives in `prototype/app.js`, with stage CSS in `prototype/styles.css`; the comparison reuses that same implementation. The analysis region is 230px tall, reduced to 210px on narrow screens. Canvas backing resolution is capped at DPR 2; the genuine Gemini geometry, Manrope and pastel tokens are unchanged.

`setupUploadMotion` mounts only the main analysis graphic. Stage updates reuse its Canvas/SVG, while the existing progress, focus and scroll behavior remain intact. Both OS/in-app reduced motion and hidden/offscreen state stop the RAF loop. Returning to a running job resumes at its current stage. Render replacement/page exit disconnects IntersectionObserver/ResizeObserver and cancels RAF. The static SVG field is the no-Canvas fallback; neither field nor simulated job timing supplies real evidence.

## Page continuity

Tab direction uses **Home → Review → Impact → Developer**. Moving forward introduces the incoming content from the right; moving back introduces it from the left. Settings and capture/analysis/reporting transitions use their workflow direction, with explicit Back actions overriding tab order. Only incoming content translates; header/footer changes use opacity .65→1 and the surrounding chrome remains in place.

New page/case/stage effects cancel on reset, screen replacement, hidden document or either reduced-motion preference. Unsupported Web Animations API falls back to immediate content. Neither animation nor a delayed WhatsApp handoff may postpone focus/state or override later navigation; a queued handoff opens only while its original Review case is still selected.

The journey refinements share this cancellation lifecycle for chart, timecode, report-action, notice and dialog entrances. Status motion checks Web Animations API and matrix support before animating; unsupported capability keeps the new selection immediate. Impact panels remain still and only actual bar ratios animate; numeric counters do not count through invented values. Removing dormant width transitions also resolves the earlier layout-transition finding, so its scoped suppression is removed.

Programmatic scrolling to errors, missing facts and filtered results uses the combined OS/app reduced-motion preference. Reduced motion uses immediate scroll positioning. Focus recovery checks visibility, disabled/hidden state and closed disclosures before choosing a retained target, related control or heading. A recovered target outside its scroll viewport is revealed to the nearest edge; an already visible target keeps scroll position. An Undo toast keeps its original eight-second deadline through rerenders; expiry recovers focus without extending the correction window.

## Authoring rules

- Keep motion within its component. The page-edge glow does not move.
- State updates are immediate; animation communicates the change rather than delaying it.
- Pause inactive/offscreen loops and cancel obsolete animation frames.
- Preserve stable hit targets, scroll position and focus when content rerenders.
- Test rapid repeated taps and navigation away mid-job.
- OS `prefers-reduced-motion` and in-app Reduce motion both stop decorative loops, morph interpolation and page/case/stage effects. Percent, stage labels, selected state and completion remain visible.

The prototype's job boundaries (3.2, 6.2, 8.2, 11 seconds) are demonstration pacing. They do not predict Gemini/backend latency. Read real upload/job state instead.

The page/case/stage pass passed twelve browser motion samples across 320×640, 390×844 and 1400×1100, rapid tab replacement, keyboard focus and in-app reduced motion. Analysis completion preserved footer focus; retained Gemini/progress DOM and cancellation/fallback behavior passed isolated Node VM checks. Evidence is separate from v9/v10 captures in `previews/motion-pass-2026-10-04/`. Final structural validation passed. Physical devices and browser OS preference emulation remain untested.

Delayed bar effects use backwards fill so each starting ratio remains visible throughout its stagger, avoiding a final-value flash. Retained Undo is hidden during Recording and restored if still valid on return, with the original deadline unchanged. OS reduced-motion rules take precedence over the final shared button styling.
