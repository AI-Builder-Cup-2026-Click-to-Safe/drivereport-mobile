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
import { Arrival, Count, Disclosure, ScanSweep, Spark } from "./standard-ui";
import { ImpactBar } from "./motion";
import {
  RoadStat,
  MeterBar,
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
            <Action title="Analyse a clip" onPress={() => go("clip")} />
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
            title="Gemini is still working · see progress"
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
  const [chosen, setChosen] = useState("");
  const [demo, setDemo] = useState(true);
  const [busy, setBusy] = useState(false);
  const file = store.records.find((r) => r.id === chosen);
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
      setDemo(false);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setBusy(true);
    try {
      if (!demo && !store.settings.token)
        throw Error(
          "Add your API access token in Settings → Developer before analysing.",
        );
      if (!demo && rr.prefs.region !== "MY")
        throw Error(
          "Live legal analysis currently supports Malaysia. Change the region in Settings or use the demo clip.",
        );
      if (demo) await rr.seed();
      else await rr.setPrefs({ demo: false });
      void rr.begin(demo ? [] : [chosen], demo).catch(showError);
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
          disabled={(!file && !demo) || busy || rr.job?.status === "running"}
          onPress={() => void start()}
        />
      }
    >
      {file || demo ? (
        <View style={{ gap: 12 }}>
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
            {demo || file?.thumbnail ? (
              <Image
                source={demo ? demoFrame : { uri: file!.thumbnail }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Icon name="Video" color="white" size={44} />
            )}
            {demo && (
              <T
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  color: "white",
                  backgroundColor: "#111318BB",
                  borderRadius: 12,
                  padding: 5,
                  fontSize: 12,
                }}
              >
                Synthetic demo · 00:24
              </T>
            )}
          </View>
          <T style={{ fontSize: 17, fontWeight: "700" }}>
            {demo ? "dashcam_kl_0842.mp4" : file!.name}
          </T>
          <T style={s.muted}>
            {demo
              ? "00:24 · 2.8 MB · Kuala Lumpur · Daylight"
              : `${(file!.size / 1e6).toFixed(1)} MB · saved on this device`}
          </T>
        </View>
      ) : (
        <T style={{ color: C.muted }}>No clip yet.</T>
      )}
      <Action
        secondary
        title={file || demo ? "Change video" : "Choose a file"}
        disabled={busy}
        icon="Upload"
        onPress={() => void choose()}
      />
      <Quiet
        title="Use the demo clip"
        onPress={() => {
          setDemo(true);
          setChosen("");
        }}
      />
      <T style={s.section}>For the best result</T>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Icon name="Sun" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Daylight footage</T>
          <T style={s.muted}>Gemini has to read the plate.</T>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Icon name="Clock" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Short clips, up to 300 MB</T>
          <T style={s.muted}>
            Gemini bills us by the second. We are really poor.
          </T>
        </View>
      </View>
      {store.records.length > 0 && (
        <Disclosure
          title="Saved recordings"
          note={String(store.records.length)}
        >
          {store.records.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`Select ${r.name}`}
              onPress={() => {
                setChosen(r.id);
                setDemo(false);
              }}
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
    running = j.status === "running";
  const result =
    rr.allCases.find((c) => j.caseIds.includes(c.id)) ||
    (j.mode === "demo"
      ? (submissionFixtures.allCases[0] as RoadCase)
      : undefined);
  const file = store.records.find((r) => j.sourceIds.includes(r.id));
  const stage = done ? 4 : j.stage;
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
      title="Gemini at work"
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
        {j.mode === "demo" || file?.thumbnail ? (
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
        <T
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            color: "white",
            backgroundColor: "#111318BB",
            borderRadius: 12,
            padding: 5,
            fontSize: 12,
          }}
        >
          {j.mode === "demo" ? "Synthetic demo" : "Your recording"}
        </T>
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
                accessibilityLabel={`${name}: ${done || i < stage ? "complete" : i === stage ? "working" : "awaiting result"}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor:
                    done || i < stage
                      ? C.accent
                      : i === stage
                        ? C.ink
                        : C.lilac,
                }}
              />
              <T
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: done || i < stage ? C.accent : C.muted,
                }}
              >
                {name}
              </T>
            </View>
          ))}
        </View>
        <T style={s.muted}>
          {done
            ? "Done"
            : !running
              ? "Paused"
              : j.mode === "live" && stage > 0
                ? "Review in progress"
                : `${stage + 1} of 4`}
        </T>
      </View>
      <Arrival identity={`${j.id}-${stage}-${j.status}`} distance={8}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Spark working={running} />
          <View style={{ flex: 1, gap: 8 }}>
            <T
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={{
                fontSize: 25,
                lineHeight: 29,
                fontWeight: "800",
                letterSpacing: -0.6,
              }}
            >
              {running || done ? captions[stage][0] : "Analysis interrupted"}
            </T>
            <T style={{ color: C.muted, fontSize: 14, lineHeight: 20 }}>
              {running || done
                ? captions[stage][1]
                : j.error || "Your recording is still saved."}
            </T>
          </View>
        </View>
      </Arrival>
      {result && (done || j.mode === "demo") && (
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {(done || stage >= 1) && (
            <FindingRow
              label="Watched"
              value={
                j.mode === "demo"
                  ? "24 frames · plate read"
                  : "Recording reviewed"
              }
            />
          )}
          {(done || stage >= 2) &&
            result.offences
              .flatMap((o) => o.lawSources)
              .slice(0, 1)
              .map((law, i) => (
                <FindingRow
                  key={i}
                  label="Law"
                  value={[law.act || law.title, law.section]
                    .filter(Boolean)
                    .join(", ")}
                />
              ))}
          {(done || stage >= 3) &&
            result.offences.map((o, i) => (
              <Arrival key={o.id} delay={i * 240}>
                <View
                  style={{
                    padding: 10,
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <T style={s.muted}>{duration(o.atSeconds)}</T>
                  <T
                    style={{
                      flex: 1,
                      color: C.accent,
                      fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    {o.label}
                  </T>
                  <PointsChip
                    points={o.demeritPoints ?? 0}
                    delay={260 + i * 240}
                  />
                </View>
              </Arrival>
            ))}
          {done && (
            <FindingRow
              label="Record"
              value={
                licenceRecord(result)
                  ? `${result.vehicle.plate} · ${licenceRecord(result)!.points} pts on record`
                  : "Licence lookup unavailable"
              }
            />
          )}
        </View>
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
            title="Retry analysis"
            secondary
            onPress={() =>
              void rr.begin(j.sourceIds, j.mode === "demo").catch(showError)
            }
          />
        </>
      )}
      {running && <Quiet title="Stop waiting" onPress={rr.cancel} />}
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
      <Intro title="Your impact. Their problem." />
      <T style={s.muted}>I keep receipts. Karma loves paperwork.</T>
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
            <T style={{ fontSize: 14, fontWeight: "700" }}>{label}</T>
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
                  fontSize: 18,
                  fontWeight: "800",
                  color: C.ink,
                  backgroundColor: "#F5F5F0",
                  padding: 5,
                  borderRadius: 6,
                }}
              >
                {topPlate}
              </T>
            )}
          </View>
          <T style={{ fontWeight: "800", color: top ? "#FF9B8F" : "#B6BAC2" }}>
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
            <T style={{ color: "white", fontSize: 12 }}>
              {top.record} on record · {top.pending} from your report
              {isSubmissionDemo(top.case) ? " · demo" : ""}
            </T>
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
          onPress={() => setOffence(offence === code ? "" : code)}
          style={{ gap: 8 }}
        >
          <View style={s.row}>
            <T style={{ fontSize: 14, flex: 1 }}>{name}</T>
            <T>{remote ? remoteOffenceCount(code) : data.counts[code]}</T>
          </View>
          <ImpactBar
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
                paddingVertical: 15,
                borderBottomWidth: 1,
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
                  width: 54,
                  height: 54,
                  borderRadius: 10,
                  backgroundColor: C.lilac,
                }}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <T style={{ fontWeight: "700" }}>
                  {c.vehicle.plate ||
                    (c.offences.length
                      ? "Plate unreadable"
                      : "Suspiciously civil")}
                </T>
                <T style={s.muted}>
                  {c.offences.length} offence
                  {c.offences.length === 1 ? "" : "s"} ·{" "}
                  {c.incident.date || "Date unknown"}
                </T>
              </View>
              <T
                style={{
                  fontSize: 12,
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

function FindingRow({ label, value }: { label: string; value: string }) {
  return (
    <Arrival distance={8}>
      <View
        style={{
          padding: 10,
          flexDirection: "row",
          gap: 8,
          borderBottomWidth: 1,
          borderColor: C.line,
        }}
      >
        <Icon name="Check" color={C.accent} size={16} />
        <T style={[s.muted, { width: 58 }]}>{label}</T>
        <T
          style={{ color: C.accent, fontSize: 14, flex: 1, fontWeight: "600" }}
        >
          {value}
        </T>
      </View>
    </Arrival>
  );
}
