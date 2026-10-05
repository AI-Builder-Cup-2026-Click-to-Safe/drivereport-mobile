# Acceptance criteria

These criteria are for the implemented app. `docs/VALIDATION.md` records the narrower checks actually completed for this package.

| Area | Required checks |
| --- | --- |
| Home | Exact final headline/support; single primary recording CTA; no location/cases/capture caption; Developer in nav and Settings in header. |
| Navigation | Home/Review/Impact/Developer labels and clear active state; distinct morphs, interrupted/rapid taps, focus and both reduced-motion modes. |
| Capture | Actual file recorded; black screen, red dot and accurate elapsed time; stop/upload; permission denied, unavailable camera and interruption recovery. |
| Upload | 0 bytes rejects; 300,000,000 accepts; 300,000,001 rejects; supported media validated beyond filename; retry/transport progress; tokens not leaked. |
| Analysis | Five stages reflect service state; no filename/agent-demo caption; Gemini prominent; complete/failure/cancel/retry, navigation away and persistent notification. |
| Review | Ready/missing/clean/sent; direct editing; date/time picker and no duplicate date/icons; unknown facts highlighted; at least one selected offence required. |
| Evidence | Playable original/annotated assets; matching timestamps/vehicle; seek and track synchronization; unavailable/expired media recovery. |
| WhatsApp | Configured complete case opens directly; neutral correctly encoded draft; optional personal fields; wrong/missing region recipient recovery. |
| Reporting status | Opened stays actionable; Sent only on confirmation; Undo and lasting unmark; cancelled WhatsApp handoff never means Sent. |
| Impact metrics | Unique known plates for reported/billed totals; repeated cases do not inflate; unknown plates excluded; fine outcome independent of Sent. |
| Recurring plate | Count distinct sightings; card click/keyboard toggles plate scope and reveals results; clear works; normalization ignores spacing/case. |
| Filters | Expanded four-category chart; aligned time selector; date/offence/status/plate intersection; correct empty states; stable hover geometry and indicator interruption. |
| Settings | MY supplied demo number; SG/JP unconfigured; independent overrides; case jurisdiction retained; reporter details optional; English-only UK/US formatting. |
| Accessibility | Persistent labels, named icons, keyboard focus, status announcements, contrast, target sizing, screen-reader review and reduced motion. |
| Responsive | Narrow 320px, 390px reference and target-device sizes; safe areas, keyboard-open forms, scrolling/sticky actions and no horizontal overflow. |
| Production integration | Current timezone-aware date scopes, durable job/case IDs, legal/evidence provenance, offline/session recovery and truthful authority-outcome state. |

Use fixture variants plus actual target devices. Do not repeat broad testing without a changed feature, failure or unresolved concern. Focus on behavior that can fail across component/integration boundaries.
