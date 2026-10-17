import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { RealVideo } from "./footage";
import { initialReviewSeek } from "./footage-state";
import Svg, { Path } from "react-native-svg";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { currentLocationDefault, localDate, needsReportDefault } from "./report-defaults";
import { useRoad } from "./context";
import { demoFrameFor } from "./media";
import {
  duration,
  labels,
  missing,
  normalizePlate,
  playableEvidence,
  reportText,
  signedLinkExpired,
  validation,
  whatsapp,
  type RoadCase,
} from "./model";
import {
  PointsChip,
  RECEIPT_STAMP_AT,
  Receipt,
  STAMP_LAND_MS,
  receiptOutcome,
  Stamp,
  SampleOverlay,
} from "./submission-motion";
import { pendingCases, licenceRecord, casePoints } from "./submission-model";
import { Arrival, CaseId, Disclosure, Plate, Spark } from "./standard-ui";
import { shortDate, typedPlate, zoneLabel } from "./format";
import {
  Action,
  C,
  Icon,
  Intro,
  Notice,
  Page,
  Quiet,
  T,
  TextLink,
  go,
  haptic,
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
function Evidence({
  c,
  seek,
  revision,
  onTime,
  subtitle,
}: {
  c: RoadCase;
  seek: number;
  revision: number;
  onTime: (time: number) => void;
  subtitle?: string;
}) {
  const rr = useRoad();
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(Math.max(0, seek));
  // The annotated copy is the point of the review; it only exists once the
  // server has rendered it, and a copy that will not play falls back to the
  // recording rather than an error.
  const [annotated, setAnnotated] = useState(true);
  const played = playableEvidence(c.evidence, annotated);
  const hasFallback =
    annotated &&
    playableEvidence(c.evidence, true) !== playableEvidence(c.evidence, false);
  const fallBack = useCallback(() => setAnnotated(false), []);
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
      style={{ borderRadius: 16, overflow: "hidden", backgroundColor: C.dark }}
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
          paddingLeft: 6,
          paddingRight: 16,
          paddingBottom: 4,
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
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={playing ? "Pause" : "Play"} color="white" />
        </Pressable>
        <View
          style={{
            flex: 1,
            marginHorizontal: 8,
            height: 44,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.25)",
            }}
          >
            <View
              style={{
                height: 4,
                borderRadius: 2,
                width: `${(time / c.evidence.durationSeconds) * 100}%`,
                backgroundColor: "white",
              }}
            />
          </View>
          {/* Offence moments on the timeline, as in the reference scrubber. */}
          {c.offences.map((o) => (
            <View
              key={o.id}
              style={{
                position: "absolute",
                left: `${(o.atSeconds / c.evidence.durationSeconds) * 100}%`,
                width: 4,
                height: 12,
                marginLeft: -2,
                borderRadius: 2,
                backgroundColor: C.gemPhoto,
              }}
            />
          ))}
          <View
            style={{
              position: "absolute",
              left: `${(time / c.evidence.durationSeconds) * 100}%`,
              width: 16,
              height: 16,
              marginLeft: -8,
              borderRadius: 8,
              backgroundColor: "white",
            }}
          />
        </View>
        <T
          style={{
            color: "white",
            fontSize: 13,
            fontWeight: "600",
            fontVariant: ["tabular-nums"],
          }}
        >
          {duration(time)} / {duration(c.evidence.durationSeconds)}
        </T>
      </View>
    </View>
  ) : played ? (
    <View>
      <RealVideo
        // The player itself keys each source; keep retry focus through a link refresh.
        key={`${c.id}-${annotated ? "annotated" : "original"}`}
        uri={played}
        seek={seek}
        revision={revision}
        onTime={onTime}
        caption={subtitle}
        onFailed={hasFallback ? fallBack : undefined}
        onRetry={async () => {
          if (played.startsWith("file:")) return played;
          const refreshed = await rr.refreshEvidence(c.id);
          return playableEvidence(refreshed.evidence, annotated) || played;
        }}
      />
    </View>
  ) : (
    <Notice error>Original evidence is unavailable.</Notice>
  );
}
function DateField({
  c,
  kind,
  disabled,
  wide = false,
  onChange,
}: {
  c: RoadCase;
  kind: "date" | "time";
  disabled: boolean;
  wide?: boolean;
  onChange: (v: string) => void;
}) {
  const rr = useRoad();
  const [open, setOpen] = useState(false);
  const value = c.incident[kind];
  const [draft, setDraft] = useState(new Date());
  const date = () =>
    new Date(
      `${c.incident.date || localDate()}T${c.incident.time || "12:00"}:00`,
    );
  const apply = (d: Date) => {
    onChange(
      kind === "date"
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    );
  };
  return (
    <FactBox
      label={
        kind === "date"
          ? "Date"
          : `Time · ${zoneLabel(c.incident.timeZone, date())}`
      }
      source={factSource(c, kind, value)}
      missing={!value}
      wide={wide}
      onPress={
        disabled
          ? undefined
          : () => {
              setDraft(date());
              setOpen(true);
            }
      }
      accessibilityLabel={`Edit ${kind}`}
    >
      <T style={[factValue, { color: valueColor(c, kind, value) }]}>
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
    </FactBox>
  );
}

