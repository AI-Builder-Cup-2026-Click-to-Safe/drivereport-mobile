import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Defs, G, Mask, Rect } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarStyle } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useRoad } from "./context";
import { Action, C, Page, T, go } from "./ui";
import { BrandMark } from "./brand";
import { BreathingDisc } from "./motion";
import {
  APERTURE_END,
  APERTURE_START,
  HOME_END,
  IRIS_END,
  apertureGeometry,
  entranceAt,
  entranceDuration,
  progress,
} from "./home-timing";

let homePlayed = false;
export function replayHomeEntrance() {
  homePlayed = false;
  go("home");
}
const ease = Easing.bezier(0.16, 1, 0.3, 1);
function phase(
  clock: Animated.Value,
  delay: number,
  duration: number,
  from = 0,
  to = 1,
) {
  const start = entranceAt(delay),
    span = entranceDuration(duration);
  return clock.interpolate({
    inputRange: Array.from({ length: 31 }, (_, i) => start + (span * i) / 30),
    outputRange: Array.from(
      { length: 31 },
      (_, i) => from + (to - from) * ease(i / 30),
    ),
    extrapolate: "clamp",
  });
}
function Opening({
  clock,
  target,
  width,
  height,
}: {
  clock: Animated.Value;
  target: { x: number; y: number };
  width: number;
  height: number;
}) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const id = clock.addListener(({ value }) => setTime(value));
    return () => clock.removeListener(id);
  }, [clock]);
  const coverVisible = time < APERTURE_END;
  useEffect(
    () => setStatusBarStyle(coverVisible ? "light" : "dark", false),
    [coverVisible],
  );
  const center = apertureGeometry(width, height);
  const open = ease(
    progress(time, APERTURE_START, APERTURE_END - APERTURE_START),
  );
  const land = ease(progress(time, APERTURE_END, IRIS_END - APERTURE_END));
  const radius = (1.6 + (center.radius - 1.6) * open) * (1 - land) + 64 * land;
  const x = center.x + (target.x - center.x) * land;
  const y = center.y + (target.y - center.y) * land;
  const turn = -48 + 48 * ease(progress(time, APERTURE_START, 1590));
  const brand = 1 - ease(progress(time, 1251, 664));
  if (time >= IRIS_END) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Svg width={width} height={height}>
        <Defs>
          <Mask
            id="capture-aperture"
            x={0}
            y={0}
            width={width}
            height={height}
            maskUnits="userSpaceOnUse"
          >
            <Rect width={width} height={height} fill="white" />
            <Circle
              cx={center.x}
              cy={center.y}
              r={center.radius * open}
              fill="black"
            />
          </Mask>
        </Defs>
        <Rect
          width={width}
          height={height}
          fill="#000"
          mask="url(#capture-aperture)"
        />
        <G
          opacity={open * (0.82 - land * 0.04)}
          stroke={C.accent}
          strokeWidth={1}
          fill="none"
        >
          <Circle cx={x} cy={y} r={radius} />
          {[0, 120, 240].map((angle) => (
            <Circle
              key={angle}
              cx={x}
              cy={y}
              r={(radius * 49) / 64}
              strokeDasharray={[
                (((radius * 49) / 64) * Math.PI) / 2,
                ((radius * 49) / 64) * Math.PI * 1.5,
              ]}
              rotation={angle + turn}
              origin={`${x}, ${y}`}
              strokeLinecap="round"
            />
          ))}
        </G>
      </Svg>
      <View
        style={{
          position: "absolute",
          top: center.y - 18,
          width,
          alignItems: "center",
          opacity: brand,
          transform: [{ scale: 0.88 + 0.12 * brand }],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <BrandMark size={28} color="#f6f1e9" />
          <T
            style={{
              color: "#f6f1e9",
              fontSize: 18,
              fontWeight: "700",
              letterSpacing: -0.36,
            }}
          >
            Click-to-Safe
          </T>
        </View>
      </View>
    </View>
  );
}

