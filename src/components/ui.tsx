import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
export const C = {
  bg: "#080e14",
  card: "#111c26",
  line: "#21303d",
  cyan: "#08d8ea",
  white: "#f2f7fb",
  muted: "#8295a6",
  green: "#25db8a",
  amber: "#f6ba50",
  red: "#fb686a",
};
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export const Icon = ({
  name,
  color = C.cyan,
  size = 22,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) => <Ionicons accessible={false} name={name} size={size} color={color} />;
export const Txt = ({
  children,
  style,
  muted = false,
}: React.PropsWithChildren<{
  style?: React.ComponentProps<typeof Text>["style"];
  muted?: boolean;
}>) => (
  <Text style={[s.text, muted && { color: C.muted }, style]}>{children}</Text>
);
export function Screen({
  children,
  title,
  subtitle,
  back,
  right,
}: React.PropsWithChildren<{
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}>) {
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
      >
        {title && (
          <View style={s.header}>
            {back && (
              <Pressable
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/(tabs)")
                }
                accessibilityLabel="Back"
                style={s.back}
              >
                <Icon name="arrow-back" color={C.white} />
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <Txt style={s.title}>{title}</Txt>
              {subtitle && (
                <Txt muted style={s.caption}>
                  {subtitle}
                </Txt>
              )}
            </View>
            {right}
          </View>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export const Card = ({
  children,
  style,
}: React.PropsWithChildren<{ style?: ViewStyle }>) => (
  <View style={[s.card, style]}>{children}</View>
);
export function Button({
  title,
  onPress,
  icon,
  kind = "primary",
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  kind?: "primary" | "outline" | "green" | "danger";
  disabled?: boolean;
  busy?: boolean;
}) {
  const color =
    kind === "outline" ? C.cyan : kind === "danger" ? C.white : C.bg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor:
            kind === "outline"
              ? "transparent"
              : kind === "green"
                ? C.green
                : kind === "danger"
                  ? "#a93640"
                  : C.cyan,
          borderColor: kind === "outline" ? C.line : "transparent",
          opacity: disabled || busy ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        icon && <Icon name={icon} color={color} size={19} />
      )}
      <Text style={[s.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}
export function Badge({
  text,
  color = C.cyan,
}: {
  text: string;
  color?: string;
}) {
  return (
    <View
      style={[
        s.badge,
        { backgroundColor: `${color}15`, borderColor: `${color}40` },
      ]}
    >
      <Txt
        style={{ fontSize: 10, fontWeight: "700", color, letterSpacing: 0.5 }}
      >
        {text}
      </Txt>
    </View>
  );
}
export const Label = ({ children }: React.PropsWithChildren) => (
  <Txt muted style={s.label}>
    {children}
  </Txt>
);
export const Field = ({
  label,
  ...props
}: TextInputProps & { label: string }) => (
  <View style={{ gap: 8, marginBottom: 16 }}>
    <Label>{label}</Label>
    <TextInput
      placeholderTextColor="#526577"
      selectionColor={C.cyan}
      {...props}
      style={[
        s.input,
        props.multiline && { minHeight: 100, textAlignVertical: "top" },
        props.style,
      ]}
    />
  </View>
);
export const Divider = () => (
  <View style={{ height: 1, backgroundColor: C.line, marginVertical: 18 }} />
);
export const Notice = ({
  children,
  error,
}: React.PropsWithChildren<{ error?: boolean }>) => (
  <View style={[s.notice, error && { borderColor: "#703039" }]}>
    <Icon
      name={error ? "alert-circle-outline" : "information-circle-outline"}
      color={error ? C.red : C.cyan}
      size={18}
    />
    <Txt muted style={{ flex: 1, fontSize: 12, lineHeight: 19 }}>
      {children}
    </Txt>
  </View>
);
export const handleError = (e: unknown) =>
  Alert.alert(
    "DriveReport",
    e instanceof Error ? e.message : "Something went wrong. Please try again.",
  );
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: { padding: 22, paddingBottom: 40, gap: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 7,
  },
  back: { paddingVertical: 10, paddingRight: 4 },
  text: { color: C.white, fontSize: 14, lineHeight: 22 },
  title: {
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  caption: { fontSize: 11, lineHeight: 18, marginTop: 4 },
  card: {
    padding: 19,
    backgroundColor: C.card,
    borderRadius: 17,
    borderColor: C.line,
    borderWidth: 1,
    gap: 14,
  },
  button: {
    minHeight: 51,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  buttonText: { fontSize: 13, fontWeight: "800" },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 14,
    color: C.white,
    fontSize: 14,
    backgroundColor: "#0b131c",
  },
  notice: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  section: { fontSize: 16, fontWeight: "700" },
});