/* Reference .fact: the label inside a white box, a blue spark for what Gemini read, "· you" for edits. */
const factValue = {
  fontSize: 17,
  lineHeight: 23,
  fontWeight: "600" as const,
};
function factSource(c: RoadCase, key: string, value: string | null | undefined) {
  if (!value?.trim()) return undefined;
  if (c.edited?.includes(key)) return "you" as const;
  if (key === "location" && c.incident.locationCoordinates) return "mapAddress" as const;
  if (key === "date" && c.defaulted?.includes("date")) return "deviceDate" as const;
  if (key === "time" && c.defaulted?.includes("time")) return "deviceTime" as const;
  if (key === "location" && c.defaulted?.includes("location")) return "deviceLocation" as const;
  return c.analysis || c.provenance.isDemo ? ("ai" as const) : undefined;
}
function valueColor(c: RoadCase, key: string, value: string | null | undefined) {
  return factSource(c, key, value) === "ai" ? C.accent : C.ink;
}
function FactBox({
  label,
  source,
  missing = false,
  focused = false,
  wide = false,
  inAsk = false,
  onPress,
  accessibilityLabel,
  children,
}: React.PropsWithChildren<{
  label: string;
  source?: "ai" | "you" | "deviceDate" | "deviceTime" | "deviceLocation" | "mapAddress";
  missing?: boolean;
  focused?: boolean;
  wide?: boolean;
  inAsk?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}>) {
  const Box = onPress ? Pressable : View;
  return (
    <Box
      {...(onPress ? { onPress, accessibilityRole: "button" as const, accessibilityLabel } : {})}
      style={{
        flexGrow: 1,
        flexBasis: wide ? "100%" : "40%",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1.5,
        borderRadius: 12,
        borderStyle: missing && !focused && !inAsk ? "dashed" : "solid",
        borderColor: focused
          ? C.accent
          : missing
            ? inAsk
              ? C.amberLine
              : C.warning
            : C.line,
        backgroundColor: C.bg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <T
          style={{
            fontSize: 12,
            lineHeight: 14,
            fontWeight: "700",
            color: missing ? C.warning : C.muted,
          }}
        >
          {label}
        </T>
        {source === "ai" && <Spark size={11} tint={C.accent} />}
        {source && source !== "ai" && (
          <T style={{ fontSize: 12, lineHeight: 14, fontWeight: "700" }}>
            · {source === "deviceDate" ? "Device date" : source === "deviceTime" ? "Device time" : source === "deviceLocation" ? "GPS location" : source === "mapAddress" ? "Map address" : "you"}
          </T>
        )}
      </View>
      <View style={{ marginTop: 5 }}>{children}</View>
    </Box>
  );
}
function FactInput({
  label,
  value,
  source,
  missing,
  wide,
  inAsk,
  multiline = false,
  onChangeText,
  ...rest
}: Omit<TextInputProps, "value" | "onChangeText"> & {
  label: string;
  value: string;
  source?: "ai" | "you" | "deviceDate" | "deviceTime" | "deviceLocation" | "mapAddress";
  missing: boolean;
  wide?: boolean;
  inAsk?: boolean;
  onChangeText: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <FactBox
      label={label}
      source={source}
      missing={missing}
      focused={focused}
      wide={wide}
      inAsk={inAsk}
    >
      <TextInput
        maxFontSizeMultiplier={1.6}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        returnKeyType={multiline ? "default" : "done"}
        placeholderTextColor={C.prompt}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: "Manrope",
          padding: 0,
          minHeight: multiline ? 72 : 24,
          color: source === "ai" ? C.accent : C.ink,
          ...(multiline
            ? {
                fontSize: 15,
                lineHeight: 22,
                fontWeight: "500" as const,
                textAlignVertical: "top" as const,
              }
            : { fontSize: 17, fontWeight: "600" as const }),
        }}
        {...rest}
      />
    </FactBox>
  );
}

