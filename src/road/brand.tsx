import React from "react";
import Svg, { Path } from "react-native-svg";

/** Authored Click-to-Safe mark, copied without changing its geometry. */
export function BrandMark({
  size = 24,
  color = "#2b2531",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 3 19.5 5.7v5.8c0 4.1-2.8 7.1-7.5 9.5-4.7-2.4-7.5-5.4-7.5-9.5V5.7L12 3Z" />
      <Path d="m9.8 8.5-1.4 7.4m5.8-7.4 1.4 7.4" />
      <Path d="M12 9v1.7m0 2.6V15" />
    </Svg>
  );
}
