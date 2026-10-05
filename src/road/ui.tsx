import React, { useRef, useState } from "react";
import {
  Alert,
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextProps,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { setStatusBarStyle } from "expo-status-bar";
import { router, usePathname } from "expo-router";
import Svg, {
  Defs,
  RadialGradient,
  Rect,
  Stop,
  SvgXml,
} from "react-native-svg";
import icons from "./icons.json";
import { BrandMark } from "./brand";
import { MorphIcon, Motion, DecorationViewport, FadeArrival } from "./motion";
import { useRoad } from "./context";
export const C = {
  bg: "#f3f0f6",
  surface: "#fcfafe",
  ink: "#2b2531",
  muted: "#615968",
  line: "#d1c8d4",
  mint: "#dcefe3",
  lilac: "#e8dcf0",
  peach: "#f2dfd5",
  accent: "#4e625a",
  warning: "#864a34",
  warningBg: "#f6e3d7",
  dark: "#20282b",
};
export const showError = (e: unknown) =>
  Alert.alert("Click-to-Safe", e instanceof Error ? e.message : String(e));
let currentDestination = "home";
let navigationDirection = 1;
export const go = (name: string) => {
  const order = ["home", "review", "impact", "developer"];
  navigationDirection =
    name === "home" ||
    (order.includes(name) &&
      order.includes(currentDestination) &&
      order.indexOf(name) < order.indexOf(currentDestination))
      ? -1
      : 1;
  currentDestination = name;
  setStatusBarStyle(name === "recording" ? "light" : "dark", false);
  router.replace((name === "home" ? "/" : `/${name}`) as never);
};
export function T({ style, ...p }: TextProps) {
  return (
    <Text
      {...p}
      style={[
        { fontFamily: "Manrope", fontSize: 14, lineHeight: 21, color: C.ink },
        style,
      ]}
    />
  );
}
export function Icon({
  name,
  size = 22,
  color = C.ink,
}: {
  name: keyof typeof icons;
  size?: number;
  color?: string;
}) {
  return (
    <SvgXml
      xml={icons[name].replaceAll("currentColor", color)}
      width={size}
      height={size}
    />
  );
}
export function Action({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  small = false,
  fadeOnEnable = false,
  controlRef,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: keyof typeof icons;
  small?: boolean;
  fadeOnEnable?: boolean;
  controlRef?: React.Ref<View>;
}) {
  const { reduced, foreground } = useRoad();
  const previous = useRef(disabled);
  const opacity = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const becameEnabled = previous.current && !disabled;
    previous.current = disabled;
    if (!fadeOnEnable || !becameEnabled || reduced || !foreground) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.55);
    const a = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [disabled, fadeOnEnable, reduced, foreground, opacity]);
  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        ref={controlRef}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          {
            minHeight: small ? 44 : 50,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderWidth: secondary ? 1 : 0,
            borderColor: C.line,
            backgroundColor: disabled
              ? "#e8e3ec"
              : secondary
                ? C.surface
                : pressed
                  ? C.accent
                  : C.ink,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        {icon && (
          <Icon
            name={icon}
            color={disabled ? C.muted : secondary ? C.ink : "white"}
            size={19}
          />
        )}
        <T
          style={{
            fontWeight: "700",
            color: disabled ? C.muted : secondary ? C.ink : "white",
            textAlign: "center",
          }}
        >
          {title}
        </T>
      </Pressable>
    </Animated.View>
  );
}
export function Quiet({
  title,
  onPress,
  icon,
  compact = false,
  onFocus,
}: {
  title: string;
  onPress: () => void;
  icon?: keyof typeof icons;
  compact?: boolean;
  onFocus?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      onFocus={onFocus}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 7,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      {icon && <Icon name={icon} size={20} />}
      {!compact && <T style={{ fontSize: 12, fontWeight: "600" }}>{title}</T>}
    </Pressable>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <FadeArrival>
      <View
        accessibilityLiveRegion="polite"
        style={{
          padding: 13,
          borderRadius: 10,
          backgroundColor: error ? C.warningBg : C.mint,
          flexDirection: "row",
          gap: 9,
          alignItems: "flex-start",
        }}
      >
        <Icon
          name="CircleAlert"
          color={error ? C.warning : C.accent}
          size={18}
        />
        <T
          style={{
            fontSize: 12,
            lineHeight: 18,
            flex: 1,
            color: error ? C.warning : C.accent,
          }}
        >
          {children}
        </T>
      </View>
    </FadeArrival>
  );
}
export function Intro({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ gap: 9 }}>
      <T
        accessibilityRole="header"
        style={{
          fontSize: 25,
          lineHeight: 33,
          fontWeight: "700",
          letterSpacing: -0.65,
        }}
      >
        {title}
      </T>
      {body && (
        <T style={{ color: C.muted, fontSize: 14, lineHeight: 22 }}>{body}</T>
      )}
    </View>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  missing = false,
  multiline = false,
  ...rest
}: TextInputProps & { label: string; missing?: boolean }) {
  const [height, setHeight] = useState(84);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 5, flex: 1, minWidth: 110 }}>
      <T
        style={{
          fontSize: 12,
          color: missing ? C.warning : focused ? C.accent : C.muted,
          fontWeight: "600",
        }}
      >
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        onContentSizeChange={(e) =>
          multiline &&
          setHeight(Math.max(84, e.nativeEvent.contentSize.height + 22))
        }
        placeholderTextColor={missing ? "#925d45" : "#81727e"}
        style={{
          fontFamily: "Manrope",
          fontSize: 16,
          lineHeight: 23,
          color: C.ink,
          borderWidth: 1,
          borderColor: missing ? "#925d45" : C.line,
          backgroundColor: missing ? C.warningBg : C.surface,
          borderRadius: 10,
          padding: 12,
          minHeight: 48,
          ...(multiline ? { height, textAlignVertical: "top" as const } : {}),
        }}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
      />
      {missing && (
        <T style={{ fontSize: 11, color: C.warning }}>
          I need this before I snitch.
        </T>
      )}
    </View>
  );
}
export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  section: { fontSize: 16, fontWeight: "700", lineHeight: 24 },
  muted: { color: C.muted, fontSize: 12, lineHeight: 18 },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    backgroundColor: C.surface,
    gap: 14,
  },
});
export function Page({
  title,
  home = false,
  children,
  footer,
  nav = true,
  centered = false,
  animateContent = true,
  onScrollStart,
  onActionFocus,
}: {
  title: string;
  home?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  nav?: boolean;
  centered?: boolean;
  animateContent?: boolean;
  onScrollStart?: () => void;
  onActionFocus?: () => void;
}) {
  const path = usePathname();
  const rr = useRoad();
  const viewport = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  const visibility = React.useMemo(() => ({ offset, viewport }), [offset]);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="rose-edge" cx="100%" cy="0%" rx="65%" ry="27%">
              <Stop offset="0" stopColor="#e8d5ed" stopOpacity=".55" />
              <Stop offset="1" stopColor="#f3f0f6" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="mint-edge" cx="0%" cy="0%" rx="55%" ry="22%">
              <Stop offset="0" stopColor="#d4ebdf" stopOpacity=".6" />
              <Stop offset="1" stopColor="#f3f0f6" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#rose-edge)" />
          <Rect width="100%" height="100%" fill="url(#mint-edge)" />
        </Svg>
      </View>
      <FadeArrival identity={path} duration={160} distance={0}>
        <View
          style={{
            height: 62,
            paddingHorizontal: 21,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {home ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <BrandMark />
              <T style={{ fontWeight: "700", fontSize: 17 }}>Click-to-Safe</T>
            </View>
          ) : (
            <Quiet title="Back" icon="ChevronLeft" onPress={() => go("home")} />
          )}
          {!home && <T style={{ fontWeight: "700", fontSize: 16 }}>{title}</T>}
          {home ? (
            <Quiet
              onFocus={onActionFocus}
              title="Settings"
              icon="Settings"
              onPress={() => go("settings")}
            />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
      </FadeArrival>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View ref={viewport} collapsable={false} style={{ flex: 1 }}>
          <ScrollView
            onScrollBeginDrag={onScrollStart}
            onScroll={(event) => setOffset(event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={100}
            key={path}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: centered ? 1 : undefined,
              justifyContent: centered ? "center" : undefined,
              paddingHorizontal: centered ? 20 : 24,
              paddingTop: 16,
              paddingBottom: 26,
              gap: 22,
            }}
          >
            <DecorationViewport.Provider value={visibility}>
              <Motion
                identity={path}
                direction={navigationDirection}
                durationMs={animateContent ? undefined : 0}
              >
                <View style={{ gap: 24 }}>
                  {rr.error && <Notice error>{rr.error}</Notice>}
                  {children}
                </View>
              </Motion>
            </DecorationViewport.Provider>
          </ScrollView>
        </View>
        {footer && (
          <FadeArrival identity={path} distance={0}>
            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 10,
                paddingBottom: 14,
                gap: 9,
                backgroundColor: C.bg,
              }}
            >
              {footer}
            </View>
          </FadeArrival>
        )}
      </KeyboardAvoidingView>
      {rr.job?.notice && path !== "/analysis" && (
        <FadeArrival distance={0}>
          <View style={{ paddingHorizontal: 18, paddingBottom: 7 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Review completed analysis"
              onPress={() => go("analysis")}
              style={{ backgroundColor: C.mint, padding: 12, borderRadius: 10 }}
            >
              <T style={{ fontSize: 12, fontWeight: "700" }}>
                Report completed. Your draft is ready to review. →
              </T>
            </Pressable>
          </View>
        </FadeArrival>
      )}
      {rr.undo && (
        <View
          style={{
            padding: 12,
            backgroundColor: C.mint,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <T style={{ fontSize: 12 }}>Report marked sent.</T>
          <Quiet
            title="Undo"
            onPress={() => void rr.undoSent().catch(showError)}
          />
        </View>
      )}
      {nav ? (
        <Navigation onActionFocus={onActionFocus} />
      ) : (
        <SafeAreaView edges={["bottom"]} />
      )}
    </SafeAreaView>
  );
}
export function Navigation({ onActionFocus }: { onActionFocus?: () => void }) {
  const path = usePathname(),
    rr = useRoad();
  const active =
    path === "/"
      ? "home"
      : path.slice(1) === "impact"
        ? "history"
        : path.slice(1);
  const [tap, setTap] = useState({ key: "", n: 0 });
  const pending = rr.cases.filter((c) =>
    ["ready", "needs_info", "opened"].includes(c.reporting.status),
  ).length;
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{
        backgroundColor: C.surface,
        borderTopWidth: 1,
        borderColor: "#e8e3ec",
      }}
    >
      <View style={{ height: 68, flexDirection: "row", paddingHorizontal: 7 }}>
        {(["home", "review", "history", "developer"] as const).map((key, i) => (
          <Pressable
            key={key}
            onFocus={onActionFocus}
            accessibilityRole="tab"
            accessibilityLabel={["Home", "Review", "Impact", "Developer"][i]}
            accessibilityState={{ selected: active === key }}
            onPress={() => {
              setTap({ key, n: tap.n + 1 });
              if (active !== key) go(key === "history" ? "impact" : key);
            }}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
            }}
          >
            <View
              style={{
                height: 33,
                width: 39,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: key === "developer" && active !== key ? 1 : 0,
                borderColor: C.muted,
                borderRadius: 8,
              }}
            >
              <MorphIcon
                name={key}
                active={active === key}
                pulse={tap.key === key ? tap.n : 0}
              />
            </View>
            <T
              style={{
                fontSize: 11,
                lineHeight: 16,
                color: C.muted,
                fontWeight: "600",
              }}
            >
              {["Home", "Review", "Impact", "Developer"][i]}
            </T>
            {key === "review" && pending > 0 && (
              <View
                style={{
                  position: "absolute",
                  right: 20,
                  top: 3,
                  backgroundColor: C.lilac,
                  paddingHorizontal: 5,
                  borderRadius: 5,
                }}
              >
                <T style={{ fontSize: 10, lineHeight: 16 }}>{pending}</T>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
export function Segments({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  const { reduced } = useRoad();
  const [width, setWidth] = useState(0);
  const v = useRef(new Animated.Value(value)).current;
  React.useEffect(() => {
    const a = Animated.timing(v, {
      toValue: value,
      duration: reduced ? 0 : 280,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [value, reduced, v]);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        backgroundColor: "#e8e3ec",
        padding: 3,
        borderRadius: 8,
      }}
    >
      {width > 0 && (
        <Animated.View
          style={{
            position: "absolute",
            left: 3,
            top: 3,
            bottom: 3,
            width: (width - 6) / items.length,
            backgroundColor: C.surface,
            borderRadius: 6,
            transform: [
              {
                translateX: v.interpolate({
                  inputRange: [0, items.length - 1],
                  outputRange: [
                    0,
                    ((width - 6) / items.length) * (items.length - 1),
                  ],
                }),
              },
            ],
          }}
        />
      )}
      {items.map((s, i) => (
        <Pressable
          key={s}
          accessibilityRole="button"
          accessibilityLabel={s}
          accessibilityState={{ selected: value === i }}
          onPress={() => onChange(i)}
          style={{
            flex: 1,
            minHeight: 41,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <T style={{ fontSize: 12, fontWeight: value === i ? "700" : "400" }}>
            {s}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

export function focusControl(ref: React.RefObject<View | null>) {
  requestAnimationFrame(() => {
    if (ref.current) {
      ref.current.focus();
      AccessibilityInfo.sendAccessibilityEvent(ref.current, "focus");
    }
  });
}
