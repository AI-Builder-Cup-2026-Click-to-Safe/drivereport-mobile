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
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextProps,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { setStatusBarStyle } from "expo-status-bar";
import { router, usePathname } from "expo-router";
import { SvgXml } from "react-native-svg";
import icons from "./icons.json";
import { BrandMark } from "./brand";
import { Motion, DecorationViewport, FadeArrival } from "./motion";
import { useRoad } from "./context";
import { SubmissionIcon, SlidingPill } from "./submission-navigation";
import { pendingCases } from "./submission-model";
export const C = {
  bg: "#FFFFFF",
  surface: "#F3F4F6",
  ink: "#111318",
  muted: "#5D6270",
  line: "#E3E5E9",
  mint: "#E8F6EC",
  lilac: "#E9EBEF",
  peach: "#FFF4E5",
  accent: "#1A56DB",
  warning: "#A84B0A",
  warningBg: "#FFF4E5",
  dark: "#000000",
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
  const path = (name === "home" ? "/" : `/${name}`) as never;
  if (["home", "review", "impact"].includes(name)) router.navigate(path);
  else router.push(path);
};
export function T({ style, ...p }: TextProps) {
  return (
    <Text
      {...p}
      style={[
        { fontFamily: "Manrope", fontSize: 16, lineHeight: 23, color: C.ink },
        style,
      ]}
    />
  );
}
export function Icon({
  name,
  size = 22,
  color = C.ink,
  strokeWidth,
}: {
  name: keyof typeof icons;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const xml = icons[name].replaceAll("currentColor", color);
  return (
    <SvgXml
      xml={
        strokeWidth
          ? xml.replace(
              /stroke-width="[\d.]+"/,
              `stroke-width="${strokeWidth}"`,
            )
          : xml
      }
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
  leading,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: keyof typeof icons;
  small?: boolean;
  fadeOnEnable?: boolean;
  controlRef?: React.Ref<View>;
  /** A custom glyph before the title, e.g. the Gemini spark. */
  leading?: React.ReactNode;
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
            minHeight: small ? 44 : 56,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            borderWidth: secondary ? 1.5 : 0,
            borderColor: C.line,
            backgroundColor: disabled
              ? C.lilac
              : secondary
                ? C.bg
                : pressed
                  ? "#000000"
                  : C.ink,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed && !reduced ? 0.97 : 1 }],
          },
          !secondary && !disabled && primaryLift,
        ]}
      >
        {leading}
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
            fontSize: 17,
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
// DESIGN.md "Primary lift": the black primary button is the only lifted surface.
const primaryLift = {
  shadowColor: C.ink,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.28,
  shadowRadius: 10,
};
/** Gemini Blue text action ("How Gemini decided", "Read the law ↗"). */
export function TextLink({
  title,
  onPress,
  leading,
  trailingIcon,
  size = 15,
  align = "center",
  inline = false,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  leading?: React.ReactNode;
  trailingIcon?: keyof typeof icons;
  size?: number;
  align?: "center" | "flex-start";
  /** Keep the line height; the 44pt target comes from hitSlop instead. */
  inline?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={({ pressed }) => ({
        minHeight: inline ? undefined : 44,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: align,
        gap: 6,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      {leading}
      <T
        style={{
          fontSize: size,
          lineHeight: size + 5,
          fontWeight: "700",
          color: C.accent,
        }}
      >
        {title}
      </T>
      {trailingIcon && (
        <Icon name={trailingIcon} size={size - 1} color={C.accent} />
      )}
    </Pressable>
  );
}
/** Native switch in the design's colours: Gemini Blue on, Hover Hairline off. */
export function Toggle(props: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      trackColor={{ true: C.accent, false: "#C9CDD4" }}
      ios_backgroundColor="#C9CDD4"
      {...props}
    />
  );
}
export function Quiet({
  title,
  onPress,
  icon,
  compact = false,
  disabled = false,
  onFocus,
}: {
  title: string;
  onPress: () => void;
  icon?: keyof typeof icons;
  compact?: boolean;
  disabled?: boolean;
  onFocus?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      onFocus={onFocus}
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 7,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        opacity: disabled ? 0.3 : pressed ? 0.5 : 1,
      })}
    >
      {icon && <Icon name={icon} size={20} />}
      {!compact && (
        <T style={{ fontSize: 15, fontWeight: "600", color: C.muted }}>
          {title}
        </T>
      )}
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
          backgroundColor: error ? C.warningBg : C.surface,
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
          fontSize: 30,
          lineHeight: 33,
          fontWeight: "800",
          letterSpacing: -0.65,
        }}
      >
        {title}
      </T>
      {body && (
        <T style={{ color: C.muted, fontSize: 16, lineHeight: 23 }}>{body}</T>
      )}
    </View>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  missing = false,
  hint = true,
  multiline = false,
  textColor = C.ink,
  ...rest
}: TextInputProps & {
  label: string;
  missing?: boolean;
  hint?: boolean;
  textColor?: string;
}) {
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
        placeholderTextColor={missing ? C.warning : C.muted}
        style={{
          fontFamily: "Manrope",
          fontSize: 16,
          lineHeight: 23,
          color: textColor,
          borderWidth: 1,
          borderColor: focused ? C.accent : missing ? "#F3B46B" : C.line,
          backgroundColor: missing ? C.warningBg : C.surface,
          borderRadius: 12,
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
      {missing && hint && (
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
    borderRadius: 16,
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
  animateContent = false,
  headerLeft,
  headerRight,
  gap = 24,
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
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  gap?: number;
  onScrollStart?: () => void;
  onActionFocus?: () => void;
}) {
  // Keep the route this screen opened on. The global path changes for the outgoing screen
  // mid-transition, which remounted its scroll view (jumping to the top) while it faded out.
  const openedOn = usePathname();
  const [path] = useState(openedOn);
  const rr = useRoad();
  const viewport = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  const visibility = React.useMemo(() => ({ offset, viewport }), [offset]);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <FadeArrival identity={path} duration={160} distance={0}>
        <View
          style={{
            height: 56,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {headerLeft ??
            (home ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <BrandMark color={C.ink} />
                <T style={{ fontWeight: "700", fontSize: 17 }}>Click-to-Safe</T>
              </View>
            ) : path === "/impact" ? (
              <View style={{ width: 44 }} />
            ) : (
              <Quiet
                title="Back"
                compact
                icon="ChevronLeft"
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : go(
                        path === "/work" || path === "/handoff"
                          ? "review"
                          : path === "/review"
                            ? "impact"
                            : "home",
                      )
                }
              />
            ))}
          {!home && <T style={{ fontWeight: "700", fontSize: 16 }}>{title}</T>}
          {headerRight ??
            (home ? (
              <Quiet
                onFocus={onActionFocus}
                title="Settings"
                compact
                icon="Settings"
                onPress={() => go("settings")}
              />
            ) : (
              <View style={{ width: 44 }} />
            ))}
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
            // Scrolling away from a field puts the keyboard away instead of leaving it over the page.
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              flexGrow: centered ? 1 : undefined,
              justifyContent: centered ? "center" : undefined,
              paddingHorizontal: 20,
              paddingTop: 8,
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
                <View style={{ gap }}>
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
                paddingHorizontal: 20,
                paddingTop: 10,
                paddingBottom: 14,
                gap: 9,
                backgroundColor: C.bg,
                borderTopWidth: 1,
                borderTopColor: C.line,
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
              style={{
                backgroundColor: C.surface,
                padding: 12,
                borderRadius: 16,
              }}
            >
              <T style={{ fontSize: 12, fontWeight: "700" }}>
                I’ve documented the audacity. See the case →
              </T>
            </Pressable>
          </View>
        </FadeArrival>
      )}
      {rr.undo && (
        <SentToast
          until={rr.undo.until}
          onUndo={() => void rr.undoSent().catch(showError)}
        />
      )}
      {nav ? (
        <Navigation onActionFocus={onActionFocus} />
      ) : (
        <SafeAreaView edges={["bottom"]} />
      )}
    </SafeAreaView>
  );
}
function SentToast({ until, onUndo }: { until: number; onUndo: () => void }) {
  const { reduced, foreground } = useRoad();
  const progress = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const remaining = Math.max(0, until - Date.now());
    progress.setValue(remaining / 8000);
    pop.setValue(1);
    if (reduced || !foreground) return;
    pop.setValue(0.85);
    const a = Animated.parallel([
      Animated.timing(progress, {
        toValue: 0,
        duration: remaining,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(pop, {
          toValue: 1.12,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(pop, {
          toValue: 1,
          duration: 170,
          useNativeDriver: true,
        }),
      ]),
    ]);
    a.start();
    return () => a.stop();
  }, [until, reduced, foreground, progress, pop]);
  return (
    <View
      style={{
        margin: 12,
        padding: 14,
        backgroundColor: C.ink,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Icon name="Check" color="white" />
        </Animated.View>
        <T style={{ color: "white", flex: 1, fontSize: 15 }}>
          Report marked sent.
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo"
          onPress={onUndo}
          style={{ backgroundColor: "white", borderRadius: 24, padding: 12 }}
        >
          <T style={{ fontWeight: "700" }}>Undo</T>
        </Pressable>
      </View>
      {!reduced && (
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            backgroundColor: "#4F8BFF",
            transformOrigin: "left center",
            transform: [{ scaleX: progress }],
          }}
        />
      )}
    </View>
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
  const pending = pendingCases(rr.cases).length;
  const { width } = useWindowDimensions();
  const tabIndex = ["home", "review", "history"].indexOf(active);
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{
        backgroundColor: C.bg,
        borderTopWidth: 1,
        borderColor: C.line,
      }}
    >
      <View style={{ height: 68, flexDirection: "row", paddingHorizontal: 14 }}>
        <SlidingPill index={Math.max(0, tabIndex)} width={width} />
        {(["home", "review", "history"] as const).map((key, i) => (
          <Pressable
            key={key}
            onFocus={onActionFocus}
            accessibilityRole="tab"
            accessibilityLabel={["Home", "Cases", "Impact"][i]}
            accessibilityState={{ selected: active === key }}
            onPress={() => {
              if (active !== key) {
                if (key === "review")
                  rr.select(pendingCases(rr.cases)[0]?.id || "");
                go(key === "history" ? "impact" : key);
              }
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
                width: 56,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 18,
              }}
            >
              <SubmissionIcon name={key} active={active === key} />
            </View>
            <T
              style={{
                fontSize: 12,
                lineHeight: 16,
                color: active === key ? C.ink : C.muted,
                fontWeight: active === key ? "800" : "600",
              }}
            >
              {["Home", "Cases", "Impact"][i]}
            </T>
            {key === "review" && pending > 0 && (
              <View
                style={{
                  position: "absolute",
                  left: "50%",
                  marginLeft: 12,
                  top: 4,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: C.warning,
                }}
              >
                <T
                  style={{
                    fontSize: 11,
                    lineHeight: 13,
                    fontWeight: "700",
                    color: "white",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {pending}
                </T>
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
        backgroundColor: C.surface,
        padding: 4,
        borderRadius: 999,
      }}
    >
      {width > 0 && (
        <Animated.View
          style={{
            position: "absolute",
            left: 4,
            top: 4,
            bottom: 4,
            width: (width - 8) / items.length,
            backgroundColor: C.bg,
            borderRadius: 999,
            // DESIGN.md "Slab" shadow lifts the selected segment off the track.
            shadowColor: C.ink,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 1,
            transform: [
              {
                translateX: v.interpolate({
                  inputRange: [0, items.length - 1],
                  outputRange: [
                    0,
                    ((width - 8) / items.length) * (items.length - 1),
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
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <T
            numberOfLines={1}
            style={{
              fontSize: 14,
              lineHeight: 18,
              fontWeight: value === i ? "800" : "600",
              color: value === i ? C.ink : C.muted,
              fontVariant: ["tabular-nums"],
            }}
          >
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
