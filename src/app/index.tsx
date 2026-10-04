import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useStore } from "../lib/store";
import { C } from "../components/ui";
export default function Index() {
  const { ready, settings } = useStore();
  return ready ? (
    <Redirect href={settings.onboarded ? "/(tabs)" : "/welcome"} />
  ) : (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}>
      <ActivityIndicator color={C.cyan} />
    </View>
  );
}
