import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { useRoad } from "./context";
import {
  deathStats,
  deathSentence,
  casePoints,
  licenceRecord,
} from "./submission-model";
import type { RoadCase } from "./model";
import { shortDate } from "./format";
import { T, C, styles as s } from "./ui";
import { Plate } from "./standard-ui";

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
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 460,
      delay,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, reduced, foreground, delay]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [
          {
            scale: v.interpolate({
              inputRange: [0, 0.8, 1],
              outputRange: [reported ? 2.6 : 2.4, 0.94, 1],
            }),
          },
          {
            rotate: v.interpolate({
              inputRange: [0, 1],
              outputRange: [
                reported ? "-26deg" : "-14deg",
                reported ? "-9deg" : "0deg",
              ],
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
          backgroundColor: "#C81E1E",
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
export function RoadStat() {
  const { reduced, foreground } = useRoad();
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
  const rising = v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const departing = v.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const statText = { fontSize: 14, lineHeight: 20, color: C.muted };
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
              outputRange: [oldDigits.length * 8.8, digits.length * 8.8],
            }),
            height: 20,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: slots }, (_, i) => {
            const before = oldDigits.padStart(slots, " ")[i];
            const after = digits.padStart(slots, " ")[i];
            const right = (slots - i - 1) * 8.8;
            return (
              <View
                key={i}
                style={{ position: "absolute", right, width: 8.8, height: 20 }}
              >
                {before === after ? (
                  <T
                    style={[
                      statText,
                      { fontWeight: "800", fontVariant: ["tabular-nums"] },
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
                      <T
                        style={[
                          statText,
                          { fontWeight: "800", fontVariant: ["tabular-nums"] },
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
                      <T
                        style={[
                          statText,
                          { fontWeight: "800", fontVariant: ["tabular-nums"] },
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
        <T style={statText}> {n === 1 ? "person dies" : "people die"} on </T>
        <View style={{ height: 20, overflow: "hidden" }}>
          <T style={[statText, { opacity: 0 }]}>{place}</T>
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
            <T style={statText}>{oldPlace}</T>
          </Animated.View>
          <Animated.View
            style={{
              position: "absolute",
              transform: [{ translateY: rising }],
              opacity: v,
            }}
          >
            <T style={statText}>{place}</T>
          </Animated.View>
        </View>
        <T style={statText}>
          {" "}
          roads {place === "Singapore" ? "every 3 days." : "every day."}
        </T>
      </View>
    </View>
  );
}
export function MeterBar({
  record,
  pending,
  light = false,
  delay = 0,
}: {
  record: number;
  pending: number;
  light?: boolean;
  delay?: number;
}) {
  const { reduced, foreground } = useRoad();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    v.setValue(reduced || !foreground ? 1 : 0);
    if (reduced || !foreground) return;
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 900,
      delay,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, reduced, foreground, record, pending, delay]);
  return (
    <View
      accessible
      accessibilityLabel={`${record} points on record, ${pending} potential points from reports, out of 20`}
      style={{
        height: 18,
        borderRadius: 9,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          gap: 2,
          height: 18,
          transformOrigin: "left center",
          transform: [{ scaleX: v }],
        }}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              overflow: "hidden",
              backgroundColor:
                i < record
                  ? light
                    ? C.ink
                    : "#F5F5F0"
                  : i < record + pending
                    ? "#C81E1E"
                    : // Empty segments stay visible, so the bar always reads as 20.
                      light
                      ? "#D4D7DD"
                      : "rgba(255,255,255,0.14)",
            }}
          >
            {i >= record && i < record + pending && (
              <Svg width="100%" height="100%">
                <Path
                  d="M-6 20L14 0M2 24L22 4"
                  stroke="#FF9B8F"
                  strokeWidth={4}
                />
              </Svg>
            )}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
/** The meter's key: matching swatches, each part shown only when it is non-zero. */
export function MeterKey({
  record,
  pending,
  demo = false,
}: {
  record: number;
  pending: number;
  demo?: boolean;
}) {
  const label = {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600" as const,
    color: "#C9CDD4",
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
              backgroundColor: "#F5F5F0",
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
              backgroundColor: "#C81E1E",
            }}
          >
            <Svg width={12} height={12}>
              <Path
                d="M-3 9L9 -3M1 13L13 1M5 17L17 5"
                stroke="#FF9B8F"
                strokeWidth={2.2}
              />
            </Svg>
          </View>
          <T style={label}>
            <T style={[label, value]}>{pending}</T> from your report
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
export function Receipt({ c }: { c: RoadCase }) {
  const { reduced, foreground, prefs } = useRoad();
  const language = prefs.language;
  const [height, setHeight] = useState(0);
  const v = useRef(new Animated.Value(1)).current;
  const record = licenceRecord(c);
  const points = casePoints(c);
  useEffect(() => {
    v.setValue(reduced || !foreground ? 1 : 0);
    if (reduced || !foreground) return;
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 900,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, reduced, foreground]);
  return (
    <View style={{ overflow: "hidden" }}>
      <View
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={{ backgroundColor: C.surface, padding: 16, gap: 18 }}
      >
        <View style={s.row}>
          <T style={receiptHead}>ROAD RECEIPT</T>
          <T style={[receiptHead, { letterSpacing: 0 }]}>
            {c.id.replace("SUB-", "")}
          </T>
        </View>
        <View
          style={[
            s.row,
            {
              borderTopWidth: 1,
              borderStyle: "dashed",
              borderColor: "#C9CDD4",
              paddingTop: 16,
            },
          ]}
        >
          <Plate value={c.vehicle.plate} />
          <Stamp reported delay={1050}>
            <T
              style={{
                color: "#15803D",
                fontWeight: "800",
                letterSpacing: 2,
                borderWidth: 2,
                borderColor: "#15803D",
                borderRadius: 5,
                padding: 6,
                fontSize: 13,
              }}
            >
              REPORTED
            </T>
          </Stamp>
        </View>
        {c.offences
          .filter((o) => o.included)
          .map((o) => (
            <View key={o.id} style={{ gap: 5 }}>
              <View style={s.row}>
                <T style={{ fontWeight: "700", flex: 1, fontSize: 16 }}>
                  {o.label}
                </T>
                <PointsChip points={o.demeritPoints ?? 0} delay={500} />
              </View>
              {o.lawSources.map((l, i) => (
                <T
                  key={i}
                  style={{ fontSize: 14, fontWeight: "600", color: C.muted }}
                >
                  {l.act || l.title}
                  {l.section ? ", " + l.section : ""}
                </T>
              ))}
            </View>
          ))}
        <T style={{ fontSize: 13, lineHeight: 18, color: C.muted }}>
          {[
            c.vehicle.type,
            c.incident.location,
            shortDate(c.incident.date, language),
            c.incident.time,
          ]
            .filter(Boolean)
            .join(" · ")}
        </T>
        {!!points && (
          <View
            style={{
              borderTopWidth: 1,
              borderColor: "#C9CDD4",
              borderStyle: "dashed",
              paddingTop: 12,
              gap: 8,
            }}
          >
            <View style={s.row}>
              <T style={s.muted}>
                Licence points{c.provenance.isDemo ? " · demo" : ""}
              </T>
              <T style={{ fontWeight: "800" }}>
                {(record?.points ?? 0) + points} / 20
              </T>
            </View>
            <MeterBar
              record={record?.points ?? 0}
              pending={points}
              light
              delay={700}
            />
          </View>
        )}
      </View>
      <Svg
        width="100%"
        height={8}
        viewBox="0 0 360 8"
        preserveAspectRatio="none"
      >
        <Path
          d={
            "M0 0H360" +
            Array.from(
              { length: 45 },
              (_, i) => `L${360 - i * 8 - 4} 8L${352 - i * 8} 0`,
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
    </View>
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
          borderColor: "#4F8BFF",
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
          borderColor: unread ? "#F3B46B" : "#4F8BFF",
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
