import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Svg, { Path, Rect } from "react-native-svg";
import { useRoad } from "./context";
import {
  deathStats,
  deathSentence,
  casePoints,
} from "./submission-model";
import type { RoadCase } from "./model";
import { shortDate } from "./format";
import { T, C, styles as s } from "./ui";
import { Plate } from "./standard-ui";

/** When the REPORTED stamp hits the paper, measured from its delay; the page jolt keys off this. */
export const STAMP_LAND_MS = 170;
export function Stamp({
  children,
  delay = 0,
  reported = false,
}: React.PropsWithChildren<{ delay?: number; reported?: boolean }>) {
  const { reduced, foreground } = useRoad();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    v.setValue(reduced || !foreground ? 1 : 0);
    if (reduced || !foreground) return;
    const a = reported
      ? // The stamp falls (accelerating) onto the paper and lands at a known moment, then settles
        // while the page takes the hit. An ease-out slam landed after ~80ms and drifted for 400ms,
        // so the jolt read as a second, separate animation.
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 0.7,
            duration: STAMP_LAND_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ])
      : Animated.timing(v, {
          toValue: 1,
          duration: 460,
          delay,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        });
    a.start();
    return () => a.stop();
  }, [v, reduced, foreground, delay, reported]);
  // Reference keyframes: slam in from 2.4–2.6× and a steep angle, overshoot at 70%, settle.
  return (
    <Animated.View
      style={{
        opacity: v.interpolate(
          reported
            ? // Visible for most of the fall, not only at the last instant.
              { inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }
            : { inputRange: [0, 0.7, 1], outputRange: [0, 1, 1] },
        ),
        transform: [
          {
            scale: v.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [reported ? 2.6 : 2.4, 0.92, 1],
            }),
          },
          {
            rotate: v.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: reported
                ? ["-26deg", "-7deg", "-9deg"]
                : ["-14deg", "-3deg", "0deg"],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
export function PointsChip({
  points,
  delay = 0,
}: {
  points: number;
  delay?: number;
}) {
  return points > 0 ? (
    <Stamp delay={delay}>
      <View
        style={{
          backgroundColor: C.penalty,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 99,
        }}
      >
        <T
          style={{
            fontSize: 13,
            lineHeight: 18,
            color: "white",
            fontWeight: "800",
            fontVariant: ["tabular-nums"],
          }}
        >
          +{points} pts
        </T>
      </View>
    </Stamp>
  ) : null;
}
// The stat's rolling slots are measured in points, so they grow with the text they clip.
const STAT_CAP = 1.4;
export function RoadStat() {
  const { reduced, foreground } = useRoad();
  const k = Math.min(useWindowDimensions().fontScale, STAT_CAP);
  const focused = useIsFocused();
  const [index, setIndex] = useState(0);
  const previous = useRef(0);
  const current = useRef(0);
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      previous.current = current.current = 0;
      setIndex(0);
      v.setValue(1);
    }
    if (reduced || !foreground || !focused) return;
    const timer = setInterval(() => {
      previous.current = current.current;
      current.current = (current.current + 1) % deathStats.length;
      v.setValue(0);
      setIndex(current.current);
      Animated.timing(v, {
        toValue: 1,
        duration: 560,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        // Width changes let the stable words glide beside the rolling digits.
        useNativeDriver: false,
      }).start();
    }, 3400);
    return () => {
      clearInterval(timer);
      v.stopAnimation();
      v.setValue(1);
    };
  }, [reduced, foreground, focused, v]);
  const [n, place] = deathStats[index];
  const [oldNumber, oldPlace] = deathStats[previous.current];
  const digits = String(n),
    oldDigits = String(oldNumber);
  const slots = Math.max(digits.length, oldDigits.length);
  const rising = v.interpolate({ inputRange: [0, 1], outputRange: [20 * k, 0] });
  const departing = v.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20 * k],
  });
  // Reference .home-stat: 700 14px muted, the number in Ink 800.
  const statText = {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700" as const,
    color: C.muted,
  };
  const digitText = { color: C.ink, fontWeight: "800" as const };
  return (
    <View
      accessible
      accessibilityLabel={deathSentence(0)}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}
      >
        <Animated.View
          style={{
            width: v.interpolate({
              inputRange: [0, 1],
              outputRange: [oldDigits.length * 8.8 * k, digits.length * 8.8 * k],
            }),
            height: 20 * k,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: slots }, (_, i) => {
            const before = oldDigits.padStart(slots, " ")[i];
            const after = digits.padStart(slots, " ")[i];
            const right = (slots - i - 1) * 8.8 * k;
            return (
              <View
                key={i}
                style={{ position: "absolute", right, width: 8.8 * k, height: 20 * k }}
              >
                {before === after ? (
                  <T maxFontSizeMultiplier={STAT_CAP}
                    style={[
                      statText,
                      { ...digitText, fontVariant: ["tabular-nums"] },
                    ]}
                  >
                    {after}
                  </T>
                ) : (
                  <>
                    <Animated.View
                      style={{
                        position: "absolute",
                        transform: [{ translateY: departing }],
                        opacity: v.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0],
                        }),
                      }}
                    >
                      <T maxFontSizeMultiplier={STAT_CAP}
                        style={[
                          statText,
                          { ...digitText, fontVariant: ["tabular-nums"] },
                        ]}
                      >
                        {before}
                      </T>
                    </Animated.View>
                    <Animated.View
                      style={{
                        transform: [{ translateY: rising }],
                        opacity: v,
                      }}
                    >
                      <T maxFontSizeMultiplier={STAT_CAP}
                        style={[
                          statText,
                          { ...digitText, fontVariant: ["tabular-nums"] },
                        ]}
                      >
                        {after}
                      </T>
                    </Animated.View>
                  </>
                )}
              </View>
            );
          })}
        </Animated.View>
        <T maxFontSizeMultiplier={STAT_CAP} style={statText}> {n === 1 ? "person dies" : "people die"} on </T>
        <View style={{ height: 20 * k, overflow: "hidden" }}>
          <T maxFontSizeMultiplier={STAT_CAP} style={[statText, { opacity: 0 }]}>{place}</T>
          <Animated.View
            style={{
              position: "absolute",
              transform: [{ translateY: departing }],
              opacity: v.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            }}
          >
            <T maxFontSizeMultiplier={STAT_CAP} style={statText}>{oldPlace}</T>
          </Animated.View>
          <Animated.View
            style={{
              position: "absolute",
              transform: [{ translateY: rising }],
              opacity: v,
            }}
          >
            <T maxFontSizeMultiplier={STAT_CAP} style={statText}>{place}</T>
          </Animated.View>
        </View>
        <T maxFontSizeMultiplier={STAT_CAP} style={statText}>
          {" "}
          roads {place === "Singapore" ? "every 3 days." : "every day."}
        </T>
      </View>
    </View>
  );
}
/**
 * The 20-segment licence bar (reference .meter-bar): points on record in solid Paper/Ink, then
 * points from Sent reports striped in Penalty. The solid part grows first and the stripes follow,
 * so the bar fills in two moves rather than one.
 */
