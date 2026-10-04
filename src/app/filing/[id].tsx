import { useState } from "react";
import { Alert, Linking, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { router, useLocalSearchParams } from "expo-router";
import {
  Badge,
  Button,
  C,
  Card,
  Field,
  handleError,
  Icon,
  Label,
  Notice,
  s,
  Screen,
  Txt,
} from "../../components/ui";
import { useStore } from "../../lib/store";
import { findingTitle, Incident, whatsappUrl } from "../../lib/domain";
function Filing({ incident: i }: { incident: Incident }) {
  const { settings, update } = useStore(),
    [draft, setDraft] = useState(i.draft ?? ""),
    [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const url = whatsappUrl(settings.recipient, draft);
      await update(i.id, { draft });
      if (!(await Linking.canOpenURL(url)))
        throw new Error(
          "WhatsApp is not installed on this device. Copy the draft and share the video separately, or use a phone with WhatsApp.",
        );
      await Linking.openURL(url);
      await update(i.id, { openedAt: new Date().toISOString() });
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };
  const finding =
    i.result?.reportable.find((f) => f.vehicle_id === i.selectedVehicleId) ??
    i.result?.reportable[0];
  const steps = [
    {
      title: "Video reviewed by AI",
      done: Boolean(i.result),
      detail: "Video, legal references and final review complete.",
    },
    {
      title: "Report draft prepared",
      done: Boolean(i.draft),
      detail: "Editable draft stored on your device.",
    },
    {
      title: "Opened in WhatsApp",
      done: Boolean(i.openedAt),
      detail: i.openedAt
        ? new Date(i.openedAt).toLocaleString()
        : "You choose whether to send.",
    },
    {
      title: "Marked reported by you",
      done: Boolean(i.reportedAt),
      detail: i.reportedAt
        ? new Date(i.reportedAt).toLocaleString()
        : "No automatic delivery confirmation.",
    },
  ];
  return (
    <Screen
      title="Filing Status"
      subtitle={i.id}
      back
      right={
        <Badge
          text={i.reportedAt ? "REPORTED" : "DRAFT"}
          color={i.reportedAt ? C.green : C.amber}
        />
      }
    >
      <Card>
        <Label>Potential violation</Label>
        <Txt style={{ fontSize: 20, fontWeight: "700" }}>
          {finding ? findingTitle(finding) : "Road incident"}
        </Txt>
        <Txt muted>
          {i.plate} · {i.location}
        </Txt>
      </Card>
      <Card>
        {steps.map((step, n) => (
          <View key={step.title} style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ alignItems: "center", width: 23 }}>
              <Icon
                name={step.done ? "checkmark-circle" : "ellipse-outline"}
                color={step.done ? C.green : C.muted}
                size={22}
              />
              {n < steps.length - 1 && (
                <View
                  style={{
                    width: 1,
                    backgroundColor: C.line,
                    minHeight: 35,
                    flex: 1,
                  }}
                />
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: 18 }}>
              <Txt style={{ fontSize: 13, fontWeight: "600" }}>
                {step.title}
              </Txt>
              <Txt muted style={{ fontSize: 11 }}>
                {step.detail}
              </Txt>
            </View>
          </View>
        ))}
      </Card>
      <Card style={{ backgroundColor: "#10261f", borderColor: "#204737" }}>
        <View style={s.row}>
          <Icon name="logo-whatsapp" color={C.green} />
          <Txt style={{ fontWeight: "700" }}>Your message preview</Txt>
        </View>
        <Field
          label="Edit before sharing"
          value={draft}
          onChangeText={setDraft}
          multiline
          style={{ minHeight: 280, backgroundColor: "#0b1c16", lineHeight: 22 }}
        />
        <Button
          title="Save draft"
          kind="outline"
          disabled={!draft.trim()}
          onPress={() => {
            void update(i.id, { draft })
              .then(() => Alert.alert("Draft saved"))
              .catch(handleError);
          }}
        />
      </Card>
      {!settings.recipient && (
        <Button
          title="Set WhatsApp recipient"
          kind="outline"
          onPress={() => router.push("/(tabs)/settings")}
        />
      )}
      <Button
        title="Open WhatsApp draft"
        icon="logo-whatsapp"
        kind="green"
        busy={busy}
        disabled={!draft.trim()}
        onPress={() => {
          void open();
        }}
      />
      <Button
        title="Copy message"
        icon="copy-outline"
        kind="outline"
        disabled={!draft.trim()}
        onPress={() => {
          void Clipboard.setStringAsync(draft)
            .then(() => update(i.id, { draft }))
            .then(() =>
              Alert.alert(
                "Copied",
                "Paste the draft into your chosen conversation.",
              ),
            )
            .catch(handleError);
        }}
      />
      <Button
        title="Share video separately"
        icon="attach-outline"
        kind="outline"
        onPress={() => {
          void Sharing.shareAsync(i.file, { mimeType: i.mime }).catch(
            handleError,
          );
        }}
      />
      <Notice>
        Attach the original video in WhatsApp before sending. This app cannot
        confirm receipt or an authority’s decision.
      </Notice>
      <Button
        title={i.reportedAt ? "Undo reported status" : "I sent the report"}
        kind="outline"
        onPress={() =>
          Alert.alert(
            i.reportedAt ? "Remove your confirmation?" : "Confirm you sent it",
            "This only updates your local record.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Confirm",
                onPress: () => {
                  void update(i.id, {
                    reportedAt: i.reportedAt
                      ? undefined
                      : new Date().toISOString(),
                    draft,
                  }).catch(handleError);
                },
              },
            ],
          )
        }
      />
    </Screen>
  );
}
export default function FilingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records } = useStore();
  const i = records.find((v) => v.id === id);
  return i ? (
    <Filing key={i.id} incident={i} />
  ) : (
    <Screen title="Filing Status" back>
      <Txt>Filing not found.</Txt>
    </Screen>
  );
}
