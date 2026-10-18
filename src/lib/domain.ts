export const DEFAULT_API =
  "https://prototype-video-api-fydsujlsyq-uc.a.run.app";
// Injected only for the explicitly authorized judging build. This value is
// extractable from the binary; EAS visibility does not make it a runtime secret.
const judgingToken = process.env.EXPO_PUBLIC_JUDGING_API_TOKEN?.trim() || "";
export const hasBuiltInConnection = Boolean(judgingToken);
export type Finding = {
  vehicle_id: string;
  appearance: string;
  conduct: string;
  start_seconds: number;
  end_seconds: number;
  legal_basis: string;
  penalty: string;
  reasoning: string;
  confidence: number;
};
export type Review = {
  verdict: string;
  reportable: Finding[];
  follow_up_exhausted: boolean;
  estimated_ai_cost_usd?: number;
  review_id?: string;
  created_at?: string;
  case?: unknown;
  decision_trail?: unknown;
  original_video_url?: string;
  annotated_video_url?: string;
  excerpt_video_url?: string;
  thumbnail_url?: string;
  dismissed?: boolean;
  tracks: unknown[];
  evidence: {
    timeline: { start_seconds: number; end_seconds: number; event: string }[];
  };
};
export type ImpactSummary = {
  snitchedCount: number;
  billedCount: number;
  mostSpotted: { plate: string; count: number } | null;
  offenceOccurrences: Record<string, number>;
  isDemo: boolean;
  demoToday: string;
};
export type Stage = "queued" | "preparing" | "uploading" | "reviewing" | "ready" | "error";
export type Incident = {
  id: string;
  name: string;
  file: string;
  thumbnail?: string;
  mime: string;
  size: number;
  createdAt: string;
  stage: Stage;
  remoteUri?: string;
  remoteApiUrl?: string;
  remoteAudioRemoved?: boolean;
  remoteMime?: string;
  uploadJobId?: string;
  durationSeconds?: number;
  selectedVehicleId?: string;
  result?: Review;
  error?: string;
  plate: string;
  location: string;
  occurredAt: string;
  draft?: string;
  openedAt?: string;
  reportedAt?: string;
  dashcamSession?: string;
  protected?: boolean;
};
export type Settings = {
  apiUrl: string;
  token: string;
  name: string;
  phone: string;
  address: string;
  identityNumber: string;
  recipient: string;
  onboarded: boolean;
};
export const initialSettings: Settings = {
  apiUrl: DEFAULT_API,
  token: judgingToken,
  name: "",
  phone: "",
  address: "",
  identityNumber: "",
  recipient: "",
  onboarded: false,
};
export function applyBuildConnection(settings: Settings): Settings {
  // Keep the supplied credential bound to its server, including after updates
  // that restore an older empty token or a custom URL from Keychain.
  return hasBuiltInConnection
    ? { ...settings, apiUrl: DEFAULT_API, token: judgingToken }
    : settings;
}
export function validateApiUrl(value: string) {
  const u = new URL(value.trim());
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash)
    throw new Error(
      "Use an HTTPS server URL without credentials or query parameters.",
    );
  return u.href.replace(/\/+$/, "");
}
export function parseReview(input: unknown): Review {
  if (!input || typeof input !== "object")
    throw new Error("The server returned an invalid review.");
  const r = input as Record<string, unknown>;
  if (!Array.isArray(r.reportable) || typeof r.verdict !== "string")
    throw new Error("The server returned an incomplete review. Please retry.");
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const number = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
  const reportable = r.reportable.map((value: unknown) => {
    if (!value || typeof value !== "object")
      throw new Error("Invalid finding in server response.");
    const f = value as Record<string, unknown>;
    if (!text(f.vehicle_id) || !text(f.conduct) || !text(f.legal_basis))
      throw new Error(
        "A finding is missing its vehicle, conduct or legal basis.",
      );
    return {
      vehicle_id: text(f.vehicle_id),
      appearance: text(f.appearance),
      conduct: text(f.conduct),
      legal_basis: text(f.legal_basis),
      penalty: text(f.penalty),
      reasoning: text(f.reasoning),
      start_seconds: number(f.start_seconds),
      end_seconds: number(f.end_seconds),
      confidence: Math.min(1, number(f.confidence)),
    };
  });
  const evidence = r.evidence as Record<string, unknown> | undefined;
  const timeline = Array.isArray(evidence?.timeline)
    ? evidence.timeline.flatMap((v: unknown) => {
        if (!v || typeof v !== "object") return [];
        const e = v as Record<string, unknown>;
        return text(e.event)
          ? [
              {
                start_seconds: number(e.start_seconds),
                end_seconds: number(e.end_seconds),
                event: text(e.event),
              },
            ]
          : [];
      })
    : [];
  const httpsUrl = (v: unknown) =>
    typeof v === "string" && v.startsWith("https://") ? v : undefined;
  return {
    estimated_ai_cost_usd:
      typeof r.estimated_ai_cost_usd === "number" &&
      Number.isFinite(r.estimated_ai_cost_usd) && r.estimated_ai_cost_usd >= 0
        ? r.estimated_ai_cost_usd : undefined,
    verdict: r.verdict,
    reportable,
    follow_up_exhausted: r.follow_up_exhausted === true,
    ...(text(r.review_id) ? { review_id: text(r.review_id) } : {}),
    ...(text(r.created_at) ? { created_at: text(r.created_at) } : {}),
    ...(r.case && typeof r.case === "object" ? { case: r.case } : {}),
    ...(r.decision_trail && typeof r.decision_trail === "object"
      ? { decision_trail: r.decision_trail }
      : {}),
    ...(httpsUrl(r.original_video_url)
      ? { original_video_url: httpsUrl(r.original_video_url) }
      : {}),
    ...(httpsUrl(r.annotated_video_url)
      ? { annotated_video_url: httpsUrl(r.annotated_video_url) }
      : {}),
    ...(httpsUrl(r.excerpt_video_url)
      ? { excerpt_video_url: httpsUrl(r.excerpt_video_url) }
      : {}),
    ...(httpsUrl(r.thumbnail_url)
      ? { thumbnail_url: httpsUrl(r.thumbnail_url) }
      : {}),
    ...(typeof r.dismissed === "boolean" ? { dismissed: r.dismissed } : {}),
    tracks: Array.isArray(r.tracks) ? r.tracks : [],
    evidence: { timeline },
  };
}
export const timecode = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
export const statusLabel = (i: Incident) =>
  i.reportedAt
    ? "Marked reported"
    : i.openedAt
      ? "Draft opened"
      : i.draft
        ? "Draft prepared"
        : i.stage === "ready"
          ? i.result?.reportable.length
            ? "Review evidence"
            : "No findings"
          : i.stage === "error"
            ? "Needs attention"
            : i.stage === "reviewing"
              ? "AI reviewing"
              : i.stage === "preparing"
                ? "Removing audio"
                : i.stage === "uploading"
                  ? "Uploading"
                  : "Ready to upload";
