import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, Switch, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import { useStore } from "../lib/store";
import { checkConnection } from "../lib/api";
import { hasBuiltInConnection, validateApiUrl } from "../lib/domain";
import { useRoad } from "./context";
import { Turn, FadeArrival } from "./motion";
import {
  Action,
  C,
  Field,
  Icon,
  Intro,
  Notice,
  Page,
  Quiet,
  Segments,
  T,
  go,
  showError,
  focusControl,
  styles as s,
} from "./ui";
import {
  defaultWhatsAppTestMessage,
  regionNames,
  whatsappTest,
  type Region,
} from "./model";
import { replayHomeEntrance } from "./home";
export { Review, Handoff } from "./review";
export {
  StandardHome as Home,
  StandardAnalysis as Analysis,
  StandardImpact as Impact,
} from "./standard";
export function Developer() {
  const rr = useRoad(),
    store = useStore();
  const [url, setUrl] = useState(store.settings.apiUrl),
    [token, setToken] = useState(store.settings.token),
    [reveal, setReveal] = useState(false),
    [chosen, setChosen] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [testNumber, setTestNumber] = useState(rr.prefs.testRecipient || "");
  const [testMessage, setTestMessage] = useState(
    rr.prefs.testMessage || defaultWhatsAppTestMessage,
  );
  const chooseRef = useRef<View>(null);
  const file = store.records.find((i) => i.id === chosen);
  const choose = async () => {
    setBusy(true);
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ["video/mp4", "video/quicktime", "video/webm"],
        copyToCacheDirectory: true,
      });
      if (r.canceled) return;
      const f = r.assets[0];
      const stat = await FS.getInfoAsync(f.uri);
      if (
        !stat.exists ||
        !stat.size ||
        stat.size > 300000000 ||
        !/\.(mp4|mov|webm)$/i.test(f.name)
      )
        throw Error(
          "Choose a playable MP4, MOV or WebM between 1 byte and 300 MB.",
        );
      setChosen(await store.importVideo(f.uri, f.name, f.mimeType));
      setMessage("");
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const analyse = () => {
    if (!chosen) return;
    if (!store.settings.token) {
      setMessage("Save your API access token first.");
      return;
    }
    void rr
      .setPrefs({ demo: false })
      .then(() => {
        go("analysis");
        void rr.begin([chosen]).catch(showError);
      })
      .catch(showError);
  };
  const openWhatsAppTest = async () => {
    setBusy(true);
    try {
      const number = testNumber.replace(/[\s()+-]/g, "");
      const link = whatsappTest(number, testMessage);
      await rr.setPrefs({ testRecipient: number, testMessage });
      await Linking.openURL(link);
      setMessage(
        "Test draft opened. Nothing is sent until you tap Send in WhatsApp.",
      );
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Developer options" nav={false}>
      <Intro
        title="Test WhatsApp"
        body="Enter your own number. I’ll open a harmless dummy draft so you can verify the handoff without creating a case."
      />
      <Field
        label="Test WhatsApp number"
        value={testNumber}
        onChangeText={setTestNumber}
        keyboardType="phone-pad"
        placeholder="Country code and phone number"
      />
      <Field
        label="Demo message"
        value={testMessage}
        onChangeText={setTestMessage}
        multiline
        placeholder="Write the message to open in WhatsApp"
      />
      <Action
        title="Open WhatsApp test draft"
        icon="MessageCircle"
        disabled={busy}
        onPress={() => void openWhatsAppTest()}
      />
      <Action
        title="Save test details"
        secondary
        onPress={() => {
          const number = testNumber.replace(/[\s()+-]/g, "");
          if (!/^[1-9]\d{7,14}$/.test(number))
            return showError(
              "Enter an international number including country code.",
            );
          if (!testMessage.trim()) return showError("Enter a test message.");
          void rr
            .setPrefs({ testRecipient: number, testMessage })
            .then(() =>
              setMessage(
                "Test number and message saved. Demo reports only go to this number.",
              ),
            )
            .catch(showError);
        }}
      />
      <T style={s.muted}>
        Synthetic demo reports never use the authority recipient.
      </T>
      <Intro
        title="Feed me the road drama."
        body="Give me a clip. I’ll do the detective shit."
      />
      <View
        style={{
          gap: 9,
          padding: 14,
          backgroundColor: C.peach,
          borderRadius: 10,
        }}
      >
        <T style={{ fontSize: 12 }}>
          Judges, small clips. Gemini bills us. We are really poor.
        </T>
        <T style={{ fontSize: 12 }}>
          ☀ Daylight footage works better. I’m not Batman.
        </T>
      </View>
      <Action
        controlRef={chooseRef}
        title="Choose video"
        secondary
        icon="Upload"
        disabled={busy}
        onPress={() => void choose()}
      />
      <T style={s.muted}>MP4, MOV or WebM · 300 MB max</T>
      {file && (
        <View style={s.card}>
          <T>{file.name}</T>
          <View style={s.row}>
            <T style={s.muted}>{(file.size / 1e6).toFixed(1)} MB · Ready</T>
            <Quiet
              title="Remove selection"
              icon="X"
              onPress={() => {
                setChosen("");
                focusControl(chooseRef);
              }}
            />
          </View>
        </View>
      )}
      <Action
        title="Analyse video"
        icon="ArrowRight"
        disabled={!file || busy || rr.job?.status === "running"}
        onPress={analyse}
      />
      <Action
        title="Use demo clip"
        secondary
        disabled={rr.job?.status === "running"}
        onPress={() =>
          void rr
            .seed()
            .then(() => {
              go("analysis");
              void rr.begin([], true).catch(showError);
            })
            .catch(showError)
        }
      />
      {__DEV__ && (
        <Quiet
          title="Load 12-second test video"
          onPress={() => {
            if (busy || rr.job?.status === "running") return;
            setBusy(true);
            void store
              .importSample()
              .then((id) => {
                setChosen(id);
                setMessage(
                  "Real test footage loaded. Analyse video sends it to the configured AI server; this is not a simulated result.",
                );
              })
              .catch(showError)
              .finally(() => setBusy(false));
          }}
        />
      )}
      {__DEV__ && (
        <Quiet title="Replay Home entrance" onPress={replayHomeEntrance} />
      )}
      <T style={s.section}>Backend settings</T>
      {hasBuiltInConnection ? (
        <Notice>AI analysis is ready. No access token setup is needed.</Notice>
      ) : (
        <>
          <Field
            label="Base URL"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          <View style={{ gap: 5 }}>
            <Field
              label="Access token"
              value={token}
              onChangeText={setToken}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Quiet
              title={reveal ? "Hide access token" : "Show access token"}
              icon={reveal ? "EyeOff" : "Eye"}
              onPress={() => setReveal(!reveal)}
            />
          </View>
          <Action
            title="Save connection"
            secondary
            onPress={() =>
              void Promise.resolve()
                .then(() =>
                  store.saveSettings({
                    ...store.settings,
                    apiUrl: validateApiUrl(url.trim()),
                    token: token.trim(),
                  }),
                )
                .then(() => setMessage("Connection saved securely."))
                .catch(showError)
            }
          />
        </>
      )}
      <Quiet
        title="Check URL"
        onPress={() =>
          void checkConnection({
            ...store.settings,
            apiUrl: hasBuiltInConnection ? store.settings.apiUrl : url,
          })
            .then(setMessage)
            .catch(showError)
        }
      />
      {message && <Notice>{message}</Notice>}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Demo dataset</T>
          <T style={s.muted}>Synthetic cases · no Gemini bill</T>
        </View>
        <Switch
          accessibilityLabel="Demo dataset"
          value={rr.prefs.demo}
          onValueChange={(v) =>
            void (v ? rr.seed() : rr.setPrefs({ demo: false })).catch(showError)
          }
        />
      </View>
      <T style={s.muted}>
        {rr.prefs.demo
          ? "Demo cases and motion previews are separate from your real footage."
          : "Live GCP connection. Analysis stages are displayed only when confirmed by the server."}
      </T>
      {store.records
        .filter((i) => i.stage === "queued" || i.stage === "error")
        .map((i) => (
          <View key={i.id} style={s.card}>
            <T>{i.name}</T>
            <T style={s.muted}>
              {i.error || "Saved recording awaiting analysis"}
            </T>
            <Action
              title="Review saved clip"
              secondary
              disabled={rr.job?.status === "running"}
              onPress={() => {
                setChosen(i.id);
                setMessage("Clip selected. Tap Analyse video to upload.");
              }}
            />
          </View>
        ))}
    </Page>
  );
}
export function Settings() {
  const rr = useRoad(),
    p = rr.prefs;
  const [recipient, setRecipient] = useState(p.recipients[p.region]),
    [open, setOpen] = useState(""),
    [message, setMessage] = useState("");
  const recipientRef = useRef<View>(null),
    personalRef = useRef<View>(null);
  const [personal, setPersonal] = useState({
    name: p.name,
    identity: p.identity,
    address: p.address,
    phone: p.phone,
    email: p.email,
    includePersonal: p.includePersonal,
  });
  const [saving, setSaving] = useState(false);
  const saveAndClose = (
    patch: Parameters<typeof rr.setPrefs>[0],
    ref: React.RefObject<View | null>,
    text: string,
  ) => {
    setSaving(true);
    void rr
      .setPrefs(patch)
      .then(() => {
        setOpen("");
        setMessage(text);
        focusControl(ref);
      })
      .catch(showError)
      .finally(() => setSaving(false));
  };
  useEffect(
    () => setRecipient(p.recipients[p.region]),
    [p.region, p.recipients],
  );
  const save = (patch: Parameters<typeof rr.setPrefs>[0]) =>
    void rr.setPrefs(patch).catch(showError);
  return (
    <Page title="Settings" nav={false}>
      <T style={s.section}>Reporting</T>
      <Pressable
        accessibilityRole="button"
        ref={recipientRef}
        accessibilityState={{ expanded: open === "recipient" }}
        accessibilityLabel="Authority WhatsApp"
        onPress={() => setOpen(open === "recipient" ? "" : "recipient")}
        style={s.row}
      >
        <Icon name="MessageCircle" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Authority WhatsApp</T>
          <T style={s.muted}>
            {p.recipients[p.region]
              ? `+${p.recipients[p.region]}`
              : "Add a number for this region"}
          </T>
        </View>
        <Turn open={open === "recipient"}>
          <Icon name="ChevronRight" />
        </Turn>
      </Pressable>
      {open === "recipient" && (
        <FadeArrival distance={8}>
          <View style={{ gap: 12 }}>
            <Field
              label="Recipient number"
              value={recipient}
              onChangeText={setRecipient}
              keyboardType="phone-pad"
            />
            <Action
              title="Save recipient"
              disabled={saving}
              secondary
              onPress={() => {
                const n = recipient.replace(/[\s()+-]/g, "");
                if (!/^[1-9]\d{7,14}$/.test(n)) {
                  setMessage(
                    "Enter an international number including country code.",
                  );
                  return;
                }
                saveAndClose(
                  { recipients: { ...p.recipients, [p.region]: n } },
                  recipientRef,
                  "Recipient saved for " + regionNames[p.region] + ".",
                );
              }}
            />
            <T style={s.muted}>
              I’ll use this for {regionNames[p.region]} drafts. Malaysia’s
              default is the supplied demo number.
            </T>
          </View>
        </FadeArrival>
      )}
      <Pressable
        accessibilityRole="button"
        ref={personalRef}
        accessibilityState={{ expanded: open === "personal" }}
        accessibilityLabel="Your details"
        onPress={() => setOpen(open === "personal" ? "" : "personal")}
        style={s.row}
      >
        <Icon name="UserRound" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Your details</T>
          <T style={s.muted}>Optional · fill them in WhatsApp</T>
        </View>
        <Turn open={open === "personal"}>
          <Icon name="ChevronRight" />
        </Turn>
      </Pressable>
      {open === "personal" && (
        <FadeArrival distance={8}>
          <View style={{ gap: 15 }}>
            {(
              [
                ["name", "Full name"],
                ["identity", "Identity number"],
                ["address", "Postal address"],
                ["phone", "Phone"],
                ["email", "Email"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={personal[key]}
                onChangeText={(v) =>
                  setPersonal((current) => ({ ...current, [key]: v }))
                }
              />
            ))}
            <View style={s.row}>
              <T style={{ flex: 1 }}>Add your details to report drafts</T>
              <Switch
                accessibilityLabel="Add your details to report drafts"
                value={personal.includePersonal}
                onValueChange={(v) =>
                  setPersonal((current) => ({ ...current, includePersonal: v }))
                }
              />
            </View>
            <Action
              title="Save details"
              secondary
              disabled={saving}
              onPress={() =>
                saveAndClose(
                  personal,
                  personalRef,
                  "Your details are saved securely on this device.",
                )
              }
            />
            <T style={s.muted}>Saved securely on this device.</T>
          </View>
        </FadeArrival>
      )}
      <T style={s.section}>Preferences</T>
      <T style={{ fontWeight: "600" }}>Region</T>
      <Segments
        items={["Malaysia", "Singapore", "Japan"]}
        value={(["MY", "SG", "JP"] as Region[]).indexOf(p.region)}
        onChange={(i) => save({ region: (["MY", "SG", "JP"] as Region[])[i] })}
      />
      <T style={{ fontWeight: "600" }}>Language</T>
      <Segments
        items={["English (UK)", "English (US)"]}
        value={p.language === "en-GB" ? 0 : 1}
        onChange={(i) => save({ language: i ? "en-US" : "en-GB" })}
      />
      <View style={s.row}>
        <Icon name="Eye" />
        <T style={{ flex: 1, fontWeight: "600" }}>Reduce motion</T>
        <Switch
          accessibilityLabel="Reduce motion"
          value={p.reduced}
          onValueChange={(v) => save({ reduced: v })}
        />
      </View>
      <T style={s.section}>Footage</T>
      <View style={s.row}>
        <Icon name="Video" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "600" }}>Keep original recordings</T>
          <T style={s.muted}>Original clips stay on this device.</T>
        </View>
        <Icon name="Check" />
      </View>
      <View style={s.row}>
        <Icon name="UserRound" />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "600" }}>Blur unrelated faces</T>
          <T style={s.muted}>
            Unavailable until annotated evidence is connected.
          </T>
        </View>
      </View>
      {message && <Notice>{message}</Notice>}
      <Quiet
        title="Developer"
        icon="Settings"
        onPress={() => go("developer")}
      />
      <T style={[s.muted, { textAlign: "center" }]}>
        I do the boring shit. You tap Send.
      </T>
    </Page>
  );
}
