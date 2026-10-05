# Screen specifications

The modular prototype is authoritative for pixels, ordering and exact copy. Static captures are snapshots; run the prototype to inspect motion and interaction. Internal route names remain compatible with the original file.

All route changes give incoming scroll content a 280ms fade/horizontal 24px settle. Tab direction follows Home → Review → Impact → Developer; workflow forward/back direction and explicit Back actions determine other transitions. Header labels fade for 160ms and footers for 180ms, with chrome/glows anchored and destination focus/selection immediate. See `docs/MOTION.md` for interruption and fallback rules.

## Home (`home`)

The **Click-to-Safe** brand and clear Settings action are at top. The original single-color mark in `assets/brand/click-to-safe-mark.svg` uses a rounded shield around two converging road edges and a dashed center line: protection and a safer road in three paths. Keep the mark simple and use the existing text color; it replaces ScanLine only in app branding. Navigation icons, authored morph geometry and the genuine Gemini mark remain unchanged. No location text, case list or metrics. Approved headline/supporting line precede one large pastel Start recording control. Bottom navigation: Home / Review / Impact / Developer. Developer has an outlined idle icon.

The selected Capture arrives entrance begins with the phone entirely black except for the shield-and-road logo and exact **Click-to-Safe** name. A camera aperture opens from the screen center to reveal the existing pastel Home. Its rim and three iris arcs then contract and land on the measured record disc while the exact headline, tagline and control resolve dramatically. The circular opening remains open; the reveal does not close Home again. The splash holds for an additional 1s and all entrance durations/stagger delays are 1.5× their original values. The final composition settles by 3670ms and the disc/two outline rings then use a restrained 4.2s invitation.

Play the complete entrance on first Home presentation and explicit Reset. Ordinary returns retain the quick page transition without another black opening. The native Start recording action is available throughout, with a stable hit target; pointer/keyboard interaction or actionable focus settles the composition immediately. Resize, hidden/offscreen state or either reduced-motion preference also removes the entrance. Reduced motion and missing Web Animations API show the final Home immediately. Idle motion pauses on hover, focus, disabled, offscreen and hidden states; it is static with reduced motion. The black brand opening is the user's explicit transient exception to Home's pastel treatment, not a replacement theme.

Starting while a job is busy is disabled or clearly rejected; See analysis progress appears for the active job. Capture in the shipped prototype creates no real media. Actual capture failure/permission states are an implementation task and must preserve the quiet Home hierarchy.

## Developer options (`developer`)

Judge guidance, video picker, chosen-file state, Analyse video action, then base URL and access token. Small daylight footage is encouraged. Accept MP4/MOV/WebM, `0 < bytes <= 300000000`. Show empty, oversized or unsupported-extension errors with recovery. Remove/replace the chosen file. Token starts masked, with an explicit persistent input label and a separate accessible reveal button. The video picker has matching hover/focus feedback. Check URL validates syntax only in the prototype; it performs no network request. Demo footage is a named synthetic shortcut, not a real bundled MP4.

The picker icon lifts 2px on hover/keyboard focus over 180ms without moving its hit target. Removing a selected file returns focus to Choose video. Either reduced-motion preference removes the lift.

Real integration: authenticate to the app API, upload bytes, track progress and allow retry. Never put a Gemini provider secret in the frontend. Account for capture-created files as well as manual uploads.

## Recording (`recording`)

Solid black. Timer centered at top with an 8px red indicator; duration derives from elapsed wall time, including long recordings. Middle reassurance: Don’t worry. / I’ve got your back. Single End recording CTA. No live video preview, navigation bar or extra action. Preserve accessible focus/contrast and do not turn the static dot into an attention-grabbing flash.

Stopping creates/uploads a real file in implementation. The prototype supplies a synthetic 2.8 MB descriptor and starts its simulated pipeline. Camera interruptions and unsupported platforms need explicit recovery, without claiming that a recording was saved.

## Analysing (`processing`)

Footage → prominent steady Gemini mark/name → evidence/report graphic. No file name or file metadata, no agent-demo caption, no decorative dividers. Progress and five stages are meaningful; completion has a persistent Review report action and centered footer note. The user can leave while processing; completion remains available in-app until reviewed.

