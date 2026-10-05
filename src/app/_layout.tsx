import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { StoreProvider } from "../lib/store";
import { RoadProvider } from "../road/context";
export default function Layout() {
  const [loaded, error] = useFonts({
    Manrope: require("../../assets/road/fonts/Manrope-variable-latin.ttf"),
  });
  if (!loaded && !error) return null;
  return (
    <StoreProvider>
      <RoadProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "none",
            contentStyle: { backgroundColor: "#f3f0f6" },
          }}
        />
      </RoadProvider>
    </StoreProvider>
  );
}