export function Review() {
  const rr = useRoad();
  const queue = pendingCases(rr.cases);
  const c = rr.cases.find((c) => c.id === rr.selected) || queue[0];
  const index = c ? queue.indexOf(c) : -1;
  const sentCount = rr.cases.filter((x) => x.reporting.status === "sent").length;
  return c ? (
    <CaseReview key={c.id} c={c} index={index} />
  ) : (
    <Page
      title="Cases"
      headerLeft={<View />}
      onRefresh={rr.prefs.demo ? undefined : () => void rr.syncCases(true).catch(showError)}
      refreshing={rr.syncingCases}
    >
      {/* First use and "everything is sent" are different empty states. */}
      <Intro
        title={sentCount ? "All caught up." : "I can’t snitch on thin air."}
        body={
          rr.syncingCases
            ? "Checking the server for shared cases…"
            : sentCount
              ? `Nothing needs you. Your ${sentCount === 1 ? "sent report lives" : `${sentCount} sent reports live`} in Impact.`
              : "Give me a clip. I’ll check for clown behaviour."
        }
      />
      {!!rr.historyError && <Notice error>{rr.historyError}</Notice>}
      <Action
        title="Analyse a clip"
        leading={(pressed) => <Spark size={20} pressed={pressed} />}
        onPress={() => go("clip")}
      />
      {sentCount > 0 && (
        <TextLink title="See your impact" weight="600" onPress={() => go("impact")} />
      )}
    </Page>
  );
}