The user-selected Living intelligence composition uses a bounded evidence field: intake stream → Gemini inspection → evidence/law clusters → receipt assembly → settled completion. The exact Gemini mark remains steady, with its name centered below. Reduced motion or unavailable Canvas preserves static stage geometry; hidden/offscreen state pauses rendering and navigation disposes its resources. The field is illustration, not live inference or a law/result feed.

Stages have a 48px minimum height with 6px vertical padding. Inactive Done/Next labels sit beside their titles; the active explanation remains below its title. Completion notices use their own layout space before footer/navigation so actions stay accessible.

Stage changes update rows in the existing screen with 180ms badge/check and active-copy feedback. Gemini/progress elements and scroll position persist across stages; focus, stage labels and announcements do not wait for animation.

Stage IDs in the proposed API: `upload`, `gemini_video`, `rag_law`, `compile_report`, `completed`. Keep stage order. Actual transfer progress should drive upload percent; job progress/stages drive later state. Time-based progress and 11-second boundaries are demo-only. Failed/cancelled/retryable states must come from the API.

## Review case (`review`)

Case ID/jurisdiction, previous/next case controls, headline, missing-field summary, annotated evidence player, suspected offences and inline incident fields. Unclear footage is informative; no evidence-approval checkbox. Individual offence inclusion checkboxes remain and determine report content. Time buttons seek to relevant evidence.

Required fields: vehicle plate, vehicle type, incident date, time, location and description. Vehicle model is optional. Display unidentified fields with warm highlighting and inline hint. Tap fields directly; no pencil icon. Native date/time inputs remain editable/picker-capable, with calendar/clock chrome hidden. No duplicate date below the input. Sent cases are read-only. Previous/Next announces the selected case and preserves control focus.

Previous/Next introduces case content with a 220ms fade/12px horizontal settle. Toolbar/live region stay still and selection, retained focus and announcement update immediately.

The description expands as text is edited or rewrapped, avoiding a second scroll region inside Review. Known editable facts, Previous/Next and offence-inclusion controls have quiet, stable hover/focus feedback; missing-field emphasis remains distinct. The dark evidence controls have visible mint keyboard focus, and the scrub input provides a 44px-high hit area.

The offence timestamp within 0.5s of the simulated seek time has a modest sage surface, stronger underline and `aria-current="time"`. Seeking updates the time immediately with a 140ms timecode fade; the range's accessible value explicitly identifies a simulated timeline. Excluded offence titles become muted without altering inclusion state or evidence. Focused fact labels use sage, with warm missing-field labels retained.

Report CTA is enabled when required data is complete and at least one offence is included. Reporter personal details and confidence flags do not block it. The case-region recipient must be configured; otherwise collect that number, then open WhatsApp. Complete configured cases go directly to a prefilled WhatsApp draft. There is no preview screen.

Completing the required facts gives the newly enabled report action a 180ms fade; availability changes immediately. An unconfigured-recipient dialog uses its visible regional heading as the accessible name and enters over 180ms/8px without delaying focus or input.

A clean result shows no suspected offence and Back to Impact. Missing cases offer Start recording. Preserve the user's custom description if offence inclusion changes and ask for a review of it without erasing it.

## WhatsApp handoff (`handoff`)

Opening the draft sets `opened`, not `sent`. The user confirms sending or returns to review. Explicit confirmation sets Sent and returns to Impact. Eight-second Undo restores the prior status; Sent review also offers Mark as not sent indefinitely. Do not claim delivery or an authority response.

Undo occupies its own normal layout space before the footer/navigation and retains its original eight-second deadline across rerenders and navigation. Expiry returns focus from Undo to a visible report action or selected navigation control. Mark as not sent returns focus to the available reporting action.

Group Mark report sent / Not sent yet toward the bottom of the scroll region, with the existing delivery note centered beneath them.

A delayed WhatsApp handoff may open only while the user remains on its original Review case. Later navigation takes precedence.

## Impact (`history`, public name `Impact`)

“Your impact. Their problem.” Two prominent outlined pastel counters, then the repeat-plate card, expanded offence chart, combined filter/results area and divider-free thumbnail list. All/Needs you/Sent share one animated indicator. Status is colored literal text without pills.

The repeat card has no Most spotted label. Plate is 24px (20px narrow); sighting numeral is 22px. Clicking it toggles a normalized plate filter, resets offence/status to All when enabling, reveals results and focuses the visible clear-filter control. Case/status counts in the result area reflect both plate and offence scopes. Date scope also applies. Clear plate preserves other selections; Clear filters removes plate/offence/status selections and retains date range.

