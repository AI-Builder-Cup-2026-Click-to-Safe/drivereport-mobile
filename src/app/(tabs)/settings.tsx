import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
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
  Screen,
  Txt,
} from "../../components/ui";
import { useStore } from "../../lib/store";
import { checkConnection } from "../../lib/api";
import { validateApiUrl } from "../../lib/domain";
export default function SettingsScreen() {
  const { settings, saveSettings, records, active } = useStore();
  const [form, setForm] = useState(settings),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    setForm(settings);
  }, [settings]);
  const field = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const save = async () => {
    setBusy(true);
    try {
      const next = {
        ...form,
        apiUrl: validateApiUrl(form.apiUrl),
        token: form.token.trim(),
      };
      await saveSettings(next);
      Alert.alert(
        "Settings saved",
        "Connection and profile are stored securely on this device.",
      );
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Settings" subtitle="YOUR PROFILE & CONNECTION">
      <Card>
        <View style={{ alignItems: "center", gap: 9 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "#183342",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="person-outline" size={30} />
          </View>
          <Txt style={{ fontWeight: "700", fontSize: 19 }}>
            {settings.name || "Your driver profile"}
          </Txt>
          <Badge text="STORED ON THIS DEVICE" color={C.green} />
        </View>
      </Card>
      <View>
        <Label>Personal details · optional</Label>
        <View style={{ height: 17 }} />
        <Field
          label="Full name"
          value={form.name}
          onChangeText={field("name")}
          placeholder="Your name"
          textContentType="name"
        />
        <Field
          label="Your mobile number"
          value={form.phone}
          onChangeText={field("phone")}
          placeholder="+60 …"
          keyboardType="phone-pad"
        />
        <Field
          label="Address · optional"
          value={form.address}
          onChangeText={field("address")}
          placeholder="Only include if required for your report"
          maxLength={300}
          multiline
        />
        <Field
          label="Identity number · optional"
          value={form.identityNumber}
          onChangeText={field("identityNumber")}
          placeholder="Stored locally; included only in your draft"
          maxLength={30}
          autoCapitalize="characters"
        />
        <Field
          label="WhatsApp report recipient"
          value={form.recipient}
          onChangeText={field("recipient")}
          placeholder="International number, e.g. +60 …"
          keyboardType="phone-pad"
        />
        <Notice>
          Confirm the recipient with the relevant authority. Opening WhatsApp
          only prepares a message; you choose whether to send it.
        </Notice>
      </View>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt style={{ fontWeight: "700" }}>Cloud analysis</Txt>
          <Badge text="GCP" />
        </View>
        <Field
          label="Server URL"
          value={form.apiUrl}
          onChangeText={field("apiUrl")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Field
          label="API access token"
          value={form.token}
          onChangeText={field("token")}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Bearer token"
        />
        <Button
          title="Check server connection"
          kind="outline"
          busy={busy}
          onPress={() => {
            setBusy(true);
            void checkConnection(form)
              .then(setStatus)
              .catch(handleError)
              .finally(() => setBusy(false));
          }}
        />
        {status ? (
          <Txt style={{ color: C.green, fontSize: 12 }}>{status}</Txt>
        ) : null}
        <Txt muted style={{ fontSize: 11 }}>
          Videos are uploaded only when you start analysis. Your profile and API
          token are kept in device secure storage.
        </Txt>
      </Card>
      <Button
        title="Save settings"
        icon="checkmark-circle-outline"
        busy={busy}
        disabled={Boolean(active)}
        onPress={() => {
          void save();
        }}
      />
      <Card>
        <Txt style={{ fontWeight: "700" }}>Local evidence storage</Txt>
        <Txt muted>
          {records.length} clips ·{" "}
          {(records.reduce((n, i) => n + i.size, 0) / 1024 / 1024).toFixed(1)}{" "}
          MB
        </Txt>
        <Txt muted style={{ fontSize: 11 }}>
          Delete clips from their evidence screen. Local deletion does not
          delete videos already uploaded to Cloud Storage.
        </Txt>
      </Card>
      <Txt muted style={{ fontSize: 10, textAlign: "center" }}>
        DriveReport 1.0 · AI-assisted review{`\n`}Independent prototype. No
        authority delivery tracking.
      </Txt>
    </Screen>
  );
}