export function buildDraft(i: Incident, profile: Settings): string {
  if (!i.result?.reportable.length)
    throw new Error("There are no reportable findings.");
  if (!i.plate.trim() || !i.location.trim() || !i.occurredAt.trim())
    throw new Error(
      "Add the vehicle plate, incident location and incident date/time first.",
    );
  const ids = [...new Set(i.result.reportable.map((f) => f.vehicle_id))];
  const selected = i.selectedVehicleId || (ids.length === 1 ? ids[0] : "");
  const findings = i.result.reportable.filter((f) => f.vehicle_id === selected);
  if (!findings.length)
    throw new Error("Select the vehicle you want to report.");
  return [
    `ROAD INCIDENT REPORT • ${i.id}`,
    `Vehicle plate (entered by reporter): ${i.plate.trim()}`,
    `Location: ${i.location.trim()}`,
    `Incident date/time: ${i.occurredAt.trim()}`,
    "",
    ...findings.map(
      (f, n) =>
        `${n + 1}. ${f.conduct}\nVehicle: ${f.appearance || f.vehicle_id}\nClip: ${timecode(f.start_seconds)}–${timecode(f.end_seconds)}\nLegal reference suggested by AI: ${f.legal_basis}\nObservation: ${f.reasoning}`,
    ),
    "",
    "AI-assisted draft, reviewed by the reporter. Please independently verify the evidence.",
    "Video evidence will be attached separately.",
    ...(profile.name ? [`Reporter: ${profile.name}`] : []),
    ...(profile.phone ? [`Contact: ${profile.phone}`] : []),
    ...(profile.address ? [`Address: ${profile.address}`] : []),
    ...(profile.identityNumber
      ? [`Identity number: ${profile.identityNumber}`]
      : []),
  ].join("\n");
}
export function whatsappUrl(recipient: string, draft: string) {
  const phone = recipient.replace(/[\s()+-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(phone))
    throw new Error(
      "Set the recipient’s international phone number in Settings.",
    );
  return `whatsapp://send?phone=${phone}&text=${encodeURIComponent(draft)}`;
}

export function findingTitle(f: Finding): string {
  const citedLabel = f.legal_basis.match(/\(([A-Za-z][^)]+)\)/)?.[1];
  if (citedLabel && citedLabel.length < 75) return citedLabel;
  return f.conduct.length <= 80
    ? f.conduct
    : `${f.conduct.slice(0, 77).trimEnd()}…`;
}
