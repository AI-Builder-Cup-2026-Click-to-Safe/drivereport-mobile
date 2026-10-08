import React, { useState } from "react";
import { Image, Pressable, View, useWindowDimensions } from "react-native";
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
        <Arrival delay={170}>
          <T
            accessibilityRole="header"
            style={{
              fontSize: width < 350 ? 38 : 46,
              lineHeight: width < 350 ? 40 : 48,
              fontWeight: "800",
              letterSpacing: -1.6,
            }}
          >
            Spotted an asshole?
          </T>
        </Arrival>
        <Arrival delay={260}>
          <T style={{ fontSize: 18, lineHeight: 26, color: C.muted }}>
            Show me the clip. Gemini finds the offence, reads the plate and
            cites the law. You tap Send.
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
  const [demo, setDemo] = useState(false);
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
      await rr.setPrefs({ demo });
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
      <Intro title="Your clip" />
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
            {demo ? "Kuala Lumpur · demo clip" : file!.name}
          </T>
          <T style={s.muted}>
            {demo
              ? "Simulated analysis · no upload"
              : `${(file!.size / 1e6).toFixed(1)} MB · saved on this device`}
          </T>
        </View>
      ) : (
        <T style={{ color: C.muted }}>No clip yet.</T>
      )}
      <Action
        secondary
        title={file || demo ? "Use a different clip" : "Choose a file"}
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
      <T style={s.muted}>
        Small daylight clips, please. Gemini bills us. We are really poor.
      </T>
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
  const result = rr.allCases.find((c) => j.caseIds.includes(c.id));
  const file = store.records.find((r) => j.sourceIds.includes(r.id));
  const stage = done ? 4 : j.stage;
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
        : "Case ready",
      result && missing(result).length
        ? "Check the case and fill in the missing details."
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
      footer={
        done ? (
          <Action
            title={
              result && missing(result).length
                ? "Add missing details"
                : "See the case"
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
          aspectRatio: 16 / 9,
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
        {running && stage === 1 && <ScanSweep />}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {["Upload", "Watch", "Law", "Judge"].map((name, i) => (
            <View
              key={name}
              accessible
              accessibilityLabel={`${name}: ${done || i < stage ? "complete" : i === stage ? "working" : "awaiting result"}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  done || i < stage ? C.accent : i === stage ? C.ink : C.lilac,
              }}
            />
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
                fontSize: 27,
                lineHeight: 31,
                fontWeight: "800",
                letterSpacing: -0.6,
              }}
            >
              {running || done ? captions[stage][0] : "Analysis interrupted"}
            </T>
            <T style={{ color: C.muted }}>
              {running || done
                ? captions[stage][1]
                : j.error || "Your recording is still saved."}
            </T>
          </View>
        </View>
      </Arrival>
      {result && done && (
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {result.offences.map((o, i) => (
            <Arrival key={o.id} delay={i * 240} distance={10}>
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                  padding: 14,
                  borderBottomWidth: 1,
                  borderColor: C.line,
                }}
              >
                <Icon name="Check" size={18} color={C.accent} />
                <T style={s.muted}>{duration(o.atSeconds)}</T>
                <T style={{ color: C.accent, flex: 1, fontSize: 15 }}>
                  {o.label}
                </T>
                <T
                  style={{
                    color: o.confidence >= 0.9 ? C.accent : C.warning,
                    fontSize: 12,
                  }}
                >
                  {o.confidence >= 0.9 ? "Clear" : "Unclear"}
                </T>
              </View>
            </Arrival>
          ))}
        </View>
      )}
      {done &&
        result?.analysis?.timeline.map((line, i) => (
          <Arrival key={i} delay={i * 90}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <T style={s.muted}>{duration(line.start_seconds)}</T>
              <T style={{ flex: 1, color: C.accent }}>{line.event}</T>
            </View>
          </Arrival>
        ))}
      {j.mode === "demo" && (
        <T style={s.muted}>
          Demo preview · upload, Gemini and law retrieval are simulated.
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
  const rr = useRoad();
  const [period, setPeriod] = useState(0),
    [status, setStatus] = useState(0),
    [plate, setPlate] = useState(""),
    [offence, setOffence] = useState("");
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
  const top =
    data.recurring && data.recurring[1] > 1 ? data.recurring : undefined;
  return (
    <Page title="Impact">
      <Intro title="Your impact. Their problem." />
      <View>
        <Count value={data.sent} />
        <T style={{ fontSize: 18, fontWeight: "600" }}>assholes snitched on</T>
      </View>
      <T style={{ fontWeight: "700" }}>
        {rr.prefs.demo
          ? `${data.billed} got billed`
          : "Authority response not tracked"}
        <T style={s.muted}>{rr.prefs.demo ? " · demo outcome" : ""}</T>
      </T>
      <Pressable
        accessibilityRole="button"
        disabled={!top}
        accessibilityLabel={
          top ? `Filter cases for ${top[0]}` : "No repeat guests"
        }
        onPress={() => setPlate(plate ? "" : top![0])}
        style={{
          padding: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: plate ? C.accent : C.line,
          backgroundColor: C.surface,
        }}
      >
        <T style={{ fontWeight: "700" }}>
          {top ? `${top[0]} · Spotted ${top[1]} times.` : "No repeat guests."}
        </T>
        <T style={s.muted}>
          {top
            ? `Same car, same energy.${rr.prefs.demo ? " Demo sightings." : ""}`
            : "I’m keeping an eye out."}
        </T>
      </Pressable>
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
        {list.map((c) => (
          <Pressable
            key={c.id}
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
                {c.offences.length} offence{c.offences.length === 1 ? "" : "s"}{" "}
                · {c.incident.date || "Date unknown"}
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
      <Disclosure
        title="By offence"
        note={["All time", "Last 7 days", "Today"][period]}
      >
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
            style={{ gap: 8, paddingVertical: 8 }}
          >
            <View style={s.row}>
              <T>{name}</T>
              <T>{data.counts[code]}</T>
            </View>
            <ImpactBar
              index={i}
              ratio={
                data.counts[code] / Math.max(1, ...Object.values(data.counts))
              }
            />
          </Pressable>
        ))}
      </Disclosure>
    </Page>
  );
}

export function Work() {
  const rr = useRoad(),
    store = useStore();
  const c = rr.cases.find((c) => c.id === rr.selected) || rr.cases[0];
  if (!c)
    return (
      <Page title="Gemini’s work" nav={false}>
        <Intro title="I need a case first." />
        <Action title="Analyse a clip" onPress={() => go("clip")} />
      </Page>
    );
  const original = c.analysis;
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
    <Page title="Gemini’s work" nav={false}>
      <Intro
        title="Gemini’s work"
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
      {!original && !storedResult && (
        <T style={s.muted}>
          This older case has no saved original response. Its edited report
          details are available on the Case screen.
        </T>
      )}
      <T style={s.muted}>
        Timing, token usage and frame counts are not supplied by this API.
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