export function Home() {
  const rr = useRoad(),
    dimensions = useWindowDimensions();
  const root = useRef<View>(null),
    disc = useRef<View>(null);
  const first = useRef(!homePlayed).current;
  const [entering, setEntering] = useState(first);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const clock = useRef(new Animated.Value(first ? 0 : HOME_END)).current;
  const started = useRef(false),
    interrupted = useRef(false);
  const disabled = !rr.ready || !!rr.error || rr.job?.status === "running";
  const settle = useCallback(() => {
    interrupted.current = true;
    clock.stopAnimation();
    clock.setValue(HOME_END);
    setEntering(false);
    setStatusBarStyle("dark", false);
  }, [clock]);
  const measure = useCallback(() => {
    root.current?.measureInWindow((rx, ry) =>
      disc.current?.measureInWindow((x, y, w, h) => {
        if (w && h) {
          if (started.current) settle();
          setTarget({ x: x + w / 2 - rx, y: y + h / 2 - ry });
        }
      }),
    );
  }, [settle]);
  useEffect(() => {
    if (!rr.ready || !target || started.current) return;
    started.current = true;
    homePlayed = true;
    SplashScreen.hide();
    if (
      !first ||
      interrupted.current ||
      rr.reduced ||
      !rr.foreground ||
      disabled
    ) {
      settle();
      return;
    }
    setStatusBarStyle("light", false);
    const animation = Animated.timing(clock, {
      toValue: HOME_END,
      duration: HOME_END,
      easing: Easing.linear,
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished) settle();
    });
    return () => {
      animation.stop();
      clock.setValue(HOME_END);
      setEntering(false);
    };
  }, [
    rr.ready,
    rr.reduced,
    rr.foreground,
    disabled,
    target,
    first,
    clock,
    settle,
  ]);
  useEffect(() => {
    if (rr.reduced || !rr.foreground) settle();
  }, [rr.reduced, rr.foreground, settle]);
  useEffect(() => {
    const listener = Keyboard.addListener("keyboardWillShow", settle);
    return () => listener.remove();
  }, [settle]);
  const initialSize = useRef(
    `${dimensions.width}:${dimensions.height}`,
  ).current;
  useEffect(() => {
    if (`${dimensions.width}:${dimensions.height}` !== initialSize) settle();
  }, [dimensions.width, dimensions.height, initialSize, settle]);
  const words = [
    "One",
    "click",
    "away",
    "from",
    "making",
    "the",
    "road",
    "safer.",
  ];
  return (
    <View
      ref={root}
      collapsable={false}
      style={{ flex: 1 }}
      onTouchStart={settle}
    >
      <Page
        title="Home"
        home
        centered
        animateContent={!first}
        onScrollStart={settle}
        onActionFocus={settle}
      >
        <View style={{ gap: 9 }}>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel="One click away from making the road safer."
            style={{ flexDirection: "row", flexWrap: "wrap" }}
          >
            {words.map((word, i) => {
              const group = i < 3 ? 0 : i < 5 ? 1 : 2;
              const delay = 900 + group * 105 + (i - [0, 3, 5][group]) * 18;
              return (
                <View
                  key={word}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ overflow: "hidden" }}
                >
                  <Animated.View
                    style={{
                      opacity: phase(clock, delay, 620, 0.22),
                      transform: [
                        { translateY: phase(clock, delay, 620, 20, 0) },
                      ],
                    }}
                  >
                    <T
                      style={{
                        fontSize: 26,
                        lineHeight: 33,
                        fontWeight: "700",
                        letterSpacing: -0.7,
                      }}
                    >
                      {word}
                      {i < 7 ? " " : ""}
                    </T>
                  </Animated.View>
                </View>
              );
            })}
          </View>
          <View
            accessible
            accessibilityLabel="You drive. I’ll deal with the assholes."
            style={{ flexDirection: "row", flexWrap: "wrap" }}
          >
            {["You drive. ", "I’ll deal with the assholes."].map((text, i) => (
              <Animated.View
                key={text}
                accessibilityElementsHidden
                style={{ opacity: phase(clock, 1030 + i * 170, 580, 0.3) }}
              >
                <T style={{ color: C.muted, lineHeight: 22 }}>{text}</T>
              </Animated.View>
            ))}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start recording"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onFocus={settle}
          onPress={() => go("recording")}
          style={({ pressed }) => ({
            borderRadius: 16,
            overflow: "hidden",
            opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
          })}
        >
          <LinearGradient
            colors={[C.mint, C.lilac, C.peach]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              minHeight: 226,
              padding: 22,
              alignItems: "center",
              justifyContent: "center",
              gap: 15,
            }}
          >
            <View ref={disc} collapsable={false} onLayout={measure}>
              <Animated.View
                style={{
                  opacity: phase(clock, 770, 480, 0.15),
                  transform: [{ scale: phase(clock, 770, 480, 0.86) }],
                }}
              >
                <BreathingDisc
                  disabled={disabled || entering}
                  coreStyle={{
                    opacity: phase(clock, 920, 430, 0.25),
                    transform: [{ scale: phase(clock, 920, 430, 0.4) }],
                  }}
                />
              </Animated.View>
            </View>
            <Animated.View style={{ opacity: phase(clock, 1050, 360, 0.38) }}>
              <T style={{ fontSize: 16, fontWeight: "700" }}>Start recording</T>
            </Animated.View>
          </LinearGradient>
        </Pressable>
        {rr.job?.status === "running" && (
          <Action
            title="See analysis progress"
            secondary
            onPress={() => go("analysis")}
          />
        )}
      </Page>
      {entering && !rr.reduced && (
        <Opening
          clock={clock}
          target={
            target || { x: dimensions.width / 2, y: dimensions.height / 2 }
          }
          width={dimensions.width}
          height={dimensions.height}
        />
      )}
    </View>
  );
}