function CaseReview({ c, index }: { c: RoadCase; index: number }) {
  const rr = useRoad();
  const queue = pendingCases(rr.cases);
  const record = licenceRecord(c);
  const points = casePoints(c);
  const [seek, setSeek] = useState(() => initialReviewSeek(c)),
    [revision, setRevision] = useState(0),
    [playhead, setPlayhead] = useState(() => initialReviewSeek(c));
  const [busy, setBusy] = useState(false),
    [descriptionNote, setDescriptionNote] = useState(false);
  // Keep fields mounted while typing, even after the first character resolves a missing fact.
  const [askKeys] = useState(() => missing(c));
  const changing = useRef(false);
  const currentCase = useRef(c);
  currentCase.current = c;
  const fillReportDefaults = rr.fillReportDefaults;
  const resolveIncidentLocation = rr.resolveIncidentLocation;
  useFocusEffect(useCallback(() => {
    const expected = currentCase.current;
    let focused = true;
    // Permission alerts may briefly make iOS inactive without leaving this screen.
    const active = () => focused && AppState.currentState !== "background";
    if (active()) void resolveIncidentLocation(expected, active).catch(() => {});
    if (active() && needsReportDefault(expected, "date"))
      void fillReportDefaults(expected, { date: localDate() }).catch(() => {});
    if (Platform.OS !== "web" && active() && needsReportDefault(expected, "location")) {
      void currentLocationDefault({
        servicesEnabled: Location.hasServicesEnabledAsync,
        requestPermission: Location.requestForegroundPermissionsAsync,
        currentPosition: () => Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: false,
        }),
        reverseGeocode: Location.reverseGeocodeAsync,
      }, active).then((location) => {
        if (location && active()) return fillReportDefaults(expected, { location });
      }).catch(() => {});
    }
    return () => { focused = false; };
  }, [fillReportDefaults, resolveIncidentLocation]));
  // Signed evidence links last six hours; a case opened later fetches new ones
  // rather than showing "could not be opened".
  const stale = [
    c.evidence.originalVideoUrl,
    c.evidence.annotatedVideoUrl,
    c.evidence.excerptVideoUrl,
  ].some((url) => signedLinkExpired(url));
  useEffect(() => {
    if (stale) void rr.refreshEvidence(c.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, stale]);
  // Dismissed cases leave both Cases and Impact without being reported.
  const dismiss = (shown: string[]) => {
    // The queue shows one case per plate, so its hidden repeats go with it.
    const plates = new Set(
      rr.cases
        .filter((q) => shown.includes(q.id))
        .map((q) => normalizePlate(q.vehicle.plate))
        .filter(Boolean),
    );
    const ids = rr.cases
      .filter(
        (q) =>
          shown.includes(q.id) ||
          (q.reporting.status !== "sent" && plates.has(normalizePlate(q.vehicle.plate))),
      )
      .map((q) => q.id);
    Alert.alert(
      shown.length > 1 ? `Clear all ${shown.length} waiting cases?` : "Dismiss this case?",
      `${shown.length > 1 ? "They leave" : "It leaves"} Cases and Impact without being reported. Sent reports are unaffected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: ids.length > 1 ? "Clear all" : "Dismiss",
          style: "destructive",
          onPress: () => {
            const next = queue.find((q) => !shown.includes(q.id));
            void rr
              .dismissCases(ids)
              .then(() => rr.select(next?.id || ""))
              .catch(showError);
          },
        },
      ],
    );
  };
  const locked = c.reporting.status === "sent",
    error = validation(c);
  const update = (patch: Partial<RoadCase>) =>
    void rr.changeCase(c.id, patch).catch(showError);
  const fact = (key: string, inAsk = false) => {
    const wide = inAsk || ["location", "description", "model"].includes(key);
    if (key === "date" || key === "time")
      return (
        <DateField
          key={key}
          c={c}
          kind={key}
          wide={inAsk}
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
      <FactInput
        key={key}
        label={label}
        value={value || ""}
        source={factSource(c, key, value)}
        missing={key !== "model" && !value?.trim()}
        wide={wide}
        inAsk={inAsk}
        editable={!locked}
        multiline={key === "description"}
        // Plates are typed as printed: capitals, no autocorrect.
        {...(key === "plate"
          ? {
              autoCapitalize: "characters" as const,
              autoCorrect: false,
              spellCheck: false,
            }
          : {})}
        placeholder={
          {
            plate: "e.g. ABC 1234",
            vehicle: "e.g. White sedan",
            location: "Road or nearby landmark",
            description: "What the vehicle did",
            model: "If you know it",
          }[key]
        }
        onChangeText={(v) =>
          update(
            vehicleKey
              ? {
                  vehicle: {
                    ...c.vehicle,
                    [vehicleKey]: key === "plate" ? typedPlate(v) : v,
                  },
                }
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
      const fresh = await rr.refreshEvidence(c.id);
      await openWhatsAppDraft(fresh, rr.prefs);
      await rr.changeCase(c.id, {
        reporting: { status: "opened", confirmedByUser: false },
      });
      // The handoff reads the selected case; this one may be showing only as the queue's first.
      rr.select(c.id);
      go("handoff");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
      changing.current = false;
    }
  };
  const isNow = (at: number) => Math.abs(playhead - at) <= 0.5;
  const line = c.analysis?.timeline.find(
    (t) => playhead >= t.start_seconds && playhead <= t.end_seconds,
  );
  return (
    <Page
      gap={0}
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
            <View />
          )
        ) : (
          // Past cases open from Impact; the header must not wait for the route to settle to show Back.
          <Quiet title="Back" compact icon="ChevronLeft" onPress={() => go("impact")} />
        )
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
        ) : undefined
      }
      footer={
        c.offences.length ? (
          locked ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Action
                    title="View Impact"
                    icon="History"
                    secondary
                    onPress={() => go("impact")}
                  />
                </View>
                <Quiet
                  title="Mark as not sent"
                  onPress={() =>
                    update({
                      reporting: { status: "opened", confirmedByUser: false },
                    })
                  }
                />
              </View>
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
              <Pressable
                accessibilityRole="button"
                onPress={() => dismiss([c.id])}
                hitSlop={8}
                style={{ alignSelf: "center", paddingVertical: 6 }}
              >
                <T
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: C.muted,
                    textDecorationLine: "underline",
                  }}
                >
                  Dismiss case
                </T>
              </Pressable>
            </>
          )
        ) : (
          <Action
            title="Back to Impact"
            icon="History"
            secondary
            onPress={() => go("impact")}
          />
        )
      }
    >
      {["opened", "sent"].includes(c.reporting.status) && (
        <T
          style={{
            marginBottom: 12,
            fontSize: 13,
            lineHeight: 16,
            fontWeight: "700",
            color: locked ? C.green : C.ink,
          }}
        >
          {labels[c.reporting.status]}
        </T>
      )}
      {!c.offences.length && (
        <View style={{ marginBottom: 18 }}>
          <Intro
            title="No assholes? Plot twist."
            body="Gemini found no suspected offence in this clip. Humanity survives."
          />
        </View>
      )}
      <View style={{ gap: 8 }}>
        <Evidence
          c={c}
          seek={seek}
          revision={revision}
          onTime={setPlayhead}
          subtitle={c.analysis?.timeline.length ? line?.event || "" : undefined}
        />
      </View>
      <View
        style={{
          marginVertical: 18,
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
        <View style={{ flex: 1, minWidth: 130, gap: 4 }}>
          <T
            style={{
              fontWeight: "700",
              lineHeight: 19,
              color: c.edited?.includes("vehicle") ? C.ink : C.accent,
            }}
          >
            {c.vehicle.type || "Unknown vehicle"}
            {c.edited?.includes("vehicle") ? " · you" : ""}
          </T>
          <T style={{ fontSize: 14, lineHeight: 17, color: C.muted }}>
            {shortDate(c.incident.date, rr.prefs.language)} ·{" "}
            {c.incident.time || "Time unknown"}
          </T>
        </View>
      </View>
      {!!c.offences.length && (
        <>
          {!!askKeys.length && !locked && (
            // One tinted panel with one bordered input; once filled it calms to a hairline.
            <View
              style={{
                marginBottom: 22,
                padding: 16,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: missing(c).length ? C.warningBg : C.line,
                backgroundColor: missing(c).length ? C.warningBg : "transparent",
              }}
            >
              <T
                style={{
                  marginBottom: 10,
                  fontWeight: "800",
                  fontSize: 21,
                  lineHeight: 24,
                  letterSpacing: -0.3,
                }}
              >
                {askKeys.length === 1 && askKeys[0] === "plate"
                  ? "What’s the plate?"
                  : askKeys.length === 1 && askKeys[0] === "location"
                    ? "Where was this?"
                    : "Gemini needs you"}
              </T>
              <View style={{ gap: 8 }}>{askKeys.map((k) => fact(k, true))}</View>
            </View>
          )}
          <View style={{ gap: 0 }}>
            <View style={[s.row, { paddingBottom: 6 }]}>
              <T style={s.section}>Suspected offences</T>
              <T style={{ fontSize: 12, fontWeight: "700", color: C.muted }}>
                In report
              </T>
            </View>
            {c.offences.map((o) => (
              <View
                key={o.id}
                style={{
                  gap: 4,
                  paddingBottom: 12,
                  borderTopWidth: 1,
                  borderColor: C.line,
                  opacity: o.included ? 1 : 0.6,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                    paddingVertical: 8,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Seek ${o.label}`}
                    // The chip for the moment under the playhead inverts to Ink.
                    accessibilityState={{ selected: isNow(o.atSeconds) }}
                    onPress={() => {
                      setSeek(o.atSeconds);
                      setPlayhead(o.atSeconds);
                      setRevision((n) => n + 1);
                    }}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: isNow(o.atSeconds) ? C.ink : C.surface,
                      transform: [{ scale: pressed && !rr.reduced ? 0.92 : 1 }],
                    })}
                  >
                    <T
                      style={{
                        color: isNow(o.atSeconds) ? "white" : C.ink,
                        fontSize: 14,
                        lineHeight: 18,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
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
                        fontSize: 16,
                        lineHeight: 20,
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
                      haptic.select();
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
                        borderWidth: 2,
                        borderColor: o.included ? C.accent : "#A9AEB8",
                        borderRadius: 7,
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: o.included ? C.accent : C.bg,
                        opacity: locked ? 0.5 : 1,
                      }}
                    >
                      {o.included && (
                        <Stamp>
                          <Icon
                            name="Check"
                            size={16}
                            color="white"
                            strokeWidth={3}
                          />
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
                      columnGap: 10,
                    }}
                  >
                    <T
                      style={{ fontSize: 14, lineHeight: 20, fontWeight: "700" }}
                    >
                      {law.act || law.title}
                      {law.section ? ", " + law.section : ""}
                    </T>
                    {law.url?.startsWith("https://") && (
                      <TextLink
                        title="Read the law"
                        trailingIcon="ArrowUpRight"
                        size={14}
                        inline
                        accessibilityLabel={`Read ${law.act || law.title}${law.section ? ", " + law.section : ""}`}
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
                        marginTop: 6,
                        fontSize: 13,
                        lineHeight: 17,
                        color: C.penalty,
                        fontWeight: "700",
                      }}
                    >
                      {record.points + points >= 20
                        ? `${c.vehicle.plate} already has ${record.points}. This could make it ${record.points + points}: licence suspended.`
                        : `${c.vehicle.plate} already has ${record.points}. 20 suspends a licence.`}
                    </T>
                  </Arrival>
                )}
              </View>
            ))}
          </View>
          <View style={{ marginTop: 18 }}>
            <Disclosure
              title={locked ? "Details" : "Edit details"}
              note={locked ? "Read only" : undefined}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {["plate", "vehicle", "date", "time", "location", "description"]
                  .filter((k) => locked || !askKeys.includes(k))
                  .map((k) => fact(k))}
                {fact("model")}
              </View>
              {descriptionNote && (
                <T style={[s.muted, { marginBottom: 12 }]}>
                  I kept your description. Update it under Edit details if the
                  offences changed.
                </T>
              )}
            </Disclosure>
          </View>
        </>
      )}
      <View style={{ marginTop: 10 }} />
      <TextLink
        title="How Gemini decided"
        align="flex-start"
        weight="600"
        leading={<Spark size={12} />}
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
  const [busy, setBusy] = useState(false);
  // "Yes, I sent it": the chip turns into Sent first; only then does the page become the receipt.
  const [celebrating, setCelebrating] = useState(false);
  if (!c)
    return (
      <Page title="WhatsApp" nav={false}>
        <Action title="Back to Cases" onPress={() => go("review")} />
      </Page>
    );
  const sent = c.reporting.status === "sent";
  const localClip =
    !c.provenance.isDemo && !!c.evidence.originalVideoUrl?.startsWith("file:");
  // Points already on the licence plus other Sent reports for this plate: where the bar starts.
  const before =
    (licenceRecord(c)?.points ?? 0) +
    rr.cases
      .filter(
        (x) =>
          x.id !== c.id &&
          x.reporting.status === "sent" &&
          normalizePlate(x.vehicle.plate) === normalizePlate(c.vehicle.plate),
      )
      .reduce((n, x) => n + casePoints(x), 0);
  const confirm = async () => {
    haptic.tap();
    setBusy(true);
    setCelebrating(true);
    try {
      if (!rr.reduced) await new Promise((r) => setTimeout(r, 420 + 260));
      await rr.confirmSent(c.id, true);
    } catch (e) {
      setCelebrating(false);
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="WhatsApp"
      nav={false}
      gap={0}
      headerRight={<CaseId c={c} />}
      footer={
        sent ? (
          <Rise delay={rr.reduced ? 0 : RECEIPT_STAMP_AT + 650}>
            <Action
              title="See your impact"
              icon="History"
              onPress={() => {
                undoOnLeave.started = c.id;
                rr.startUndo(c.id);
                go("impact");
              }}
            />
          </Rise>
        ) : (
          <FadeOut out={celebrating}>
            <View style={{ gap: 10 }}>
              <Action
                title="Yes, I sent it"
                icon="Check"
                disabled={busy}
                onPress={() => void confirm()}
              />
              <Action
                title="Not yet"
                icon="Clock"
                secondary
                onPress={() => go("review")}
              />
            </View>
            {!validation(c) && (
              <View style={{ marginTop: 6 }}>
                <TextLink
                  title="Open WhatsApp again"
                  weight="600"
                  leading={<Icon name="MessageCircle" size={16} color={C.accent} />}
                  onPress={() =>
                    void rr
                      .refreshEvidence(c.id)
                      .then((fresh) => openWhatsAppDraft(fresh, rr.prefs))
                      .catch(showError)
                  }
                />
              </View>
            )}
          </FadeOut>
        )
      }
    >
      {sent ? (
        <SentReceipt c={c} before={before} startUndo={rr.startUndo} />
      ) : (
        <>
          <Intro
            title="Did you send it?"
            body={
              c.evidence.excerptVideoUrl?.startsWith("https://")
                ? "Tap Send in WhatsApp, then tell me here."
                : localClip
                  ? "Tap Send in WhatsApp, then share the clip to the same chat."
                  : "Attach the clip, tap Send in WhatsApp, then tell me here."
            }
          />
          <StateCard c={c} sent={celebrating} />
          {/* openWhatsAppDraft also copies the report, so say so instead of overwriting silently. */}
          <T style={{ marginTop: -12, marginBottom: 12, fontSize: 13, lineHeight: 18, color: C.muted }}>
            The report text is on your clipboard too, in case WhatsApp drops it.
          </T>
          {localClip && (
            <Action
              title="Share original clip"
              secondary
              icon="Upload"
              disabled={busy}
              onPress={() => void shareOriginal(c).catch(showError)}
            />
          )}
        </>
      )}
    </Page>
  );
}

