import type {
  Incident as LegacyIncident,
  Review,
} from "../lib/domain.ts";
export type Region = "MY" | "SG" | "JP";
export type Status = "needs_info" | "ready" | "opened" | "sent" | "clean";
export type Offence = {
  id: string;
  code: string;
  label: string;
  atSeconds: number;
  confidence: number;
  included: boolean;
  reasoning?: string;
  demeritPoints?: number;
  lawSources: {
    act?: string;
    title?: string;
    url?: string;
    section?: string;
  }[];
};
export type DecisionTrail = {
  excerptVideoUrl: string | null;
  verdict: string;
  offences: {
    offenceId: string;
    observed: string;
    reasoning: string;
    legalBasis: string;
    penalty: string;
    confidence: number;
    window: { startSeconds: number; endSeconds: number };
  }[];
  citations: {
    statute: string;
    section: string;
    quote: string;
    penalty: string;
    relevance: number;
  }[];
  gaps: string[];
  roundsUsed: number;
  followUpExhausted: boolean;
  outstandingQuestions: { video: string[]; lawyer: string[] };
};
export type RoadCase = {
  id: string;
  version: number;
  region: Region;
  vehicle: { plate: string | null; type: string | null; model: string | null };
  incident: {
    date: string | null;
    time: string | null;
    timeZone: string;
    location: string | null;
    description: string | null;
  };
  offences: Offence[];
  evidence: {
    durationSeconds: number;
    originalVideoUrl: string | null;
    annotatedVideoUrl: string | null;
    excerptVideoUrl?: string | null;
    thumbnailUrl: string | null;
    tracks: unknown[];
    isSynthetic: boolean;
  };
  reporting: { status: Status; confirmedByUser: boolean };
  authorityOutcome: {
    status: string;
    source: string | null;
    updatedAt: string | null;
  };
  provenance: { isDemo: boolean; factsSource: string; legalRetrieval: string };
  sourceId?: string;
  reviewId?: string;
  decisionTrail?: DecisionTrail;
  analysis?: {
    vehicle: RoadCase["vehicle"];
    incident: RoadCase["incident"];
    offences: Offence[];
    timeline: { start_seconds: number; end_seconds: number; event: string }[];
  };
  edited?: string[];
};
export type Preferences = {
  region: Region;
  language: "en-GB" | "en-US";
  reduced: boolean;
  recipients: Record<Region, string>;
  includePersonal: boolean;
  name: string;
  identity: string;
  address: string;
  phone: string;
  email: string;
  demo: boolean;
  /** Developer settings stay hidden on release builds until the version line is tapped five times. */
  developer?: boolean;
  testRecipient?: string;
  testMessage?: string;
};
export const categories = [
  ["red_light", "Ran a red light"],
  ["double_line", "Overtook across double lines"],
  ["wrong_way", "Drove against traffic"],
  ["dangerous", "Reckless and dangerous driving"],
] as const;
export const regionNames = { MY: "Malaysia", SG: "Singapore", JP: "Japan" };
/** JPJ's public traffic-offence WhatsApp hotline, normalized for wa.me. */
export const MALAYSIA_JPJ_WHATSAPP = "60134498997";
export const labels: Record<Status, string> = {
  needs_info: "Needs details",
  ready: "Review",
  opened: "Draft opened",
  sent: "Sent",
  clean: "No offence",
};
export const normalizePlate = (p: string | null) =>
  (p || "").replace(/\s+/g, "").toUpperCase();
