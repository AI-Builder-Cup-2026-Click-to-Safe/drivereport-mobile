# Standard native implementation

The active mobile UI follows `whyteaz/road-receipts-handover`, commit `25f5108`, `variants/standard` (last Standard change `4f60eb9`). Other design documents in this directory describe the previous Prototype implementation.

## Screen map

- Home: white canvas, Gemini spark, “Spotted an asshole?”, clip analysis primary action, recording secondary action.
- Clip: local file selection, saved recordings, explicit synthetic demo, thumbnail, analyse action.
- Analysis: footage, Upload/Watch/Law/Judge dots, rotating spark, rewritten caption, scan sweep, arriving findings.
- Cases: original evidence, plate and metadata, missing facts once, suspected offences, expandable reasoning/citations, visible location/description, editable details, original Gemini response.
- Impact: animated distinct-plate count, separate authority outcome, recurring plate filter, status filters, collapsed offence chart/date range.
- Settings: reporting details, region/language/motion, Developer access. Navigation contains Home/Cases/Impact only.

## Integration boundaries

Camera capture, continuous local recording chunks, file persistence, signed GCS upload and the existing review API are retained. No backend code or API contract changed. The live endpoint returns its review together, so intermediate Law/Judge states and streamed narration are not simulated for real footage. Token, frame and latency metrics absent from that response are not invented. Demo stages are explicitly marked synthetic.

Original model facts, reasoning and timestamped descriptions are stored separately from user changes. Older cases without a retained response say so. User changes do not replace the underlying demo image. A demo WhatsApp draft requires an explicit test recipient; live drafts retain their region recipient. Sent requires explicit confirmation and supports the existing eight-second undo.

## Motion

Native animations reproduce the authored entry staggers, 28px route transition, 2.4s spark rotation, 1.3s footage sweep, caption rise, 240ms finding staggers, count-up, growing offence bars, tab highlight and Sent pop/countdown. Reduced motion renders final states without animation; backgrounding stops decorative loops. Recording remains black with a clock and no decorative motion.

## Validation

Run `npm run typecheck`, `npm run lint`, and `npm test`. Simulator checks cover Home → clip → demo analysis → case, missing-fact editing, Gemini’s work, Impact filters/disclosures, Settings reduced motion and demo recording. A simulator does not validate a physical camera or WhatsApp delivery. Store/TestFlight builds require a separate release.

Verified on 2026-10-08: TypeScript and ESLint passed, all 27 tests passed, and an Xcode Release build was installed on iPhone 16 Pro / iOS 18.6 Simulator. The flows above were exercised through the simulator UI, including missing location → enabled draft action, user provenance after editing, Sent/date filters, and reduced-motion immediate Home rendering. Existing cases and saved recordings survived the app update. No real video was uploaded and no WhatsApp report was sent during this UI verification.
