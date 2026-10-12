import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";
import { Stack, usePathname, useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { StoreProvider } from "../lib/store";
import { RoadProvider, useRoad } from "../road/context";
import { Navigation, attachNavigation } from "../road/ui";
void SplashScreen.preventAutoHideAsync();
function ReadySplash() {
  const { ready } = useRoad();
  const path = usePathname();
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready, path]);
  return null;
}
function Navigator() {
  const { reduced } = useRoad();
  const navigation = useNavigationContainerRef();
  useEffect(() => attachNavigation(navigation), [navigation]);
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduced ? "fade" : "slide_from_right",
          animationDuration: reduced ? 180 : 440,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      >
        {/* Tabs cross-fade quickly under the persistent bar (reference: about 340 ms). */}
        <Stack.Screen name="index" options={{ animation: "fade", animationDuration: 280 }} />
        <Stack.Screen name="review" options={{ animation: "fade", animationDuration: 280 }} />
        <Stack.Screen name="impact" options={{ animation: "fade", animationDuration: 280 }} />
        <Stack.Screen name="analysis" options={{ animation: "fade" }} />
        {/* A stray edge swipe while mounting the phone must not tear down the camera mid-file. */}
        <Stack.Screen name="recording" options={{ animation: "fade", gestureEnabled: false }} />
      </Stack>
      {/* One tab bar for Home, Cases and Impact: it stays put while their pages cross-fade. */}
      <Navigation />
    </View>
  );
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
        <Navigator />
      </RoadProvider>
    </StoreProvider>
  );
}
