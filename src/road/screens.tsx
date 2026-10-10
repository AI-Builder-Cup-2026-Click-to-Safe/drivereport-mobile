import React, { useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Linking,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Arrival } from "./standard-ui";
import * as DocumentPicker from "expo-document-picker";
import Constants from "expo-constants";
import * as Device from "expo-device";
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
  T,
  Toggle,
  go,
  notify,
  showError,
  focusControl,
  styles as s,
} from "./ui";
import {
  defaultWhatsAppTestMessage,
  regionNames,
  whatsappTest,
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
        title="Analyse with Gemini"
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
          title="Load sample video"
          onPress={() => {
            if (busy || rr.job?.status === "running") return;
            setBusy(true);
            void store
              .importSample({ fresh: true })
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
        <Toggle
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
                setMessage("Clip selected. Tap Analyse with Gemini to upload.");
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
  const [versionTaps, setVersionTaps] = useState(0);
  const developerVisible =
    __DEV__ || !Device.isDevice || p.developer || versionTaps >= 5;
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
  // Reference Settings: Reporting and Preferences groups of 60pt rows with hairlines.
  return (
    <Page title="Settings" nav={false} gap={0}>
      <SettingsGroup title="Reporting" index={0}>
        <SettingsRow
          controlRef={recipientRef}
          icon="MessageCircle"
          title={p.region === "MY" ? "Official JPJ WhatsApp" : "Authority WhatsApp"}
          note={
            p.region === "MY"
              ? "+60 13-449 8997"
              : p.recipients[p.region]
                ? `+${p.recipients[p.region]}`
                : "Add a number for this region"
          }
          open={open === "recipient"}
          onPress={() => setOpen(open === "recipient" ? "" : "recipient")}
        />
        {open === "recipient" && (
          <FadeArrival distance={8}>
            <View style={{ gap: 8, paddingTop: 4, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line }}>
              {p.region === "MY" ? (
                <>
                  <Notice>
                    Live Malaysia reports open a draft to JPJ’s traffic-offence
                    WhatsApp hotline, +60 13-449 8997. Nothing is sent until you
                    tap Send in WhatsApp.
                  </Notice>
                  <T style={setNote}>
                    The draft includes the Case facts and evidence links. JPJ may
                    require your full name, identity number, postal address and
                    phone number to investigate the complaint.
                  </T>
                </>
              ) : (
                <>
                  <Field
                    label="Recipient number"
                    value={recipient}
                    onChangeText={setRecipient}
                    keyboardType="phone-pad"
                    placeholder="Country code + number"
                  />
                  <Action
                    title="Save recipient"
                    icon="Check"
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
                  <T style={setNote}>
                    Real reports open WhatsApp at this number. Sample clips never do.
                  </T>
                </>
              )}
            </View>
          </FadeArrival>
        )}
        <SettingsRow
          controlRef={personalRef}
          icon="UserRound"
          title="Your details"
          note={
            p.includePersonal && p.name ? p.name : "Optional · fill them in WhatsApp"
          }
          open={open === "personal"}
          onPress={() => setOpen(open === "personal" ? "" : "personal")}
        />
        {open === "personal" && (
          <FadeArrival distance={8}>
            <View style={{ gap: 12, paddingTop: 4, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line }}>
              {(
                [
                  ["name", "Full name", "Your full name"],
                  ["identity", "Identity number", "ID or passport number"],
                  ["address", "Postal address", "Your postal address"],
                  ["phone", "Phone", "Your phone number"],
                  ["email", "Email", "Your email address"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <Field
                  key={key}
                  label={label}
                  placeholder={placeholder}
                  value={personal[key]}
                  onChangeText={(v) =>
                    setPersonal((current) => ({ ...current, [key]: v }))
                  }
                />
              ))}
              <View style={[s.row, { minHeight: 44 }]}>
                <T style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>
                  Add my details to drafts
                </T>
                <Toggle
                  accessibilityLabel="Add my details to drafts"
                  value={personal.includePersonal}
                  onValueChange={(v) =>
                    setPersonal((current) => ({ ...current, includePersonal: v }))
                  }
                />
              </View>
              <Action
                title="Save details"
                icon="Check"
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
              <T style={setNote}>
                Saved securely on this device. Leave it empty and fill it in WhatsApp.
              </T>
            </View>
          </FadeArrival>
        )}
      </SettingsGroup>
      <SettingsGroup title="Preferences" index={1}>
        <SettingsRow
          icon="Globe"
          title="Region"
          note={
            p.region === "MY"
              ? "Malaysian law · reports go to JPJ"
              : "Live analysis supports Malaysia only"
          }
          onPress={() => {
            if (Platform.OS === "ios")
              ActionSheetIOS.showActionSheetWithOptions(
                {
                  options: [...REGIONS.map((r) => regionNames[r]), "Cancel"],
                  cancelButtonIndex: REGIONS.length,
                },
                (i) => i < REGIONS.length && save({ region: REGIONS[i] }),
              );
            else
              save({
                region: REGIONS[(REGIONS.indexOf(p.region) + 1) % REGIONS.length],
              });
          }}
          trailing={<SelectPill label={regionNames[p.region]} />}
        />
        <SettingsRow
          icon="Languages"
          title="English format"
          note={p.language === "en-GB" ? "Dates read as 3 Oct" : "Dates read as Oct 3"}
          onPress={() => {
            const options = ["English (UK)", "English (US)"];
            if (Platform.OS === "ios")
              ActionSheetIOS.showActionSheetWithOptions(
                { options: [...options, "Cancel"], cancelButtonIndex: 2 },
                (i) => i < 2 && save({ language: i ? "en-US" : "en-GB" }),
              );
            else save({ language: p.language === "en-GB" ? "en-US" : "en-GB" });
          }}
          trailing={
            <SelectPill label={p.language === "en-GB" ? "English (UK)" : "English (US)"} />
          }
        />
        <SettingsRow
          icon="Eye"
          title="Reduce motion"
          note="Skip the theatrics"
          trailing={
            <Toggle
              accessibilityLabel="Reduce motion"
              value={p.reduced}
              onValueChange={(v) => save({ reduced: v })}
            />
          }
        />
      </SettingsGroup>
      {message && (
        <View style={{ marginTop: 16 }}>
          <Notice>{message}</Notice>
        </View>
      )}
      <View style={{ marginTop: 18, alignItems: "center", gap: 2 }}>
        {developerVisible && (
          <Quiet title="Developer" icon="Settings" onPress={() => go("developer")} />
        )}
        {/* Five taps unlock Developer on release builds, the way iOS hides build tools. */}
        <Pressable
          accessibilityRole="text"
          accessibilityLabel={`Version ${appVersion}`}
          onPress={() => {
            const taps = versionTaps + 1;
            setVersionTaps(taps);
            if (taps === 5 && !p.developer) {
              void rr.setPrefs({ developer: true }).catch(showError);
              notify("Developer settings unlocked.");
            }
          }}
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}
        >
          <T style={{ fontSize: 13, lineHeight: 16, color: C.muted }}>
            Version {appVersion}
          </T>
        </Pressable>
      </View>
    </Page>
  );
}
const setNote = { fontSize: 13, lineHeight: 19, color: C.muted };
const REGIONS = ["MY", "SG", "JP"] as const;
/** The current choice of a Settings row that opens an action sheet. */
function SelectPill({ label }: { label: string }) {
  return (
    <View
      style={{
        minHeight: 44,
        paddingLeft: 14,
        paddingRight: 11,
        borderRadius: 999,
        backgroundColor: C.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <T style={{ fontSize: 14, lineHeight: 18, fontWeight: "600" }}>{label}</T>
      <View style={{ transform: [{ rotate: "90deg" }] }}>
        <Icon name="ChevronRight" size={14} strokeWidth={2.4} />
      </View>
    </View>
  );
}
const appVersion = `${Constants.expoConfig?.version ?? "1.0.0"} (${Constants.expoConfig?.ios?.buildNumber ?? "1"})`;
function SettingsGroup({
  title,
  index,
  children,
}: React.PropsWithChildren<{ title: string; index: number }>) {
  return (
    <Arrival delay={60 + index * 60} distance={10}>
      <View style={{ marginTop: 20 }}>
        <T
          accessibilityRole="header"
          style={{ marginBottom: 2, fontSize: 15, lineHeight: 18, fontWeight: "800" }}
        >
          {title}
        </T>
        {children}
      </View>
    </Arrival>
  );
}
function SettingsRow({
  icon,
  title,
  note,
  open,
  trailing,
  onPress,
  controlRef,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  note: string;
  open?: boolean;
  trailing?: React.ReactNode;
  onPress?: () => void;
  controlRef?: React.Ref<View>;
}) {
  const Row = onPress ? Pressable : View;
  return (
    <Row
      ref={controlRef}
      {...(onPress
        ? {
            onPress,
            accessibilityRole: "button" as const,
            accessibilityLabel: title,
            accessibilityState: open === undefined ? undefined : { expanded: open },
          }
        : {})}
      style={{
        minHeight: 60,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: open ? 0 : 1,
        borderColor: C.line,
      }}
    >
      <Icon name={icon} size={20} />
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 16, lineHeight: 19, fontWeight: "700" }}>{title}</T>
        <T style={{ marginTop: 3, fontSize: 13, lineHeight: 17, color: C.muted }}>{note}</T>
      </View>
      {trailing ??
        (open !== undefined && (
          <Turn open={open}>
            <Icon name="ChevronRight" size={20} />
          </Turn>
        ))}
    </Row>
  );
}
