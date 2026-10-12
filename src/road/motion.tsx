import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { useRoad } from "./context";
import { C } from "./tokens";
export function Motion({
  children,
  identity,
  direction = 1,
  small = false,
  durationMs,
  distance,
}: {
  children: React.ReactNode;
  identity: string;
  direction?: number;
  small?: boolean;
  durationMs?: number;
  distance?: number;
}) {
  const { reduced, foreground } = useRoad();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    value.stopAnimation();
    const immediate = reduced || !foreground || durationMs === 0;
    value.setValue(immediate ? 1 : 0);
    if (immediate) return;
    const a = Animated.timing(value, {
      toValue: 1,
      duration: durationMs ?? (small ? 180 : 300),
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [identity, reduced, foreground, value, small, durationMs]);
  return (
    <Animated.View
      style={{
        opacity: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
        transform: [
          {
            translateX: value.interpolate({
              inputRange: [0, 1],
              outputRange: [direction * (distance ?? (small ? 12 : 28)), 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
export function FadeArrival({
  children,
  identity = "arrival",
  duration = 180,
  distance = 6,
}: {
  children: React.ReactNode;
  identity?: string;
  duration?: number;
  distance?: number;
}) {
  const { reduced, foreground } = useRoad();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    value.setValue(reduced || !foreground ? 1 : 0);
    if (reduced || !foreground) return;
    const animation = Animated.timing(value, {
      toValue: 1,
      duration,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [identity, reduced, foreground, duration, value]);
  return (
    <Animated.View
      style={{
        opacity: value,
        transform: [
          {
            translateY: value.interpolate({
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

export function ImpactBar({
  ratio,
  index,
  selected = false,
}: {
  ratio: number;
  index: number;
  selected?: boolean;
}) {
  const { reduced, foreground } = useRoad();
  const v = useRef(new Animated.Value(reduced ? ratio : 0)).current;
  useEffect(() => {
    if (reduced || !foreground) {
      v.setValue(ratio);
      return;
    }
    const animation = Animated.timing(v, {
      toValue: ratio,
      duration: 520,
      delay: 60 + index * 60,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [ratio, index, reduced, foreground, v]);
  return (
    <View
      style={{
        height: 8,
        borderRadius: 999,
        backgroundColor: C.surface,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: selected ? C.accent : C.ink,
          transformOrigin: "left center",
          transform: [{ scaleX: v }],
        }}
      />
    </View>
  );
}

export function Turn({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const { reduced, foreground } = useRoad();
  const v = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: open ? 1 : 0,
      duration: reduced || !foreground ? 0 : 180,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, open, reduced, foreground]);
  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: v.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "90deg"],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
