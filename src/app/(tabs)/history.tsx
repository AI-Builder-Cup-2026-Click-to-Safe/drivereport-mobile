import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { IncidentRow } from "../../components/IncidentRow";
import { Badge, C, Card, Icon, Screen, Txt } from "../../components/ui";
import { useStore } from "../../lib/store";
export default function History() {
  const { records } = useStore();
  const [filter, setFilter] = useState("All filings");
  const filtered = records.filter(
    (i) =>
      filter === "All filings" ||
      (filter === "To review"
        ? i.result?.reportable.length && !i.reportedAt
        : filter === "Reported"
          ? i.reportedAt
          : i.stage === "error"),
  );
  return (
    <Screen
      title="Filing History"
      subtitle="YOUR EVIDENCE VAULT"
      right={<Badge text={`${records.length} CLIPS`} />}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {["All filings", "To review", "Reported", "Needs attention"].map(
          (f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingVertical: 9,
                paddingHorizontal: 13,
                borderRadius: 8,
                backgroundColor: filter === f ? "#133640" : C.card,
                borderWidth: 1,
                borderColor: filter === f ? C.cyan : C.line,
              }}
            >
              <Txt
                style={{ fontSize: 11, color: filter === f ? C.cyan : C.muted }}
              >
                {f}
              </Txt>
            </Pressable>
          ),
        )}
      </ScrollView>
      <View>
        {filtered.map((i) => (
          <IncidentRow key={i.id} item={i} />
        ))}
        {!filtered.length && (
          <Card>
            <Icon name="documents-outline" size={32} />
            <Txt>No filings here yet</Txt>
            <Txt muted style={{ fontSize: 12 }}>
              Saved clips and reviews appear here, including any uploads that
              need a retry.
            </Txt>
          </Card>
        )}
      </View>
      <Txt muted style={{ fontSize: 11 }}>
        “Reported” is your own confirmation. Authority delivery and case
        decisions are not tracked by this app.
      </Txt>
    </Screen>
  );
}