By offence and date selector share one row. Four bars: Red light, Queue cutting, Road rage, Counter traffic flow. Selected fill/check are visible but restrained; row padding/margins do not change. Selecting an offence reveals matching results. The chart never collapses. Unknown/legacy offences remain viewable in cases.

Offence bars reveal their real ratios with left-origin `scaleX`, 360ms per bar and 28ms staggers capped at 84ms. Arrival begins at zero; date changes transition from the prior ratios. Numeric counts update immediately and the outlined impact panels stay still. Either reduced-motion preference or unavailable Web Animations API shows final ratios immediately. Clearing plate/offence/all filters returns focus to the corresponding visible filter control.

Metric definitions are in PRODUCT.md. Demo Today/Last 7 days are anchored to **3 October 2026**, deliberately matching the supplied fixtures. Actual app periods must use the region/user timezone and the current clock. Do not ship the frozen date.

Hover and selected rows retain geometry. Trailing footage thumbnail is 80×60px (66×54px narrow), with a duration label. Cases include AI-returned clean results. Needs you includes ready, needs_info and opened; Sent contains only user-confirmed sent cases.

Thumbnail imagery responds with a bounded 1.035× scale over 240ms on row hover/keyboard focus; the row and thumbnail container keep their geometry. Reduced motion removes this decorative response.

## Settings (`settings`)

Authority WhatsApp with a regional recipient and editable override. Optional user details and inclusion toggle. Region MY/SG/JP; English UK/US formatting; Reduce motion; footage retention/blur preferences. The prototype remembers these only until reset/reload and does not save/blur media. Reporter details may remain empty for completion in WhatsApp.

Disclosure and preference controls share the restrained hover/focus feedback used elsewhere, without changing row geometry. Opening Settings focuses its heading to announce the destination to keyboard users.

Settings disclosure chevrons rotate over 180ms. Saving recipient or personal details closes the relevant disclosure and returns focus to its visible summary. Hidden controls are never retained as the keyboard destination. Reduced motion preserves the final open/closed pose without interpolation.

Changing preference region must not redirect an existing case to another jurisdiction. Returning to a prior region restores its independent override. MY defaults to the supplied demo number, SG/JP are unconfigured. Mask credentials elsewhere; avoid storing sensitive reporter data unless a deliberate persistence design is implemented.

## Responsive and accessibility behavior

Phone reference is 390×844; mobile is fluid at ≤760px. Narrow adjustments apply at ≤350px. Maintain a single scroll region and reachable bottom actions. Desktop studio/sidebar is a review harness, not a required desktop product dashboard. A real app uses platform safe areas rather than the preview's fake status bar.

Every input has a persistent label. Tappable/icon actions have accessible names, at least 44px targets where authored, visible focus and immediate selected state. Completion/missing facts announce through status regions; the elapsed timer does not announce every second. Both OS and app reduced motion preserve information and stop decorative movement.

Persistent completion notices sit in normal layout flow before the footer/navigation and reserve their own space. Upload/inline-fact transitions also respect both reduced-motion preferences.

Shared controls use 160ms color feedback. Toasts enter over 180ms/6px, completion notices fade over 180ms, and both reserve their own space. Dismissing a focused notice or losing a control during rerender restores a visible relevant action, summary or heading. Programmatic error, missing-fact and filter-result scrolling uses smooth motion only when both OS and app preferences allow it.

Recovered focus targets inside the main scroll region are revealed to the nearest edge only if their bounds fall outside that region. Already visible controls retain the current scroll position. This also applies when the clear-plate filter first appears after selecting the recurring card.

Page/case/stage motion cancels on reset, screen replacement, hidden document or either reduced-motion preference; unsupported Web Animations API uses immediate state. Navigation-motion verification passed browser direction, interruption, keyboard focus and in-app reduced-motion checks. Isolated Node VM checks covered cancellation/fallbacks and retained analysis elements. The v11 evidence is in `previews/motion-pass-2026-10-04/`, separate from the prior static design pass; physical devices and OS preference emulation remain untested.

An actionable Undo retains its original deadline through navigation and rerenders. It is hidden while Recording keeps only End recording, and is shown again on other screens if still valid; no timer extension occurs. Delayed chart bars hold their starting transform throughout the stagger.
