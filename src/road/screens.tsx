import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, Switch, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import { useStore } from "../lib/store";
import { checkConnection } from "../lib/api";
import { hasBuiltInConnection, validateApiUrl } from "../lib/domain";
import { useRoad } from "./context";
import {
  LivingIntelligence,
  Motion,
  ImpactBar,
  Turn,
  FadeArrival,
} from "./motion";
import {
  Action,
  C,
  Field,
  Icon,
  Intro,
  Notice,
  Page,
  Quiet,
  Segments,
  T,
  go,
  showError,
  focusControl,
  styles as s,
} from "./ui";
import {
  categories,
  duration,
  impact,
  labels,
  normalizePlate,
  regionNames,
  type Region,
} from "./model";
import { replayHomeEntrance } from "./home";
export { Review, Handoff } from "./review";
export { Home } from "./home";
export function Developer() {
  const rr = useRoad(),
    store = useStore();
  const [url, setUrl] = useState(store.settings.apiUrl),
    [token, setToken] = useState(store.settings.token),
    [reveal, setReveal] = useState(false),
    [chosen, setChosen] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const chooseRef = useRef<View>(null);
  const file = store.records.find((i) => i.id === chosen);
  const choose = async () => {
    setBusy(true);
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ["video/mp4", "video/quicktime", "video/webm"],
        copyToCacheDirectory: true,
      });
      if (r.canceled) return;
      const f = r.assets[0];
      const stat = await FS.getInfoAsync(f.uri);
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
      setMessage("");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const analyse = () => {
    if (!chosen) return;
    if (!store.settings.token) {
      setMessage("Save your API access token first.");
      return;
    }
    void rr
      .setPrefs({ demo: false })
      .then(() => {
        go("analysis");
        void rr.begin([chosen]).catch(showError);
      })
      .catch(showError);
  };
  return (
    <Page title="Developer options">
      <Intro
        title="Feed me the road drama."
        body="Give me a clip. I’ll do the detective shit."
      />
      <View
        style={{
          gap: 9,
          padding: 14,
          backgroundColor: C.peach,
          borderRadius: 10,
        }}
      >
        <T style={{ fontSize: 12 }}>
          Judges, small clips. Gemini bills us. We are really poor.
        </T>
        <T style={{ fontSize: 12 }}>
          ☀ Daylight footage works better. I’m not Batman.
        </T>
      </View>
      <Action
        controlRef={chooseRef}
        title="Choose video"
        secondary
        icon="Upload"
        disabled={busy}
        onPress={() => void choose()}
      />
      <T style={s.muted}>MP4, MOV or WebM · 300 MB max</T>
      {file && (
        <View style={s.card}>
          <T>{file.name}</T>
          <View style={s.row}>
            <T style={s.muted}>{(file.size / 1e6).toFixed(1)} MB · Ready</T>
            <Quiet
              title="Remove selection"
              icon="X"
              onPress={() => {
                setChosen("");
                focusControl(chooseRef);
              }}
            />
          </View>
        </View>
      )}
      <Action
        title="Analyse video"
        icon="ArrowRight"
        disabled={!file || busy || rr.job?.status === "running"}
        onPress={analyse}
      />
      <Action
        title="Use demo clip"
        secondary
        disabled={rr.job?.status === "running"}
        onPress={() =>
          void rr
            .seed()
            .then(() => {
              go("analysis");
              void rr.begin([], true).catch(showError);
            })
            .catch(showError)
        }
      />
      {__DEV__ && (
        <Quiet
          title="Load 12-second test video"
          onPress={() => {
            if (busy || rr.job?.status === "running") return;
            setBusy(true);
            void store
              .importSample()
              .then((id) => {
                setChosen(id);
                setMessage(
                  "Real test footage loaded. Analyse video sends it to the configured AI server; this is not a simulated result.",
                );
              })
              .catch(showError)
              .finally(() => setBusy(false));
          }}
        />
      )}
      {__DEV__ && (
        <Quiet title="Replay Home entrance" onPress={replayHomeEntrance} />
      )}
      <T style={s.section}>Backend settings</T>
      {hasBuiltInConnection ? (
        <Notice>AI analysis is ready. No access token setup is needed.</Notice>
      ) : (
        <>
          <Field
            label="Base URL"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <View style={{ gap: 5 }}>
            <Field
              label="Access token"
              value={token}
              onChangeText={setToken}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Quiet
              title={reveal ? "Hide access token" : "Show access token"}
              icon={reveal ? "EyeOff" : "Eye"}
              onPress={() => setReveal(!reveal)}
            />
          </View>
          <Action
            title="Save connection"
            secondary
            onPress={() =>
              void Promise.resolve()
                .then(() =>
                  store.saveSettings({
                    ...store.settings,
                    apiUrl: validateApiUrl(url.trim()),
                    token: token.trim(),
                  }),
                )
                .then(() => setMessage("Connection saved securely."))
                .catch(showError)
            }
          />
        </>
      )}
      <Quiet
        title="Check URL"
        onPress={() =>
          void checkConnection({
            ...store.settings,
            apiUrl: hasBuiltInConnection ? store.settings.apiUrl : url,
          })
            .then(setMessage)
            .catch(showError)
        }
      />
      {message && <Notice>{message}</Notice>}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Demo dataset</T>
          <T style={s.muted}>Synthetic cases · no Gemini bill</T>
        </View>
        <Switch
          accessibilityLabel="Demo dataset"
          value={rr.prefs.demo}
          onValueChange={(v) =>
            void (v ? rr.seed() : rr.setPrefs({ demo: false })).catch(showError)
          }
        />
      </View>
      <T style={s.muted}>
        {rr.prefs.demo
          ? "Demo cases and motion previews are separate from your real footage."
          : "Live GCP connection. Analysis stages are displayed only when confirmed by the server."}
      </T>
      {store.records
        .filter((i) => i.stage === "queued" || i.stage === "error")
        .map((i) => (
          <View key={i.id} style={s.card}>
            <T>{i.name}</T>
            <T style={s.muted}>
              {i.error || "Saved recording awaiting analysis"}
            </T>
            <Action
              title="Review saved clip"
              secondary
              disabled={rr.job?.status === "running"}
              onPress={() => {
                setChosen(i.id);
                setMessage("Clip selected. Tap Analyse video to upload.");
              }}
            />
          </View>
        ))}
    </Page>
  );
}
const stageCopy = [
  ["Uploading", "Moving their audacity to the cloud."],
  [
    "Analysing video with Gemini",
    "Asking Gemini: skill issue, or actual offence?",
  ],
  [
    "Fetching RAG on Malaysia law",
    "Retrieving Malaysian traffic law. Vibes have been evicted.",
  ],
  [
    "Gemini AI agent compiling evidence and drafting report",
    "Making “what the fuck” sound professional.",
  ],
  ["Report completed", "Done. Nothing sent. I’m a snitch with boundaries."],
];
export function Analysis() {
  const rr = useRoad(),
    j = rr.job;
  const complete = j?.status === "complete";
  const running = j?.status === "running";
  if (!j)
    return (
      <Page title="Analysing">
        <Intro title="I need a clip first." />
        <Action title="Choose a video" onPress={() => go("developer")} />
      </Page>
    );
  return (
    <Page
      title="Analysing"
      nav={false}
      footer={
        <>
          <Action
            title={complete ? "Review report" : "Back to home"}
            onPress={() => {
              if (complete) {
                void rr
                  .setPrefs({ demo: j.mode === "demo" })
                  .then(() => {
                    if (j.caseIds[0]) rr.select(j.caseIds[0]);
                    rr.dismissNotice();
                    go("review");
                  })
                  .catch(showError);
              } else go("home");
            }}
          />
          <T style={[s.muted, { textAlign: "center", fontSize: 11 }]}>
            {complete
              ? "Draft done. Nothing sent. I know my damn boundaries."
              : j.mode === "demo"
                ? "Demo preview · upload, Gemini and RAG are simulated."
                : "Your recording is kept while the server reviews it."}
          </T>
        </>
      }
    >
      <Intro
        title={
          complete
            ? "I turned stupid into paperwork."
            : "I’m putting stupid on paper."
        }
        body={
          complete
            ? "Your draft’s ready. Fact-check me before the snitching."
            : "I’ll ping you. Their bullshit is becoming admin."
        }
      />
      <LivingIntelligence stage={j.stage} />
      <View style={s.row}>
        <T style={s.muted}>
          {complete
            ? "5 of 5 steps complete"
            : j.mode === "demo"
              ? `Step ${j.stage + 1} of 5`
              : j.stage === 0
                ? "Uploading video"
                : "Server review in progress"}
        </T>
        <T style={{ fontWeight: "700" }}>
          {j.progress === null ? "Working…" : `${j.progress}%`}
        </T>
      </View>
      <View style={{ height: 4, backgroundColor: C.line, borderRadius: 3 }}>
        <View
          style={{
            height: 4,
            borderRadius: 3,
            backgroundColor: C.accent,
            width: `${j.progress === null ? 35 : j.progress}%`,
          }}
        />
      </View>
      <View style={{ gap: 8 }}>
        {stageCopy.map(([title, body], i) => {
          const done = complete || i < j.stage;
          const active = running && i === j.stage;
          return (
            <Motion
              key={title}
              identity={`${i}-${done}-${active}`}
              small
              distance={0}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  paddingVertical: 9,
                  minHeight: 48,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 15,
                    backgroundColor: done ? C.mint : active ? C.ink : "#e8e3ec",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {done ? (
                    <Icon name="Check" size={16} color={C.accent} />
                  ) : (
                    <T
                      style={{
                        fontSize: 12,
                        color: active ? "white" : C.muted,
                      }}
                    >
                      {i + 1}
                    </T>
                  )}
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <T
                    style={{ fontSize: 13, fontWeight: active ? "700" : "500" }}
                  >
                    {title}
                  </T>
                  {active ? (
                    <FadeArrival identity={`${i}-${active}`} distance={0}>
                      <T style={s.muted}>{body}</T>
                    </FadeArrival>
                  ) : (
                    <T style={{ fontSize: 10, lineHeight: 14, color: C.muted }}>
                      {done
                        ? "Done"
                        : j.mode === "live" && i > 1
                          ? "Awaiting final result"
                          : "Next"}
                    </T>
                  )}
                </View>
              </View>
            </Motion>
          );
        })}
      </View>
      {j.mode === "live" && running && j.stage === 1 && (
        <Notice>
          The server returns the completed review together. Intermediate legal
          and drafting stages are not reported separately.
        </Notice>
      )}
      {complete && (
        <Notice>
          Report completed. Your draft is ready to review. Nothing sent.
        </Notice>
      )}
      {!running && !complete && (
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
export function Impact() {
  const rr = useRoad();
  const [period, setPeriod] = useState(0),
    [status, setStatus] = useState(0),
    [offence, setOffence] = useState(""),
    [plate, setPlate] = useState("");
  const data = impact(rr.cases, ["all", "week", "today"][period]);
  const scoped = data.scoped.filter(
    (c) =>
      (!plate || normalizePlate(c.vehicle.plate) === plate) &&
      (!offence || c.offences.some((o) => o.code === offence)),
  );
  const list = scoped.filter(
    (c) =>
      status === 0 ||
      (status === 1 &&
        ["ready", "opened", "needs_info"].includes(c.reporting.status)) ||
      (status === 2 && c.reporting.status === "sent"),
  );
  const counts = [
    scoped.length,
    scoped.filter((c) =>
      ["ready", "opened", "needs_info"].includes(c.reporting.status),
    ).length,
    scoped.filter((c) => c.reporting.status === "sent").length,
  ];
  const top = data.recurring;
  return (
    <Page title="Impact">
      <Intro
        title="Your impact. Their problem."
        body="I keep receipts. Karma loves paperwork."
      />
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          [String(data.sent), "Assholes\nsnitched on", C.mint],
          [rr.prefs.demo ? String(data.billed) : "—", "Got billed", C.lilac],
        ].map(([count, label, color]) => (
          <View
            key={label}
            style={{
              flex: 1,
              minHeight: 168,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 13,
              padding: 17,
              backgroundColor: color,
              justifyContent: "space-between",
              overflow: "hidden",
            }}
          >
            <Icon
              name={label === "Got billed" ? "FileCheck2" : "Video"}
              color="#a7a1aa"
              size={24}
            />
            <T
              style={{
                fontSize: 62,
                lineHeight: 73,
                fontWeight: "700",
                letterSpacing: -3,
              }}
            >
              {count}
            </T>
            <T style={{ fontSize: 12, lineHeight: 17, fontWeight: "600" }}>
              {label}
            </T>
          </View>
        ))}
      </View>
      {!rr.prefs.demo && (
        <T style={s.muted}>Fine outcomes are not connected.</T>
      )}
      {top && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filter cases for ${top[0]}`}
          onPress={() => {
            setPlate(plate === top[0] ? "" : top[0]);
            setOffence("");
            setStatus(0);
          }}
          style={[
            s.card,
            {
              backgroundColor: plate ? C.mint : C.surface,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            },
          ]}
        >
          <T style={{ fontWeight: "700", fontSize: 23 }}>{top[0]}</T>
          <View>
            <T style={{ fontSize: 12 }}>
              Spotted{" "}
              <T style={{ fontSize: 20, fontWeight: "700" }}>{top[1]}</T>{" "}
              {top[1] === 1 ? "time." : "times."}
            </T>
            <T style={s.muted}>Same car, same energy.</T>
          </View>
        </Pressable>
      )}
      {plate && (
        <Quiet
          title="Clear plate filter"
          icon="X"
          onPress={() => setPlate("")}
        />
      )}
      <View style={{ gap: 16 }}>
        <T style={s.section}>By offence</T>
        <Segments
          items={["All time", "Last 7 days", "Today"]}
          value={period}
          onChange={setPeriod}
        />
        <T style={s.muted}>Pick their bullshit. I’ll find the clip.</T>
        {categories.map(([code, label], index) => (
          <Pressable
            key={code}
            accessibilityRole="checkbox"
            accessibilityLabel={`Filter ${label}`}
            accessibilityState={{ checked: offence === code }}
            onPress={() => setOffence(offence === code ? "" : code)}
            style={{
              padding: 9,
              borderRadius: 8,
              backgroundColor: offence === code ? "#e4dbee" : "transparent",
              gap: 10,
              minHeight: 50,
            }}
          >
            <View style={s.row}>
              <T style={{ fontSize: 12 }}>
                {label}
                {offence === code ? " ✓" : ""}
              </T>
              <T style={{ fontSize: 12, fontWeight: "700" }}>
                {data.counts[code]}
              </T>
            </View>
            <ImpactBar
              index={index}
              ratio={
                data.counts[code] / Math.max(1, ...Object.values(data.counts))
              }
            />
          </Pressable>
        ))}
      </View>
      <Segments
        items={[
          `All ${counts[0]}`,
          `Needs you ${counts[1]}`,
          `Sent ${counts[2]}`,
        ]}
        value={status}
        onChange={setStatus}
      />
      {list.length === 0 ? (
        <View style={s.card}>
          <T>No clips here. The clowns took a day off.</T>
          <Quiet
            title="Clear filters"
            onPress={() => {
              setStatus(0);
              setOffence("");
              setPlate("");
              setPeriod(0);
            }}
          />
        </View>
      ) : (
        list.map((c) => (
          <FadeArrival
            key={c.id}
            identity={`${period}-${status}-${plate}-${offence}`}
            distance={0}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open case ${c.id} ${c.vehicle.plate || "Plate unreadable"}`}
              onPress={() => {
                rr.select(c.id);
                go("review");
              }}
              style={{
                flexDirection: "row",
                gap: 14,
                paddingVertical: 8,
                minHeight: 83,
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <T style={{ fontWeight: "700", fontSize: 15 }}>
                  {c.vehicle.plate ||
                    (!c.offences.length
                      ? "Suspiciously civil"
                      : "Plate unreadable")}
                </T>
                <T style={s.muted}>
                  {c.offences.length
                    ? `${c.offences.length} offences`
                    : "No offence"}{" "}
                  · {c.incident.date || "Date unknown"}
                </T>
                <T
                  style={{
                    fontSize: 11,
                    color:
                      c.reporting.status === "sent"
                        ? "#215841"
                        : c.reporting.status === "needs_info"
                          ? "#774009"
                          : "#55327c",
                  }}
                >
                  {labels[c.reporting.status]}
                </T>
              </View>
              <View
                style={{
                  width: 80,
                  height: 60,
                  backgroundColor: C.dark,
                  borderRadius: 7,
                  overflow: "hidden",
                }}
              >
                {(c.provenance.isDemo || c.evidence.thumbnailUrl) && (
                  <Image
                    source={
                      c.provenance.isDemo
                        ? require("../../assets/road/images/dashcam-evidence-demo.jpg")
                        : { uri: c.evidence.thumbnailUrl! }
                    }
                    style={{ width: 80, height: 60 }}
                  />
                )}
                <T
                  style={{
                    position: "absolute",
                    bottom: 3,
                    right: 4,
                    color: "white",
                    fontSize: 10,
                    backgroundColor: "#20282bcc",
                    paddingHorizontal: 3,
                  }}
                >
                  {duration(c.evidence.durationSeconds)}
                </T>
              </View>
            </Pressable>
          </FadeArrival>
        ))
      )}
      <T style={[s.muted, { fontSize: 11 }]}>
        {rr.prefs.demo ? "Demo cases. " : ""}“Sent” means you confirmed sending.
      </T>
    </Page>
  );
}
export function Settings() {
  const rr = useRoad(),
    p = rr.prefs;
  const [recipient, setRecipient] = useState(p.recipients[p.region]),
    [open, setOpen] = useState(""),
    [message, setMessage] = useState("");
  const recipientRef = useRef<View>(null),
    personalRef = useRef<View>(null);
  const [personal, setPersonal] = useState({
    name: p.name,
    identity: p.identity,
    address: p.address,
    phone: p.phone,
    email: p.email,
    includePersonal: p.includePersonal,
  });
  const [saving, setSaving] = useState(false);
  const saveAndClose = (
    patch: Parameters<typeof rr.setPrefs>[0],
    ref: React.RefObject<View | null>,
    text: string,
  ) => {
    setSaving(true);
    void rr
      .setPrefs(patch)
      .then(() => {
        setOpen("");
        setMessage(text);
        focusControl(ref);
      })
      .catch(showError)
      .finally(() => setSaving(false));
  };
  useEffect(
    () => setRecipient(p.recipients[p.region]),
    [p.region, p.recipients],
  );
  const save = (patch: Parameters<typeof rr.setPrefs>[0]) =>
    void rr.setPrefs(patch).catch(showError);
  return (
    <Page title="Settings">
      <T style={s.section}>Reporting</T>
      <Pressable
        accessibilityRole="button"
        ref={recipientRef}
        accessibilityState={{ expanded: open === "recipient" }}
        accessibilityLabel="Authority WhatsApp"
        onPress={() => setOpen(open === "recipient" ? "" : "recipient")}
        style={s.row}
      >
        <Icon name="MessageCircle" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Authority WhatsApp</T>
          <T style={s.muted}>
            {p.recipients[p.region]
              ? `+${p.recipients[p.region]}`
              : "Add a number for this region"}
          </T>
        </View>
        <Turn open={open === "recipient"}>
          <Icon name="ChevronRight" />
        </Turn>
      </Pressable>
      {open === "recipient" && (
        <FadeArrival distance={8}>
          <View style={{ gap: 12 }}>
            <Field
              label="Recipient number"
              value={recipient}
              onChangeText={setRecipient}
              keyboardType="phone-pad"
            />
            <Action
              title="Save recipient"
              disabled={saving}
              secondary
              onPress={() => {
                const n = recipient.replace(/[\s()+-]/g, "");
                if (!/^[1-9]\d{7,14}$/.test(n)) {
                  setMessage(
                    "Enter an international number including country code.",
                  );
                  return;
                }
                saveAndClose(
                  { recipients: { ...p.recipients, [p.region]: n } },
                  recipientRef,
                  "Recipient saved for " + regionNames[p.region] + ".",
                );
              }}
            />
            <T style={s.muted}>
              I’ll use this for {regionNames[p.region]} drafts. Malaysia’s
              default is the supplied demo number.
            </T>
          </View>
        </FadeArrival>
      )}
      <Pressable
        accessibilityRole="button"
        ref={personalRef}
        accessibilityState={{ expanded: open === "personal" }}
        accessibilityLabel="Your details"
        onPress={() => setOpen(open === "personal" ? "" : "personal")}
        style={s.row}
      >
        <Icon name="UserRound" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Your details</T>
          <T style={s.muted}>Optional · fill them in WhatsApp</T>
        </View>
        <Turn open={open === "personal"}>
          <Icon name="ChevronRight" />
        </Turn>
      </Pressable>
      {open === "personal" && (
        <FadeArrival distance={8}>
          <View style={{ gap: 15 }}>
            {(
              [
                ["name", "Full name"],
                ["identity", "Identity number"],
                ["address", "Postal address"],
                ["phone", "Phone"],
                ["email", "Email"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={personal[key]}
                onChangeText={(v) =>
                  setPersonal((current) => ({ ...current, [key]: v }))
                }
              />
            ))}
            <View style={s.row}>
              <T style={{ flex: 1 }}>Add your details to report drafts</T>
              <Switch
                accessibilityLabel="Add your details to report drafts"
                value={personal.includePersonal}
                onValueChange={(v) =>
                  setPersonal((current) => ({ ...current, includePersonal: v }))
                }
              />
            </View>
            <Action
              title="Save details"
              secondary
              disabled={saving}
              onPress={() =>
                saveAndClose(
                  personal,
                  personalRef,
                  "Your details are saved securely on this device.",
                )
              }
            />
            <T style={s.muted}>Saved securely on this device.</T>
          </View>
        </FadeArrival>
      )}
      <T style={s.section}>Preferences</T>
      <T style={{ fontWeight: "600" }}>Region</T>
      <Segments
        items={["Malaysia", "Singapore", "Japan"]}
        value={(["MY", "SG", "JP"] as Region[]).indexOf(p.region)}
        onChange={(i) => save({ region: (["MY", "SG", "JP"] as Region[])[i] })}
      />
      <T style={{ fontWeight: "600" }}>Language</T>
      <Segments
        items={["English (UK)", "English (US)"]}
        value={p.language === "en-GB" ? 0 : 1}
        onChange={(i) => save({ language: i ? "en-US" : "en-GB" })}
      />
      <View style={s.row}>
        <Icon name="Eye" />
        <T style={{ flex: 1, fontWeight: "600" }}>Reduce motion</T>
        <Switch
          accessibilityLabel="Reduce motion"
          value={p.reduced}
          onValueChange={(v) => save({ reduced: v })}
        />
      </View>
      <T style={s.section}>Footage</T>
      <View style={s.row}>
        <Icon name="Video" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "600" }}>Keep original recordings</T>
          <T style={s.muted}>Original clips stay on this device.</T>
        </View>
        <Icon name="Check" />
      </View>
      <View style={s.row}>
        <Icon name="UserRound" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "600" }}>Blur unrelated faces</T>
          <T style={s.muted}>
            Unavailable until annotated evidence is connected.
          </T>
        </View>
      </View>
      {message && <Notice>{message}</Notice>}
      <T style={[s.muted, { textAlign: "center" }]}>
        I do the boring shit. You tap Send.
      </T>
    </Page>
  );
}
