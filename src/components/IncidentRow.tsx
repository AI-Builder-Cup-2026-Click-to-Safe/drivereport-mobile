import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import { findingTitle, Incident, statusLabel } from "../lib/domain";
import { Badge, C, Icon, s, Txt } from "./ui";
export function IncidentRow({ item }: { item: Incident }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name}`}
      onPress={() => router.push(`/evidence/${item.id}`)}
      style={{
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.line,
        gap: 10,
      }}
    >
      <View style={s.row}>
        {item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={{ width: 62, height: 51, borderRadius: 8 }}
          />
        ) : (
          <View
            style={{
              width: 62,
              height: 51,
              backgroundColor: C.card,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
            }}
          >
            <Icon name="videocam-outline" />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Txt style={{ fontWeight: "600", fontSize: 13 }}>
            {item.result?.reportable[0]
              ? findingTitle(item.result.reportable[0])
              : item.name}
          </Txt>
          <Txt muted style={{ fontSize: 10 }}>
            {new Date(item.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}{" "}
            · {item.plate || "Plate not entered"}
          </Txt>
        </View>
        <Icon name="chevron-forward" size={16} color={C.muted} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Badge
          text={statusLabel(item)}
          color={
            item.stage === "error" ? C.red : item.reportedAt ? C.green : C.cyan
          }
        />
        {Boolean(item.result?.reportable.length) && (
          <Txt style={{ fontSize: 10, color: C.amber }}>
            {Math.round(item.result!.reportable[0].confidence * 100)}% AI
            confidence
          </Txt>
        )}
      </View>
    </Pressable>
  );
}
