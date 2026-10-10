import React, { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import { useRoad } from "./context";
import { demoFrameFor } from "./media";
import { useStore } from "../lib/store";
import {
  Action,
  Announce,
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
  TextLink,
} from "./ui";
import {
  Arrival,
  CaseId,
  Count,
  Disclosure,
  FrameBadge,
  ScanSweep,
  Spark,
} from "./standard-ui";
import { shortDate } from "./format";
import { DEMO_STAGE_MS } from "./analysis-timing";
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
const clipMeta = {
  fontSize: 14,
  lineHeight: 18,
  color: C.muted,
  fontVariant: ["tabular-nums" as const],
};

export function StandardHome() {
  const rr = useRoad();
  const { width } = useWindowDimensions();
  const headline = {
    fontSize: width < 350 ? 34 : 42,
    lineHeight: width < 350 ? 36 : 44,
    fontWeight: "800" as const,
    letterSpacing: -1.47,
  };
  // Reference Home: spark, stat (16), headline (8), lede (14), button (30), quiet action (6).
  return (
    <Page title="Home" home centered animateContent={false}>
      <View style={{ paddingBottom: 48 }}>
        <Arrival delay={80}>
          <SparkEntrance size={44} />
        </Arrival>
        <Arrival delay={170}>
          <View style={{ marginTop: 16 }}>
            <RoadStat />
          </View>
        </Arrival>
        <Arrival delay={260}>
          <T accessibilityRole="header" style={[headline, { marginTop: 8 }]}>
            Spotted an asshole?
          </T>
          {/* The reference balances this line as “Let’s take / their licence.” */}
          <T style={[headline, { marginTop: 4, color: C.accent }]}>
            {"Let’s take\ntheir licence."}
          </T>
        </Arrival>
        <Arrival delay={350}>
          <T
            style={{
              marginTop: 14,
              maxWidth: 300,
              fontSize: 18,
              lineHeight: 26,
              color: C.muted,
            }}
          >
            Gemini finds the offence, the law and the demerit points. You tap
            Send. JPJ does the rest.
          </T>
        </Arrival>
        <Arrival delay={440}>
          <View style={{ marginTop: 30 }}>
            <Action
              title="Analyse a clip"
              leading={(pressed) => <Spark size={20} pressed={pressed} />}
              onPress={() => go("clip")}
            />
          </View>
        </Arrival>
        <Arrival delay={530}>
          <View style={{ marginTop: 6, alignItems: "center" }}>
            <Quiet
              title="Record a drive instead"
              onPress={() => go("recording")}
            />
          </View>
        </Arrival>
        {rr.job?.status === "running" && (
          <View style={{ marginTop: 6, alignItems: "center" }}>
            <Quiet
              title={
                rr.job.stage < 0
                  ? "Saving your recording · see progress"
                  : "Gemini is still working · see progress"
              }
              onPress={() => go("analysis")}
            />
          </View>
        )}
      </View>
    </Page>
  );
}

/** Home's spark turns in from -90° as the screen arrives. */
function SparkEntrance({ size }: { size: number }) {
  const { reduced, foreground } = useRoad();
  const v = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced || !foreground) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 820,
      delay: 120,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, reduced, foreground]);
  return (
    <Animated.View
      style={{
        alignSelf: "flex-start",
        opacity: v,
        transform: [
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
        ],
      }}
    >
      <Spark size={size} />
    </Animated.View>
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
          "This build isn’t connected to the analysis server yet. Add its access token in Developer settings.",
        );
      if (rr.prefs.region !== "MY")
        throw Error(
          "Live analysis supports Malaysia only. Set the region to Malaysia in Settings.",
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
          leading={(pressed) => <Spark size={20} pressed={pressed} />}
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
            <ClipImage uri={thumbnail} />
          ) : (
            <Icon name="Video" color="white" size={44} />
          )}
          {!file && <DurationPill seconds={SAMPLE_VIDEO.durationSeconds} />}
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
          <View style={{ flex: 1, minWidth: 180, gap: 3 }}>
            <T
              numberOfLines={1}
              style={{ fontSize: 17, lineHeight: 21, fontWeight: "700" }}
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
      <View style={{ marginTop: 4 }}>
        <T style={[s.section, { marginBottom: 8 }]}>For the best result</T>
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
              paddingVertical: 12,
              borderTopWidth: 1,
              borderBottomWidth: icon === "Clock" ? 1 : 0,
              borderColor: C.line,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: C.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={icon} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: "700", fontSize: 15, lineHeight: 19 }}>
                {title}
              </T>
              <T
                style={{
                  marginTop: 2,
                  fontSize: 13,
                  lineHeight: 18,
                  color: C.muted,
                }}
              >
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

/** Reference .dur: the clip length on the frame's bottom-right corner. */
function DurationPill({ seconds }: { seconds: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: 10,
        bottom: 10,
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: "rgba(17,19,24,0.75)",
      }}
    >
      <T
        style={{
          fontSize: 12,
          lineHeight: 14,
          fontWeight: "700",
          color: "white",
          fontVariant: ["tabular-nums"],
        }}
      >
        {duration(seconds)}
      </T>
    </View>
  );
}

