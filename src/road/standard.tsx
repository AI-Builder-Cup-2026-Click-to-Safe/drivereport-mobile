import React, { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import { useRoad } from "./context";
import { demoFrameFor } from "./media";
import { useStore } from "../lib/store";
import {
  Action,
  C,
  Icon,
  Intro,
  Notice,
  Page,
  Quiet,
  Segments,
  T,
  go,
  showError,
  styles as s,
} from "./ui";
import {
  Arrival,
  Count,
  Disclosure,
  FrameBadge,
  ScanSweep,
  Spark,
} from "./standard-ui";
import { shortDate } from "./format";
import { SAMPLE_VIDEO, useSamplePreview } from "../lib/sample";
import { FadeArrival, ImpactBar } from "./motion";
import {
  RoadStat,
  MeterBar,
  MeterKey,
  PointsChip,
  SampleOverlay,
  CostCounter,
} from "./submission-motion";
import {
  topOffender,
  licenceRecord,
  casePoints,
  isSubmissionDemo,
} from "./submission-model";
import submissionFixtures from "./submission-fixtures.json";
import {
  categories,
  duration,
  impact,
  labels,
  missing,
  normalizePlate,
  type RoadCase,
} from "./model";

export const demoFrame = require("../../assets/road/images/frame-wxy2048.jpg");
const clipMeta = { fontSize: 15, lineHeight: 20, color: C.muted };

export function StandardHome() {
  const rr = useRoad();
  const { width } = useWindowDimensions();
  return (
    <Page title="Home" home centered animateContent={false}>
      <View style={{ gap: 18, paddingBottom: 32 }}>
        <Arrival delay={80}>
          <Spark size={44} />
        </Arrival>
        <RoadStat />
        <Arrival delay={170}>
          <T
            accessibilityRole="header"
            style={{
              fontSize: width < 350 ? 34 : 42,
              lineHeight: width < 350 ? 36 : 44,
              fontWeight: "800",
              letterSpacing: -1.6,
            }}
          >
            Spotted an asshole?{"\n"}
            <T
              style={{
                fontSize: width < 350 ? 34 : 42,
                lineHeight: width < 350 ? 36 : 44,
                fontWeight: "800",
                letterSpacing: -1.6,
                color: C.accent,
              }}
            >
              Let’s take their licence.
            </T>
          </T>
        </Arrival>
        <Arrival delay={260}>
          <T style={{ fontSize: 18, lineHeight: 26, color: C.muted }}>
            Gemini finds the offence, the law and the demerit points. You tap
            Send. JPJ does the rest.
          </T>
        </Arrival>
        <Arrival delay={350}>
          <View style={{ marginTop: 12 }}>
            <Action
              title="Analyse a clip"
              leading={<Spark size={18} />}
              onPress={() => go("clip")}
            />
          </View>
        </Arrival>
        <Arrival delay={440}>
          <Quiet
            title="Record a drive instead"
            onPress={() => go("recording")}
          />
        </Arrival>
        <Arrival delay={530}>
          <Quiet title="Test WhatsApp" onPress={() => go("developer")} />
        </Arrival>
        {rr.job?.status === "running" && (
          <Quiet
            title={
              rr.job.stage < 0
                ? "Saving your recording · see progress"
                : "Gemini is still working · see progress"
            }
            onPress={() => go("analysis")}
          />
        )}
      </View>
    </Page>
  );
}

export function Clip() {
  const rr = useRoad(),
    store = useStore();
  const sample = useSamplePreview();
  // Empty means the bundled sample. Every clip is uploaded and reviewed for real.
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const file = store.records.find((r) => r.id === chosen);
  const saved = store.records.filter(
    (r) => r.name !== SAMPLE_VIDEO.name || r.dashcamSession,
  );
  const thumbnail = file ? file.thumbnail : sample?.thumbnail;
  const size = file ? file.size : sample?.size;
  const choose = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["video/mp4", "video/quicktime", "video/webm"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const f = result.assets[0],
        stat = await FS.getInfoAsync(f.uri);
      if (
        !stat.exists ||
        !stat.size ||
        stat.size > 300000000 ||
        !/\.(mp4|mov|webm)$/i.test(f.name)
      )
        throw Error(
          "Choose a playable MP4, MOV or WebM between 1 byte and 300 MB.",
        );
      setChosen(await store.importVideo(f.uri, f.name, f.mimeType));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setBusy(true);
    try {
      if (!store.settings.token)
        throw Error(
          "Add your API access token in Settings → Developer before analysing.",
        );
      if (rr.prefs.region !== "MY")
        throw Error(
          "Live legal analysis currently supports Malaysia. Change the region in Settings.",
        );
      let id = file?.id;
      if (!id) {
        id = await store.importSample();
        // Analysing a sample that was already reported starts a new review instead of reopening it.
        const earlier = rr.allCases.filter((c) => c.sourceId === id);
        if (
          earlier.length &&
          earlier.every((c) => c.reporting.status === "sent")
        )
          id = await store.importSample({ fresh: true });
      }
      await rr.setPrefs({ demo: false });
      void rr.begin([id]).catch(showError);
      go("analysis");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Your clip"
      nav={false}
      footer={
        <Action
          title="Analyse with Gemini"
          leading={<Spark size={18} />}
          disabled={busy || rr.job?.status === "running"}
          onPress={() => void start()}
        />
      }
    >
      <View style={{ gap: 14 }}>
        <View
          style={{
            aspectRatio: 16 / 9,
            backgroundColor: C.dark,
            borderRadius: 16,
            overflow: "hidden",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {thumbnail ? (
            <Image
              source={{ uri: thumbnail }}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <Icon name="Video" color="white" size={44} />
          )}
          {!file && (
            <FrameBadge>
              {`Sample clip · ${duration(SAMPLE_VIDEO.durationSeconds)}`}
            </FrameBadge>
          )}
        </View>
        {/* One row: the file on the left, Change video on the right (it wraps under on narrow screens). */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 180, gap: 2 }}>
            <T
              numberOfLines={1}
              style={{ fontSize: 18, lineHeight: 24, fontWeight: "800" }}
            >
              {file ? file.name : SAMPLE_VIDEO.name}
            </T>
            <T style={clipMeta}>
              {[
                file ? "" : duration(SAMPLE_VIDEO.durationSeconds),
                size ? `${(size / 1e6).toFixed(1)} MB` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </T>
            <T style={clipMeta}>
              {file ? "Saved on this device" : "Real dashcam footage"}
            </T>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change video"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void choose()}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingLeft: 12,
              paddingRight: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderWidth: 1.5,
              borderColor: C.line,
              borderRadius: 999,
              backgroundColor: pressed ? C.surface : C.bg,
              opacity: busy ? 0.4 : 1,
            })}
          >
            <Icon name="Upload" size={16} />
            <T style={{ fontSize: 14, fontWeight: "700" }}>Change video</T>
          </Pressable>
        </View>
      </View>
      {file && (
        <Quiet title="Use the sample clip" onPress={() => setChosen("")} />
      )}
      <View>
        <T style={[s.section, { fontSize: 15, marginBottom: 6 }]}>
          For the best result
        </T>
        {(
          [
            ["Sun", "Daylight footage", "Gemini has to read the plate."],
            [
              "Clock",
              "Short clips, up to 300 MB",
              "Gemini bills us by the second. We are really poor.",
            ],
          ] as const
        ).map(([icon, title, note]) => (
          <View
            key={title}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 10,
              borderTopWidth: 1,
              borderBottomWidth: icon === "Clock" ? 1 : 0,
              borderColor: C.line,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: C.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={icon} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "700", lineHeight: 21 }}>{title}</T>
              <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>
                {note}
              </T>
            </View>
          </View>
        ))}
      </View>
      {saved.length > 0 && (
        <Disclosure title="Saved recordings" note={String(saved.length)}>
          {saved.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`Select ${r.name}`}
              onPress={() => setChosen(r.id)}
              style={{
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: C.line,
              }}
            >
              <T style={{ fontWeight: "600" }}>{r.name}</T>
              <T style={s.muted}>{(r.size / 1e6).toFixed(1)} MB</T>
            </Pressable>
          ))}
        </Disclosure>
      )}
    </Page>
  );
}