// The reference's repeating-linear-gradient(-45deg, light 0 5px, red 5px 10px), drawn as paths:
// react-native-svg breaks a rotated Pattern into stray triangles on iOS.
const STRIPES_WIDTH = 480;
const STRIPES = Array.from({ length: 36 }, (_, i) => {
  const x = -18 + i * 10 * Math.SQRT2,
    w = 5 * Math.SQRT2;
  return `M${x.toFixed(2)} 18H${(x + w).toFixed(2)}L${(x + w + 18).toFixed(2)} 0H${(x + 18).toFixed(2)}Z`;
}).join("");
export function MeterBar({
  record,
  pending,
  light = false,
  delay = 0,
  pendingDelay,
}: {
  record: number;
  pending: number;
  light?: boolean;
  delay?: number;
  pendingDelay?: number;
}) {
  const { reduced, foreground } = useRoad();
  const solid = useRef(new Animated.Value(1)).current;
  const stripes = useRef(new Animated.Value(1)).current;
  const pts = Math.min(20, record),
    pend = Math.min(20 - pts, pending);
  useEffect(() => {
    if (reduced || !foreground) {
      solid.setValue(1);
      stripes.setValue(1);
      return;
    }
    solid.setValue(0);
    stripes.setValue(0);
    const ease = Easing.bezier(0.16, 1, 0.3, 1);
    const a = Animated.parallel([
      Animated.timing(solid, { toValue: 1, duration: light ? 600 : 700, delay, easing: ease, useNativeDriver: true }),
      Animated.timing(stripes, {
        toValue: 1,
        duration: light ? 640 : 600,
        delay: pendingDelay ?? delay + 500,
        easing: ease,
        useNativeDriver: true,
      }),
    ]);
    a.start();
    return () => a.stop();
  }, [solid, stripes, reduced, foreground, pts, pend, delay, pendingDelay, light]);
  const gap = light ? C.surface : C.ink;
  return (
    <View
      accessible
      accessibilityLabel={`${record} points on record, ${pending} potential points from reports, out of 20`}
      style={{
        height: 18,
        borderRadius: 9,
        overflow: "hidden",
        backgroundColor: light ? C.lilac : "rgba(255,255,255,0.14)",
      }}
    >
      {pts > 0 && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${(pts / 20) * 100}%`,
            backgroundColor: light ? C.ink : C.paper,
            transformOrigin: "left center",
            transform: [{ scaleX: solid }],
          }}
        />
      )}
      {pend > 0 && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${(pts / 20) * 100}%`,
            width: `${(pend / 20) * 100}%`,
            overflow: "hidden",
            transformOrigin: "left center",
            opacity: stripes.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ scaleX: stripes }],
          }}
        >
          <Svg width={STRIPES_WIDTH} height={18}>
            <Rect width={STRIPES_WIDTH} height={18} fill={C.penalty} />
            <Path d={STRIPES} fill={C.penaltyLight} />
          </Svg>
        </Animated.View>
      )}
      {/* 2pt gaps every 5% carry the scale, so no "20 = suspended" label is needed. */}
      {Array.from({ length: 19 }, (_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${(i + 1) * 5}%`,
            width: 2,
            marginLeft: -2,
            backgroundColor: gap,
          }}
        />
      ))}
    </View>
  );
}
/** The meter's key: matching swatches, each part shown only when it is non-zero. */
export function MeterKey({
  record,
  pending,
  reports = 1,
  demo = false,
}: {
  record: number;
  pending: number;
  /** Sent reports behind the striped points; the reference says "your reports" past one. */
  reports?: number;
  demo?: boolean;
}) {
  const label = {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600" as const,
    color: C.lineHover,
  };
  const value = {
    color: "white",
    fontWeight: "800" as const,
    fontVariant: ["tabular-nums" as const],
  };
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 16,
        rowGap: 6,
      }}
    >
      {record > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: C.paper,
            }}
          />
          <T style={label}>
            <T style={[label, value]}>{record}</T> on record
          </T>
        </View>
      )}
      {pending > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              overflow: "hidden",
              backgroundColor: C.penalty,
            }}
          >
            <Svg width={12} height={12}>
              <Path
                d="M-3 9L9 -3M1 13L13 1M5 17L17 5"
                stroke={C.penaltyLight}
                strokeWidth={2.2}
              />
            </Svg>
          </View>
          <T style={label}>
            <T style={[label, value]}>{pending}</T> from{" "}
            {reports > 1 ? "your reports" : "your report"}
          </T>
        </View>
      )}
      {demo && <T style={label}>demo</T>}
    </View>
  );
}
const receiptHead = {
  fontSize: 13,
  lineHeight: 16,
  fontWeight: "800" as const,
  letterSpacing: 0.8,
  color: C.muted,
  fontVariant: ["tabular-nums" as const],
};
const roadOf = (c: RoadCase) => String(c.incident.location || "").split(",")[0].trim();
const offenderName: Record<string, string> = {
  red_light: "red‑light runner",
  double_line: "double‑line overtaker",
  wrong_way: "wrong‑way driver",
  dangerous: "reckless driver",
};
/** Reference receiptOutcome(): what this report could do, then one line of humour about the road. */
export function receiptOutcome(c: RoadCase, before: number) {
  const add = casePoints(c),
    total = before + add,
    road = roadOf(c),
    code = c.offences.find((o) => o.included)?.code || "";
  return {
    add,
    before,
    total,
    first:
      add && total >= 20
        ? `If JPJ agrees, ${c.vehicle.plate} loses their licence.`
        : add
          ? `If JPJ agrees, ${c.vehicle.plate} is ${20 - total} points from losing their licence.`
          : "JPJ decides what happens next.",
    second: road
      ? `That’s one less ${offenderName[code] || "dangerous driver"} on ${road}.`
      : "",
  };
}
/**
 * The road receipt. It prints first (900ms clip reveal); only once it is fully out do the licence
 * points fill (solid, then stripes, the total counting up) and the Reported stamp slam in.
 */
export const RECEIPT_PRINT_MS = 900;
export const RECEIPT_STAMP_AT = 2150;
export function Receipt({ c, before }: { c: RoadCase; before: number }) {
  const { reduced, foreground, prefs } = useRoad();
  const language = prefs.language;
  const [height, setHeight] = useState(0);
  const v = useRef(new Animated.Value(1)).current;
  const out = receiptOutcome(c, before);
  // This report's points always show in red: on a plate that is already full, they take the
  // last segments and the points before it fill the rest.
  const record = Math.min(before, 20 - Math.min(20, out.add));
  const [shown, setShown] = useState(Math.min(20, out.total));
  useEffect(() => {
    v.setValue(reduced || !foreground ? 1 : 0);
    if (reduced || !foreground) return;
    const a = Animated.timing(v, {
      toValue: 1,
      duration: RECEIPT_PRINT_MS,
      easing: Easing.bezier(0.3, 0.7, 0.2, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, reduced, foreground]);
  // The total counts from the points before this report up to the new total as the stripes fill.
  useEffect(() => {
    const to = Math.min(20, out.total);
    if (reduced || !foreground) {
      setShown(to);
      return;
    }
    setShown(record);
    let frame = 0;
    const start = Date.now() + RECEIPT_PRINT_MS + 550;
    const tick = () => {
      const k = Math.max(0, Math.min(1, (Date.now() - start) / 640));
      setShown(Math.round(record + (to - record) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, foreground, record, out.total]);
  const dashed = {
    borderStyle: "dashed" as const,
    borderColor: C.lineHover,
  };
  return (
    <Animated.View
      style={{
        overflow: "hidden",
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
        ],
      }}
    >
      <View
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={{ backgroundColor: C.surface, padding: 16, paddingBottom: 20 }}
      >
        <View
          style={[
            s.row,
            { alignItems: "baseline", paddingBottom: 12, borderBottomWidth: 1.5, ...dashed },
          ]}
        >
          <T style={receiptHead}>ROAD RECEIPT</T>
          <T numberOfLines={1} style={[receiptHead, { letterSpacing: 0, flexShrink: 1 }]}>
            {c.id.replace("SUB-", "")}
          </T>
        </View>
        <View style={[s.row, { marginTop: 14, marginBottom: 4 }]}>
          <Plate value={c.vehicle.plate} />
          <Stamp reported delay={RECEIPT_STAMP_AT}>
            <T
              maxFontSizeMultiplier={1.3}
              style={{
                marginRight: 4,
                paddingHorizontal: 10,
                paddingTop: 7,
                paddingBottom: 6,
                borderWidth: 2.5,
                borderColor: C.green,
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "rgba(232,246,236,0.8)",
                color: C.green,
                fontSize: 15,
                lineHeight: 17,
                fontWeight: "800",
                letterSpacing: 2.1,
              }}
            >
              REPORTED
            </T>
          </Stamp>
        </View>
        <View style={{ paddingTop: 6, paddingBottom: 14, borderBottomWidth: 1.5, ...dashed }}>
          {c.offences
            .filter((o) => o.included)
            .map((o) => (
              <View key={o.id} style={{ marginTop: 8 }}>
                <View style={s.row}>
                  <T style={{ fontWeight: "700", flex: 1, fontSize: 16, lineHeight: 21 }}>
                    {o.label}
                  </T>
                  <PointsChip points={o.demeritPoints ?? 0} delay={500} />
                </View>
                {o.lawSources.map((l, i) => (
                  <T
                    key={i}
                    style={{ marginTop: 2, fontSize: 14, lineHeight: 19, fontWeight: "600", color: C.muted }}
                  >
                    {l.act || l.title}
                    {l.section ? ", " + l.section : ""}
                  </T>
                ))}
              </View>
            ))}
          <T style={{ marginTop: 8, fontSize: 13, lineHeight: 17, color: C.muted }}>
            {[
              c.vehicle.type,
              roadOf(c) || c.incident.location,
              shortDate(c.incident.date, language),
              c.incident.time,
            ]
              .filter(Boolean)
              .join(" · ")}
          </T>
        </View>
        {!!out.add && (
          <View style={{ paddingTop: 14, gap: 10 }}>
            <View style={[s.row, { alignItems: "baseline" }]}>
              <T style={{ fontSize: 13, lineHeight: 16, fontWeight: "700", color: C.muted }}>
                Licence points
              </T>
              <T style={{ fontSize: 20, lineHeight: 22, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                {shown} / 20
              </T>
            </View>
            <MeterBar
              record={record}
              pending={Math.min(20, out.total) - record}
              light
              delay={RECEIPT_PRINT_MS + 50}
              pendingDelay={RECEIPT_PRINT_MS + 550}
            />
          </View>
        )}
      </View>
      <Svg
        width="100%"
        height={7}
        viewBox="0 0 360 7"
        preserveAspectRatio="none"
      >
        <Path
          d={
            "M0 0H360" +
            Array.from(
              { length: 45 },
              (_, i) => `L${360 - i * 8 - 4} 7L${352 - i * 8} 0`,
            ).join("") +
            "Z"
          }
          fill={C.surface}
        />
      </Svg>
      {!reduced && height > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "white",
            transform: [
              {
                translateY: v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, height + 10],
                }),
              },
            ],
          }}
        />
      )}
    </Animated.View>
  );
}
export function SampleOverlay({
  caption,
  unread = false,
}: {
  caption?: string;
  unread?: boolean;
}) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
      <View
        style={{
          position: "absolute",
          left: "45.6%",
          top: "33%",
          width: "31.4%",
          height: "46%",
          borderWidth: 1.5,
          borderColor: C.gemPhoto,
          borderRadius: 6,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: "57.7%",
          top: "65.2%",
          width: "9%",
          height: "4.6%",
          borderWidth: 1.5,
          borderStyle: unread ? "dashed" : "solid",
          borderColor: unread ? C.amberLine : C.gemPhoto,
          borderRadius: 3,
        }}
      />
      {!!caption && (
        <View
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 8,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 10,
            backgroundColor: "#111318BD",
          }}
        >
          <T
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: "white",
              fontWeight: "600",
            }}
          >
            {caption}
          </T>
        </View>
      )}
    </View>
  );
}
export function CostCounter({ value }: { value: number }) {
  const { reduced, foreground } = useRoad();
  const [shown, setShown] = useState(value);
  const previous = useRef(0);
  useEffect(() => {
    if (reduced || !foreground) {
      setShown(value);
      previous.current = value;
      return;
    }
    let frame = 0;
    const start = Date.now(),
      from = previous.current;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 650);
      const n = from + (value - from) * (1 - Math.pow(1 - p, 3));
      setShown(n);
      previous.current = n;
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, foreground]);
  return (
    <T
      style={{
        fontSize: 22,
        fontWeight: "800",
        color: C.accent,
        fontVariant: ["tabular-nums"],
      }}
    >
      US${shown.toFixed(4)}
    </T>
  );
}