export const duration = (s: number) => {
  const n = Math.max(0, Math.floor(s));
  return `${n >= 3600 ? Math.floor(n / 3600) + ":" : ""}${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
export function missing(c: RoadCase) {
  return [
    ["plate", c.vehicle.plate],
    ["vehicle", c.vehicle.type],
    ["date", c.incident.date],
    ["time", c.incident.time],
    ["location", c.incident.location],
    ["description", c.incident.description],
  ]
    .filter(([, v]) => !v?.trim())
    .map(([k]) => k!);
}
export function validation(c: RoadCase) {
  if (!c.offences.some((o) => o.included))
    return "Pick an offence. I don’t report vibes.";
  const m: Record<string, string> = {
    plate: "I’m petty, not psychic. Add the plate.",
    vehicle: "I’m a snitch, not a psychic. Add the vehicle type.",
    date: "I’ve got chaos, no date. Add when it happened.",
    time: "I found the drama, lost the time. Add it.",
    location: "I’ve got drama, no address. Add the location.",
    description: "I need the plot. Add what happened.",
  };
  const key = missing(c)[0];
  if (key) return m[key];
  if (
    !validDate(c.incident.date!) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.incident.time!)
  )
    return "Check the incident date and time.";
  return "";
}
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(Date.parse(s)) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function correctStatus(c: RoadCase): Status {
  return !c.offences.length
    ? "clean"
    : c.reporting.status === "sent"
      ? "sent"
      : validation(c)
        ? "needs_info"
        : c.reporting.status === "opened"
          ? "opened"
          : "ready";
}
export function recipient(p: Preferences, c: RoadCase) {
  const v = (
    c.provenance.isDemo
      ? p.testRecipient || ""
      : c.region === "MY"
        ? p.recipients.MY || MALAYSIA_JPJ_WHATSAPP
        : p.recipients[c.region]
  ).replace(/[\s()+-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(v))
    throw Error(
      c.provenance.isDemo
        ? "Add your test WhatsApp number in Settings → Developer. Demo reports only go to your test number."
        : `Add an Authority WhatsApp number for ${regionNames[c.region]} in Settings.`,
    );
  return v;
}
export function reportText(c: RoadCase, p: Preferences) {
  const error = validation(c);
  if (error) throw Error(error);
  const personal = (value: string, label: string) =>
    p.includePersonal && value.trim() ? value.trim() : `[${label}]`;
  return [
    c.provenance.isDemo
      ? "DEMO — SYNTHETIC TRAFFIC OFFENCE REPORT"
      : `ADUAN KESALAHAN LALU LINTAS / TRAFFIC OFFENCE REPORT — ${c.id}`,
    c.provenance.isDemo
      ? "Demonstration only. This is not a real complaint."
      : "",
    `Authority / Pihak berkuasa: ${regionNames[c.region]}`,
    `Date / Tarikh: ${c.incident.date}`,
    `Time / Masa: ${c.incident.time} (${c.incident.timeZone})`,
    `Location / Lokasi: ${c.incident.location}`,
    `Vehicle plate / No. pendaftaran: ${c.vehicle.plate}`,
    `Vehicle / Kenderaan: ${[c.vehicle.type, c.vehicle.model].filter(Boolean).join(" / ")}`,
    `Description / Keterangan: ${c.incident.description}`,
    "",
    "Suspected offences / Kesalahan disyaki:",
    ...c.offences
      .filter((o) => o.included)
      .map((o, i) => `${i + 1}. ${o.label} — ${duration(o.atSeconds)}`),
    "",
    c.evidence.originalVideoUrl?.startsWith("https://")
      ? `Original recording / Rakaman asal: ${c.evidence.originalVideoUrl}`
      : "Video evidence / Bukti video: attach the original recording separately.",
    ...(c.evidence.excerptVideoUrl?.startsWith("https://")
      ? [`Cited evidence excerpt: ${c.evidence.excerptVideoUrl}`]
      : []),
    ...(c.evidence.annotatedVideoUrl?.startsWith("https://")
      ? [`Annotated evidence: ${c.evidence.annotatedVideoUrl}`]
      : []),
    "",
    `Full name / Nama penuh: ${personal(p.name, "Full name")}`,
    `Identity number / No. pengenalan: ${personal(p.identity, "ID or passport number")}`,
    `Postal address / Alamat: ${personal(p.address, "Postal address")}`,
    `Phone / Telefon: ${personal(p.phone, "Phone number")}`,
    `Email / E-mel: ${personal(p.email, "Email address")}`,
    "",
    "Please review the evidence and suspected offences. Thank you.",
  ]
    .filter((v) => v !== undefined)
    .join("\n");
}
export function whatsapp(c: RoadCase, p: Preferences) {
  return `https://wa.me/${c.provenance.factsSource === "submission_fixture_v1" && c.provenance.isDemo ? "" : recipient(p, c)}?text=${encodeURIComponent(reportText(c, p))}`;
}
export const defaultWhatsAppTestMessage = [
  "DEMO — TRAFFIC REPORT TEST",
  "This is a test message. No real complaint is being submitted.",
  "",
  "Incident: Running a red light",
  "Vehicle: Perodua Myvi · VGD 8888",
  "Location: Jalan Tun Razak, Kuala Lumpur",
  "Time: 10:04 AM · 12 Feb 2026",
  "",
  "Video evidence: Demo attachment",
  "Please ignore this test message.",
].join("\n");
export function whatsappTest(
  value: string,
  message = defaultWhatsAppTestMessage,
) {
  const number = value.replace(/[\s()+-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(number))
    throw Error("Enter an international number including country code.");
  const draft = message.trim();
  if (!draft) throw Error("Enter a test message.");
  return `https://wa.me/${number}?text=${encodeURIComponent(draft)}`;
}
export function inPeriod(c: RoadCase, period: string, now = new Date()) {
  if (period === "all") return true;
  if (!c.incident.date) return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: c.incident.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const age = (Date.parse(today) - Date.parse(c.incident.date)) / 86400000;
  return age >= 0 && age < (period === "today" ? 1 : 7);
}
export function impact(cases: RoadCase[], period = "all", now = new Date()) {
  const scoped = cases.filter((c) => inPeriod(c, period, now));
  const unique = (list: RoadCase[]) =>
    new Set(list.map((c) => normalizePlate(c.vehicle.plate)).filter(Boolean))
      .size;
  const sightings = new Map<string, number>();
  for (const c of scoped) {
    const p = normalizePlate(c.vehicle.plate);
    if (p) sightings.set(p, (sightings.get(p) || 0) + 1);
  }
  return {
    scoped,
    sent: unique(scoped.filter((c) => c.reporting.status === "sent")),
    billed: unique(
      scoped.filter((c) => c.authorityOutcome.status === "issued"),
    ),
    counts: Object.fromEntries(
      categories.map(([k]) => [
        k,
        scoped.reduce(
          (n, c) => n + c.offences.filter((o) => o.code === k).length,
          0,
        ),
      ]),
    ),
    recurring: [...sightings.entries()].sort((a, b) => b[1] - a[1])[0],
  };
}
export function fromLegacy(i: LegacyIncident, region: Region): RoadCase[] {
  if (!i.result) return [];
  const server = fromServerCase(i, region);
  if (server) return [server];
  const ids = [...new Set(i.result.reportable.map((o) => o.vehicle_id))];
  if (!ids.length) ids.push("clean");
  return ids.map((vehicleId, index) => {
    const findings = i.result!.reportable.filter(
      (o) => o.vehicle_id === vehicleId,
    );
    const c: RoadCase = {
      id: `${i.id}-${index + 1}`,
      sourceId: i.id,
      version: 1,
      region,
      vehicle: {
        plate: null,
        type: findings[0]?.appearance || null,
        model: null,
      },
      incident: {
        date: null,
        time: null,
        timeZone:
          region === "JP"
            ? "Asia/Tokyo"
            : region === "SG"
              ? "Asia/Singapore"
              : "Asia/Kuala_Lumpur",
        location: null,
        description:
          findings.map((f) => f.conduct).join(" ") || i.result!.verdict,
      },
      offences: findings.map((f, n) => ({
        id: `${i.id}-${index}-${n}`,
        code: "other",
        label: f.conduct,
        atSeconds: f.start_seconds,
        confidence: f.confidence,
        included: true,
        reasoning: f.reasoning,
        lawSources: [{ title: f.legal_basis }],
      })),
      evidence: {
        durationSeconds: 0,
        originalVideoUrl: i.file,
        annotatedVideoUrl: null,
        thumbnailUrl: i.thumbnail || null,
        tracks: [],
        isSynthetic: false,
      },
      reporting: {
        status: findings.length ? "needs_info" : "clean",
        confirmedByUser: false,
      },
      authorityOutcome: { status: "unknown", source: null, updatedAt: null },
      provenance: {
        isDemo: false,
        factsSource: "video_analysis_and_user",
        legalRetrieval: "backend_review",
      },
    };
    c.analysis = {
      vehicle: { ...c.vehicle },
      incident: { ...c.incident },
      offences: c.offences.map((o) => ({
        ...o,
        lawSources: o.lawSources.map((s) => ({ ...s })),
      })),
      timeline: (i.result!.evidence?.timeline || []).map((t) => ({ ...t })),
    };
    // Only carry user facts to the explicitly selected vehicle; never duplicate a plate across vehicles.
    if (ids.length === 1 || vehicleId === i.selectedVehicleId) {
      c.vehicle.plate = i.plate || null;
      c.incident.location = i.location || null;
      c.edited = [i.plate ? "plate" : "", i.location ? "location" : ""].filter(
        Boolean,
      );
    }
    return c;
  });
}

/** Convert a persisted backend review into the same case model used for a
 * review created on this device. The signed original is used only when no
 * durable local recording exists. */
export function fromServerReview(review: Review, region: Region): RoadCase[] {
  if (!review.review_id) return [];
  return fromLegacy(
    {
      id: `cloud:${review.review_id}`,
      name: `Server review ${review.review_id.slice(0, 8)}`,
      file: review.original_video_url || "",
      mime: "video/mp4",
      size: 0,
      createdAt: review.created_at || "",
      stage: "ready",
      plate: "",
      location: "",
      occurredAt: "",
      result: review,
    },
    region,
  );
}

/** Refresh server-owned fields without erasing facts or local evidence edited
 * on the current device. */
export function mergeServerCase(
  local: RoadCase,
  remote: RoadCase,
): RoadCase {
  const localOriginal = local.evidence.originalVideoUrl;
  const localThumbnail = local.evidence.thumbnailUrl;
  return {
    ...local,
    reviewId: remote.reviewId || local.reviewId,
    decisionTrail: remote.decisionTrail || local.decisionTrail,
    authorityOutcome: remote.authorityOutcome,
    evidence: {
      ...local.evidence,
      durationSeconds:
        remote.evidence.durationSeconds || local.evidence.durationSeconds,
      originalVideoUrl:
        localOriginal?.startsWith("file:")
          ? localOriginal
          : remote.evidence.originalVideoUrl || localOriginal,
      annotatedVideoUrl:
        remote.evidence.annotatedVideoUrl ||
        local.evidence.annotatedVideoUrl,
      excerptVideoUrl:
        remote.evidence.excerptVideoUrl || local.evidence.excerptVideoUrl,
      thumbnailUrl:
        localThumbnail?.startsWith("file:")
          ? localThumbnail
          : remote.evidence.thumbnailUrl || localThumbnail,
      tracks: remote.evidence.tracks.length
        ? remote.evidence.tracks
        : local.evidence.tracks,
    },
  };
}

const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown) => (typeof value === "string" ? value : "");
const nullableText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;
const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const https = (value: unknown) =>
  typeof value === "string" && value.startsWith("https://") ? value : null;
