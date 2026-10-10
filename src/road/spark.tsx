import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { ClipPath, Defs, G, Path } from "react-native-svg";
import { useRoad } from "./context";

const SPARK =
  "M58.6819 29.4195C53.6116 27.2369 49.1753 24.2426 45.3711 20.4403C41.5688 16.638 38.5745 12.1998 36.3919 7.12951C35.554 5.18629 34.8807 3.18883 34.3645 1.14087C34.1962 .471311 33.5958 0 32.9057 0C32.2156 0 31.6152 .471311 31.4469 1.14087C30.9307 3.18883 30.2574 5.18442 29.4195 7.12951C27.2369 12.1998 24.2426 16.638 20.4403 20.4403C16.638 24.2426 12.1998 27.2369 7.12951 29.4195C5.18629 30.2574 3.18883 30.9307 1.14087 31.4469C.471311 31.6152 0 32.2156 0 32.9057C0 33.5958 .471311 34.1962 1.14087 34.3645C3.18883 34.8807 5.18442 35.554 7.12951 36.3919C12.1998 38.5745 16.6361 41.5688 20.4403 45.3711C24.2444 49.1734 27.2369 53.6116 29.4195 58.6819C30.2574 60.6251 30.9307 62.6226 31.4469 64.6705C31.6152 65.3401 32.2156 65.8114 32.9057 65.8114C33.5958 65.8114 34.1962 65.3401 34.3645 64.6705C34.8807 62.6226 35.554 60.627 36.3919 58.6819C38.5745 53.6116 41.5688 49.1753 45.3711 45.3711C49.1734 41.5688 53.6116 38.5745 58.6819 36.3919C60.6251 35.554 62.6226 34.8807 64.6705 34.3645C65.3401 34.1962 65.8114 33.5958 65.8114 32.9057C65.8114 32.2156 65.3401 31.6152 64.6705 31.4469C62.6226 30.9307 60.627 30.2574 58.6819 29.4195Z";
// The reference fills the spark with conic-gradient(from 200deg, blue, violet, rose, amber, blue):
// blue at the bottom point, violet left, rose top, amber right. SVG has no conic gradient, so draw
// thin wedges around the centre and clip them to the spark.
const SPARK_WEDGES = (() => {
  const stops = ["#4C8DF6", "#9B72CB", "#D96570", "#F1A04A", "#4C8DF6"].map(
    (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
  );
  const n = 48;
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(33 + 48 * Math.sin(a)).toFixed(2)} ${(33 - 48 * Math.cos(a)).toFixed(2)}`;
  };
  return Array.from({ length: n }, (_, i) => {
    const segment = ((i + 0.5) / n) * 4,
      k = Math.floor(segment),
      f = segment - k;
    const rgb = stops[k].map((v, j) => Math.round(v + (stops[k + 1][j] - v) * f));
    const a0 = 200 + (i / n) * 360 - 0.6,
      a1 = 200 + ((i + 1) / n) * 360 + 0.6;
    return { d: `M33 33L${at(a0)}L${at(a1)}Z`, fill: `rgb(${rgb.join(",")})` };
  });
})();

export function Spark({
  size = 28,
  working = false,
  tint,
  pressed = false,
}: {
  size?: number;
  working?: boolean;
  /** A single colour instead of the Gemini gradient, e.g. Gemini Blue beside a field label. */
  tint?: string;
  /** On a primary button the spark turns 180° while the button is held. */
  pressed?: boolean;
}) {
  const { reduced, foreground } = useRoad();
  const rotation = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(turn, {
      toValue: pressed && !reduced ? 1 : 0,
      duration: 700,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [pressed, reduced, turn]);
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
          {
            rotate: turn.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "180deg"],
            }),
          },
          {
            scale: turn.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.9],
            }),
          },
        ],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 66 66">
        {tint ? (
          <Path d={SPARK} fill={tint} />
        ) : (
          <>
            <Defs>
              <ClipPath id="spark">
                <Path d={SPARK} />
              </ClipPath>
            </Defs>
            <G clipPath="url(#spark)">
              {SPARK_WEDGES.map((w, i) => (
                <Path key={i} d={w.d} fill={w.fill} />
              ))}
            </G>
          </>
        )}
      </Svg>
    </Animated.View>
  );
}
