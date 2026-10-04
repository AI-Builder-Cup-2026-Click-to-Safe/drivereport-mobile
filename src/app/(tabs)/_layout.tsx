import { Tabs } from "expo-router";
import { C, Icon, IconName } from "../../components/ui";
export default function TabsLayout() {
  const icons: Record<string, IconName> = {
    index: "grid-outline",
    capture: "radio-outline",
    history: "documents-outline",
    settings: "settings-outline",
  };
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0c151e",
          borderTopColor: C.line,
          height: 85,
          paddingTop: 9,
          paddingBottom: 25,
        },
        tabBarActiveTintColor: C.cyan,
        tabBarInactiveTintColor: "#718394",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 3 },
        tabBarIcon: ({ color }) => (
          <Icon name={icons[route.name]} color={color} size={21} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="capture" options={{ title: "Record" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
