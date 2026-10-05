import React, { useEffect, useRef, useState } from "react";
import { Image, Linking, Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Sharing from "expo-sharing";
import { useRoad } from "./context";
import {
  duration,
  missing,
  regionNames,
  validation,
  whatsapp,
  type RoadCase,
} from "./model";
import { Motion } from "./motion";
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
      <Image
        source={require("../../assets/road/images/dashcam-evidence-demo.jpg")}
        style={{ width: "100%", height: 194 }}
      />
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
        animationType="fade"
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
  const [seek, setSeek] = useState(-1),
    [seekRevision, setSeekRevision] = useState(0),
    [playhead, setPlayhead] = useState(-1),
    [busy, setBusy] = useState(false),
    [direction, setDirection] = useState(1),
    [descriptionNote, setDescriptionNote] = useState(false);
  const changing = useRef(false);
  useEffect(() => {
    setSeek(-1);
    setPlayhead(-1);
    setDescriptionNote(false);
  }, [c?.id]);
  if (!c)
    return (
      <Page title="Review case">
        <Intro
          title="I can’t snitch on thin air."
          body="Record a drive. I’ll check for clown behaviour."
        />
        <Action
          title="Start recording"
          icon="Camera"
          onPress={() => go("recording")}
        />
        <Action
          title="Use a demo clip"
          secondary
          onPress={() => go("developer")}
        />
      </Page>
    );
  const locked = c.reporting.status === "sent",
    error = validation(c);
  const update = (patch: Partial<RoadCase>) =>
    void rr.changeCase(c.id, patch).catch(showError);
  const send = async () => {
    if (changing.current) return;
    changing.current = true;
    setBusy(true);
    try {
      const url = whatsapp(c, rr.prefs);
      await Linking.openURL(url);
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
  const navigate = (n: number) => {
    setDirection(n);
    rr.select(rr.cases[(index + n + rr.cases.length) % rr.cases.length].id);
  };
  return (
    <Page
      title="Review case"
      footer={
        locked ? (
          <>
            <Action
              title="Mark as not sent"
              secondary
              onPress={() =>
                update({
                  reporting: { status: "opened", confirmedByUser: false },
                })
              }
            />
            <T style={[s.muted, { textAlign: "center" }]}>
              This changes your record, not an already sent message.
            </T>
          </>
        ) : c.offences.length ? (
          <>
            <Action
              title="Report via WhatsApp"
              fadeOnEnable
              icon="MessageCircle"
              disabled={!!error || busy}
              onPress={() => void send()}
            />
            <T style={[s.muted, { textAlign: "center", fontSize: 11 }]}>
              {error || "I draft the snitching. You tap Send."}
            </T>
          </>
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
          {c.id} · {regionNames[c.region]}
          {c.region === "MY" ? " / JPJ" : ""}
        </T>
        <Quiet
          compact
          title="Previous case"
          icon="ChevronLeft"
          onPress={() => navigate(-1)}
        />
        <Quiet
          compact
          title="Next case"
          icon="ChevronRight"
          onPress={() => navigate(1)}
        />
      </View>
      <Motion
        identity={c.id}
        direction={direction}
        durationMs={220}
        distance={12}
      >
        <View style={{ gap: 22 }}>
          <Intro
            title={
              !c.offences.length
                ? "No assholes? Plot twist."
                : locked
                  ? "You sent it. I live for this paperwork."
                  : "I found premium stupidity."
            }
            body={
              !c.offences.length
                ? "I found nothing to report. Humanity survives this clip."
                : locked
                  ? "These are the details you confirmed sending."
                  : `${c.offences.length} suspected offence${c.offences.length === 1 ? "" : "s"}. Check me before I snitch.`
            }
          />
          {missing(c).length > 0 && c.offences.length > 0 && (
            <Notice error>{error}</Notice>
          )}
          <Evidence
            c={c}
            seek={seek}
            revision={seekRevision}
            onTime={setPlayhead}
          />
          {c.provenance.isDemo && (
            <T style={s.muted}>
              Synthetic demonstration. No real incident is being reported.
            </T>
          )}
          {c.offences.length > 0 && (
            <>
              <View style={{ gap: 13 }}>
                <View style={s.row}>
                  <T style={s.section}>Suspected offences</T>
                  <T style={s.muted}>Include</T>
                </View>
                {c.offences.map((o) => (
                  <View
                    key={o.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 54,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Seek ${o.label}`}
                      accessibilityState={{
                        selected: Math.abs(playhead - o.atSeconds) <= 0.5,
                      }}
                      onPress={() => {
                        setSeek(o.atSeconds);
                        setPlayhead(o.atSeconds);
                        setSeekRevision((n) => n + 1);
                      }}
                      style={{
                        minHeight: 44,
                        justifyContent: "center",
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor:
                          Math.abs(playhead - o.atSeconds) <= 0.5
                            ? C.mint
                            : "#e8e3ec",
                      }}
                    >
                      <T
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color:
                            Math.abs(playhead - o.atSeconds) <= 0.5
                              ? C.accent
                              : C.ink,
                          textDecorationLine:
                            Math.abs(playhead - o.atSeconds) <= 0.5
                              ? "underline"
                              : "none",
                        }}
                      >
                        {duration(o.atSeconds)}
                      </T>
                    </Pressable>
                    <View style={{ flex: 1, gap: 3 }}>
                      <T
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: o.included ? C.ink : C.muted,
                        }}
                      >
                        {o.label}
                      </T>
                      <T
                        style={{
                          fontSize: 11,
                          color: o.confidence >= 0.9 ? C.accent : C.warning,
                        }}
                      >
                        {o.confidence >= 0.9
                          ? "Clear evidence"
                          : "Unclear footage"}
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
                          width: 23,
                          height: 23,
                          borderWidth: 1,
                          borderColor: C.accent,
                          borderRadius: 5,
                          backgroundColor: o.included ? C.accent : C.surface,
                        }}
                      >
                        {o.included && (
                          <Icon name="Check" size={21} color="white" />
                        )}
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
              {descriptionNote && (
                <Notice>
                  Your description is kept. Review it after changing included
                  offences.
                </Notice>
              )}
              <View style={{ gap: 15 }}>
                <View style={s.row}>
                  <T style={s.section}>Incident details</T>
                  <T style={s.muted}>{locked ? "Read only" : "Tap to edit"}</T>
                </View>
                <Field
                  label="Vehicle plate"
                  value={c.vehicle.plate || ""}
                  editable={!locked}
                  missing={!c.vehicle.plate?.trim()}
                  onChangeText={(v) =>
                    update({ vehicle: { ...c.vehicle, plate: v } })
                  }
                  placeholder="Add vehicle plate"
                />
                <Field
                  label="Vehicle type"
                  value={c.vehicle.type || ""}
                  editable={!locked}
                  missing={!c.vehicle.type?.trim()}
                  onChangeText={(v) =>
                    update({ vehicle: { ...c.vehicle, type: v } })
                  }
                  placeholder="Add vehicle type"
                />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <DateField
                    c={c}
                    kind="date"
                    disabled={locked}
                    onChange={(v) =>
                      update({ incident: { ...c.incident, date: v } })
                    }
                  />
                  <DateField
                    c={c}
                    kind="time"
                    disabled={locked}
                    onChange={(v) =>
                      update({ incident: { ...c.incident, time: v } })
                    }
                  />
                </View>
                <Field
                  label="Location"
                  value={c.incident.location || ""}
                  editable={!locked}
                  missing={!c.incident.location?.trim()}
                  onChangeText={(v) =>
                    update({ incident: { ...c.incident, location: v } })
                  }
                  placeholder="Add road or nearby landmark"
                />
                <Field
                  label="What happened"
                  value={c.incident.description || ""}
                  editable={!locked}
                  missing={!c.incident.description?.trim()}
                  multiline
                  onChangeText={(v) =>
                    update({ incident: { ...c.incident, description: v } })
                  }
                />
                <Field
                  label="Vehicle model · optional"
                  value={c.vehicle.model || ""}
                  editable={!locked}
                  onChangeText={(v) =>
                    update({ vehicle: { ...c.vehicle, model: v } })
                  }
                />
              </View>
            </>
          )}
          {!c.provenance.isDemo &&
            c.offences.some((o) => o.lawSources.length > 0) && (
              <View style={{ gap: 10 }}>
                <T style={s.section}>AI-cited legal basis</T>
                {c.offences.flatMap((o) =>
                  o.lawSources.map((law, i) => (
                    <T key={`${o.id}-${i}`} style={s.muted}>
                      {law.title || law.section}
                    </T>
                  )),
                )}
              </View>
            )}
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
        </View>
      </Motion>
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
        title="Your WhatsApp draft is open."
        body="Check the details, attach the recording if needed, then tap Send in WhatsApp."
      />
      <View
        style={[
          s.card,
          {
            backgroundColor: C.mint,
            paddingVertical: 30,
            alignItems: "center",
          },
        ]}
      >
        <Icon name="MessageCircle" size={45} />
        <T style={{ fontSize: 18, fontWeight: "700" }}>{c.vehicle.plate}</T>
        <T>Draft opened · not confirmed sent</T>
      </View>
      <View style={{ height: 130 }} />
    </Page>
  );
}
