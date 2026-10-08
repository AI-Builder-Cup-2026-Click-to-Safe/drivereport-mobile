import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useRoad } from "./context";
import { C, Icon, T } from "./ui";

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

export function Spark({
  size = 28,
  working = false,
}: {
  size?: number;
  working?: boolean;
}) {
  const { reduced, foreground } = useRoad();
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    rotation.setValue(0);
    if (!working || reduced || !foreground) return;
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2400,
        easing: Easing.bezier(0.6, 0, 0.4, 1),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [working, reduced, foreground, rotation]);
  return (
    <Animated.View
      accessible={false}
      style={{
        width: size,
        height: size,
        transform: [
          {
            rotate: rotation.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "360deg"],
            }),
          },
        ],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 66 66">
        <Defs>
          <LinearGradient id="gemini" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0" stopColor="#4C8DF6" />
            <Stop offset=".45" stopColor="#9B72CB" />
            <Stop offset=".72" stopColor="#D96570" />
            <Stop offset="1" stopColor="#F1A04A" />
          </LinearGradient>
        </Defs>
        <Path
          d="M58.6819 29.4195C53.6116 27.2369 49.1753 24.2426 45.3711 20.4403C41.5688 16.638 38.5745 12.1998 36.3919 7.12951C35.554 5.18629 34.8807 3.18883 34.3645 1.14087C34.1962 .471311 33.5958 0 32.9057 0C32.2156 0 31.6152 .471311 31.4469 1.14087C30.9307 3.18883 30.2574 5.18442 29.4195 7.12951C27.2369 12.1998 24.2426 16.638 20.4403 20.4403C16.638 24.2426 12.1998 27.2369 7.12951 29.4195C5.18629 30.2574 3.18883 30.9307 1.14087 31.4469C.471311 31.6152 0 32.2156 0 32.9057C0 33.5958 .471311 34.1962 1.14087 34.3645C3.18883 34.8807 5.18442 35.554 7.12951 36.3919C12.1998 38.5745 16.6361 41.5688 20.4403 45.3711C24.2444 49.1734 27.2369 53.6116 29.4195 58.6819C30.2574 60.6251 30.9307 62.6226 31.4469 64.6705C31.6152 65.3401 32.2156 65.8114 32.9057 65.8114C33.5958 65.8114 34.1962 65.3401 34.3645 64.6705C34.8807 62.6226 35.554 60.627 36.3919 58.6819C38.5745 53.6116 41.5688 49.1753 45.3711 45.3711C49.1734 41.5688 53.6116 38.5745 58.6819 36.3919C60.6251 35.554 62.6226 34.8807 64.6705 34.3645C65.3401 34.1962 65.8114 33.5958 65.8114 32.9057C65.8114 32.2156 65.3401 31.6152 64.6705 31.4469C62.6226 30.9307 60.627 30.2574 58.6819 29.4195Z"
          fill="url(#gemini)"
        />
      </Svg>
    </Animated.View>
  );
}

export function Disclosure({
  title,
  note,
  children,
}: React.PropsWithChildren<{ title: string; note?: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderTopWidth: 1, borderColor: C.line }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          minHeight: 54,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <T style={{ fontWeight: "700", flex: 1 }}>{title}</T>
        {note && <T style={{ color: C.muted, fontSize: 12 }}>{note}</T>}
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icon name="ChevronRight" size={18} />
        </View>
      </Pressable>
      {open && (
        <Arrival distance={8}>
          <View style={{ gap: 14, paddingBottom: 16 }}>{children}</View>
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
  return (
    <View
      style={{
        borderWidth: source ? 2 : 0,
        borderColor: source === "ai" ? C.accent : C.ink,
        borderRadius: 10,
        padding: source ? 3 : 0,
        alignSelf: "flex-start",
      }}
    >
      <T
        style={{
          backgroundColor: C.ink,
          color: "#F5F5F0",
          borderRadius: 7,
          overflow: "hidden",
          paddingHorizontal: 11,
          paddingVertical: 7,
          fontSize: 20,
          fontWeight: "800",
          letterSpacing: 1.2,
        }}
      >
        {value || "Unreadable"}
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
                <Stop offset="0" stopColor="#4F8BFF" stopOpacity="0" />
                <Stop offset=".9" stopColor="#4F8BFF" stopOpacity=".35" />
                <Stop offset=".96" stopColor="white" stopOpacity=".85" />
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

export function Count({ value }: { value: number }) {
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
        fontSize: 84,
        lineHeight: 90,
        fontWeight: "800",
        letterSpacing: -4,
        fontVariant: ["tabular-nums"],
      }}
    >
      {shown}
    </T>
  );
}