const submissionCode = (code: string, label: string) => {
  if (["red_light", "double_line", "wrong_way", "dangerous"].includes(code))
    return code;
  if (code === "counter_flow") return "wrong_way";
  if (code === "queue_cut" && /double line|overtak/i.test(label))
    return "double_line";
  if (["queue_cut", "road_rage", "emergency_lane"].includes(code))
    return "dangerous";
  return code || "other";
};

function parseDecisionTrail(value: unknown): DecisionTrail | undefined {
  const trail = object(value);
  if (!trail) return undefined;
  const questions = object(trail.outstandingQuestions);
  return {
    excerptVideoUrl: https(trail.excerptVideoUrl),
    verdict: text(trail.verdict),
    offences: Array.isArray(trail.offences)
      ? trail.offences.flatMap((value) => {
          const item = object(value),
            window = object(item?.window);
          return item
            ? [
                {
                  offenceId: text(item.offenceId),
                  observed: text(item.observed),
                  reasoning: text(item.reasoning),
                  legalBasis: text(item.legalBasis),
                  penalty: text(item.penalty),
                  confidence: Math.min(1, Math.max(0, finite(item.confidence))),
                  window: {
                    startSeconds: Math.max(0, finite(window?.startSeconds)),
                    endSeconds: Math.max(0, finite(window?.endSeconds)),
                  },
                },
              ]
            : [];
        })
      : [],
    citations: Array.isArray(trail.citations)
      ? trail.citations.flatMap((value) => {
          const item = object(value);
          return item
            ? [
                {
                  statute: text(item.statute),
                  section: text(item.section),
                  quote: text(item.quote),
                  penalty: text(item.penalty),
                  relevance: Math.min(1, Math.max(0, finite(item.relevance))),
                },
              ]
            : [];
        })
      : [],
    gaps: Array.isArray(trail.gaps) ? trail.gaps.map(text).filter(Boolean) : [],
    roundsUsed: Math.max(0, finite(trail.roundsUsed)),
    followUpExhausted: trail.followUpExhausted === true,
    outstandingQuestions: {
      video: Array.isArray(questions?.video)
        ? questions.video.map(text).filter(Boolean)
        : [],
      lawyer: Array.isArray(questions?.lawyer)
        ? questions.lawyer.map(text).filter(Boolean)
        : [],
    },
  };
}