export function StandardAnalysis() {
  const rr = useRoad(),
    store = useStore(),
    j = rr.job;
  if (!j)
    return (
      <Page title="Gemini at work" nav={false}>
        <Intro title="I need a clip first." />
        <Action title="Analyse a clip" onPress={() => go("clip")} />
      </Page>
    );
  const done = j.status === "complete",
    running = j.status === "running",
    preparing = j.stage < 0,
    saving = preparing && running;
  const result =
    rr.allCases.find((c) => j.caseIds.includes(c.id)) ||
    (j.mode === "demo"
      ? (submissionFixtures.allCases[0] as RoadCase)
      : undefined);
  const file = store.records.find((r) => j.sourceIds.includes(r.id));
  const stage = done ? 4 : Math.max(0, j.stage);
  const awarded = result ? casePoints(result) : 0;
  const prior = result ? licenceRecord(result) : null;
  const captions = [
    ["Uploading your clip", "Moving their audacity to the cloud."],
    [
      "Gemini is watching",
      "Checking what happened and the relevant law. Your review will appear when it’s ready.",
    ],
    [
      "Searching JPJ law",
      "RAG over the actual rulebook. Vibes have been evicted.",
    ],
    ["Gemini is judging", "Matching what happened to the law."],
    [
      result && missing(result).length
        ? "One thing I couldn’t see"
        : awarded
          ? `+${awarded} demerit points.`
          : "Case ready",
      result && missing(result).length
        ? "Check the case and fill in the missing details."
        : prior && result
          ? `${result.vehicle.plate} already has ${prior.points}. This could make it ${prior.points + awarded}: licence suspended.`
          : "Nothing sent. I’m a snitch with boundaries.",
    ],
  ];
  // Each stage leaves one result row: Watched, Law, the offence with its points, then Record.
  const findings: Finding[] = [];
  if (result && (done || j.mode === "demo")) {
    if (done || stage >= 1)
      findings.push({
        key: "watched",
        label: "Watched",
        value: j.mode === "demo" ? "24 frames · plate read" : "Recording reviewed",
      });
    if (done || stage >= 2)
      result.offences
        .flatMap((o) => o.lawSources)
        .slice(0, 1)
        .forEach((law, i) =>
          findings.push({
            key: `law-${i}`,
            label: "Law",
            value: [law.act || law.title, law.section]
              .filter(Boolean)
              .join(", "),
          }),
        );
    if (done || stage >= 3)
      result.offences.forEach((o, i) =>
        findings.push({
          key: o.id,
          label: duration(o.atSeconds),
          value: o.label,
          delay: i * 240,
          trailing: (
            <PointsChip points={o.demeritPoints ?? 0} delay={260 + i * 240} />
          ),
        }),
      );
    if (done)
      findings.push({
        key: "record",
        label: "Record",
        value: prior
          ? `${result.vehicle.plate} · ${prior.points} pts on record`
          : "Licence lookup unavailable",
      });
  }
  const review = () => {
    void rr
      .setPrefs({ demo: j.mode === "demo" })
      .then(() => {
        if (j.caseIds[0]) rr.select(j.caseIds[0]);
        rr.dismissNotice();
        go("review");
      })
      .catch(showError);
  };
  return (
    <Page
      title={saving ? "Saving your drive" : "Gemini at work"}
      nav={false}
      gap={10}
      footer={
        done ? (
          <Action
            title={
              result && missing(result).length
                ? "Add missing details"
                : "Review the report"
            }
            onPress={review}
          />
        ) : (
          <Quiet
            title="Back to home · I’ll keep working"
            onPress={() => go("home")}
          />
        )
      }
    >
      <View
        style={{
          aspectRatio: 2.05,
          backgroundColor: C.dark,
          borderRadius: 16,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!saving && (j.mode === "demo" || file?.thumbnail) ? (
          <Image
            source={j.mode === "demo" ? demoFrame : { uri: file!.thumbnail }}
            style={{
              width: "100%",
              height: "100%",
              opacity: stage === 0 ? 0.5 : 1,
            }}
          />
        ) : (
          <Icon name="Video" size={48} color="white" />
        )}
        <FrameBadge>
          {j.mode === "demo"
            ? "Synthetic demo"
            : saving
              ? "Saving on this device"
              : file?.dashcamSession
                ? "Your recording"
                : file?.name === SAMPLE_VIDEO.name
                  ? "Sample clip"
                  : "Your clip"}
        </FrameBadge>
        {stage === 0 && j.progress !== null && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 4,
              backgroundColor: "white",
              width: `${j.progress}%`,
            }}
          />
        )}
        {j.mode === "demo" && stage >= 1 && (
          <SampleOverlay
            caption={
              stage === 1
                ? "The light turns red. A blue hatchback approaches the junction."
                : "The hatchback crosses the stop line while the light is red."
            }
          />
        )}
        {running && stage === 1 && <ScanSweep />}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {["Upload", "Watch", "Law", "Judge"].map((name, i) => (
            <View
              key={name}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                key={name}
                accessible
                accessibilityLabel={`${name}: ${preparing ? "awaiting saved recording" : done || i < stage ? "complete" : i === stage ? "working" : "awaiting result"}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor:
                    preparing
                      ? C.lilac
                      : done || i < stage
                      ? C.accent
                      : i === stage
                        ? C.ink
                        : C.lilac,
                }}
              />
              <T
                style={{
                  fontSize: 12,
                  lineHeight: 16,
                  fontWeight: "700",
                  color:
                    !preparing && (done || i < stage)
                      ? C.accent
                      : !preparing && i === stage
                        ? C.ink
                        : C.muted,
                }}
              >
                {name}
              </T>
            </View>
          ))}
        </View>
        <T style={s.muted}>
          {saving
            ? "Preparing"
            : done
            ? "Done"
            : !running
              ? "Paused"
              : j.mode === "live" && stage > 0
                ? "Review in progress"
                : `${stage + 1} of 4`}
        </T>
      </View>
      {/* A short fade: the stage caption changes in place instead of blanking for half a second. */}
      <FadeArrival identity={`${j.id}-${stage}-${j.status}`} distance={6}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ paddingTop: 2 }}>
            <Spark working={running} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={{
                fontSize: 27,
                lineHeight: 30,
                fontWeight: "800",
                letterSpacing: -0.7,
              }}
            >
              {saving
                ? "Securing the last recording"
                : running || done
                  ? captions[stage][0]
                  : "Analysis interrupted"}
            </T>
            <T style={{ color: C.muted, fontSize: 16, lineHeight: 22 }}>
              {saving
                ? j.sourceIds.length
                  ? `${j.sourceIds.length} saved segment${j.sourceIds.length === 1 ? "" : "s"}. Finishing the last file before upload.`
                  : "Closing the camera file and saving it locally before upload."
                : running || done
                ? captions[stage][1]
                : j.error || "Your recording is still saved."}
            </T>
          </View>
        </View>
      </FadeArrival>
      {findings.length > 0 && (
        // The card arrives with its first row, so it never shows as an empty grey box.
        <Arrival identity={j.id} distance={8}>
          <View
            style={{
              backgroundColor: C.surface,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {findings.map(({ key, ...finding }, i) => (
              <FindingRow key={key} {...finding} divider={i > 0} />
            ))}
          </View>
        </Arrival>
      )}
      <View
        style={{
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: "#C9CDD4",
          borderRadius: 16,
          padding: 12,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <T style={{ fontSize: 13, fontWeight: "700" }}>Estimated AI cost</T>
          <T style={s.muted}>
            {j.mode === "demo"
              ? "24 s sample · estimate"
              : "Not supplied by the API"}
          </T>
        </View>
        {j.mode === "demo" ? (
          <CostCounter value={0.0012 * (done ? 1 : stage / 4)} />
        ) : (
          <T style={{ color: C.accent }}>—</T>
        )}
      </View>
      {j.mode === "demo" && (
        <T style={s.muted}>
          Sample analysis · simulated findings and licence record.
        </T>
      )}
      {!running && !done && (
        <>
          <Notice error>{j.error || "Analysis interrupted."}</Notice>
          <Action
            title={j.sourceIds.length ? "Retry analysis" : "Record again"}
            secondary
            onPress={() => {
              if (!j.sourceIds.length && j.mode === "live") go("recording");
              else
                void rr
                  .begin(j.sourceIds, j.mode === "demo")
                  .catch(showError);
            }}
          />
        </>
      )}
      {running && !saving && (
        <Quiet title="Stop waiting" onPress={rr.cancel} />
      )}
    </Page>
  );
}

export function StandardImpact() {
  const rr = useRoad(),
    store = useStore();
  const [period, setPeriod] = useState(0),
    [status, setStatus] = useState(0),
    [plate, setPlate] = useState(""),
    [offence, setOffence] = useState("");
  const [remote, setRemote] = useState<Awaited<
    ReturnType<typeof store.getImpact>
  > | null>(null);
  const [remoteError, setRemoteError] = useState(false);
  const periodKey = (["all", "week", "today"] as const)[period];
  useEffect(() => {
    let alive = true;
    if (rr.prefs.demo) {
      setRemote(null);
      setRemoteError(false);
      return;
    }
    setRemoteError(false);
    void store
      .getImpact(periodKey)
      .then((value) => {
        if (alive) setRemote(value);
      })
      .catch(() => {
        if (alive) setRemoteError(true);
      });
    return () => {
      alive = false;
    };
  }, [periodKey, rr.prefs.demo, store]);
  const data = impact(rr.cases, ["all", "week", "today"][period]);
  const scoped = data.scoped.filter(
    (c) =>
      (!plate || normalizePlate(c.vehicle.plate) === plate) &&
      (!offence || c.offences.some((o) => o.code === offence)),
  );
  const needs = (c: RoadCase) =>
    ["ready", "needs_info", "opened"].includes(c.reporting.status);
  const list = scoped.filter(
    (c) =>
      status === 0 || (status === 1 ? needs(c) : c.reporting.status === "sent"),
  );
  const top = topOffender(data.scoped);
  const topPlate = top?.case.vehicle.plate || remote?.mostSpotted?.plate || "";
  const remoteCount = remote?.mostSpotted?.count || 0;
  const remoteOffenceCount = (code: string) => {
    const values = remote?.offenceOccurrences || {};
    if (code === "wrong_way")
      return (values.wrong_way || 0) + (values.counter_flow || 0);
    if (code === "dangerous")
      return (
        (values.dangerous || 0) +
        (values.queue_cut || 0) +
        (values.road_rage || 0) +
        (values.emergency_lane || 0)
      );
    return values[code] || 0;
  };
  const { width } = useWindowDimensions();
  return (
    <Page title="Impact">
      <Intro
        title="Your impact. Their problem."
        body="I keep receipts. Karma loves paperwork."
      />
      {!rr.prefs.demo && (
        <Quiet
          title={rr.syncingCases ? "Syncing server cases…" : "Sync server cases"}
          disabled={rr.syncingCases}
          onPress={() => void rr.syncCases(true).catch(showError)}
        />
      )}
      {!!rr.historyError && <Notice error>{rr.historyError}</Notice>}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          [remote?.snitchedCount ?? data.sent, "Assholes reported"],
          [remote?.billedCount ?? data.billed, "Got billed"],
        ].map(([value, label]) => (
          <View
            key={String(label)}
            style={{
              flex: 1,
              minHeight: 150,
              padding: 16,
              backgroundColor: C.surface,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <Count value={Number(value)} size={width < 350 ? 54 : 72} />
            <T style={{ fontSize: 15, lineHeight: 19, fontWeight: "700" }}>
              {label}
            </T>
          </View>
        ))}
      </View>
      <Arrival>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            topPlate
              ? `Filter cases for ${topPlate}`
              : "Top offender: nobody yet"
          }
          disabled={!topPlate}
          onPress={() => setPlate(plate ? "" : normalizePlate(topPlate))}
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: C.ink,
            gap: 14,
            borderWidth: plate ? 3 : 0,
            borderColor: C.accent,
          }}
        >
          <View style={s.row}>
            <T style={{ fontSize: 20, fontWeight: "800", color: "white" }}>
              Top offender
            </T>
            {!!topPlate && (
              <T
                style={{
                  fontSize: width < 350 ? 18 : 20,
                  lineHeight: 22,
                  fontWeight: "800",
                  letterSpacing: 1.2,
                  color: C.ink,
                  backgroundColor: "#F5F5F0",
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: 7,
                  overflow: "hidden",
                }}
              >
                {topPlate}
              </T>
            )}
          </View>
          <T
            style={{
              fontSize: width < 350 ? 16 : 17,
              lineHeight: 22,
              fontWeight: top ? "800" : "600",
              color: top ? "#FF9B8F" : "#C9CDD4",
            }}
          >
            {top
              ? top.record + top.pending >= 20
                ? "Your report could take their licence."
                : `${20 - top.record - top.pending} more points and they’re taking the bus.`
              : remoteCount
                ? `${remoteCount} server case${remoteCount === 1 ? "" : "s"}. Licence records are not available.`
                : rr.prefs.demo
                  ? "Nobody yet. Report a red-light runner and they land here."
                  : "Licence records are not available yet."}
          </T>
          {top ? (
            <MeterBar record={top.record} pending={top.pending} />
          ) : (
            <T style={{ color: "#B6BAC2", fontSize: 12 }}>
              The backend does not return licence points for live cases.
            </T>
          )}
          {top && (
            <MeterKey
              record={top.record}
              pending={top.pending}
              demo={isSubmissionDemo(top.case)}
            />
          )}
        </Pressable>
      </Arrival>
      <T style={s.section}>By offence</T>
      <Segments
        items={["All time", "Last 7 days", "Today"]}
        value={period}
        onChange={setPeriod}
      />
      {categories.map(([code, name], i) => (
        <Pressable
          key={code}
          accessibilityRole="button"
          accessibilityLabel={`Filter ${name}`}
          accessibilityState={{ selected: offence === code }}
          onPress={() => setOffence(offence === code ? "" : code)}
          style={{ gap: 7, paddingVertical: 4 }}
        >
          <View style={s.row}>
            <T
              style={{
                fontSize: 16,
                lineHeight: 20,
                fontWeight: "600",
                flex: 1,
                color: offence === code ? C.accent : C.ink,
              }}
            >
              {name}
            </T>
            <T
              style={{
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
                color: offence === code ? C.accent : C.ink,
              }}
            >
              {remote ? remoteOffenceCount(code) : data.counts[code]}
            </T>
          </View>
          <ImpactBar
            selected={offence === code}
            index={i}
            ratio={
              (remote ? remoteOffenceCount(code) : data.counts[code]) /
              Math.max(
                1,
                ...categories.map(([key]) =>
                  remote ? remoteOffenceCount(key) : data.counts[key],
                ),
              )
            }
          />
        </Pressable>
      ))}
      <Segments
        items={[
          `All ${scoped.length}`,
          `Needs you ${scoped.filter(needs).length}`,
          `Sent ${scoped.filter((c) => c.reporting.status === "sent").length}`,
        ]}
        value={status}
        onChange={setStatus}
      />
      {(plate || offence || period > 0) && (
        <Quiet
          title="Clear filters"
          icon="X"
          onPress={() => {
            setPlate("");
            setOffence("");
            setPeriod(0);
          }}
        />
      )}
      <View>
        {list.map((c, i) => (
          <Arrival key={c.id} delay={Math.min(i * 55, 220)} distance={8}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open case ${c.vehicle.plate || c.id}`}
              onPress={() => {
                rr.select(c.id);
                go("review");
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderColor: C.line,
              }}
            >
              <Image
                source={
                  c.provenance.isDemo
                    ? demoFrameFor(c)
                    : c.evidence.thumbnailUrl
                      ? { uri: c.evidence.thumbnailUrl }
                      : undefined
                }
                style={{
                  width: 64,
                  height: 48,
                  borderRadius: 10,
                  backgroundColor: C.lilac,
                }}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <T
                  style={{
                    fontSize: 16,
                    lineHeight: 20,
                    fontWeight: "800",
                    letterSpacing: 0.3,
                  }}
                >
                  {c.vehicle.plate ||
                    (c.offences.length
                      ? "Plate unreadable"
                      : "Suspiciously civil")}
                </T>
                <T style={{ fontSize: 13, lineHeight: 17, color: C.muted }}>
                  {[
                    `${c.offences.length} offence${c.offences.length === 1 ? "" : "s"}`,
                    shortDate(c.incident.date, rr.prefs.language, {
                      timeZone: c.incident.timeZone,
                      relative: true,
                    }),
                    c.incident.time,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </T>
              </View>
              <T
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color:
                    c.reporting.status === "sent"
                      ? "#15803D"
                      : c.reporting.status === "needs_info"
                        ? C.warning
                        : C.ink,
                }}
              >
                {labels[c.reporting.status]}
              </T>
            </Pressable>
          </Arrival>
        ))}
        {!list.length && (
          <T style={{ color: C.muted }}>
            Nothing here. Suspiciously well-behaved.
          </T>
        )}
      </View>
      <T style={s.muted}>
        {rr.prefs.demo ? "Demo cases. " : ""}“Sent” means you confirmed sending.
      </T>
      {remoteError && (
        <T style={s.muted}>
          Cloud impact is unavailable, so these counters use this device.
        </T>
      )}
    </Page>
  );
}

