import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { WebView } from "react-native-webview";
import geometry from "../../assets/road/navigation/morph-geometry.json";
import { motionHtml } from "./motion-html";
import { useRoad } from "./context";
export const DecorationViewport = createContext<{
  offset: number;
  viewport: React.RefObject<View | null>;
} | null>(null);
function useDecorationVisibility() {
  const context = useContext(DecorationViewport);
  const target = useRef<View>(null);
  const [visible, setVisible] = useState(true);
  const measure = useCallback(() => {
    if (!context?.viewport.current) return;
    context.viewport.current.measureInWindow((_x, top, _w, height) => {
      target.current?.measureInWindow((_tx, y, _tw, h) => {
        if (height > 0 && h > 0) setVisible(y + h > top && y < top + height);
      });
    });
  }, [context]);
  useLayoutEffect(measure, [measure]);
  return { target, visible, measure };
}
export function LivingIntelligence({ stage }: { stage: number }) {
  const { reduced, foreground } = useRoad();
  const { target, visible, measure } = useDecorationVisibility();
  const paused = !foreground || !visible;
  const web = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const source = useMemo(() => ({ html: motionHtml }), []);
  useEffect(() => {
    if (loaded)
      web.current?.injectJavaScript(
        `window.setMotion(${stage},${reduced},${paused});true;`,
      );
  }, [stage, reduced, paused, loaded]);
  return (
    <View
      ref={target}
      collapsable={false}
      onLayout={measure}
      accessibilityLabel={`Gemini Living intelligence illustration, stage ${stage + 1}${reduced ? ", reduced motion" : ""}`}
      style={{ height: 230 }}
    >
      <WebView
        ref={web}
        source={source}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(r) =>
          r.url === "about:blank" || r.url.startsWith("data:text/html")
        }
        onMessage={(e) => {
          if (e.nativeEvent.data === "ready") {
            setLoaded(true);
            web.current?.injectJavaScript(
              `window.setMotion(${stage},${reduced},${paused});true;`,
            );
          }
          if (__DEV__) console.log("ROAD_MOTION", e.nativeEvent.data);
        }}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        style={{ backgroundColor: "transparent", height: 230, flex: 0 }}
        onError={(e) =>
          console.error("ROAD_MOTION_LOAD", e.nativeEvent.description)
        }
        accessible={false}
      />
    </View>
  );
}
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
type Form = {
  a: number[][];
  b: number[][];
  c: number[][];
  d: number[][];
  smoothA: number;
  smoothB: number;
  smoothC: number;
  smoothD: number;
};
export function path(points: number[][], closed: boolean, smooth: number) {
  let d = `M${points[0].join(" ")}`;
  const n = points.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = points[i],
      b = points[(i + 1) % n],
      p = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)],
      next = points[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    d += `C${a[0] + ((b[0] - p[0]) * smooth) / 6} ${a[1] + ((b[1] - p[1]) * smooth) / 6} ${b[0] - ((next[0] - a[0]) * smooth) / 6} ${b[1] - ((next[1] - a[1]) * smooth) / 6} ${b[0]} ${b[1]}`;
  }
  return d + (closed ? "Z" : "");
}
const poses: Record<string, number> = {};
export function MorphIcon({
  name,
  active,
  pulse = 0,
}: {
  name: "home" | "review" | "history" | "developer";
  active: boolean;
  pulse?: number;
}) {
  const { reduced, foreground } = useRoad();
  const [mix, setMix] = useState(poses[name] ?? 0);
  const pose = useRef(mix);
  const prior = useRef(active);
  useEffect(() => {
    const end = active ? 1 : 0;
    if (reduced || !foreground) {
      poses[name] = end;
      pose.current = end;
      setMix(end);
      prior.current = active;
      return;
    }
    const start = pose.current;
    const repeat = pulse > 0 && prior.current === active && active;
    prior.current = active;
    let frame = 0;
    const time = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - time) / 420);
      const v = repeat
        ? 1 - Math.sin(t * Math.PI) * 0.22
        : start + (end - start) * Easing.bezier(0.16, 1, 0.3, 1)(t);
      poses[name] = v;
      pose.current = v;
      setMix(v);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [active, pulse, reduced, foreground, name]);
  const f = geometry[name] as Form;
  const points = (a: number[][], b: number[][]) =>
    a.map((p, i) => p.map((v, k) => v + (b[i][k] - v) * mix));
  const colour = "#615968";
  return (
    <Svg
      width={29}
      height={29}
      viewBox="0 0 32 32"
      stroke={colour}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path
        d={path(
          points(f.a, f.b),
          true,
          f.smoothA + (f.smoothB - f.smoothA) * mix,
        )}
        fill={colour}
        fillOpacity={mix}
      />
      <Path
        d={path(
          points(f.c, f.d),
          name === "home",
          f.smoothC + (f.smoothD - f.smoothC) * mix,
        )}
        stroke={`rgb(${97 + 155 * mix},${89 + 161 * mix},${104 + 150 * mix})`}
        fill={name === "home" ? "#fcfafe" : "none"}
        fillOpacity={mix}
      />
      {name === "history" ? (
        <Path d="M5 6H27" opacity={mix} />
      ) : name === "developer" ? (
        <Path d="M19 21H24" opacity={mix} stroke="#fcfafe" />
      ) : null}
    </Svg>
  );
}
export function BreathingDisc({
  disabled = false,
  coreStyle,
}: {
  disabled?: boolean;
  coreStyle?: React.ComponentProps<typeof Animated.View>["style"];
}) {
  const { reduced, foreground } = useRoad();
  const { target, visible, measure } = useDecorationVisibility();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    if (reduced || !foreground || disabled || !visible) return;
    const animation = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [reduced, foreground, disabled, visible, v]);
  return (
    <Animated.View
      ref={target}
      collapsable={false}
      onLayout={measure}
      style={{
        width: 128,
        height: 128,
        borderRadius: 64,
        backgroundColor: "#fcfafe",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#b8b0bd",
        transform: [
          {
            scale: v.interpolate({
              inputRange: [0, 0.23, 0.42, 0.68, 1],
              outputRange: [1, 1.045, 1.012, 1, 1],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          position: "absolute",
          inset: 8,
          borderWidth: 1,
          borderColor: "#d1c8d4",
          borderRadius: 60,
        }}
      />
      {[0, 1].map((i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: -1,
            borderWidth: 1,
            borderRadius: 65,
            borderColor: i ? "#7b698b" : "#4e625a",
            opacity: v.interpolate({
              inputRange: [
                0,
                0.083 * i + 0.001,
                0.13 + 0.083 * i,
                0.45 + 0.083 * i,
                1,
              ],
              outputRange: [0, 0, 0.34, 0, 0],
            }),
            transform: [
              {
                scale: v.interpolate({
                  inputRange: [0, 0.083 * i + 0.001, 0.45 + 0.083 * i, 1],
                  outputRange: [0.94, 0.94, 1.28, 1.28],
                }),
              },
            ],
          }}
        />
      ))}
      <Animated.View
        style={[
          {
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: "#2b2531",
          },
          coreStyle,
        ]}
      />
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

export function ImpactBar({ ratio, index }: { ratio: number; index: number }) {
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
    <View style={{ height: 4, backgroundColor: "#E3E5E9", overflow: "hidden" }}>
      <Animated.View
        style={{
          height: 4,
          backgroundColor: "#1A56DB",
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
