import React, { useRef, useState } from "react";
import {
  Alert,
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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
import * as Haptics from "expo-haptics";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { setStatusBarStyle } from "expo-status-bar";
import { router, usePathname } from "expo-router";
import { SvgXml } from "react-native-svg";
import icons from "./icons.json";
import { BrandMark } from "./brand";
import { Motion, DecorationViewport, FadeArrival } from "./motion";
import { useRoad } from "./context";
import { SubmissionIcon, SlidingPill } from "./submission-navigation";
import { Spark } from "./spark";
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
  // The submission's remaining roles: points and penalties, Sent green, the photo-blue on footage.
  penalty: "#C81E1E",
  penaltyLight: "#FF9B8F",
  green: "#15803D",
  lineHover: "#C9CDD4",
  gemPhoto: "#4F8BFF",
  paper: "#F5F5F0",
  prompt: "#7B5B3F",
  amberLine: "#F3B46B",
  code: "#1E3A8A",
};
/** Fire-and-forget haptics; iOS applies the user's System Haptics setting itself. */
export const haptic = {
  select: () => void Haptics.selectionAsync().catch(() => {}),
  tap: () =>
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () =>
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    ),
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
export function T({ balance, ...p }: TextProps & { balance?: boolean }) {
  return balance ? <BalancedText {...p} /> : <PlainText {...p} />;
}
/**
 * How far text may grow with the reader's text size. Body copy doubles; titles and display type
 * grow less so a 42pt headline never breaks inside a word at the accessibility sizes.
 */
export const fontCap = (size: number) => (size >= 28 ? 1.25 : size >= 20 ? 1.5 : 2);
function PlainText({ style, ...p }: TextProps) {
  return (
    <Text
      // The reference sets text-wrap: pretty, so a paragraph never ends on one orphaned word.
      lineBreakStrategyIOS="push-out"
      maxFontSizeMultiplier={fontCap(StyleSheet.flatten(style)?.fontSize ?? 16)}
      {...p}
      style={[
        // 500 is the reference's body weight; 400 read noticeably thinner on device.
        {
          fontFamily: "Manrope",
          fontSize: 16,
          lineHeight: 23,
          fontWeight: "500",
          color: C.ink,
        },
        style,
      ]}
    />
  );
}
/**
 * text-wrap: balance — a heading that wraps onto two lines breaks at the word that evens them out.
 * The break is chosen once from the first layout; three or more lines are left as laid out.
 */