/** The clip frame settles from a slight zoom as Your clip arrives. */
function ClipImage({ uri }: { uri: string }) {
  const { reduced, foreground } = useRoad();
  const v = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced || !foreground) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 700,
      delay: 120,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, reduced, foreground]);
  return (
    <Animated.Image
      source={{ uri }}
      style={{
        width: "100%",
        height: "100%",
        transform: [
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) },
        ],
      }}
    />
  );
}

export function StandardAnalysis() {
  const rr = useRoad(),
    store = useStore(),
    j = rr.job;
  const done = j?.status === "complete",
    running = j?.status === "running";
  const stage = !j ? 0 : done ? 4 : Math.max(0, j.stage);
  const demo = j?.mode === "demo";
  // How far the current demo stage has got, so rows and the cost fill in through the stage.
  const [now, setNow] = useState(() => Date.now());
  const [stageStart, setStageStart] = useState(() => Date.now());
  useEffect(() => setStageStart(Date.now()), [j?.id, stage]);
  useEffect(() => {
    if (!running || !demo) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [running, demo]);
  if (!j)
    return (
      <Page title="Gemini at work" nav={false}>
        <Intro title="I need a clip first." />
        <Action title="Analyse a clip" onPress={() => go("clip")} />
      </Page>
    );
  const preparing = j.stage < 0,
    saving = preparing && running;
  const result =
    rr.allCases.find((c) => j.caseIds.includes(c.id)) ||
    (demo ? (submissionFixtures.allCases[0] as RoadCase) : undefined);
  const file = store.records.find((r) => j.sourceIds.includes(r.id));
  const f =
    demo && running && stage < 4
      ? Math.max(0, Math.min(1, (now - stageStart) / DEMO_STAGE_MS[stage]))
      : 1;
  const narration = result?.analysis?.timeline || [];
  const offences = result?.offences || [];
  const sources = result ? lawSourcesOf(result) : [];
  // Reference stepOf(): how much of the current stage's output has arrived.
  const k =
    !demo || done || stage < 1
      ? 99
      : stage === 1
        ? Math.min(narration.length, Math.floor(f * narration.length * 1.1) + 1)
        : stage === 2
          ? Math.min(sources.length, Math.floor(f * (sources.length + 0.6)))
          : Math.min(offences.length + 1, Math.floor(f * (offences.length + 1.4)));
  const adds = result ? casePoints(result) : 0;
  const record = result ? licenceRecord(result) : null;
  const plate = result?.vehicle.plate || "";
  const plateRead = !!result?.analysis?.vehicle.plate;
  const caption: [string, string] = saving
    ? [
        "Securing the last recording",
        j.sourceIds.length
          ? `${j.sourceIds.length} saved segment${j.sourceIds.length === 1 ? "" : "s"}. Finishing the last file before upload.`
          : "Closing the camera file and saving it locally before upload.",
      ]
    : !running && !done
      ? ["Analysis interrupted", j.error || "Your recording is still saved."]
      : stage >= 4
        ? verdict(result, adds, record?.points ?? 0)
        : stage === 3 && k > offences.length
          ? [
              plural(offences.filter((o) => o.included).length, "suspected offence"),
              "Writing it up the way JPJ wants it.",
            ]
          : (
              [
                ["Uploading your clip", "Moving their audacity to the cloud."],
                ["Gemini is watching", "Frame by frame. Skill issue, or actual offence?"],
                ["Searching JPJ law", "RAG over the actual rulebook. Vibes have been evicted."],
                ["Gemini is judging", "Making “what the fuck” sound professional."],
              ] as [string, string][]
            )[stage];
  // Each stage leaves one result row (reference rows()): Watched, Law, the offence with its points, Record.
  const findings: Finding[] = [];
  if (result && (done || demo)) {
    if (stage >= 1) {
      const watched = stage >= 2;
      const frames = 24;
      findings.push({
        key: "watched",
        label: "Watched",
        value: !demo
          ? "Recording reviewed"
          : watched
            ? `${frames} frames · plate ${plateRead ? "read" : "unreadable"}`
            : `${Math.round((frames * Math.min(narration.length, k)) / Math.max(1, narration.length))} of ${frames} frames`,
        wait: !watched,
        need: watched && demo && !plateRead,
      });
    }
    if (stage >= 2) {
      const list = stage >= 3 ? sources : sources.slice(0, k);
      if (!list.length)
        findings.push({ key: "law-0", label: "Law", value: "Searching JPJ law", wait: true });
      list.forEach((law, i) =>
        findings.push({
          key: `law-${i}`,
          label: "Law",
          value: lawRef(law),
          // The Act and section, then what the offence is in plain words.
          sub: law.act && law.section ? law.title : undefined,
        }),
      );
    }
    if (stage >= 3)
      offences.slice(0, stage >= 4 ? 99 : k).forEach((o, i) =>
        findings.push({
          key: o.id,
          label: duration(o.atSeconds),
          value: o.label,
          trailing: o.demeritPoints ? (
            <PointsChip points={o.demeritPoints} delay={260 + i * 240} />
          ) : undefined,
        }),
      );
    if (adds && (stage >= 4 || (stage === 3 && k > offences.length)))
      findings.push(
        !plate
          ? {
              key: "record",
              label: "Record",
              value: "No plate, no lookup",
              sub: "Add the plate and I’ll check their record.",
              need: true,
            }
          : {
              key: "record",
              label: "Record",
              value: record ? `${plate} · ${record.points} pts` : `${plate} · no points`,
              sub: record
                ? `${plural(record.summonses, "summons").replace("summonss", "summonses")} on record`
                : "No summons on record",
            },
      );
  }
  // The footage subtitle follows the stage: the description line by line, then the offence moment.
  const line =
    !demo || stage < 1
      ? ""
      : stage === 1
        ? narration[Math.max(0, Math.min(k, narration.length) - 1)]?.event || ""
        : quoteAt(narration, offences[0]?.atSeconds ?? 12);
  const costUsd = 0.0012;
  const elapsed =
    stage === 0
      ? 0
      : DEMO_STAGE_MS.slice(1, stage).reduce((n, ms) => n + ms, 0) +
        f * DEMO_STAGE_MS[Math.min(stage, 3)];
  const cost =
    done || stage >= 4
      ? costUsd
      : (costUsd * elapsed) / (DEMO_STAGE_MS[1] + DEMO_STAGE_MS[2] + DEMO_STAGE_MS[3]);
  const missingKeys = result ? missing(result) : [];
  const review = () => {
    void rr
      .setPrefs({ demo })
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
      gap={0}
      footer={
        done ? (
          <FadeArrival distance={8} duration={300}>
            <Action
              title={
                missingKeys.includes("plate")
                  ? "Add the plate"
                  : missingKeys.includes("location")
                    ? "Add the location"
                    : missingKeys.length
                      ? "Add the missing detail"
                      : "Review the report"
              }
              icon="FileCheck2"
              onPress={review}
            />
          </FadeArrival>
        ) : (
          <View style={{ minHeight: 76, alignItems: "center", justifyContent: "center" }}>
            <T
              style={{
                maxWidth: 300,
                textAlign: "center",
                fontSize: 13,
                lineHeight: 18,
                fontWeight: "600",
                color: C.muted,
              }}
            >
              Long clips take a while. Keep Click-to-Safe open and I’ll flag it when it’s done.
            </T>
            <Quiet title="Back to home" onPress={() => go("home")} />
          </View>
        )
      }
    >
      <View
        style={{
          aspectRatio: 16 / 9,
          backgroundColor: C.dark,
          borderRadius: 16,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!saving && (demo || file?.thumbnail) ? (
          <Image
            source={demo ? demoFrame : { uri: file!.thumbnail }}
            style={{
              width: "100%",
              height: "100%",
              opacity: stage === 0 ? 0.5 : 1,
            }}
          />
        ) : (
          <Icon name="Video" size={48} color="white" />
        )}
        {demo && <FrameBadge>Sample run</FrameBadge>}
        {saving && <FrameBadge>Saving on this device</FrameBadge>}
        {stage === 0 && running && (
          <UploadBar
            progress={demo ? null : (j.progress ?? 0) / 100}
            ms={DEMO_STAGE_MS[0]}
          />
        )}
        {demo && stage >= 1 && <SampleOverlay caption={line || undefined} />}
        {running && stage === 1 && <ScanSweep />}
      </View>
      <StageDots stage={stage} preparing={preparing} />
      <Announce message={caption[0]} />
      {/* The caption changes in place: a short fade and rise, never a blank. */}
      <FadeArrival identity={`${j.id}-${caption[0]}`} distance={8} duration={320}>
        <View style={{ minHeight: 84, marginTop: 12, marginBottom: 4, paddingLeft: 40 }}>
          <View style={{ position: "absolute", left: 0, top: 2 }}>
            <DoneSpark working={running && !saving} done={done} />
          </View>
          <T
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={{ fontSize: 27, lineHeight: 30, fontWeight: "800", letterSpacing: -0.68 }}
          >
            {caption[0]}
          </T>
          <T style={{ marginTop: 6, color: C.muted, fontSize: 16, lineHeight: 22 }}>
            {caption[1]}
          </T>
        </View>
      </FadeArrival>
      {findings.length > 0 && (
        // The card arrives with its first row, so it never shows as an empty grey box.
        <Arrival identity={j.id} distance={8}>
          <View
            style={{
              marginTop: 6,
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
      <CostTotal
        value={demo ? cost : null}
        note={demo ? "24 s clip" : "Not reported by the server"}
        settled={done}
      />
      {!running && !done && (
        <View style={{ marginTop: 16, gap: 12 }}>
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
        </View>
      )}
      {running && !saving && !demo && (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <Quiet title="Stop waiting" onPress={rr.cancel} />
        </View>
      )}
    </Page>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const lawRef = (law: RoadCase["offences"][number]["lawSources"][number]) =>
  law.act && law.section ? `${law.act}, ${law.section}` : law.title || law.act || "";
function lawSourcesOf(c: RoadCase) {
  const seen = new Set<string>();
  return c.offences
    .filter((o) => o.included)
    .flatMap((o) => o.lawSources)
    .filter((law) => {
      const key = lawRef(law);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
function quoteAt(
  narration: { start_seconds: number; event: string }[],
  at: number,
) {
  return (
    narration
      .filter((l) => Math.abs(l.start_seconds - at) <= 1)
      .sort((a, b) => Math.abs(a.start_seconds - at) - Math.abs(b.start_seconds - at))[0]
      ?.event || ""
  );
}
/** Reference verdict(): this case's points weighed against the points already on the plate. */
function verdict(c: RoadCase | undefined, adds: number, had: number): [string, string] {
  if (!c || !c.offences.length)
    return ["No suspected offence", "Gemini found nothing to report. Humanity survives."];
  if (!adds)
    return [
      plural(c.offences.filter((o) => o.included).length, "suspected offence"),
      "Nothing sent. I’m a snitch with boundaries.",
    ];
  if (!c.vehicle.plate)
    return [`+${adds} demerit points.`, "I couldn’t read the plate. Add it and I’ll check their record."];
  const total = had + adds;
  if (!had) return [`+${adds} demerit points.`, `${20 - total} more and they’re taking the bus.`];
  return [
    `+${adds} demerit points.`,
    total >= 20
      ? `${c.vehicle.plate} already has ${had}. This could make it ${total}: licence suspended.`
      : `${c.vehicle.plate} already has ${had}. ${20 - total} more and they’re taking the bus.`,
  ];
}

/** Upload darkens the footage under a white progress bar; the demo fills it over the stage. */
function UploadBar({ progress, ms }: { progress: number | null; ms: number }) {
  const { reduced } = useRoad();
  const v = React.useRef(new Animated.Value(progress ?? 0)).current;
  useEffect(() => {
    if (progress !== null) {
      v.setValue(progress);
      return;
    }
    v.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const a = Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [progress, ms, reduced, v]);
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <Animated.View
        style={{
          height: 4,
          backgroundColor: "white",
          transformOrigin: "left center",
          transform: [{ scaleX: v }],
        }}
      />
    </View>
  );
}

/** Upload · Watch · Law · Judge: done in Gemini Blue, current in Ink; dots pop as they advance. */
function StageDots({ stage, preparing }: { stage: number; preparing: boolean }) {
  return (
    <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 }}>
      {["Upload", "Watch", "Law", "Judge"].map((name, i) => {
        const doneDot = !preparing && i < stage,
          now = !preparing && i === stage;
        return (
          <View
            key={name}
            accessible
            accessibilityLabel={`${name}: ${preparing ? "waiting for the saved recording" : doneDot ? "done" : now ? "working" : "next"}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <StageDot
              color={doneDot ? C.accent : now ? C.ink : C.lilac}
              pop={doneDot || now}
              identity={`${stage}`}
              recent={i === stage || i === stage - 1}
            />
            <T
              style={{
                fontSize: 12,
                lineHeight: 15,
                fontWeight: "700",
                color: doneDot ? C.accent : now ? C.ink : C.muted,
              }}
            >
              {name}
            </T>
          </View>
        );
      })}
    </View>
  );
}
function StageDot({
  color,
  pop,
  identity,
  recent,
}: {
  color: string;
  pop: boolean;
  identity: string;
  recent: boolean;
}) {
  const { reduced, foreground } = useRoad();
  const v = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pop || !recent || reduced || !foreground) return;
    v.setValue(0.6);
    const a = Animated.sequence([
      Animated.timing(v, { toValue: 1.5, duration: 230, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 190, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [identity, pop, recent, reduced, foreground, v]);
  return (
    <Animated.View
      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, transform: [{ scale: v }] }}
    />
  );
}
/** The caption spark spins while Gemini works and pops when the verdict lands. */
function DoneSpark({ working, done }: { working: boolean; done: boolean }) {
  const { reduced, foreground } = useRoad();
  const v = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!done || reduced || !foreground) return;
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration: 620, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [done, reduced, foreground, v]);
  return (
    <Animated.View
      style={{
        transform: [
          { scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 1.15, 1] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["-180deg", "0deg"] }) },
        ],
      }}
    >
      <Spark working={working} />
    </Animated.View>
  );
}
/** The run's cost as a dashed receipt total; it pulses once when the run settles. */
function CostTotal({ value, note, settled }: { value: number | null; note: string; settled: boolean }) {
  const { reduced, foreground } = useRoad();
  const pulse = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!settled || reduced || !foreground) return;
    pulse.setValue(1.04);
    const a = Animated.timing(pulse, { toValue: 1, duration: 360, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [settled, reduced, foreground, pulse]);
  return (
    <Animated.View
      style={{
        marginTop: 6,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: C.lineHover,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        transform: [{ scale: pulse }],
      }}
    >
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 13, lineHeight: 16, fontWeight: "700" }}>Estimated AI cost</T>
        <T style={{ marginTop: 3, fontSize: 13, lineHeight: 17, fontWeight: "600", color: C.muted }}>
          {note}
        </T>
      </View>
      {value === null ? (
        <T style={{ fontSize: 22, lineHeight: 24, fontWeight: "800", color: C.accent }}>—</T>
      ) : (
        <CostCounter value={value} />
      )}
    </Animated.View>
  );
}

const PAGE = 30;
export function StandardImpact() {
  const rr = useRoad(),
    store = useStore();
  const [period, setPeriod] = useState(0),
    [status, setStatus] = useState(0),
    [plate, setPlate] = useState(""),
    [offence, setOffence] = useState(""),
    // Live history can grow without bound; rows render a page at a time inside the scroll view.
    [shown, setShown] = useState(PAGE);
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
  const meterLine = top
    ? 20 - top.record - top.pending > 0
      ? `${20 - top.record - top.pending} more points and they’re taking the bus.`
      : top.pending
        ? top.reports > 1
          ? "Your reports could take their licence."
          : "Your report could take their licence."
        : "Licence suspended. Enjoy the bus."
    : remoteCount
      ? `${remoteCount} server case${remoteCount === 1 ? "" : "s"}. Licence records are not available.`
      : rr.prefs.demo
        ? "Nobody yet. Report a red-light runner and they land here."
        : "Licence records are not available yet.";
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
    <Page
      title="Impact"
      gap={0}
      onRefresh={rr.prefs.demo ? undefined : () => void rr.syncCases(true).catch(showError)}
      refreshing={rr.syncingCases}
    >
      <View style={{ marginBottom: 18 }}>
        <Intro
          title="Your impact. Their problem."
          body="I keep receipts. Karma loves paperwork."
        />
      </View>
      {!!rr.historyError && (
        <View style={{ marginBottom: 12 }}>
          <Notice error>{rr.historyError}</Notice>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        {(
          [
            [remote?.snitchedCount ?? data.sent, "Assholes\nreported", "reported"],
            [remote?.billedCount ?? data.billed, "Got billed", "billed"],
          ] as const
        ).map(([value, label, kind], i) => (
          <View
            key={kind}
            style={{
              flex: 1,
              minHeight: width < 350 ? 132 : 150,
              padding: width < 350 ? 14 : 16,
              backgroundColor: C.surface,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {/* Prototype's receipt outline, drawn in on arrival behind the count. */}
            <ReceiptArt kind={kind} index={i} />
            <Count value={Number(value)} size={width < 350 ? 54 : 72} />
            <T style={{ marginTop: 10, fontSize: 15, lineHeight: 18, fontWeight: "700" }}>
              {label}
            </T>
          </View>
        ))}
      </View>
      <MeterEntrance>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            topPlate
              ? `Filter cases for ${topPlate}`
              : "Top offender: nobody yet"
          }
          disabled={!topPlate}
          onPress={() => setPlate(plate ? "" : normalizePlate(topPlate))}
          style={({ pressed }) => ({
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 18,
            borderRadius: 16,
            backgroundColor: C.ink,
            gap: 12,
            // Selected: a 3pt Gemini Blue ring that does not move the layout.
            outlineWidth: plate ? 3 : 0,
            outlineColor: C.accent,
            outlineStyle: "solid",
            transform: [{ scale: pressed && !rr.reduced ? 0.985 : 1 }],
          })}
        >
          <View style={[s.row, { minHeight: 33 }]}>
            <T
              style={{
                fontSize: width < 350 ? 18 : 20,
                lineHeight: 22,
                fontWeight: "800",
                letterSpacing: -0.2,
                color: "white",
              }}
            >
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
                  backgroundColor: C.paper,
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
            key={meterLine}
            balance
            style={{
              marginTop: -4,
              fontSize: width < 350 ? 16 : 17,
              lineHeight: 22,
              fontWeight: top ? "800" : "600",
              color: top ? C.penaltyLight : C.lineHover,
            }}
          >
            {meterLine}
          </T>
          {top ? (
            <MeterBar
              record={top.record}
              pending={top.pending}
              delay={260}
              pendingDelay={760}
            />
          ) : rr.prefs.demo ? (
            <MeterBar record={0} pending={0} />
          ) : (
            <T style={{ color: "#B6BAC2", fontSize: 12 }}>
              The backend does not return licence points for live cases.
            </T>
          )}
          {top && (
            <MeterKey record={top.record} pending={top.pending} reports={top.reports} />
          )}
        </Pressable>
      </MeterEntrance>
      <View>
        <View style={[s.row, { marginBottom: 4 }]}>
          <T style={s.section}>By offence</T>
          <PeriodSelect value={period} onChange={setPeriod} />
        </View>
        <T style={{ marginBottom: 6, fontSize: 14, lineHeight: 20, color: C.muted }}>
          Pick an offence. I’ll find the clip.
        </T>
      </View>
      {categories.map(([code, name], i) => (
        <Pressable
          key={code}
          accessibilityRole="button"
          accessibilityLabel={`Filter ${name}`}
          accessibilityState={{ selected: offence === code }}
          onPress={() => setOffence(offence === code ? "" : code)}
          style={({ pressed }) => ({
            gap: 7,
            paddingVertical: 9,
            transform: [{ scale: pressed && !rr.reduced ? 0.99 : 1 }],
          })}
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
                lineHeight: 20,
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
      <View style={{ marginTop: 18, marginBottom: 12 }}>
        <Segments
          items={[
            ["All", scoped.length],
            ["Needs you", scoped.filter(needs).length],
            ["Sent", scoped.filter((c) => c.reporting.status === "sent").length],
          ]}
          value={status}
          onChange={setStatus}
        />
      </View>
      {(plate || offence) && (
        <View
          style={{
            marginBottom: 10,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          {!!plate && <FilterChip title={`Plate ${topPlate}`} onPress={() => setPlate("")} />}
          {!!offence && (
            <FilterChip
              title={categories.find(([code]) => code === offence)?.[1] || offence}
              onPress={() => setOffence("")}
            />
          )}
          <Quiet
            title="Clear filters"
            onPress={() => {
              setPlate("");
              setOffence("");
            }}
          />
        </View>
      )}
      <View>
        {list.slice(0, shown).map((c, i) => (
          <Arrival key={c.id} delay={320 + Math.min(i, 5) * 45} distance={10}>
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
                  fontSize: 13,
                  lineHeight: 16,
                  fontWeight: "700",
                  color:
                    c.reporting.status === "sent"
                      ? C.green
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
        {list.length > shown && (
          <TextLink
            title={`Show ${Math.min(PAGE, list.length - shown)} more`}
            weight="600"
            onPress={() => setShown(shown + PAGE)}
          />
        )}
        {!list.length &&
          (rr.cases.length ? (
            <T style={{ marginTop: 14, fontSize: 18, lineHeight: 26, color: C.muted }}>
              Nothing here. Suspiciously well-behaved.
            </T>
          ) : (
            // First use: say where cases come from and offer the way in.
            <View style={{ marginTop: 14, alignItems: "flex-start" }}>
              <T style={{ fontSize: 18, lineHeight: 26, color: C.muted }}>
                No reports yet. Analyse a clip and it lands here.
              </T>
              <TextLink
                title="Analyse a clip"
                weight="600"
                align="flex-start"
                onPress={() => go("clip")}
              />
            </View>
          ))}
      </View>
      {remoteError && (
        <T style={s.muted}>
          Cloud impact is unavailable, so these counters use this device.
        </T>
      )}
    </Page>
  );
}

const RECEIPT_ART = {
  reported: [
    ["M104 -16H144L190 30V180H104V-16Z", 537.1],
    ["M144 -16V30H190", 92],
    ["M119 62H173", 54],
    ["M119 80H161", 42],
    ["M119 98H152", 33],
  ],
  billed: [
    ["M114 -12H188V176L176 168L164 176L152 168L140 176L128 168L114 176V-12Z", 538.2],
    ["M130 22H172", 42],
    ["M130 41H160", 30],
    ["M130 75L143 88L166 63", 52.4],
  ],
} as const;
const AnimatedArtPath = Animated.createAnimatedComponent(Path);
/** The counter cards' receipt outlines (reference .icard-art), drawn in as Impact arrives. */
function ReceiptArt({ kind, index }: { kind: "reported" | "billed"; index: number }) {
  const { reduced, foreground } = useRoad();
  const paths = RECEIPT_ART[kind];
  // The reference draws two strokes per card: the outline, then its details as one path, so the
  // fold and lines follow each other. Each detail segment takes its share of that second stroke.
  const strokes = React.useRef([0, 1].map(() => new Animated.Value(reduced ? 1 : 0))).current;
  const details = paths.slice(1).reduce((sum, [, length]) => sum + length, 0);
  useEffect(() => {
    if (reduced || !foreground) {
      strokes.forEach((v) => v.setValue(1));
      return;
    }
    // One stroke every 70ms across both cards, as the reference staggers its .icard-art paths.
    const a = Animated.parallel(
      strokes.map((v, i) => {
        v.setValue(0);
        return Animated.timing(v, {
          toValue: 1,
          duration: 900,
          delay: 120 + (index * 2 + i) * 70,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: false,
        });
      }),
    );
    a.start();
    return () => a.stop();
  }, [strokes, index, reduced, foreground]);
  let start = 0;
  return (
    <View pointerEvents="none" style={{ position: "absolute", right: -30, top: -6 }}>
      <Svg width={150} height={150} viewBox="0 0 180 180" fill="none">
        {paths.map(([d, length], i) => {
          const from = i ? start / details : 0;
          const to = i ? (start += length) / details : 1;
          return (
            <AnimatedArtPath
              key={i}
              d={d}
              stroke={C.lineHover}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[length, length]}
              strokeDashoffset={strokes[i ? 1 : 0].interpolate({
                inputRange: [from, to],
                outputRange: [length, 0],
                extrapolate: "clamp",
              })}
            />
          );
        })}
      </Svg>
    </View>
  );
}
/** The licence meter rises in before its bar fills. */
function MeterEntrance({ children }: React.PropsWithChildren) {
  const { reduced, foreground } = useRoad();
  const v = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced || !foreground) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 480,
      delay: 120,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, reduced, foreground]);
  return (
    <Animated.View
      style={{
        marginBottom: 26,
        opacity: v,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
const PERIODS = ["All time", "Last 7 days", "Today"];
/** Reference: a select pill beside "By offence"; iOS shows the choices as an action sheet. */
function PeriodSelect({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Impact date range, ${PERIODS[value]}`}
      onPress={() => {
        if (Platform.OS === "ios")
          ActionSheetIOS.showActionSheetWithOptions(
            { options: [...PERIODS, "Cancel"], cancelButtonIndex: PERIODS.length },
            (i) => i < PERIODS.length && onChange(i),
          );
        else onChange((value + 1) % PERIODS.length);
      }}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingLeft: 14,
        paddingRight: 11,
        borderRadius: 999,
        backgroundColor: C.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <T style={{ fontSize: 14, lineHeight: 18, fontWeight: "600" }}>{PERIODS[value]}</T>
      <View style={{ transform: [{ rotate: "90deg" }] }}>
        <Icon name="ChevronRight" size={14} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}
function FilterChip({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Clear ${title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingLeft: 14,
        paddingRight: 10,
        borderRadius: 999,
        backgroundColor: C.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <T style={{ fontSize: 14, lineHeight: 18, fontWeight: "600" }}>{title}</T>
      <Icon name="X" size={14} />
    </Pressable>
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
  const demo = isSubmissionDemo(c);
  const original = c.analysis;
  const trail = c.decisionTrail;
  const storedResult = store.records.find((r) => r.id === c.sourceId)?.result;
  const timeline = original?.timeline || storedResult?.evidence.timeline || [];
  const offences =
    original?.offences ||
    (storedResult
      ? storedResult.reportable.map((f, i) => ({
          id: String(i),
          code: "",
          label: f.conduct,
          atSeconds: f.start_seconds,
          confidence: f.confidence,
          included: true,
          reasoning: f.reasoning,
          demeritPoints: undefined as number | undefined,
          lawSources: [{ title: f.legal_basis }] as RoadCase["offences"][number]["lawSources"],
        }))
      : []);
  const plate = original?.vehicle.plate || c.vehicle.plate || "";
  const adds = casePoints(c);
  const record = licenceRecord(c);
  // Reference "What it found and cited": one grey table. The sample's run telemetry is fixture data;
  // a live review shows only what the server returned.
  const stats: Stat[] = [];
  if (demo)
    stats.push(
      { k: "Model", v: "Gemini" },
      { k: "Clip", v: "24 s · 24 frames at 1 fps" },
      { k: "Video tokens", v: "6,192" },
    );
  stats.push({ k: "Plate", v: plate || "Unreadable" });
  offences.forEach((o) =>
    stats.push({
      k: duration(o.atSeconds),
      v: o.label,
      sub: demo ? undefined : o.reasoning,
      n: o.demeritPoints ? <PointsChip points={o.demeritPoints} /> : undefined,
    }),
  );
  lawSourcesOf({ ...c, offences: offences as RoadCase["offences"] }).forEach((law) =>
    stats.push({
      k: "Law",
      v: lawRef(law),
      sub: law.act && law.section ? law.title : undefined,
    }),
  );
  if (demo && plate && adds)
    stats.push({
      k: "Summons lookup",
      v: record
        ? `${plural(record.summonses, "summons").replace("summonss", "summonses")} · ${record.points} pts`
        : "No summons on record",
      sub: plate,
    });
  if (demo)
    stats.push(
      { k: "Report agent", v: `${(520 + offences.length * 140).toLocaleString("en-GB")} tokens` },
      { k: "Total time", v: "19.2 s" },
      { k: "Estimated AI cost", v: "US$0.0012" },
      {
        k: "At scale",
        v: "30-min drive: US$0.09",
        sub: `A month of driving (≈${Math.round(6.51 / 0.09 / 2)} h): US$6.51`,
      },
    );
  const json = demo
    ? {
        description: timeline.map((l) => ({ at: duration(l.start_seconds), text: l.event })),
        vehicle: { type: c.vehicle.type, plate: c.vehicle.plate },
        offences: c.offences.map((o) => ({
          code: o.code,
          at: duration(o.atSeconds),
          confidence: o.confidence,
          evidence: quoteAt(timeline, o.atSeconds) || o.reasoning || null,
          demeritPoints: o.demeritPoints ?? null,
          lawSources: o.lawSources.map((law) => ({
            act: law.act ?? null,
            section: law.section ?? null,
            title: law.title ?? null,
            url: law.url ?? null,
          })),
        })),
        missing: missing(c),
        costUsd: 0.0012,
      }
    : storedResult || original;
  return (
    <Page
      title="How Gemini decided"
      nav={false}
      gap={0}
      headerRight={<CaseId c={c} />}
    >
      <T style={{ marginTop: 6, marginBottom: 18, fontSize: 16, lineHeight: 23, color: C.muted }}>
        What Gemini saw, found and cited for {c.id.replace("SUB-", "")}.
        {demo ? " Sample run: fixture output shaped like the backend’s." : ""}
      </T>
      <T style={s.section}>What Gemini saw</T>
      <View style={{ marginTop: 12, gap: 12 }}>
        {timeline.length ? (
          timeline.map((line, i) => (
            <Arrival key={i} delay={60 + Math.min(i, 9) * 50} distance={10}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <T
                  style={{
                    width: 44,
                    fontSize: 13,
                    lineHeight: 22,
                    fontWeight: "700",
                    color: C.muted,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {duration(line.start_seconds)}
                </T>
                <T style={{ flex: 1, fontSize: 16, lineHeight: 22, fontWeight: "600", color: C.accent }}>
                  {line.event}
                </T>
              </View>
            </Arrival>
          ))
        ) : (
          <T style={s.muted}>No timestamped description was saved for this case.</T>
        )}
      </View>
      <T style={[s.section, { marginTop: 28, marginBottom: 6 }]}>What it found and cited</T>
      {trail?.excerptVideoUrl?.startsWith("https://") && (
        <View style={{ marginBottom: 10 }}>
          <Action
            title="Watch cited evidence excerpt"
            secondary
            icon="Video"
            onPress={() => void Linking.openURL(trail.excerptVideoUrl!).catch(showError)}
          />
        </View>
      )}
      <View style={{ borderRadius: 16, backgroundColor: C.surface, overflow: "hidden" }}>
        {stats.map((stat, i) => (
          <Arrival key={`${stat.k}-${i}`} delay={i * 60} distance={8}>
            <View
              style={{
                minHeight: 50,
                paddingVertical: 10,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderTopWidth: i ? 1 : 0,
                borderColor: C.line,
              }}
            >
              <T
                style={{
                  width: 100,
                  fontSize: 13,
                  lineHeight: 16,
                  fontWeight: "700",
                  color: C.muted,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {stat.k}
              </T>
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 15, lineHeight: 20, fontWeight: "700", color: C.accent }}>
                  {stat.v}
                </T>
                {!!stat.sub && (
                  <T style={{ marginTop: 3, fontSize: 13, lineHeight: 17, color: C.muted }}>
                    {stat.sub}
                  </T>
                )}
              </View>
              {stat.n}
            </View>
          </Arrival>
        ))}
      </View>
      {!!trail?.citations.length && (
        <View style={{ marginTop: 18 }}>
          <Disclosure
            title="Retrieved law text"
            note={`${trail.citations.length} citation${trail.citations.length === 1 ? "" : "s"}`}
          >
            <View style={{ gap: 14 }}>
              {trail.citations.map((citation, index) => (
                <View key={index} style={{ gap: 6 }}>
                  <T style={{ fontWeight: "700" }}>
                    {[citation.statute, citation.section].filter(Boolean).join(", ")}
                  </T>
                  {!!citation.quote && <T>{citation.quote}</T>}
                  {!!citation.penalty && (
                    <T style={s.muted}>Penalty cited: {citation.penalty}</T>
                  )}
                </View>
              ))}
            </View>
          </Disclosure>
        </View>
      )}
      {!!trail?.gaps.length && (
        <View style={{ marginTop: 12 }}>
          <Notice>Retrieval gaps: {trail.gaps.join(" ")}</Notice>
        </View>
      )}
      {!original && !storedResult && !demo && (
        <T style={[s.muted, { marginTop: 12 }]}>
          This older case has no saved original response. Its edited report details are
          available on the Case screen.
        </T>
      )}
      {!demo && (
        <T style={[s.muted, { marginTop: 12 }]}>
          The server does not return its model ID, timing, token usage or frame counts.
        </T>
      )}
      {!!json && (
        <View style={{ marginTop: 18 }}>
          <Disclosure title="What Gemini returned" note="Structured JSON">
            {/* Reference: the raw model output in a grey code box. */}
            <View
              style={{
                marginBottom: 10,
                maxHeight: 260,
                borderRadius: 12,
                backgroundColor: C.surface,
                overflow: "hidden",
              }}
            >
              <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 12 }}>
                <T
                  selectable
                  style={{
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    fontSize: 12.5,
                    lineHeight: 18,
                    // Menlo has no 500; anything above 400 renders as its bold.
                    fontWeight: "400",
                    color: C.code,
                  }}
                >
                  {/* The reference flattens nesting to a one-space indent so long lines wrap less. */}
                  {JSON.stringify(json, null, 1).replace(/\n\s*/g, "\n ")}
                </T>
              </ScrollView>
            </View>
          </Disclosure>
        </View>
      )}
    </Page>
  );
}
type Stat = { k: string; v: string; sub?: string; n?: React.ReactNode };

type Finding = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  delay?: number;
  trailing?: React.ReactNode;
  /** Still arriving: a spinner instead of the check, the value in Muted Slate. */
  wait?: boolean;
  /** Needs the user (an unread plate): amber instead of blue. */
  need?: boolean;
};
// Reference grid: check · label · value · trailing chip, so every row's value starts on the same column.
function FindingRow({
  label,
  value,
  sub,
  delay = 0,
  trailing,
  wait = false,
  need = false,
  divider = false,
}: Omit<Finding, "key"> & { divider?: boolean }) {
  const tone = need ? C.warning : C.accent;
  return (
    <Arrival distance={10} delay={delay}>
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
        <View style={{ width: 24, alignItems: "center" }}>
          {wait ? (
            <Spinner />
          ) : (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: tone,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name={need ? "CircleAlert" : "Check"}
                color="white"
                size={14}
                strokeWidth={3}
              />
            </View>
          )}
        </View>
        <T
          style={{
            width: 66,
            fontSize: 13,
            lineHeight: 16,
            fontWeight: "700",
            color: need ? C.warning : C.muted,
            fontVariant: ["tabular-nums"],
          }}
        >
          {label}
        </T>
        <View style={{ flex: 1 }}>
          <T
            style={{
              fontSize: 15,
              lineHeight: 20,
              fontWeight: "600",
              color: wait ? C.muted : tone,
            }}
          >
            {value}
          </T>
          {!!sub && (
            <T
              style={{
                marginTop: 3,
                fontSize: 13,
                lineHeight: 17,
                color: tone,
              }}
            >
              {sub}
            </T>
          )}
        </View>
        {trailing}
      </View>
    </Arrival>
  );
}
function Spinner() {
  const { reduced } = useRoad();
  const v = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const a = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    );
    a.start();
    return () => a.stop();
  }, [reduced, v]);
  return (
    <Animated.View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2.5,
        borderColor: C.lilac,
        borderTopColor: C.accent,
        transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
      }}
    />
  );
}
