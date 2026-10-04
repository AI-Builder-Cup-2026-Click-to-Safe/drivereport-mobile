import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  Badge,
  Button,
  C,
  Card,
  Icon,
  Label,
  Notice,
  s,
  Screen,
  Txt,
} from "../../components/ui";
import { IncidentRow } from "../../components/IncidentRow";
import { useStore } from "../../lib/store";
export default function Dashboard() {
  const { records, settings, active, error } = useStore();
  const stats = [
    { value: records.length, label: "Clips saved", color: C.cyan },
    {
      value: records.filter((i) => i.result?.reportable.length && !i.reportedAt)
        .length,
      label: "To review",
      color: C.amber,
    },
    {
      value: records.filter((i) => i.reportedAt).length,
      label: "Reported",
      color: C.green,
    },
  ];
  return (
    <Screen
      title="Driver Sentinel"
      subtitle="YOUR EVERYDAY ROAD COMPANION"
      right={
        <Badge
          text={settings.token ? "CLOUD SET" : "LOCAL"}
          color={settings.token ? C.green : C.muted}
        />
      }
    >
      {error ? <Notice error>{error}</Notice> : null}
      <Card style={{ borderColor: "#174853" }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <View style={s.row}>
            <Icon name="shield-checkmark-outline" />
            <Txt style={{ fontWeight: "700" }}>AI Sentinel Monitor</Txt>
          </View>
          <Badge text={active ? "REVIEWING" : "STANDBY"} />
        </View>
        <View style={{ alignItems: "center", padding: 22 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: "#225361",
              borderRadius: 50,
              padding: 23,
              backgroundColor: "#102a34",
            }}
          >
            <Icon name="scan-outline" size={42} />
          </View>
        </View>
        <Txt
          muted
          style={{ textAlign: "center", fontSize: 12, lineHeight: 20 }}
        >
          Capture a short incident or import your dashcam footage. AI reviews it
          after upload.
        </Txt>
        <Button
          title="Launch Active Dashcam"
          icon="videocam-outline"
          kind="outline"
          onPress={() => router.push("/(tabs)/capture")}
        />
      </Card>
      <View style={{ flexDirection: "row", gap: 9 }}>
        {stats.map((v) => (
          <View
            key={v.label}
            style={{
              flex: 1,
              paddingVertical: 17,
              paddingHorizontal: 8,
              borderRadius: 12,
              backgroundColor: C.card,
              borderColor: C.line,
              borderWidth: 1,
            }}
          >
            <Txt
              style={{
                fontSize: 27,
                fontWeight: "700",
                color: v.color,
                lineHeight: 33,
              }}
            >
              {v.value}
            </Txt>
            <Txt muted style={{ fontSize: 10 }}>
              {v.label}
            </Txt>
          </View>
        ))}
      </View>
      <View>
        <View
          style={[s.row, { justifyContent: "space-between", marginBottom: 8 }]}
        >
          <Txt style={s.section}>Recent evidence</Txt>
          <Pressable onPress={() => router.push("/(tabs)/history")}>
            <Txt style={{ color: C.cyan, fontSize: 11 }}>View all →</Txt>
          </Pressable>
        </View>
        {records.length ? (
          records.slice(0, 4).map((i) => <IncidentRow key={i.id} item={i} />)
        ) : (
          <Card>
            <Icon name="folder-open-outline" size={28} />
            <Txt style={{ fontWeight: "600" }}>Your evidence starts here</Txt>
            <Txt muted style={{ fontSize: 12 }}>
              Import a video to get a timestamped AI review and prepare your
              first report.
            </Txt>
            <Button
              title="Import a video"
              onPress={() => router.push("/(tabs)/capture")}
            />
          </Card>
        )}
      </View>
      <View style={s.row}>
        <Icon name="lock-closed-outline" size={15} color={C.muted} />
        <Label>Profile stays on this device</Label>
      </View>
    </Screen>
  );
}
