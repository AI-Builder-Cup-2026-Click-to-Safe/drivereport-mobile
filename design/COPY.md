# Approved copy and voice

Use the current prototype for complete literal strings. `design/computed-styles.json` includes extracted text for each surface. Do not import older slogans from earlier mockups.

| Surface / element | Exact final copy |
| --- | --- |
| Home headline | One click away from making the road safer. |
| Home supporting line | You drive. I’ll deal with the assholes. |
| Main CTA | Start recording |
| Recording reassurance | Don’t worry. / I’ve got your back. |
| Recording action | End recording |
| Analysis headline | I’m putting stupid on paper. |
| Analysis supporting line | I’ll ping you. Their bullshit is becoming admin. |
| Analysis upload | Uploading / Moving their audacity to the cloud. |
| Analysis Gemini | Analysing video with Gemini / Asking Gemini: skill issue, or actual offence? |
| Analysis legal stage (MY) | Fetching RAG on Malaysia law / Retrieving Malaysian traffic law. Vibes have been evicted. |
| Analysis compiling | Gemini AI agent compiling evidence and drafting report / Making “what the fuck” sound professional. |
| Analysis complete | Report completed / Done. Nothing sent. I’m a snitch with boundaries. |
| Review headline | I found premium stupidity. |
| Review controls | Incident details / Tap to edit / Report via WhatsApp |
| Review footer | I draft the snitching. You tap Send. |
| Impact header | Impact |
| Impact headline | Your impact. Their problem. |
| Impact supporting line | I keep receipts. Karma loves paperwork. |
| Impact totals | Assholes snitched on / Got billed |
| Repeat plate | Spotted 10 times. / Same car, same energy. / Demo sightings |
| Offence heading/help | By offence / Pick their bullshit. I’ll find the clip. |
| Status filters | All / Needs you / Sent |
| Settings recipient | Authority WhatsApp |
| Developer budget guidance | We are really poor. |
| Developer footage guidance | Daylight footage works better. |

The sighting count is dynamic; singular uses “Spotted 1 time.” Labels for Red light, Queue cutting, Road rage and Counter traffic flow are literal. Preserving count grammar is required.

## Voice rules

- Speak as the app: “I…” and helpful responses addressed to “you.” Put the joke in the helpful line; keep controls short.
- Use the approved irreverence. Do not fill every empty space with another joke.
- Keep unknown/low-confidence facts explicitly uncertain. A punchline does not establish intent or guilt.
- Use English only, including generated report drafts. Region names can be Malaysia, Singapore and Japan.
- Keep outgoing authority reports neutral: date, time, location, plate, vehicle, observed behavior, suspected offences, evidence links and optional reporter details.
- Missing-value labels name the field. Error messages explain recovery. Do not invent extra regulatory requirements that block the approved CTA.

## Reporting template

`prototype/app.js: reportText()` is the current complete template. It explicitly labels its synthetic incident as a demonstration. Production drafting must use real evidence URLs and actual facts. Retain the neutral report structure while removing synthetic wording only when reporting real, user-reviewed incidents. Missing optional reporter details remain bracketed placeholders for completion in WhatsApp.
