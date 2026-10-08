import React, { useEffect, useRef, useState } from "react";
import { Image, Linking, Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Sharing from "expo-sharing";
import { useRoad } from "./context";
import { demoFrameFor } from "./media";
import {
  duration,
  labels,
  missing,
  regionNames,
  validation,
  whatsapp,
  type RoadCase,
} from "./model";
import { Disclosure, Plate } from "./standard-ui";
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
  return c.provenance.isDemo ? (
    <View
      style={{ borderRadius: 12, overflow: "hidden", backgroundColor: C.dark }}
    >
      <Image source={demoFrameFor(c)} style={{ width: "100%", height: 194 }} />
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
          padding: 12,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <T style={{ color: "white", fontSize: 11 }}>
          Demo evidence · not a video
        </T>
        <T style={{ color: "white", fontSize: 11 }}>
          {duration(Math.max(0, seek))} / {duration(c.evidence.durationSeconds)}
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
  const index = Math.max(
    0,
    rr.cases.findIndex((c) => c.id === rr.selected),
  );
  const c = rr.cases[index];
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
  const [seek, setSeek] = useState(-1),
    [revision, setRevision] = useState(0),
    [playhead, setPlayhead] = useState(-1);
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
        editable={!locked}
        multiline={key === "description"}
        placeholder={
          key === "location"
            ? "Add road or nearby landmark"
            : "Add " + label.toLowerCase()
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
      await Linking.openURL(whatsapp(c, rr.prefs));
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
      title="Case"
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
                title={
                  c.provenance.isDemo
                    ? "Open test WhatsApp draft"
                    : "Report via WhatsApp"
                }
                icon="MessageCircle"
                disabled={!!error || busy}
                onPress={() => void send()}
              />
              <T style={[s.muted, { textAlign: "center" }]}>
                {error || "I write it. You attach the clip and tap Send."}
              </T>
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
      <View style={s.row}>
        <T style={[s.muted, { flex: 1 }]}>
          {regionNames[c.region]}
          {c.region === "MY" ? " / JPJ" : ""}
        </T>
        <T
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: locked ? "#15803D" : error ? C.warning : C.ink,
          }}
        >
          {labels[c.reporting.status]}
        </T>
        <Quiet
          compact
          title="Previous case"
          icon="ChevronLeft"
          onPress={() =>
            rr.select(
              rr.cases[(index - 1 + rr.cases.length) % rr.cases.length].id,
            )
          }
        />
        <Quiet
          compact
          title="Next case"
          icon="ChevronRight"
          onPress={() => rr.select(rr.cases[(index + 1) % rr.cases.length].id)}
        />
      </View>
      {!c.offences.length && (
        <Intro
          title="No assholes? Plot twist."
          body="Gemini found no suspected offence in this clip. Humanity survives."
        />
      )}
      <View style={{ gap: 8 }}>
        <Evidence c={c} seek={seek} revision={revision} onTime={setPlayhead} />
        {line && <T style={{ color: C.accent, fontSize: 13 }}>{line.event}</T>}
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
                {askKeys.length === 1 && askKeys[0] === "location"
                  ? "Where was this?"
                  : "Gemini needs you"}
              </T>
              {askKeys.map(fact)}
            </View>
          )}
          <View style={{ gap: 10 }}>
            <T style={s.section}>Suspected offences</T>
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
                    <T
                      style={{
                        fontSize: 12,
                        color: o.confidence >= 0.9 ? C.accent : C.warning,
                      }}
                    >
                      {o.confidence >= 0.9 ? "Clear" : "Unclear"}
                    </T>
                  </View>
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
                        <Icon name="Check" size={22} color="white" />
                      )}
                    </View>
                  </Pressable>
                </View>
                <Disclosure title="Why, and the law">
                  <T style={{ color: C.accent }}>{o.reasoning || o.label}</T>
                  <T style={s.muted}>
                    {duration(o.atSeconds)} ·{" "}
                    {o.confidence >= 0.9 ? "Clear" : "Unclear"}
                  </T>
                  {o.lawSources.map((law, n) => (
                    <View key={n} style={s.card}>
                      <T style={{ color: C.accent, fontWeight: "700" }}>
                        {law.title || "Legal basis"}
                      </T>
                      {law.section && <T>{law.section}</T>}
                      {law.url && /^https:\/\//.test(law.url) && (
                        <Quiet
                          title="Read the source"
                          icon="ArrowUpRight"
                          onPress={() =>
                            void Linking.openURL(law.url!).catch(showError)
                          }
                        />
                      )}
                      {c.provenance.isDemo && (
                        <T style={s.muted}>Sample citation · synthetic demo.</T>
                      )}
                    </View>
                  ))}
                </Disclosure>
              </View>
            ))}
          </View>
          <View
            style={{
              borderTopWidth: 1,
              borderColor: C.line,
              paddingTop: 18,
              gap: 16,
            }}
          >
            {["location", "description"]
              .filter((k) => locked || !askKeys.includes(k))
              .map(fact)}
          </View>
          {descriptionNote && (
            <T style={s.muted}>
              I kept your description. Update it if the offences changed.
            </T>
          )}
          <Disclosure
            title="All details"
            note={locked ? "Read only" : "Tap to edit"}
          >
            {["plate", "vehicle", "date", "time"]
              .filter((k) => locked || !askKeys.includes(k))
              .map(fact)}
            {fact("model")}
          </Disclosure>
        </>
      )}
      <Quiet
        title="Gemini’s work"
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
            onPress={() =>
              void Sharing.shareAsync(c.evidence.originalVideoUrl!).catch(
                showError,
              )
            }
          />
        )}
    </Page>
  );
}
export function Handoff() {
  const rr = useRoad();
  const c = rr.cases.find((i) => i.id === rr.selected);
  if (!c)
    return (
      <Page title="WhatsApp">
        <Action title="Back to Review" onPress={() => go("review")} />
      </Page>
    );
  return (
    <Page
      title="WhatsApp"
      nav={false}
      footer={
        <>
          <Action
            title="Mark report sent"
            onPress={() =>
              void rr
                .confirmSent(c.id)
                .then(() => go("impact"))
                .catch(showError)
            }
          />
          <Quiet title="Not sent yet" onPress={() => go("review")} />
          <T style={[s.muted, { textAlign: "center" }]}>
            Only you can confirm sending. Opening WhatsApp doesn’t send a
            report.
          </T>
        </>
      }
    >
      <Intro
        title="I drafted it. Go snitch."
        body="Attach the clip, tap Send in WhatsApp, then come back and tell me."
      />
      <View
        style={[
          s.card,
          {
            backgroundColor: C.surface,
            paddingVertical: 30,
            alignItems: "center",
          },
        ]}
      >
        <Icon name="MessageCircle" size={45} />
        <T style={{ fontSize: 18, fontWeight: "700" }}>{c.vehicle.plate}</T>
        <T>Draft opened · not confirmed sent</T>
      </View>
      <Intro
        title="Did you send it?"
        body="I can draft reports. I can’t read your damn mind."
      />
    </Page>
  );
}
