import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useRoad } from "./context";
import { C, Icon, T } from "./ui";
import type { RoadCase } from "./model";

export function Arrival({
  children,
  delay = 0,
  identity = "entry",
  distance = 14,
}: React.PropsWithChildren<{
  delay?: number;
  identity?: string;
  distance?: number;
}>) {
  const { reduced, foreground } = useRoad();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    v.setValue(reduced || !foreground ? 1 : 0);
    if (reduced || !foreground) return;
    const animation = Animated.timing(v, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [v, delay, identity, reduced, foreground]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [distance, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export { Spark } from "./spark";

export function Disclosure({
  title,
  note,
  children,
}: React.PropsWithChildren<{ title: string; note?: string }>) {
  const { reduced, foreground } = useRoad();
  const [open, setOpen] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: reduced || !foreground ? 0 : 180,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [open, reduced, foreground, turn]);
  return (
    <View style={{ borderTopWidth: 1, borderColor: C.line }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          minHeight: 56,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <T style={{ fontWeight: "700", fontSize: 16, lineHeight: 20, flex: 1 }}>
          {title}
        </T>
        {note && (
          <T style={{ color: C.muted, fontSize: 13, lineHeight: 16 }}>
            {note}
          </T>
        )}
        {/* A downward chevron that turns to point up while open. */}
        <Animated.View
          style={{
            transform: [
              {
                rotate: turn.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["90deg", "270deg"],
                }),
              },
            ],
          }}
        >
          <Icon name="ChevronRight" size={16} color={C.muted} strokeWidth={2.6} />
        </Animated.View>
      </Pressable>
      {open && (
        <Arrival distance={-8}>
          <View style={{ paddingBottom: 12 }}>{children}</View>
        </Arrival>
      )}
    </View>
  );
}

export function Plate({
  value,
  source,
}: {
  value: string | null;
  source?: "ai" | "you";
}) {
  // An unread plate stays quiet (Hover Hairline, no source ring) so the ask card is the only place that asks.
  const ring = value ? source : undefined;
  return (
    <View
      style={{
        borderWidth: ring ? 2 : 0,
        borderColor: ring === "ai" ? C.accent : C.ink,
        borderRadius: 10,
        padding: ring ? 3 : 0,
        alignSelf: "flex-start",
      }}
    >
      <T
        maxFontSizeMultiplier={1.3}
        style={{
          backgroundColor: value ? C.ink : "transparent",
          color: value ? C.paper : C.muted,
          borderRadius: 7,
          borderWidth: value ? 0 : 1.5,
          borderColor: C.lineHover,
          overflow: "hidden",
          paddingHorizontal: value ? 11 : 12,
          paddingVertical: value ? 7 : 8,
          fontSize: value ? 20 : 15,
          lineHeight: value ? 22 : 19,
          fontWeight: "800",
          letterSpacing: value ? 1.2 : 0.6,
        }}
      >
        {value || "Unreadable"}
      </T>
    </View>
  );
}

/** Reference .tag: the pill on footage ("Sample run"). */
export function FrameBadge({ children }: { children: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        paddingHorizontal: 9,
        paddingTop: 5,
        paddingBottom: 4,
        borderRadius: 999,
        backgroundColor: "rgba(17,19,24,0.72)",
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
        {children}
      </T>
    </View>
  );
}

export function ScanSweep() {
  const { reduced, foreground } = useRoad();
  const [width, setWidth] = useState(0);
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    value.setValue(0);
    if (reduced || !foreground || !width) return;
    const a = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    a.start();
    return () => a.stop();
  }, [reduced, foreground, width, value]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    >
      {!reduced && foreground && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 70,
            transform: [
              {
                translateX: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-70, width],
                }),
              },
            ],
          }}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="sweep">
                <Stop offset="0" stopColor={C.gemPhoto} stopOpacity="0" />
                <Stop offset="90%" stopColor={C.gemPhoto} stopOpacity={0.35} />
                <Stop offset="96%" stopColor="white" stopOpacity={0.85} />
                <Stop offset="1" stopColor="white" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#sweep)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

export function Count({ value, size = 72 }: { value: number; size?: number }) {
  const { reduced, foreground } = useRoad();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduced || !foreground) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 650);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, foreground]);
  return (
    <T
      style={{
        fontSize: size,
        lineHeight: size + 4,
        fontWeight: "800",
        letterSpacing: -4,
        fontVariant: ["tabular-nums"],
      }}
    >
      {shown}
    </T>
  );
}

export function CaseId({ c }: { c: RoadCase }) {
  const id = c.id.replace("SUB-", "");
  return (
    // A long live id truncates in its 56pt column instead of pushing the title off centre. Live ids
    // share their "DR-" prefix, so the start is dropped and the distinguishing end stays visible.
    <T
      numberOfLines={1}
      ellipsizeMode="head"
      accessibilityLabel={`Case ${id}`}
      maxFontSizeMultiplier={1.2}
      style={{
        fontSize: 13,
        lineHeight: 16,
        fontWeight: "600",
        color: C.muted,
        fontVariant: ["tabular-nums"],
      }}
    >
      {id}
    </T>
  );
}
