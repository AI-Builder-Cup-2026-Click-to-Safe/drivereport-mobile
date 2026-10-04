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

## Scope limits

- Physical camera capture is implemented but cannot be established by iOS simulator testing.
- No real report was sent to an authority or another person.
- WhatsApp delivery and authority processing are not backend integrations. The app opens an editable draft and lets the user share the video separately.
- AI bounding boxes and live video inference are intentionally absent.