/** Prefer the backend's dashboard contract, while retaining the legacy mapper
 * for records created by older revisions. Unknown or malformed case data falls
 * back instead of making a completed review disappear. */
function fromServerCase(i: LegacyIncident, fallbackRegion: Region) {
  const result = i.result;
  if (!result) return null;
  const raw = object(result.case),
    vehicle = object(raw?.vehicle),
    incident = object(raw?.incident),
    evidence = object(raw?.evidence),
    reporting = object(raw?.reporting),
    outcome = object(raw?.authorityOutcome),
    provenance = object(raw?.provenance);
  if (
    !raw ||
    !text(raw.id) ||
    !vehicle ||
    !incident ||
    !evidence ||
    !reporting ||
    !Array.isArray(raw.offences)
  )
    return null;
  const trail = parseDecisionTrail(result.decision_trail);
  const offences = raw.offences.flatMap((value, index) => {
    const item = object(value);
    if (!item) return [];
    const id = text(item.id) || `${text(raw.id)}-offence-${index + 1}`;
    const detail = trail?.offences.find((o) => o.offenceId === id);
    return [
      {
        id,
        code: submissionCode(text(item.code), text(item.label)),
        label: text(item.label) || "Traffic offence",
        atSeconds: Math.max(0, finite(item.atSeconds)),
        confidence: Math.min(1, Math.max(0, finite(item.confidence))),
        included: item.included !== false,
        ...(detail?.reasoning ? { reasoning: detail.reasoning } : {}),
        lawSources: Array.isArray(item.lawSources)
          ? item.lawSources.flatMap((value) => {
              const law = object(value);
              return law
                ? [
                    {
                      title: nullableText(law.title) || undefined,
                      url: https(law.url) || undefined,
                      section: nullableText(law.section) || undefined,
                    },
                  ]
                : [];
            })
          : [],
      },
    ];
  });
  const suppliedRegion = text(raw.region);
  const c: RoadCase = {
    id: text(raw.id),
    version: Math.max(1, finite(raw.version)),
    region: (["MY", "SG", "JP"].includes(suppliedRegion)
      ? suppliedRegion
      : fallbackRegion) as Region,
    vehicle: {
      plate: nullableText(vehicle.plate),
      type: nullableText(vehicle.type),
      model: nullableText(vehicle.model),
    },
    incident: {
      date: nullableText(incident.date),
      time: nullableText(incident.time),
      timeZone:
        nullableText(incident.timeZone) ||
        (fallbackRegion === "JP"
          ? "Asia/Tokyo"
          : fallbackRegion === "SG"
            ? "Asia/Singapore"
            : "Asia/Kuala_Lumpur"),
      location: nullableText(incident.location),
      description: nullableText(incident.description),
    },
    offences,
    evidence: {
      durationSeconds: Math.max(0, finite(evidence.durationSeconds)),
      // The local original survives signed-link expiry and offline use.
      originalVideoUrl: i.file || https(evidence.originalVideoUrl),
      annotatedVideoUrl:
        https(evidence.annotatedVideoUrl) || result.annotated_video_url || null,
      excerptVideoUrl:
        trail?.excerptVideoUrl || result.excerpt_video_url || null,
      thumbnailUrl: i.thumbnail || https(evidence.thumbnailUrl),
      tracks: Array.isArray(evidence.tracks)
        ? evidence.tracks
        : result.tracks || [],
      isSynthetic: false,
    },
    reporting: {
      status: (["needs_info", "ready", "opened", "sent", "clean"].includes(
        text(reporting.status),
      )
        ? text(reporting.status)
        : offences.length
          ? "needs_info"
          : "clean") as Status,
      confirmedByUser: reporting.confirmedByUser === true,
    },
    authorityOutcome: {
      status: text(outcome?.status) || "unknown",
      source: nullableText(outcome?.source),
      updatedAt: nullableText(outcome?.updatedAt),
    },
    provenance: {
      isDemo: false,
      factsSource: text(provenance?.factsSource) || "gemini_video_analysis",
      legalRetrieval: text(provenance?.legalRetrieval) || "backend_review",
    },
    sourceId: i.id,
    reviewId: result.review_id,
    decisionTrail: trail,
  };
  c.analysis = {
    vehicle: { ...c.vehicle },
    incident: { ...c.incident },
    offences: c.offences.map((o) => ({
      ...o,
      lawSources: o.lawSources.map((law) => ({ ...law })),
    })),
    timeline: result.evidence.timeline.map((line) => ({ ...line })),
  };
  c.reporting.status = correctStatus(c);
  return c;
}

