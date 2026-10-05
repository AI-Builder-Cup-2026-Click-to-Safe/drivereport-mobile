import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { StoreProvider } from "../lib/store";
import { RoadProvider, useRoad } from "../road/context";
void SplashScreen.preventAutoHideAsync();
function ReadySplash() {
  const { ready } = useRoad();
  const path = usePathname();
  useEffect(() => {
    if (ready && path !== "/") SplashScreen.hide();
  }, [ready, path]);
  return null;
}
export default function Layout() {
  const [loaded, error] = useFonts({
    Manrope: require("../../assets/road/fonts/Manrope-variable-latin.ttf"),
  });
  if (!loaded && !error) return null;
  return (
    <StoreProvider>
      <RoadProvider>
        <ReadySplash />
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
