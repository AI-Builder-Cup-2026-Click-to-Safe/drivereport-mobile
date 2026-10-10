import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Path, G, Circle } from "react-native-svg";
import geometry from "../../design/submission/nav-geometry.json";
import { useRoad } from "./context";

const poses: Record<string, number> = {};
export function SubmissionIcon({
  name,
  active,
}: {
  name: "home" | "review" | "history";
  active: boolean;
}) {
  const { reduced, foreground } = useRoad();
  const [mix, setMix] = useState(poses[name] ?? (active ? 1 : 0));
  // The icon dips 12% in scale through the middle of its morph, as in the reference.
  const [dip, setDip] = useState(0);
  const prior = useRef(mix);
  const f = geometry[name];
  useEffect(() => {
    const to = active ? 1 : 0;
    if (reduced || !foreground) {
      prior.current = to;
      poses[name] = to;
      setMix(to);
      return;
    }
    let raf = 0;
    const from = prior.current,
      start = Date.now();
    function tick() {
      const t = Math.min(1, (Date.now() - start) / 540);
      const n = from + (to - from) * (t * t * (3 - 2 * t));
      prior.current = n;
      poses[name] = n;
      setMix(n);
      setDip(t < 1 ? 0.12 * Math.sin(Math.PI * t) : 0);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, foreground, name]);
  const outline =
    mix <= 0
      ? f.a
      : mix >= 1
        ? f.b
        : "M" +
          f.geometry.a
            .map((p, i) =>
              p.map((v, k) => v + (f.geometry.b[i][k] - v) * mix).join(" "),
            )
            .join("L") +
          "Z";
  const color = `rgb(${Math.round(93 - 76 * mix)},${Math.round(98 - 79 * mix)},${Math.round(112 - 88 * mix)})`;
  return (
    <Svg
      width={26}
      height={26}
      style={dip ? { transform: [{ scale: 1 - dip }] } : undefined}
      viewBox="0 0 24 24"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Path d={outline} fill={color} fillOpacity={mix} />
      {/* At rest, unmount the hidden detail set: some iOS runtimes ignore a zero group opacity. */}
      {mix < 1 && (
        <G opacity={1 - mix}>
          {name === "home" ? (
            <>
              <Path d="m9.8 8.5-1.4 7.4m5.8-7.4 1.4 7.4" />
              <Path d="M12 9v1.7m0 2.6V15" />
            </>
          ) : name === "review" ? (
            <>
              <Path d="M15 2v4a1 1 0 0 0 1 1h4" />
              <Path d="M8 13h8M8 17h5" />
            </>
          ) : (
            <Path d="M12 7v5l3 2" />
          )}
        </G>
      )}
      {mix > 0 && (
        <G opacity={mix} stroke="#E9EBEF" fill="#E9EBEF">
          {name === "home" ? (
            <Path
              stroke="none"
              d="M9.6 22v-7.4a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1V22Z"
            />
          ) : name === "review" ? (
            <Path strokeWidth={1.9} d="M8.5 7h7M8.5 10.5h7M8.5 14h4" />
          ) : (
            <>
              <G rotation={-110 * (1 - mix)} origin="12,14">
                <Path strokeWidth={2} d="m12 14 4.6-4.6" />
                <Circle cx={12} cy={14} r={2.1} stroke="none" />
              </G>
              <Path d="M6.2 14H7.6M16.4 14h1.4M12 7.2v1.4" />
            </>
          )}
        </G>
      )}
    </Svg>
  );
}
let lastTab = 0;
export function SlidingPill({
  index,
  width,
}: {
  index: number;
  width: number;
}) {
  const { reduced, foreground } = useRoad();
  const x = useRef(new Animated.Value(lastTab)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    lastTab = index;
    if (reduced || !foreground) {
      x.setValue(index);
      stretch.setValue(1);
      return;
    }
    const a = Animated.parallel([
      Animated.timing(x, {
        toValue: index,
        duration: 460,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(stretch, {
          toValue: 1.38,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(stretch, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
    ]);
    a.start();
    return () => a.stop();
  }, [index, reduced, foreground, x, stretch]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 14 + (width - 28) / 6 - 28,
        top: 9,
        width: 56,
        height: 30,
        borderRadius: 15,
        backgroundColor: "#E9EBEF",
        transform: [
          { translateX: Animated.multiply(x, (width - 28) / 3) },
          { scaleX: stretch },
        ],
      }}
    />
  );
}
