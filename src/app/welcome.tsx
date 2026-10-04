import { ImageBackground, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Badge, Button, C, handleError, Icon, s, Txt } from "../components/ui";
import { useStore } from "../lib/store";
export default function Welcome() {
  const { settings, saveSettings } = useStore();
  const start = async () => {
    await saveSettings({ ...settings, onboarded: true });
    router.replace("/(tabs)");
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 38 }}>
        <ImageBackground
          source={require("../../assets/night-highway.jpg")}
          style={{ height: 350 }}
          imageStyle={{ opacity: 0.65 }}
        >
          <LinearGradient
            colors={["#080e1430", "#080e1400", C.bg]}
            style={{ flex: 1, justifyContent: "flex-end", padding: 25 }}
          >
            <SafeAreaView style={{ position: "absolute", top: 20, left: 25 }}>
              <Badge text="YOUR ROAD. YOUR EVIDENCE." />
            </SafeAreaView>
            <View style={s.row}>
              <Icon name="shield-checkmark" size={33} />
              <Txt
                style={{
                  fontSize: 36,
                  fontWeight: "800",
                  lineHeight: 46,
                  letterSpacing: -1.7,
                }}
              >
                DriveReport
              </Txt>
            </View>
          </LinearGradient>
        </ImageBackground>
        <View style={{ paddingHorizontal: 25, gap: 26 }}>
          <Txt
            style={{
              fontSize: 24,
              lineHeight: 31,
              fontWeight: "700",
              letterSpacing: -0.5,
            }}
          >
            Safer roads begin{`\n`}with what you see.
          </Txt>
          <Txt muted style={{ lineHeight: 24 }}>
            Turn your dashcam footage into a clear, evidence-led road incident
            report. Review with AI. Stay in control of every report.
          </Txt>
          {[
            {
              icon: "videocam-outline" as const,
              title: "AI Dashcam Review",
              text: "Upload a short clip for video, legal and final review.",
            },
            {
              icon: "logo-whatsapp" as const,
              title: "WhatsApp Report Drafts",
              text: "Check the evidence, edit your draft and share it yourself.",
            },
          ].map((f) => (
            <View
              key={f.title}
              style={[s.row, { alignItems: "flex-start", gap: 16 }]}
            >
              <View
                style={{
                  padding: 12,
                  backgroundColor: "#0b2832",
                  borderRadius: 12,
                }}
              >
                <Icon name={f.icon} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: "700" }}>{f.title}</Txt>
                <Txt muted style={{ fontSize: 12, lineHeight: 19 }}>
                  {f.text}
                </Txt>
              </View>
            </View>
          ))}
          <Button
            title="Get started"
            icon="arrow-forward"
            onPress={() => {
              void start().catch(handleError);
            }}
          />
          <Txt muted style={{ fontSize: 10, textAlign: "center" }}>
            You review and send. Nothing is automatically reported.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}