/** Preserve the original model response while tracking explicitly edited facts. */
export function editCase(c: RoadCase, patch: Partial<RoadCase>): RoadCase {
  const edited = new Set(c.edited || []);
  if (patch.vehicle)
    for (const key of ["plate", "type", "model"] as const)
      if (patch.vehicle[key] !== c.vehicle[key])
        edited.add(key === "type" ? "vehicle" : key);
  if (patch.incident)
    for (const key of ["date", "time", "location", "description"] as const)
      if (patch.incident[key] !== c.incident[key]) edited.add(key);
  return {
    ...c,
    ...patch,
    analysis: c.analysis,
    edited: [...edited],
    version: c.version + 1,
  };
}

/** iOS may relocate Documents on app updates. Resolve local evidence through the
 * original recording store, which persists filenames instead of container URLs. */
export function restoreEvidence(
  c: RoadCase,
  source?: Pick<LegacyIncident, "id" | "file" | "thumbnail">,
): RoadCase {
  if (c.provenance.isDemo || !source || source.id !== c.sourceId) return c;
  return {
    ...c,
    evidence: {
      ...c.evidence,
      originalVideoUrl: c.evidence.originalVideoUrl?.startsWith("file:")
        ? source.file
        : c.evidence.originalVideoUrl,
      thumbnailUrl: c.evidence.thumbnailUrl?.startsWith("file:")
        ? source.thumbnail || null
        : c.evidence.thumbnailUrl,
    },
  };
}
