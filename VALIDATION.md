# Road Receipts rebuild validation — 2026-10-05

This section describes the new app. The dated DriveReport results below are historical and do not establish that every new screen has been tested on Android or a physical phone.

## Build and automated checks

- Rebuilt native iOS development app after adding SVG, WebView, Device and DateTimePicker dependencies. Xcode build/install succeeded with zero errors and zero warnings.
- iPhone 16 Pro Simulator, iOS 18.6; Expo SDK 54, React Native 0.81.5, Node 22.
- TypeScript and ESLint passed. All 19 tests passed (12 retained domain/recording tests and seven new case, validation, reporting, impact, date-scope and GCP mapping tests).
- Expo Doctor: 18/18 checks passed.
- Handover source pinned at `3b64312`; its own structural validation and seven smoke groups passed before porting.

## Native Simulator flows observed

- Initial Home screen with supplied typography, copy and recording invitation.
- Home → black recording screen → End recording → analysis. Elapsed timer advances; Simulator recording is explicitly labelled as a demo with no camera capture. Status bar switches correctly between dark and light screens.
- Original Living intelligence graphic renders locally. Bridge diagnostics recorded all five stages as running in normal mode and paused in reduced-motion mode. The completed illustration visibly settles into the receipt/check composition.
- App Reduce motion preference persists while changing screens; progress and completion remain visible with decorative animation stopped.
- Analysis completion notice remains after returning Home. Opening a result restores the matching demo/live dataset before selecting its case.
- Review with missing location disables the WhatsApp action. Entering an explicitly synthetic location enables it. Excluding an offence preserves the user's description and shows the review reminder.
- Native incident-date picker opens and cancels without changing the case.
- Demo handoff reached locally by an app deep link: Mark report sent increases the local counter; Undo restores the prior status and counts. No external WhatsApp draft or report was sent during this test.
- Impact Today produces the expected empty state for older fixtures; All time restores the cases and independent counters.
- Switching off the demo dataset exposes migrated real evidence and its original server finding/citation. The original 12-second local video plays through native controls.
- Active Review tab can be retapped; navigation returns Home without losing the app state.

## Live AI retest through the rebuilt app — 2026-10-05

- Configured the existing development API credential in the Simulator's SecureStore. The temporary provisioning file was removed by the app; no credential was printed or committed.
- Added a development-only **Load 12-second test video** action for repeatable smoke testing. It imports the bundled real 1,766,147-byte MP4; **Analyse video** uses the normal authenticated upload/review flow and switches to the live dataset. No mock response or prior result was injected.
- New evidence ID: `DR-MUUTWDI5-8CF`; new case ID: `DR-MUUTWDI5-8CF-1`; local job `JOB-1791179364751`, mode `live`.
- Cloud Run access logs confirm `POST /v1/uploads` returned **200 OK** at `05:49:50.739 UTC` and `POST /v1/review` returned **200 OK** at `05:53:15.432 UTC`. The local job began at `05:49:24.751 UTC`: approximately **3 minutes 51 seconds** including cold start/upload, about **3 minutes 25 seconds** from upload-session response to final review response. This is one measured run, not a latency guarantee.
- The actual response reported **one suspected offence** involving a blue sedan, interval **00:01–00:07**, model confidence **0.95**, with four evidence-timeline entries and `follow_up_exhausted=false`. The conduct described unsafe inside overtaking/cutting across in a construction corridor. Its AI-cited legal basis was Road Transport Act 1987, Section 43(1); this test verifies response transport/display, not legal correctness or calibrated confidence.
- Native UI observed actual upload → server review → completed receipt animation → Review. Review shows the new finding and returned citation; the freshly imported original video plays through native controls.
- Unknown plate, incident date/time and location remain blank; report submission stays disabled until the user supplies required facts. The case remains `needs_info`, `confirmedByUser=false`, `provenance.isDemo=false`.
- Terminated and relaunched the app, then reopened Review. The same case ID, finding, citation and missing-fact state were restored. No WhatsApp message or authority report was sent.
- TypeScript and ESLint passed after adding the development sample loader. No backend source or deployment changes were needed.

## Implementation boundaries

