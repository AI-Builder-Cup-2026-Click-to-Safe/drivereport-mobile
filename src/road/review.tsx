import React, { useEffect, useRef, useState } from "react";
import { Image, Linking, Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { useRoad } from "./context";
import { demoFrameFor } from "./media";
import {
  duration,
  labels,
  missing,
  reportText,
  validation,
  whatsapp,
  type RoadCase,
} from "./model";
import { PointsChip, Receipt, Stamp, SampleOverlay } from "./submission-motion";
import { pendingCases, licenceRecord, casePoints } from "./submission-model";
import { Arrival, Disclosure, Plate } from "./standard-ui";
import {
  Action,
  C,
  Field,
  Icon,
  Intro,
  Notice,
  Page,
  Quiet,
  T,
  go,
  showError,
  styles as s,
} from "./ui";

async function openWhatsAppDraft(
  c: RoadCase,
  prefs: Parameters<typeof whatsapp>[1],
) {
  await Clipboard.setStringAsync(reportText(c, prefs));
  await Linking.openURL(whatsapp(c, prefs));
}

async function shareOriginal(c: RoadCase) {
  const uri = c.evidence.originalVideoUrl;
  if (!uri?.startsWith("file:"))
    throw Error("The original recording is not available on this device.");
  if (!(await Sharing.isAvailableAsync()))
    throw Error("Video sharing is not available on this device.");
  await Sharing.shareAsync(uri, {
    dialogTitle: "Attach original evidence in WhatsApp",
    mimeType: "video/mp4",
    UTI: "public.movie",
  });
}
function RealVideo({
  uri,
  seek,
  revision,
  onTime,
}: {
  uri: string;
  seek: number;
  revision: number;
  onTime: (time: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });
  useEffect(() => {
    if (seek >= 0) {
      player.currentTime = seek;
      player.pause();
    }
  }, [seek, revision, player]);
  useEffect(() => {
    const sub = player.addListener("timeUpdate", ({ currentTime }) =>
      onTime(currentTime),
    );
    return () => sub.remove();
  }, [player, onTime]);
  useEffect(() => {
    const sub = player.addListener("statusChange", (e) =>
      setFailed(e.status === "error"),
    );
    return () => sub.remove();
  }, [player]);
  return failed ? (
    <Notice error>
      Evidence could not be opened. Check that the original video is still
      available.
    </Notice>
  ) : (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{
        width: "100%",
        height: 220,
        borderRadius: 10,
        backgroundColor: C.dark,
      }}
    />
  );
}
function Evidence({
  c,
  seek,
  revision,
  onTime,
}: {
  c: RoadCase;
  seek: number;
  revision: number;
  onTime: (time: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(Math.max(0, seek));
  useEffect(() => {
    setTime(Math.max(0, seek));
    setPlaying(false);
  }, [seek, revision]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setTime((t) => {
          const n = Math.min(c.evidence.durationSeconds, t + 0.25);
          return n;
        }),
      250,
    );
    return () => clearInterval(timer);
  }, [playing, c.evidence.durationSeconds]);
  useEffect(() => {
    if (c.provenance.isDemo) onTime(time);
    if (time >= c.evidence.durationSeconds) setPlaying(false);
  }, [time, onTime, c.provenance.isDemo, c.evidence.durationSeconds]);
  const caption = c.analysis?.timeline.find(
    (t) => time >= t.start_seconds && time < t.end_seconds,
  )?.event;
  return c.provenance.isDemo ? (
    <View
      style={{ borderRadius: 12, overflow: "hidden", backgroundColor: C.dark }}
    >
      <View style={{ aspectRatio: 16 / 9 }}>
        <Image
          source={demoFrameFor(c)}
          style={{ width: "100%", height: "100%" }}
        />
        <SampleOverlay caption={caption} unread={!c.analysis?.vehicle.plate} />
      </View>
      <View
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          paddingHorizontal: 9,
          paddingVertical: 4,
          backgroundColor: "#20282bcc",
          borderRadius: 5,
        }}
      >
        <T style={{ fontSize: 10, color: "white" }}>Synthetic demo frame</T>
      </View>
      <View
        style={{
          paddingHorizontal: 12,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            playing ? "Pause sample timeline" : "Play sample timeline"
          }
          onPress={() => {
            if (time >= c.evidence.durationSeconds) setTime(0);
            setPlaying(!playing);
          }}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
        >
          <Icon name={playing ? "Pause" : "Play"} color="white" />
        </Pressable>
        <View
          style={{
            flex: 1,
            marginHorizontal: 8,
            alignSelf: "center",
            height: 3,
            backgroundColor: "#555",
          }}
        >
          <View
            style={{
              height: 3,
              width: `${(time / c.evidence.durationSeconds) * 100}%`,
              backgroundColor: "white",
            }}
          />
        </View>
        <T style={{ color: "white", fontSize: 11 }}>
          {duration(time)} / {duration(c.evidence.durationSeconds)}
        </T>
      </View>
    </View>
  ) : c.evidence.originalVideoUrl ? (
    <RealVideo
      key={c.id}
      uri={c.evidence.originalVideoUrl}
      seek={seek}
      revision={revision}
      onTime={onTime}
    />
  ) : (
    <Notice error>Original evidence is unavailable.</Notice>
  );
}
function DateField({
  c,
  kind,
  disabled,
  onChange,
}: {
  c: RoadCase;
  kind: "date" | "time";
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const rr = useRoad();
  const [open, setOpen] = useState(false);
  const value = c.incident[kind];
  const [draft, setDraft] = useState(new Date());
  const date = () =>
    new Date(
      `${c.incident.date || "2026-01-01"}T${c.incident.time || "12:00"}:00`,
    );
  const apply = (d: Date) => {
    onChange(
      kind === "date"
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    );
  };
  return (
    <View style={{ flex: 1, gap: 5 }}>
      <T style={{ fontSize: 12, color: C.muted }}>
        {kind === "date" ? "Date" : `Time · ${c.incident.timeZone}`}
        {c.edited?.includes(kind) ? " · you" : ""}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${kind}`}
        disabled={disabled}
        onPress={() => {
          setDraft(date());
          setOpen(true);
        }}
        style={{
          minHeight: 49,
          borderWidth: 1,
          borderColor: value ? C.line : "#925d45",
          backgroundColor: value ? C.surface : C.warningBg,
          padding: 12,
          borderRadius: 10,
        }}
      >
        <T style={{ fontSize: 15 }}>
          {value
            ? kind === "date"
              ? new Intl.DateTimeFormat(rr.prefs.language, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(date())
              : value
            : `Add ${kind}`}
        </T>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType={rr.reduced ? "none" : "fade"}
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#20282b66",
          }}
        >
          <View
            style={{
              backgroundColor: C.surface,
              padding: 24,
              paddingBottom: 40,
              gap: 15,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <T style={s.section}>
              {kind === "date" ? "Incident date" : "Incident time"}
            </T>
            <DateTimePicker
              value={draft}
              mode={kind}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              themeVariant="light"
              locale={rr.prefs.language}
              onChange={(e, d) => {
                if (d) setDraft(d);
                if (Platform.OS !== "ios") {
                  if (e.type === "set" && d) apply(d);
                  setOpen(false);
                }
              }}
            />
            <Action
              title="Done"
              onPress={() => {
                apply(draft);
                setOpen(false);
              }}
            />
            <Quiet title="Cancel" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
export function Review() {
  const rr = useRoad();
  const queue = pendingCases(rr.cases);
  const c = rr.cases.find((c) => c.id === rr.selected) || queue[0];
  const index = c ? queue.indexOf(c) : -1;
  return c ? (
    <CaseReview key={c.id} c={c} index={index} />
  ) : (
    <Page title="Case">
      <Intro
        title="I can’t snitch on thin air."
        body="Give me a clip. I’ll check for clown behaviour."
      />
      <Action title="Analyse a clip" onPress={() => go("clip")} />
    </Page>
  );
}

function CaseReview({ c, index }: { c: RoadCase; index: number }) {
  const rr = useRoad();
  const queue = pendingCases(rr.cases);
  const record = licenceRecord(c);
  const points = casePoints(c);
  const [seek, setSeek] = useState(!c.vehicle.plate ? 20 : 12),
    [revision, setRevision] = useState(0),
    [playhead, setPlayhead] = useState(!c.vehicle.plate ? 20 : 12);
  const [busy, setBusy] = useState(false),
    [descriptionNote, setDescriptionNote] = useState(false);
  // Keep fields mounted while typing, even after the first character resolves a missing fact.
  const [askKeys] = useState(() => missing(c));
  const changing = useRef(false);
  const locked = c.reporting.status === "sent",
    error = validation(c);
  const update = (patch: Partial<RoadCase>) =>
    void rr.changeCase(c.id, patch).catch(showError);
  const origin = (key: string) =>
    c.edited?.includes(key)
      ? " · you"
      : c.analysis || c.provenance.isDemo
        ? " · Gemini"
        : "";
  const fact = (key: string) => {
    if (key === "date" || key === "time")
      return (
        <DateField
          key={key}
          c={c}
          kind={key}
          disabled={locked}
          onChange={(v) => update({ incident: { ...c.incident, [key]: v } })}
        />
      );
    const vehicleKey =
      key === "vehicle"
        ? "type"
        : key === "plate" || key === "model"
          ? key
          : null;
    const value = vehicleKey
      ? c.vehicle[vehicleKey]
      : c.incident[key as "location" | "description"];
    const label = (
      {
        plate: "Vehicle plate",
        vehicle: "Vehicle type",
        model: "Vehicle model · optional",
        location: "Location",
        description: "What happened",
      } as Record<string, string>
    )[key];
    return (
      <Field
        key={key}
        label={label + (value ? origin(key) : "")}
        textColor={
          value &&
          !c.edited?.includes(key) &&
          (c.analysis || c.provenance.isDemo)
            ? C.accent
            : C.ink
        }
        value={value || ""}
        missing={key !== "model" && !value?.trim()}
        hint={false}
        editable={!locked}
        multiline={key === "description"}
        placeholder={
          key === "plate"
            ? "e.g. ABC 1234"
            : key === "location"
              ? "Road or nearby landmark"
              : key === "vehicle"
                ? "e.g. Blue hatchback"
                : "What the vehicle did"
        }
        onChangeText={(v) =>
          update(
            vehicleKey
              ? { vehicle: { ...c.vehicle, [vehicleKey]: v } }
              : { incident: { ...c.incident, [key]: v } },
          )
        }
      />
    );
  };
  const send = async () => {
    if (changing.current) return;
    changing.current = true;
    setBusy(true);
    try {
      await openWhatsAppDraft(c, rr.prefs);
      await rr.changeCase(c.id, {
        reporting: { status: "opened", confirmedByUser: false },
      });
      go("handoff");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
      changing.current = false;
    }
  };
  const line = c.analysis?.timeline.find(
    (t) => playhead >= t.start_seconds && playhead <= t.end_seconds,
  );
  return (
    <Page
      gap={16}
      title={
        index >= 0 && queue.length > 1
          ? `Case ${index + 1} of ${queue.length}`
          : "Case"
      }
      headerLeft={
        index >= 0 ? (
          queue.length > 1 ? (
            <Quiet
              title="Previous case"
              compact
              icon="ChevronLeft"
              disabled={index === 0}
              onPress={() => rr.select(queue[index - 1].id)}
            />
          ) : (
            <View style={{ width: 44 }} />
          )
        ) : undefined
      }
      headerRight={
        index >= 0 && queue.length > 1 ? (
          <Quiet
            title="Next case"
            compact
            icon="ChevronRight"
            disabled={index === queue.length - 1}
            onPress={() => rr.select(queue[index + 1].id)}
          />
        ) : (
          <T style={s.muted}>{c.id.replace("SUB-", "")}</T>
        )
      }
      footer={
        c.offences.length ? (
          locked ? (
            <>
              <Action
                title="View Impact"
                secondary
                onPress={() => go("impact")}
              />
              <Quiet
                title="Mark as not sent"
                onPress={() =>
                  update({
                    reporting: { status: "opened", confirmedByUser: false },
                  })
                }
              />
              <T style={[s.muted, { textAlign: "center" }]}>
                Sent by you · JPJ decides · response not tracked
              </T>
            </>
          ) : (
            <>
              <Action
                title="Report via WhatsApp"
                icon="MessageCircle"
                disabled={!!error || busy}
                onPress={() => void send()}
              />
              {!!error && (
                <T style={[s.muted, { textAlign: "center" }]}>{error}</T>
              )}
            </>
          )
        ) : (
          <Action
            title="Back to Impact"
            secondary
            onPress={() => go("impact")}
          />
        )
      }
    >
      {["opened", "sent"].includes(c.reporting.status) && (
        <T
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: locked ? "#15803D" : C.ink,
          }}
        >
          {labels[c.reporting.status]}
        </T>
      )}
      {!c.offences.length && (
        <Intro
          title="No assholes? Plot twist."
          body="Gemini found no suspected offence in this clip. Humanity survives."
        />
      )}
      <View style={{ gap: 8 }}>
        <Evidence c={c} seek={seek} revision={revision} onTime={setPlayhead} />
        {line && !c.provenance.isDemo && (
          <T style={{ color: C.accent, fontSize: 13 }}>{line.event}</T>
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Plate
          value={c.vehicle.plate}
          source={
            c.edited?.includes("plate")
              ? "you"
              : c.analysis?.vehicle.plate || c.provenance.isDemo
                ? "ai"
                : undefined
          }
        />
        <View style={{ flex: 1, minWidth: 130 }}>
          <T
            style={{
              fontWeight: "700",
              color: c.edited?.includes("vehicle") ? C.ink : C.accent,
            }}
          >
            {c.vehicle.type || "Unknown vehicle"}
            {c.edited?.includes("vehicle") ? " · you" : ""}
          </T>
          <T style={s.muted}>
            {c.incident.date || "Date unknown"} ·{" "}
            {c.incident.time || "Time unknown"}
          </T>
        </View>
      </View>
      {!!c.offences.length && (
        <>
          {!!askKeys.length && !locked && (
            <View
              style={{
                padding: 16,
                gap: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#F3B46B",
                backgroundColor: C.warningBg,
              }}
            >
              <T style={{ fontWeight: "800", fontSize: 21, lineHeight: 27 }}>
                {askKeys.length === 1 && askKeys[0] === "plate"
                  ? "What’s the plate?"
                  : askKeys.length === 1 && askKeys[0] === "location"
                    ? "Where was this?"
                    : "Gemini needs you"}
              </T>
              {askKeys.map(fact)}
            </View>
          )}
          <View style={{ gap: 10 }}>
            <View style={s.row}>
              <T style={s.section}>Suspected offences</T>
              <T style={s.muted}>In report</T>
            </View>
            {c.offences.map((o) => (
              <View
                key={o.id}
                style={{ gap: 6, opacity: o.included ? 1 : 0.6 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Seek ${o.label}`}
                    onPress={() => {
                      setSeek(o.atSeconds);
                      setPlayhead(o.atSeconds);
                      setRevision((n) => n + 1);
                    }}
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: C.surface,
                    }}
                  >
                    <T
                      style={{
                        color: C.accent,
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {duration(o.atSeconds)}
                    </T>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <T
                      style={{
                        color: C.accent,
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      {o.label}
                    </T>
                  </View>
                  <PointsChip points={o.demeritPoints ?? 0} />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Include ${o.label}`}
                    accessibilityState={{
                      checked: o.included,
                      disabled: locked,
                    }}
                    disabled={locked}
                    onPress={() => {
                      update({
                        offences: c.offences.map((f) =>
                          f.id === o.id ? { ...f, included: !f.included } : f,
                        ),
                      });
                      setDescriptionNote(true);
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: C.accent,
                        borderRadius: 5,
                        width: 24,
                        height: 24,
                        backgroundColor: o.included ? C.accent : C.bg,
                      }}
                    >
                      {o.included && (
                        <Stamp>
                          <Icon name="Check" size={22} color="white" />
                        </Stamp>
                      )}
                    </View>
                  </Pressable>
                </View>
                {o.lawSources.map((law, n) => (
                  <View
                    key={n}
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <T style={{ fontSize: 13, fontWeight: "700" }}>
                      {law.act || law.title}
                      {law.section ? ", " + law.section : ""}
                    </T>
                    {law.url?.startsWith("https://") && (
                      <Quiet
                        title="Read the law"
                        icon="ArrowUpRight"
                        onPress={() =>
                          void Linking.openURL(law.url!).catch(showError)
                        }
                      />
                    )}
                  </View>
                ))}
                {!!o.demeritPoints && record && (
                  <Arrival identity={c.vehicle.plate || ""} distance={6}>
                    <T
                      style={{
                        fontSize: 13,
                        color: "#C81E1E",
                        fontWeight: "700",
                      }}
                    >
                      {c.vehicle.plate} already has {record.points}. This could
                      make it {record.points + points}: licence suspended.
                    </T>
                  </Arrival>
                )}
              </View>
            ))}
          </View>
          {descriptionNote && (
            <T style={s.muted}>
              I kept your description. Update it if the offences changed.
            </T>
          )}
          <Disclosure
            title="Edit details"
            note={locked ? "Read only" : "Tap to edit"}
          >
            {["plate", "vehicle", "date", "time", "location", "description"]
              .filter((k) => locked || !askKeys.includes(k))
              .map(fact)}
            {fact("model")}
          </Disclosure>
        </>
      )}
      <Quiet
        title="How Gemini decided"
        onPress={() => {
          rr.select(c.id);
          go("work");
        }}
      />
      {!c.provenance.isDemo &&
        c.evidence.originalVideoUrl?.startsWith("file:") && (
          <Action
            title="Share original recording"
            secondary
            icon="Upload"
            onPress={() => void shareOriginal(c).catch(showError)}
          />
        )}
    </Page>
  );
}
export function Handoff() {
  const rr = useRoad();
  const c = rr.cases.find((i) => i.id === rr.selected);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!c)
    return (
      <Page title="WhatsApp">
        <Action title="Back to Review" onPress={() => go("review")} />
      </Page>
    );
  if (c.reporting.status === "sent")
    return (
      <Page
        title="WhatsApp"
        nav={false}
        footer={
          <Action
            title="See your impact"
            icon="History"
            onPress={() => {
              rr.startUndo(c.id);
              go("impact");
            }}
          />
        }
      >
        <Intro
          title="Reported. Your part’s done."
          body="Here’s your receipt."
        />
        <Receipt c={c} />
        <Arrival delay={1400}>
          <Intro
            title={
              licenceRecord(c) && casePoints(c) + licenceRecord(c)!.points >= 20
                ? `If JPJ agrees, ${c.vehicle.plate} loses their licence.`
                : "Your report is ready for the authority’s review."
            }
            body={
              c.provenance.isDemo
                ? "Sample receipt · no authority outcome has been recorded."
                : "You confirmed sending. The authority decides the outcome."
            }
          />
        </Arrival>
      </Page>
    );
  return (
    <Page
      title="WhatsApp"
      nav={false}
      footer={
        <>
          <Action
            title="Yes, I sent it"
            icon="Check"
            disabled={busy}
            onPress={() => {
              setBusy(true);
              void rr
                .confirmSent(c.id, true)
                .catch(showError)
                .finally(() => setBusy(false));
            }}
          />
          <Action
            title="Not yet"
            icon="Clock"
            secondary
            onPress={() => go("review")}
          />
          <Quiet
            title="Open WhatsApp again"
            icon="MessageCircle"
            onPress={() => void openWhatsAppDraft(c, rr.prefs).catch(showError)}
          />
        </>
      }
    >
      <Intro
        title="Did you send it?"
        body="Attach the clip, tap Send in WhatsApp, then tell me here."
      />
      <View
        style={[
          s.row,
          { padding: 16, backgroundColor: C.surface, borderRadius: 16 },
        ]}
      >
        <Plate value={c.vehicle.plate} />
        <T style={{ fontSize: 12, fontWeight: "700" }}>Draft opened</T>
      </View>
      {message ? <Notice>{message}</Notice> : null}
      {!c.provenance.isDemo &&
        c.evidence.originalVideoUrl?.startsWith("file:") && (
          <Action
            title="Share original clip"
            secondary
            icon="Upload"
            disabled={busy}
            onPress={() => void shareOriginal(c).catch(showError)}
          />
        )}
      <Quiet
        title="Copy report text"
        onPress={() =>
          void Clipboard.setStringAsync(reportText(c, rr.prefs))
            .then(() => setMessage("Report text copied."))
            .catch(showError)
        }
      />
    </Page>
  );
}