function BalancedText({ children, onTextLayout, ...p }: TextProps) {
  const [balanced, setBalanced] = useState<{ from: string; to: string }>();
  const source = typeof children === "string" ? children : undefined;
  return (
    <PlainText
      {...p}
      onTextLayout={(e) => {
        onTextLayout?.(e);
        const lines = e.nativeEvent.lines;
        if (!source || balanced?.from === source || lines.length !== 2) return;
        const chars = lines[0].text.length + lines[1].text.length;
        const perChar = (lines[0].width + lines[1].width) / Math.max(1, chars);
        let at = -1,
          best = Infinity;
        for (let i = source.indexOf(" "); i > 0; i = source.indexOf(" ", i + 1)) {
          const longest = Math.max(i, source.length - i - 1) * perChar;
          if (longest < best) [at, best] = [i, longest];
        }
        if (at > 0)
          setBalanced({
            from: source,
            to: `${source.slice(0, at)}\n${source.slice(at + 1)}`,
          });
      }}
    >
      {source && balanced?.from === source ? balanced.to : children}
    </PlainText>
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
  /** A custom glyph before the title, e.g. the Gemini spark; may react to the pressed state. */
  leading?: React.ReactNode | ((pressed: boolean) => React.ReactNode);
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
            transform: [{ scale: pressed && !reduced ? 0.97 : 1 }],
          },
          !secondary && !disabled && primaryLift,
        ]}
      >
        {({ pressed }) => (
          <>
            {typeof leading === "function" ? leading(pressed) : leading}
            {icon && (
              <Icon
                name={icon}
                color={disabled ? C.muted : secondary ? C.ink : "white"}
                size={20}
              />
            )}
            <T
              style={{
                fontWeight: "700",
                fontSize: 17,
                lineHeight: 21,
                color: disabled ? C.muted : secondary ? C.ink : "white",
                textAlign: "center",
              }}
            >
              {title}
            </T>
          </>
        )}
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
  weight = "700",
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
  /** 600 for a text action (How Gemini decided), 700 for an inline link (Read the law). */
  weight?: "600" | "700";
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
          fontWeight: weight,
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
      trackColor={{ true: C.accent, false: C.lineHover }}
      ios_backgroundColor={C.lineHover}
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
        ...(compact ? { width: 44, borderRadius: 22 } : { paddingHorizontal: 6 }),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: disabled ? 0.28 : !compact && pressed ? 0.55 : 1,
        backgroundColor: compact && pressed ? C.surface : "transparent",
        transform: [{ scale: compact && pressed ? 0.88 : 1 }],
      })}
    >
      {icon && <Icon name={icon} size={compact ? 22 : 20} />}
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
    <View style={{ gap: 6, marginTop: 6 }}>
      <T
        key={title}
        accessibilityRole="header"
        balance
        style={{
          fontSize: 30,
          lineHeight: 33,
          fontWeight: "800",
          letterSpacing: -0.75,
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
    <View style={{ gap: 6, flex: 1, minWidth: 110 }}>
      <T
        style={{
          fontSize: 12,
          lineHeight: 14,
          color: missing ? C.warning : C.muted,
          fontWeight: "700",
        }}
      >
        {label}
      </T>
      <TextInput
        maxFontSizeMultiplier={1.6}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        onContentSizeChange={(e) =>
          multiline &&
          setHeight(Math.max(84, e.nativeEvent.contentSize.height + 22))
        }
        placeholderTextColor={missing ? C.warning : C.prompt}
        style={{
          fontFamily: "Manrope",
          fontSize: 16,
          lineHeight: multiline ? 23 : undefined,
          fontWeight: multiline ? "500" : "600",
          color: textColor,
          borderWidth: 1.5,
          borderStyle: missing && !focused ? "dashed" : "solid",
          borderColor: focused ? C.accent : missing ? C.warning : C.line,
          backgroundColor: C.bg,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
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
  section: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  muted: { color: C.muted, fontSize: 13, lineHeight: 18 },
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
  onRefresh,
  refreshing = false,
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
  /** Pull to refresh, the native way to ask for fresh server data. */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  // Keep the route this screen opened on. The global path changes for the outgoing screen
  // mid-transition, which remounted its scroll view (jumping to the top) while it faded out.
  const openedOn = usePathname();
  const [path] = useState(openedOn);
  const rr = useRoad();
  const insets = useSafeAreaInsets();
  const viewport = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  const visibility = React.useMemo(() => ({ offset, viewport }), [offset]);
  const back = () =>
    router.canGoBack()
      ? router.back()
      : go(
          path === "/work" || path === "/handoff"
            ? "review"
            : path === "/review"
              ? "impact"
              : "home",
        );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <FadeArrival identity={path} duration={160} distance={0}>
        {home ? (
          <View
            style={{
              height: 56,
              paddingLeft: 20,
              paddingRight: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {headerLeft ?? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
              >
                <BrandMark color={C.ink} />
                <T
                  maxFontSizeMultiplier={1.3}
                  style={{ fontWeight: "800", fontSize: 18, lineHeight: 22 }}
                >
                  Click-to-Safe
                </T>
              </View>
            )}
            {headerRight ?? (
              <Quiet
                onFocus={onActionFocus}
                title="Settings"
                compact
                icon="Settings"
                onPress={() => go("settings")}
              />
            )}
          </View>
        ) : (
          // Reference bar: 56 · 1fr · 56, so the title stays centred and a long id truncates.
          <View
            style={{
              height: 56,
              paddingHorizontal: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <View style={{ width: 56, alignItems: "flex-start" }}>
              {headerLeft ??
                (path === "/impact" ? null : (
                  <Quiet title="Back" compact icon="ChevronLeft" onPress={back} />
                ))}
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              {/* The bar keeps its 56pt height, like a native navigation bar title. */}
              <T
                accessibilityRole="header"
                numberOfLines={1}
                maxFontSizeMultiplier={1.35}
                style={{ fontWeight: "700", fontSize: 16, lineHeight: 20 }}
              >
                {title}
              </T>
            </View>
            <View
              style={{ width: 56, alignItems: "flex-end", overflow: "hidden" }}
            >
              {headerRight}
            </View>
          </View>
        )}
      </FadeArrival>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View ref={viewport} collapsable={false} style={{ flex: 1 }}>
          <ScrollView
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={C.muted}
                />
              ) : undefined
            }
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
              paddingBottom: 28,
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
        {/* Notices and toasts take their own space above the footer or tab bar, as in the reference. */}
        {rr.job?.notice && path !== "/analysis" && (
          <CompletionNotice
            onOpen={() => go("analysis")}
            onDismiss={rr.dismissNotice}
          />
        )}
        {rr.undo && (
          <SentToast
            until={rr.undo.until}
            onUndo={() => {
              haptic.tap();
              void rr
                .undoSent()
                .then(() => {
                  go("impact");
                  notify("Unmarked. The receipts are still here.");
                })
                .catch(showError);
            }}
          />
        )}
        <FlashToast />
        {footer && (
          <FadeArrival identity={path} distance={0}>
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 14,
                gap: 8,
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
      {/* The tab bar itself is one persistent bar in the root layout; leave room for it. */}
      <View style={{ height: nav ? TAB_BAR_HEIGHT + insets.bottom : insets.bottom }} />
    </SafeAreaView>
  );
}
function CompletionNotice({
  onOpen,
  onDismiss,
}: {
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <FadeArrival distance={18}>
      <View
        accessibilityRole="summary"
        style={{
          marginHorizontal: 14,
          marginBottom: 10,
          paddingVertical: 9,
          paddingLeft: 14,
          paddingRight: 6,
          borderRadius: 16,
          backgroundColor: C.surface,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Spark size={22} />
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 15, lineHeight: 18, fontWeight: "700" }}>
            I’ve documented the audacity.
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See the case"
            onPress={onOpen}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <T style={{ fontSize: 14, lineHeight: 20, fontWeight: "700", color: C.accent }}>
              See the case
            </T>
          </Pressable>
        </View>
        <Quiet title="Dismiss report notification" compact icon="X" onPress={onDismiss} />
      </View>
    </FadeArrival>
  );
}

/** Speaks a changing status to VoiceOver; accessibilityLiveRegion only works on Android. */
export function Announce({ message }: { message: string }) {
  React.useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return null;
}

/* ---------- toasts: the Undo deadline and short confirmations ---------- */
type Flash = { message: string; id: number } | null;
let flash: Flash = null;
let flashTimer: ReturnType<typeof setTimeout> | undefined;
const flashListeners = new Set<() => void>();
const emitFlash = () => flashListeners.forEach((listener) => listener());
/** A short confirmation toast on the current screen (the reference's C.notify without an action). */
export function notify(message: string, ms = 3200) {
  // accessibilityLiveRegion only speaks on Android; iOS needs an explicit announcement.
  AccessibilityInfo.announceForAccessibility(message);
  flash = { message, id: Date.now() };
  emitFlash();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash = null;
    emitFlash();
  }, ms);
}
function FlashToast() {
  const focused = useIsFocused();
  const current = React.useSyncExternalStore(
    (listener) => {
      flashListeners.add(listener);
      return () => flashListeners.delete(listener);
    },
    () => flash,
  );
  if (!focused || !current) return null;
  return <ToastCard key={current.id} text={current.message} />;
}
function SentToast({ until, onUndo }: { until: number; onUndo: () => void }) {
  return (
    <ToastCard
      text="Marked sent. Fat-fingered it?"
      action="Undo"
      onAction={onUndo}
      until={until}
    />
  );
}
function ToastCard({
  text,
  action,
  onAction,
  until,
}: {
  text: string;
  action?: string;
  onAction?: () => void;
  until?: number;
}) {
  const { reduced, foreground } = useRoad();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const progress = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (reduced || !foreground) {
      enter.setValue(1);
      return;
    }
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 340,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, reduced, foreground]);
  React.useEffect(() => {
    if (!until) return;
    // The countdown keeps running under reduced motion: it is a timer, not movement.
    const remaining = Math.max(0, until - Date.now());
    progress.setValue(remaining / 8000);
    const a = Animated.timing(progress, {
      toValue: 0,
      duration: remaining,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [until, progress]);
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        marginHorizontal: 14,
        marginBottom: 10,
        paddingTop: 10,
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: action ? 10 : 16,
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 16,
        backgroundColor: C.ink,
        overflow: "hidden",
        shadowColor: C.ink,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
          {
            scale: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
        ],
      }}
    >
      <T
        style={{
          flex: 1,
          color: "white",
          fontSize: 15,
          lineHeight: 20,
          fontWeight: "600",
        }}
      >
        {text}
      </T>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onAction}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: 16,
            borderRadius: 999,
            backgroundColor: "white",
            justifyContent: "center",
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <T style={{ fontSize: 15, lineHeight: 18, fontWeight: "800" }}>
            {action}
          </T>
        </Pressable>
      )}
      {!!until && (
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            backgroundColor: C.gemPhoto,
            transformOrigin: "left center",
            transform: [{ scaleX: progress }],
          }}
        />
      )}
    </Animated.View>
  );
}