export function Work() {
  const rr = useRoad(),
    store = useStore();
  const c = rr.cases.find((c) => c.id === rr.selected) || rr.cases[0];
  if (!c)
    return (
      <Page title="How Gemini decided" nav={false}>
        <Intro title="I need a case first." />
        <Action title="Analyse a clip" onPress={() => go("clip")} />
      </Page>
    );
  const original = c.analysis;
  const trail = c.decisionTrail;
  const storedResult = store.records.find((r) => r.id === c.sourceId)?.result;
  const timeline = original?.timeline || storedResult?.evidence.timeline || [];
  const offences =
    original?.offences ||
    (storedResult
      ? storedResult.reportable.map((f, i) => ({
          id: String(i),
          label: f.conduct,
          atSeconds: f.start_seconds,
          confidence: f.confidence,
          reasoning: f.reasoning,
          lawSources: [{ title: f.legal_basis }],
        }))
      : []);
  return (
    <Page title="How Gemini decided" nav={false}>
      <Intro
        title="How Gemini decided"
        body={`What the model saw, found and cited for ${c.id}.`}
      />
      {c.provenance.isDemo && (
        <Notice>
          Synthetic demonstration. These are sample findings, not a live Gemini
          response.
        </Notice>
      )}
      <T style={s.section}>What Gemini saw</T>
      {timeline.length ? (
        timeline.map((line, i) => (
          <Arrival key={i} delay={i * 60} distance={8}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <T style={s.muted}>{duration(line.start_seconds)}</T>
              <T style={{ color: C.accent, flex: 1 }}>{line.event}</T>
            </View>
          </Arrival>
        ))
      ) : (
        <T style={s.muted}>
          No timestamped description was saved for this case.
        </T>
      )}
      <T style={s.section}>What it found and cited</T>
      {trail?.excerptVideoUrl?.startsWith("https://") && (
        <Action
          title="Watch cited evidence excerpt"
          secondary
          icon="Video"
          onPress={() =>
            void Linking.openURL(trail.excerptVideoUrl!).catch(showError)
          }
        />
      )}
      <View style={s.row}>
        <T style={s.muted}>Original plate reading</T>
        <T style={{ color: C.accent }}>
          {original?.vehicle.plate || "Not returned"}
        </T>
      </View>
      {offences.map((o, i) => (
        <Arrival key={o.id} delay={i * 60} distance={8}>
          <View
            style={{
              gap: 10,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderColor: C.line,
            }}
          >
            <T style={{ color: C.accent, fontWeight: "700" }}>
              {duration(o.atSeconds)} · {o.label}
            </T>
            <T style={s.muted}>{o.confidence >= 0.9 ? "Clear" : "Unclear"}</T>
            {o.reasoning && <T style={{ color: C.accent }}>{o.reasoning}</T>}
            {o.lawSources.map((law, n) => (
              <T key={n}>{law.title}</T>
            ))}
          </View>
        </Arrival>
      ))}
      {!!trail?.citations.length && (
        <Disclosure
          title="Retrieved law text"
          note={`${trail.citations.length} citation${trail.citations.length === 1 ? "" : "s"}`}
        >
          {trail.citations.map((citation, index) => (
            <View key={index} style={{ gap: 6 }}>
              <T style={{ fontWeight: "700" }}>
                {[citation.statute, citation.section]
                  .filter(Boolean)
                  .join(", ")}
              </T>
              {!!citation.quote && <T>{citation.quote}</T>}
              {!!citation.penalty && (
                <T style={s.muted}>Penalty cited: {citation.penalty}</T>
              )}
            </View>
          ))}
        </Disclosure>
      )}
      {!!trail?.gaps.length && (
        <Notice>Retrieval gaps: {trail.gaps.join(" ")}</Notice>
      )}
      {!original && !storedResult && (
        <T style={s.muted}>
          This older case has no saved original response. Its edited report
          details are available on the Case screen.
        </T>
      )}
      {isSubmissionDemo(c) && (
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            padding: 16,
            gap: 10,
          }}
        >
          <T style={s.section}>Sample run estimate</T>
          <View style={s.row}>
            <T>24-second clip</T>
            <CostCounter value={0.0012} />
          </View>
          <T style={s.muted}>
            30-min drive: US$0.09 · A month of driving: US$6.51
          </T>
          <T style={s.muted}>
            Design reference estimates, not measured billing for this demo.
          </T>
        </View>
      )}
      <T style={s.muted}>
        The API does not return its model ID, timing, token usage or frame
        counts.
      </T>
      {(original || storedResult) && (
        <Disclosure title="What Gemini returned" note="Structured JSON">
          <T selectable style={{ fontSize: 12, lineHeight: 19 }}>
            {JSON.stringify(storedResult || original, null, 2)}
          </T>
        </Disclosure>
      )}
    </Page>
  );
}

type Finding = {
  key: string;
  label: string;
  value: string;
  delay?: number;
  trailing?: React.ReactNode;
};
// Reference grid: check · label · value · trailing chip, so every row's value starts on the same column.
function FindingRow({
  label,
  value,
  delay = 0,
  trailing,
  divider = false,
}: Omit<Finding, "key"> & { divider?: boolean }) {
  return (
    <Arrival distance={8} delay={delay}>
      <View
        style={{
          minHeight: 48,
          paddingVertical: 9,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderTopWidth: divider ? 1 : 0,
          borderColor: C.line,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: C.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="Check" color="white" size={14} strokeWidth={3} />
        </View>
        <T
          style={{
            width: 62,
            fontSize: 13,
            lineHeight: 17,
            fontWeight: "700",
            color: C.muted,
            fontVariant: ["tabular-nums"],
          }}
        >
          {label}
        </T>
        <T
          style={{
            flex: 1,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: "600",
            color: C.accent,
          }}
        >
          {value}
        </T>
        {trailing}
      </View>
    </Arrival>
  );
}
