import React, { useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Path, G, Circle } from "react-native-svg";
import geometry from "../../design/submission/nav-geometry.json";
import { useRoad } from "./context";
import { settledTabs, tabMotion, TAB_MOTION_MS, type IconPose, type TabPose } from "./navigation-motion";

/** One frame loop keeps the pill, icon bounce, morph and needle in sync. */
export function useTabMotion(index: number, width: number, shown: boolean) {
  const { reduced, foreground } = useRoad();
  const spacing = (width - 28) / 3;
  const [pose, setPose] = useState(() => settledTabs(index, spacing));
  const current = useRef(pose);
  const previous = useRef({ index, spacing });
  const moving = useRef(false);
  const [running, setRunning] = useState(false);
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = { index, spacing };
    const settle = () => {
      moving.current = false;
      setRunning(false);
      current.current = settledTabs(index, spacing);
      setPose(current.current);
    };
    if (reduced || !foreground || !shown || spacing !== old.spacing) {
      settle();
      return;
    }
    if (index === old.index) {
      if (moving.current) settle();
      return;
    }
    const interrupted = moving.current;
    const from = current.current;
    const start = Date.now();
    let frame = 0;
    moving.current = true;
    setRunning(true);
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / TAB_MOTION_MS);
      current.current = tabMotion(from, index, spacing, progress, interrupted);
      setPose(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { moving.current = false; setRunning(false); }
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [index, spacing, reduced, foreground, shown]);
  return { pose, running };
}

export function SubmissionIcon({ name, pose }: {
  name: "home" | "review" | "history";
  pose: IconPose;
}) {
  const { mix } = pose;
  const f = geometry[name];
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
      style={{ transform: [{ translateY: pose.y }, { scaleX: pose.scaleX }, { scaleY: pose.scaleY }] }}
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
export function SlidingPill({ pose, width }: { pose: TabPose["pill"]; width: number }) {
  return (
    <View
      testID="tab-selection-pill"
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 14 + (width - 28) / 6 - 28,
        top: 7.5,
        width: 56,
        height: 30,
        borderRadius: 15,
        backgroundColor: "#E9EBEF",
        transform: [
          { translateX: pose.x },
          { scaleX: pose.scaleX },
          { scaleY: pose.scaleY },
        ],
      }}
    />
  );
}
