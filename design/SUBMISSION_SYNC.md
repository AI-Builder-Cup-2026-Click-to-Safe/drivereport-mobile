# Hackathon Submission native sync — 2026-10-08

Source: [whyteaz/road-receipts-handover, 9b9f293](https://github.com/whyteaz/road-receipts-handover/tree/9b9f293/variants/hackathon-submission), “New optimised based on judging”. This adds a new variant; Standard itself did not change. The mobile branch remains `feat/standard-design`.

## Implemented

- Home copy and eleven JAPAC statistics, rolling digits, wiping country names and stable screen-reader sentence.
- Preloaded sample, Upload / Watch / Law / Judge, staged findings, law, points stamp, sample estimate counter and retained actual API progress behavior.
- Two pending samples from first launch: readable WXY 2048 and glare-obscured plate. Cases navigation omits sent cases; analysing again refreshes a waiting sample. Inputs appear for missing facts; other edits use one disclosure. The original evidence remains unchanged by typed plate edits.
- New four-offence taxonomy, official law links from the reference, optional demerit points and sample licence record.
- Recipientless submission-sample WhatsApp drafts, explicit user confirmation, printed receipt with serrated edge, Reported stamp, striped potential-points meter, and an eight-second Undo starting on See your impact.
- Impact counter cards, black top-offender meter, open offence chart, period/status filters and staggered case rows.
- Native stack slides on deeper routes, tab cross-fades, 72-point authored icon morphs, rewind needle, stretching sliding pill, action press feedback and reduced-motion final states. Geometry in `submission/nav-geometry.json` was sampled from this pinned reference's SVG paths.

## Integration boundaries

The original visual sync changed no backend source, deployment, authentication or API contract. A later integration pass now consumes backend `5ff78ce`: normalized cases and decision trails, tracked/annotated evidence, cited excerpts, refreshed signed links, reporting status and live Impact aggregates. The client retains its older response mapper, local footage and user edits so existing saved cases and recordings remain usable. Old demo fixtures remain in storage but are hidden from the new submission dataset.

The reference is a synthetic web prototype. Its licence lookup, demerit values, estimates and issued outcomes are **sample-only**. The native app keeps explicit synthetic labels, unlike the presentation reference, because the server does not provide those fields. Server tracks and annotated/excerpt footage are treated as evidence, not a licence or fine outcome. A live plate that happens to match WXY 2048 does not receive the sample's record. Live stages are not invented while awaiting the synchronous response. No exact model ID, tokens or measured cost are claimed without a response field.

The editable Test WhatsApp utility remains available. Submission sample drafts choose any chat; actual cases retain the configured authority recipient. Neither opening a draft nor tapping an offence sends a message. No actual message was sent in this validation.

Native route transitions approximate the reference's shared-footage transition using retained native screens. The deeper routes slide; there is no custom shared-element engine. Haptics, push notifications and a backend-cached real sample run are outside this client-only sync and were not added.

## Validation

Automated and Simulator observations are recorded in the newest section of `VALIDATION.md`. Simulator verification does not establish physical-camera capture, Android behavior, WhatsApp delivery or a new live-AI run. Store/TestFlight release is separate from this source sync.