- Native screens and SVG navigation are React Native; only the original Canvas illustration runs in a local, self-contained WebView. Decorative loops observe foreground/reduced-motion state and measured scroll visibility. Offscreen pause is implemented but not separately certified across screen sizes.
- A Simulator cannot verify the physical camera, long-drive storage/thermal behavior, audio interruptions, or segment gap duration. Camera recording is foreground-only and segmented, not claimed gapless.
- Demo animation stages are simulated. The existing synchronous live API provides only upload bytes and a final result; live intermediate stages are not invented. The initial UI pass used no new paid review; the subsequent live retest above performed one real cloud analysis.
- Android native execution was not repeated for this rebuild. Historical Android results below apply to the previous app.
- Face blurring, tracked annotations, authority outcomes, server-side cases and direct authority submission require backend capabilities that are not currently present. The new UI labels unavailable features and retains unknown outcomes.
- No backend source or deployment was changed as part of this rebuild.

---

# Integration validation — 2026-10-04

## Native builds

- iOS: `expo run:ios`, iPhone 16 Pro / iOS 18.6 — native build/install/launch passed, zero Xcode errors or warnings.
- Android: `expo run:android`, Pixel 6 Pro / API 34 — BUILD SUCCESSFUL, install/launch passed; MainActivity resumed; no ReactNativeJS or AndroidRuntime errors in logcat.
- TypeScript and ESLint passed. Expo Doctor: 18/18 checks passed.
- Domain tests: 7 passed (response validation, no-findings result, malformed response, draft metadata, per-vehicle selection, WhatsApp URL encoding, local filing state, HTTPS configuration).

## Live GCP flow

Server: `prototype-video-api` in project `aitech-good-s27493`, `us-central1`.

1. iOS app imported a real 12-second workspace video and copied it to its evidence directory.
2. Native binary upload to Cloud Storage completed after `/v1/uploads` returned HTTP 200.
3. `/v1/review` returned HTTP 200 in 173.07 seconds. The actual response had **no reportable findings** and three video timeline entries. The app displayed that result without inventing a violation.
4. Reloaded the app; the saved evidence and review reappeared in the dashboard.
5. Local development credentials moved into SecureStore; temporary provisioning files were removed. No token is included in source or app bundle.

6. Second native upload/review also returned HTTP 200 in 176.06 seconds. The actual response contained one finding for `blue_sedan`, confidence 0.95, clip interval 00:01–00:04, with legal references and four timeline entries.
7. Completed the evidence form using explicitly marked `TEST ONLY` metadata, generated a draft from the actual finding, edited its title, saved it and verified the edit in persistent storage.
8. The Copy message action displayed its success alert. Share video opened the native iOS share sheet with the actual 1.8 MB video; the sheet was dismissed without sending.
9. Reloaded again after editing: the dashboard showed two saved clips, one to review and zero reported. The History “To review” filter showed only the positive record.
10. Both records persist with `stage=ready`. The positive result has a saved draft and neither record is marked reported.

Native evidence IDs: `DR-MUTI43XV-ELD` (no findings), `DR-MUTIAYY1-GW3` (one finding).
The bundled sample now uses the latter footage segment (ID01, 56–68 seconds).

## Foreground dashcam update — 2026-10-04

- Removed the single 60-second session limit. A recording session now starts subsequent one-minute files while earlier files are persisted and reviewed.
- TypeScript and ESLint passed. All 12 tests passed, including five dashcam tests for rotation protection, storage bounds, sequential review selection, continuing across clips, and camera/storage failures.
- Relaunched the development app on iPhone 16 Pro / iOS 18.6 Simulator. Verified the updated capture screen, sample-footage preview, and a violation card populated from the existing real 95% confidence server finding. Fixed the modal safe-area layout to avoid the notch.
- Simulator preview is explicitly labeled and does not record or generate live findings. No additional cloud review was triggered during this UI check.
- Verified that Stop & review closes the preview and opens the corresponding persisted Evidence File.
- Physical multi-minute capture, interruption recovery, thermal behavior, and actual segment gap duration still require iPhone testing. The current camera API starts a new recording for each file, so gapless capture is not claimed.

## Scope limits

- Physical camera capture is implemented but cannot be established by iOS simulator testing.
- No real report was sent to an authority or another person.
- WhatsApp delivery and authority processing are not backend integrations. The app opens an editable draft and lets the user share the video separately.
- AI bounding boxes and live video inference are intentionally absent.
