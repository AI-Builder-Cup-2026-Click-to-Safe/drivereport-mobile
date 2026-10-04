import { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Sharing from "expo-sharing";
import {
  Badge,
  Button,
  C,
  Card,
  Divider,
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
import { buildDraft, findingTitle, Incident, timecode } from "../../lib/domain";

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{
        width: "100%",
        height: 220,
        borderRadius: 13,
        backgroundColor: "#030609",
      }}
      nativeControls
      contentFit="contain"
    />
  );
}
function Evidence({ incident: i }: { incident: Incident }) {
  const store = useStore(),
    [plate, setPlate] = useState(i.plate),
    [location, setLocation] = useState(i.location),
    [occurredAt, setOccurredAt] = useState(i.occurredAt),
    [busy, setBusy] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    i.selectedVehicleId ||
      (new Set(i.result?.reportable.map((f) => f.vehicle_id)).size === 1
        ? i.result?.reportable[0]?.vehicle_id
        : "") ||
      "",
  );
  const selected =
    selectedVehicleId ||
    (new Set(i.result?.reportable.map((f) => f.vehicle_id)).size === 1
      ? i.result?.reportable[0]?.vehicle_id
      : "") ||
    "";
  const inProgress = store.active === i.id;
  const draft = async () => {
    setBusy(true);
    try {
      const next = {
        ...i,
        plate,
        location,
        occurredAt,
        selectedVehicleId: selected,
      };
      const text = buildDraft(next, store.settings);
      await store.update(i.id, {
        plate,
        location,
        occurredAt,
        selectedVehicleId: selected,
        draft: text,
      });
      router.push(`/filing/${i.id}`);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Evidence File"
      subtitle={i.id}
      back
      right={<Badge text={i.stage === "ready" ? "REVIEWED" : "EVIDENCE"} />}
    >
      <Player uri={i.file} />
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Txt muted style={{ flex: 1, fontSize: 11 }}>
          {i.name}
        </Txt>
        <Badge
          text={`${(i.size / 1024 / 1024).toFixed(1)} MB`}
          color={C.muted}
        />
      </View>
      {(i.stage === "queued" || i.stage === "error") && (
        <Card>
          {i.error && <Notice error>{i.error}</Notice>}
          <Txt style={s.section}>
            {i.stage === "error" ? "Ready to try again" : "Ready for AI review"}
          </Txt>
          <Txt muted style={{ fontSize: 12 }}>
            Upload this clip to your GCP server for video observation, legal
            research and a final review. Keep the app open while it runs.
          </Txt>
          {!store.settings.token && (
            <Button
              title="Configure cloud connection"
              kind="outline"
              onPress={() => router.push("/(tabs)/settings")}
            />
          )}
          <Button
            title={i.remoteUri ? "Retry AI review" : "Upload & analyse video"}
            icon="sparkles-outline"
            disabled={Boolean(store.active) || !store.settings.token}
            onPress={() => {
              void store.analyse(i.id).catch(handleError);
            }}
          />
        </Card>
      )}
      {inProgress && (
        <Card>
          <View style={s.row}>
            <ActivityIndicator color={C.cyan} />
            <Txt style={{ fontWeight: "700" }}>
              {i.stage === "uploading"
                ? `Uploading · ${Math.round(store.progress * 100)}%`
                : "AI agents are reviewing"}
            </Txt>
          </View>
          <View
            style={{
              height: 4,
              borderRadius: 3,
              backgroundColor: C.line,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 4,
                width: `${i.stage === "uploading" ? Math.max(2, store.progress * 100) : 100}%`,
                backgroundColor: C.cyan,
              }}
            />
          </View>
          <Txt muted style={{ fontSize: 12 }}>
            Video observations → legal references → final review{`\n`}
            {i.stage === "reviewing"
              ? "The server returns all results together. This can take a few minutes."
              : "Sending the video securely to Cloud Storage."}
          </Txt>
          <Button title="Stop waiting" kind="outline" onPress={store.cancel} />
        </Card>
      )}
      {i.result && (
        <>
          <Card>
            <View style={s.row}>
              <Icon
                name={
                  i.result.reportable.length
                    ? "alert-circle-outline"
                    : "checkmark-circle-outline"
                }
                color={i.result.reportable.length ? C.amber : C.green}
              />
              <Label>
                {i.result.reportable.length
                  ? `${i.result.reportable.length} potential violation${i.result.reportable.length === 1 ? "" : "s"}`
                  : "No reportable findings"}
              </Label>
            </View>
            <Txt style={{ fontSize: 13, lineHeight: 22 }}>
              {i.result.verdict || "Review completed."}
            </Txt>
            {i.result.follow_up_exhausted && (
              <Notice error>
                The AI still had outstanding questions when review ended. Check
                the footage carefully before reporting.
              </Notice>
            )}
          </Card>
          {i.result.reportable.map((f, n) => (
            <Card key={`${f.vehicle_id}-${n}`}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Badge text={`VEHICLE ${f.vehicle_id}`} color={C.muted} />
                <Badge
                  text={`${Math.round(f.confidence * 100)}% CONFIDENCE`}
                  color={C.amber}
                />
              </View>
              <Txt style={{ fontSize: 21, fontWeight: "700", lineHeight: 28 }}>
                {findingTitle(f)}
              </Txt>
              <Txt style={{ fontSize: 13, lineHeight: 21 }}>{f.conduct}</Txt>
              <Txt muted style={{ fontSize: 12 }}>
                {f.appearance || "Appearance not specified"} ·{" "}
                {timecode(f.start_seconds)}–{timecode(f.end_seconds)}
              </Txt>
              <Divider />
              <Label>AI-cited legal basis</Label>
              <Txt style={{ fontSize: 12 }}>{f.legal_basis}</Txt>
              {f.penalty ? (
                <Txt muted style={{ fontSize: 12 }}>
                  {f.penalty}
                </Txt>
              ) : null}
              <Txt muted style={{ fontSize: 12 }}>
                {f.reasoning}
              </Txt>
            </Card>
          ))}
          {i.result.evidence.timeline.length > 0 && (
            <Card>
              <Txt style={s.section}>Evidence timeline</Txt>
              {i.result.evidence.timeline.map((e, n) => (
                <View key={n} style={[s.row, { alignItems: "flex-start" }]}>
                  <Txt style={{ color: C.cyan, fontSize: 11, width: 39 }}>
                    {timecode(e.start_seconds)}
                  </Txt>
                  <Txt muted style={{ flex: 1, fontSize: 12 }}>
                    {e.event}
                  </Txt>
                </View>
              ))}
            </Card>
          )}
          {Boolean(i.result.reportable.length) && (
            <>
              <Card>
                <View style={s.row}>
                  <Icon name="location-outline" />
                  <Txt style={s.section}>Complete the evidence</Txt>
                </View>
                <Txt muted style={{ fontSize: 12 }}>
                  Verify the vehicle plate in the clip. Add where and when the
                  incident actually happened.
                </Txt>
                {Array.from(
                  new Set(i.result.reportable.map((f) => f.vehicle_id)),
                ).map((id) => (
                  <Button
                    key={id}
                    title={`${selected === id ? "✓ " : ""}Report vehicle ${id}`}
                    kind={selected === id ? "primary" : "outline"}
                    onPress={() => {
                      setSelectedVehicleId(id);
                      if (selected !== id) setPlate("");
                    }}
                  />
                ))}
                <Field
                  label="Vehicle plate"
                  value={plate}
                  onChangeText={setPlate}
                  placeholder="Enter verified plate"
                  autoCapitalize="characters"
                />
                <Field
                  label="Incident location"
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Road, direction, city"
                />
                <Field
                  label="Incident date & time"
                  value={occurredAt}
                  onChangeText={setOccurredAt}
                  placeholder="e.g. 3 Oct 2026, 14:35 MYT"
                />
              </Card>
              <Button
                title={
                  i.draft ? "Update report draft" : "Prepare WhatsApp report"
                }
                icon="logo-whatsapp"
                kind="green"
                busy={busy}
                onPress={() => {
                  void draft();
                }}
              />
              {i.draft && (
                <Button
                  title="View filing status"
                  kind="outline"
                  onPress={() => router.push(`/filing/${i.id}`)}
                />
              )}
              <Notice>
                AI results are review suggestions. Confirm the plate, location
                and incident before sharing. Nothing is sent automatically.
              </Notice>
            </>
          )}
        </>
      )}
      <Button
        title="Share video evidence"
        icon="share-outline"
        kind="outline"
        onPress={() => {
          void Sharing.shareAsync(i.file, {
            mimeType: i.mime,
            dialogTitle: "Share original video evidence",
          }).catch(handleError);
        }}
      />
      <Button
        title="Delete local evidence"
        kind="outline"
        disabled={inProgress}
        onPress={() =>
          Alert.alert(
            "Delete this clip?",
            "This removes the clip and its review from this device. Uploaded Cloud Storage copies are not deleted.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                  void store
                    .remove(i.id)
                    .then(() => router.replace("/(tabs)/history"))
                    .catch(handleError);
                },
              },
            ],
          )
        }
      />
    </Screen>
  );
}
export default function EvidenceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, ready } = useStore();
  const i = records.find((r) => r.id === id);
  return i ? (
    <Evidence key={i.id} incident={i} />
  ) : (
    <Screen title="Evidence File" back>
      <Txt>
        {ready ? "This evidence is no longer available." : "Loading evidence…"}
      </Txt>
    </Screen>
  );
}