/* ---------- the tab bar: one persistent bar under the tab routes ---------- */
export const TAB_BAR_HEIGHT = 68;
const TAB_ROUTES = ["/", "/review", "/impact"];
let lastPending = -1;
export function Navigation() {
  const path = usePathname(),
    rr = useRoad();
  const insets = useSafeAreaInsets();
  const shown = TAB_ROUTES.includes(path);
  const active =
    path === "/" ? "home" : path === "/impact" ? "history" : "review";
  const pending = pendingCases(rr.cases).length;
  const { width } = useWindowDimensions();
  const tabIndex = ["home", "review", "history"].indexOf(active);
  const [lastIndex, setLastIndex] = useState(tabIndex);
  if (shown && tabIndex !== lastIndex) setLastIndex(tabIndex);
  // Leaving the tab routes, the bar sinks; coming back, it rises on the travel curve.
  const travel = useRef(new Animated.Value(shown ? 0 : 1)).current;
  React.useEffect(() => {
    const a = Animated.timing(travel, {
      toValue: shown ? 0 : 1,
      duration: rr.reduced ? 0 : shown ? 420 : 240,
      delay: shown && !rr.reduced ? 90 : 0,
      easing: shown ? Easing.bezier(0.32, 0.72, 0, 1) : Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [shown, rr.reduced, travel]);
  const height = TAB_BAR_HEIGHT + insets.bottom;
  return (
    <Animated.View
      pointerEvents={shown ? "auto" : "none"}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height,
        paddingBottom: insets.bottom,
        backgroundColor: C.bg,
        borderTopWidth: 1,
        borderColor: C.line,
        transform: [
          {
            translateY: travel.interpolate({
              inputRange: [0, 1],
              outputRange: [0, height + 2],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          height: TAB_BAR_HEIGHT,
          flexDirection: "row",
          paddingHorizontal: 14,
        }}
      >
        <SlidingPill index={Math.max(0, shown ? tabIndex : lastIndex)} width={width} />
        {(["home", "review", "history"] as const).map((key, i) => (
          <TabButton
            key={key}
            label={["Home", "Cases", "Impact"][i]}
            count={key === "review" ? pending : 0}
            selected={shown && active === key}
            onPress={() => {
              if (active !== key || !shown) {
                if (key === "review")
                  rr.select(pendingCases(rr.cases)[0]?.id || "");
                go(key === "history" ? "impact" : key);
              }
            }}
          >
            <SubmissionIcon
              name={key}
              active={shown ? active === key : lastIndex === i}
            />
            {key === "review" && pending > 0 && <CountBadge value={pending} />}
          </TabButton>
        ))}
      </View>
    </Animated.View>
  );
}
function TabButton({
  label,
  count = 0,
  selected,
  onPress,
  children,
}: React.PropsWithChildren<{
  label: string;
  /** Cases waiting for the user; the badge is visual, so VoiceOver hears it in the label. */
  count?: number;
  selected: boolean;
  onPress: () => void;
}>) {
  const { reduced } = useRoad();
  // The icon presses in to 86% and springs back, like the reference's .tab:active .nav-ico.
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) =>
    reduced
      ? undefined
      : to < 1
        ? Animated.timing(scale, {
            toValue: to,
            duration: 80,
            useNativeDriver: true,
          }).start()
        : Animated.spring(scale, {
            toValue: 1,
            speed: 18,
            bounciness: 12,
            useNativeDriver: true,
          }).start();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={count ? `${label}, ${count} ${count === 1 ? "needs" : "need"} you` : label}
      accessibilityState={{ selected }}
      onPressIn={() => press(0.86)}
      onPressOut={() => press(1)}
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
      }}
    >
      <Animated.View
        style={{
          height: 33,
          width: 56,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale }],
        }}
      >
        {React.Children.toArray(children)[0]}
      </Animated.View>
      {/* Tab labels stay put in their fixed bar, as UITabBar's do. */}
      <T
        maxFontSizeMultiplier={1.15}
        style={{
          fontSize: 12,
          lineHeight: 16,
          color: selected ? C.ink : C.muted,
          fontWeight: selected ? "800" : "600",
        }}
      >
        {label}
      </T>
      {React.Children.toArray(children).slice(1)}
    </Pressable>
  );
}
function CountBadge({ value }: { value: number }) {
  const { reduced } = useRoad();
  const pop = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const rose = lastPending >= 0 && value > lastPending;
    lastPending = value;
    if (!rose || reduced) return;
    pop.setValue(0);
    const a = Animated.sequence([
      Animated.delay(160),
      Animated.timing(pop, {
        toValue: 1.3,
        duration: 250,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: 170,
        useNativeDriver: true,
      }),
    ]);
    a.start();
    return () => a.stop();
  }, [value, reduced, pop]);
  return (
    <Animated.View
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
        transform: [{ scale: pop }],
      }}
    >
      <T
        maxFontSizeMultiplier={1}
        style={{
          fontSize: 11,
          lineHeight: 13,
          fontWeight: "700",
          color: "white",
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </T>
    </Animated.View>
  );
}
export function Segments({
  items,
  value,
  onChange,
}: {
  /** A label, or [label, count] to show the count in bold ("All **5**"). */
  items: (string | [string, number])[];
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
      {items.map((item, i) => {
        const [label, count] = typeof item === "string" ? [item, undefined] : item;
        return (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={count === undefined ? label : `${label} ${count}`}
          accessibilityState={{ selected: value === i }}
          onPress={() => {
            if (value !== i) haptic.select();
            onChange(i);
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
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
            {label}
            {count !== undefined && (
              <T style={{ fontSize: 14, lineHeight: 18, fontWeight: "800", color: value === i ? C.ink : C.muted }}>
                {` ${count}`}
              </T>
            )}
          </T>
        </Pressable>
        );
      })}
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