// Leaving the receipt by Back (not only See your impact) still opens the 8-second Undo, as in the reference.
const undoOnLeave = { started: "" };
function SentReceipt({
  c,
  before,
  startUndo,
}: {
  c: RoadCase;
  before: number;
  startUndo: (id: string) => void;
}) {
  const { reduced, foreground } = useRoad();
  const out = receiptOutcome(c, before);
  const leave = useRef(startUndo);
  leave.current = startUndo;
  useEffect(() => {
    undoOnLeave.started = "";
    return () => {
      if (undoOnLeave.started !== c.id) leave.current(c.id);
      undoOnLeave.started = "";
    };
  }, [c.id]);
  // The whole page jumps a little as the Reported stamp lands, and the phone taps back.
  const jolt = useRef(new Animated.Value(0)).current;
  // One frame before the stamp lands, so the hit and the jolt are a single beat.
  const impact = RECEIPT_STAMP_AT + STAMP_LAND_MS - 16;
  useEffect(() => {
    if (!foreground) return;
    const thud = setTimeout(haptic.success, reduced ? 0 : impact);
    return () => clearTimeout(thud);
  }, [reduced, foreground, impact]);
  useEffect(() => {
    if (reduced || !foreground) return;
    const a = Animated.sequence([
      Animated.delay(impact),
      Animated.timing(jolt, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(jolt, { toValue: 0, duration: 220, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [jolt, reduced, foreground, impact]);
  return (
    <Animated.View
      style={{
        transform: [
          { translateY: jolt.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) },
          { scale: jolt.interpolate({ inputRange: [0, 1], outputRange: [1, 0.995] }) },
        ],
      }}
    >
      <Intro title="Reported. Your part’s done." body="Here’s your receipt." />
      <View style={{ marginTop: 18 }}>
        <Receipt c={c} before={before} />
      </View>
      <View style={{ marginTop: 18 }}>
        <Arrival delay={reduced ? 0 : RECEIPT_STAMP_AT + 450} distance={10}>
          <T
            accessibilityRole="header"
            balance
            style={{ fontSize: 21, lineHeight: 25, fontWeight: "800", letterSpacing: -0.3 }}
          >
            {out.first}
          </T>
        </Arrival>
        {!!out.second && (
          <Arrival delay={reduced ? 0 : RECEIPT_STAMP_AT + 610} distance={10}>
            <T style={{ marginTop: 6, fontSize: 16, lineHeight: 22, color: C.muted }}>
              {out.second}
            </T>
          </Arrival>
        )}
      </View>
    </Animated.View>
  );
}

/** Reference .state-card: the plate and the draft's state; it turns green as the chip becomes Sent. */
function StateCard({ c, sent }: { c: RoadCase; sent: boolean }) {
  const { reduced, foreground } = useRoad();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const tone = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced || !foreground) {
      enter.setValue(1);
      return;
    }
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 460,
      delay: 160,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, reduced, foreground]);
  useEffect(() => {
    if (!sent) return;
    if (reduced || !foreground) {
      tone.setValue(1);
      return;
    }
    Animated.timing(tone, { toValue: 1, duration: 450, useNativeDriver: false }).start();
    pop.setValue(0.85);
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.12, duration: 230, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: 190, useNativeDriver: true }),
    ]).start();
  }, [sent, reduced, foreground, tone, pop]);
  return (
    <Animated.View
      style={{
        marginTop: 22,
        marginBottom: 24,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
        ],
      }}
    >
      <Animated.View
        style={{
          padding: 16,
          borderRadius: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          backgroundColor: tone.interpolate({ inputRange: [0, 1], outputRange: [C.surface, C.mint] }),
        }}
      >
        <Plate value={c.vehicle.plate} />
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: sent ? C.mint : C.lilac,
            }}
          >
            {sent ? (
              <DrawCheck color={C.green} />
            ) : (
              <Icon name="MessageCircle" size={16} />
            )}
            <T
              style={{
                fontSize: sent ? 17 : 14,
                lineHeight: sent ? 20 : 18,
                fontWeight: "700",
                color: sent ? C.green : C.ink,
              }}
            >
              {sent ? "Sent" : "Draft opened"}
            </T>
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** The Sent check draws itself (reference: stroke-dashoffset 1 → 0 over 420ms). */
function DrawCheck({ color }: { color: string }) {
  const { reduced } = useRoad();
  const length = 22.7;
  const v = useRef(new Animated.Value(reduced ? 0 : length)).current;
  useEffect(() => {
    if (reduced) return;
    const a = Animated.timing(v, {
      toValue: 0,
      duration: 420,
      delay: 120,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [v, reduced]);
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <AnimatedPath
        d="M20 6 9 17l-5-5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[length, length]}
        strokeDashoffset={v}
      />
    </Svg>
  );
}

/** A footer that leaves: fades out and stops taking taps. */
function FadeOut({ out, children }: React.PropsWithChildren<{ out: boolean }>) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: out ? 0 : 1, duration: 200, useNativeDriver: true }).start();
  }, [out, v]);
  return (
    <Animated.View pointerEvents={out ? "none" : "auto"} style={{ opacity: v }}>
      {children}
    </Animated.View>
  );
}
/** A footer action that rises into place on the travel curve. */
function Rise({ delay, children }: React.PropsWithChildren<{ delay: number }>) {
  const { reduced, foreground } = useRoad();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced || !foreground) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, delay, reduced, foreground]);
  return (
    <Animated.View
      style={{
        opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
