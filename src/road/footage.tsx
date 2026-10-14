import React, { useEffect, useReducer, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, Easing, findNodeHandle, Pressable,
  StyleSheet, Text, View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRoad } from "./context";
import { C, T } from "./ui";
import { boundedFootageSeek, FOOTAGE_GRACE_MS, FOOTAGE_TIMEOUT_MS, footageState, initialFootageState } from "./footage-state";

type Props = {
  uri: string;
  seek: number;
  revision: number;
  onTime: (time: number) => void;
  caption?: string;
  onFailed?: () => void;
  /** Refresh signed links before retrying the same kind of evidence. */
  onRetry?: () => Promise<string>;
};

export function RealVideo(props: Props) {
  const [attempt, setAttempt] = useState({ number: 0, base: props.uri, uri: props.uri });
  const uri = attempt.base === props.uri ? attempt.uri : props.uri;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return (
    <FootagePlayer
      {...props}
      key={`${uri}:${attempt.number}`}
      uri={uri}
      retried={attempt.number > 0}
      retry={async () => {
        const uri = props.onRetry ? await props.onRetry() : props.uri;
        if (mounted.current) setAttempt((old) => ({ number: old.number + 1, base: props.uri, uri }));
      }}
    />
  );
}

function FootagePlayer({ uri, seek, revision, onTime, caption, onFailed, retry, retried }: Props & {
  retry: () => Promise<void>; retried: boolean;
}) {
  const { reduced, foreground } = useRoad();
  const focused = useIsFocused();
  const active = foreground && focused;
  const [state, dispatch] = useReducer(footageState, undefined, initialFootageState);
  const ready = state.phase === "ready";
  const failed = state.phase === "failed";
  const callback = useRef(onTime);
  callback.current = onTime;
  const failureHandled = useRef(false);
  const mounted = useRef(true);
  const statusRef = useRef<Text>(null);
  const videoRef = useRef<VideoView>(null);
  const focusAfterRetry = useRef(retried);
  const refreshing = useRef(false);
  // Passing a URL to the constructor performs a synchronous iOS source replacement.
  // The async path keeps the route and loader responsive while AVPlayer opens it.
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
    p.staysActiveInBackground = false;
  });
  useEffect(() => {
    mounted.current = true;
    const status = player.addListener("statusChange", ({ status }) => {
      if (!refreshing.current) dispatch({ type: "status", status });
    });
    const time = player.addListener("timeUpdate", ({ currentTime }) => callback.current(currentTime));
    void player.replaceAsync(uri).catch(() => {
      if (mounted.current) dispatch({ type: "failed" });
    });
    return () => {
      mounted.current = false;
      status.remove();
      time.remove();
    };
  }, [player, uri]);
  // Wait until the item is ready before seeking; an early seek can be lost on iOS.
  // Buffering must not repeat that seek or pause a video the user is playing.
  const appliedSeek = useRef("");
  useEffect(() => {
    const token = `${seek}:${revision}`;
    if (!state.playerReady || appliedSeek.current === token) return;
    appliedSeek.current = token;
    player.currentTime = boundedFootageSeek(seek, player.duration);
    player.pause();
  }, [player, state.playerReady, seek, revision]);
  useEffect(() => { if (!active || failed) player.pause(); }, [active, failed, player]);
  useEffect(() => {
    if (!active || state.phase !== "loading") return;
    const grace = setTimeout(() => dispatch({ type: "grace" }), FOOTAGE_GRACE_MS);
    const timeout = setTimeout(() => dispatch({ type: "failed" }), FOOTAGE_TIMEOUT_MS);
    return () => { clearTimeout(grace); clearTimeout(timeout); };
  }, [active, state.phase]);
  useEffect(() => {
    if (!failed || failureHandled.current || !onFailed) return;
    failureHandled.current = true;
    onFailed();
  }, [failed, onFailed]);

  const media = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const loader = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) {
      media.setValue(0);
      overlay.setValue(0);
      loader.setValue(state.showLoader ? 1 : 0);
      return;
    }
    if (reduced || !active || !state.showLoader) {
      media.setValue(1); overlay.setValue(1); loader.setValue(0);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(media, { toValue: 1, duration: 620, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true, isInteraction: false }),
      Animated.timing(overlay, { toValue: 1, duration: 300, useNativeDriver: true, isInteraction: false }),
      Animated.timing(loader, { toValue: 0, duration: 200, useNativeDriver: true, isInteraction: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, ready, reduced, state.showLoader, media, overlay, loader]);
  useEffect(() => {
    if (!active || !focusAfterRetry.current || (!ready && !state.showLoader)) return;
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(ready ? videoRef.current : statusRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
      if (ready) focusAfterRetry.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [active, ready, state.showLoader]);
  useEffect(() => {
    if (!active) return;
    if (failed) AccessibilityInfo.announceForAccessibility("The footage didn’t load. Try again.");
    else if (!ready && state.showLoader) AccessibilityInfo.announceForAccessibility("Loading the footage");
  }, [active, failed, ready, state.showLoader]);

  const tryAgain = async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    focusAfterRetry.current = true;
    dispatch({ type: "retry" });
    try { await retry(); }
    catch {
      refreshing.current = false;
      if (mounted.current) dispatch({ type: "failed" });
    }
  };
  return (
    <View testID="case-footage" accessibilityState={{ busy: state.phase === "loading" }} style={styles.frame}>
      <View style={styles.picture}>
        <Animated.View
          pointerEvents={ready ? "auto" : "none"}
          accessibilityElementsHidden={!ready}
          importantForAccessibility={ready ? "auto" : "no-hide-descendants"}
          style={[StyleSheet.absoluteFill, { opacity: media, transform: [{ scale: media.interpolate({ inputRange: [0, 1], outputRange: reduced ? [1, 1] : [1.04, 1] }) }] }]}
        >
          <VideoView
            ref={videoRef}
            testID="case-footage-video"
            accessibilityLabel="Footage playback controls"
            player={player}
            nativeControls={ready}
            contentFit="contain"
            onFirstFrameRender={() => { if (!refreshing.current) dispatch({ type: "frame" }); }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {!failed && (
          <Animated.View pointerEvents="none" accessibilityElementsHidden={ready} importantForAccessibility={ready ? "no-hide-descendants" : "auto"} style={[StyleSheet.absoluteFill, { opacity: loader }]}>
            <LoadingDashes active={active && !ready && state.showLoader} reduced={reduced} />
            <Text
              ref={statusRef}
              testID="case-footage-loading"
              accessibilityLiveRegion="polite"
              style={[styles.status, { position: "absolute", left: 12, right: 12, top: "50%", marginTop: 39 }]}
            >Loading the footage</Text>
          </Animated.View>
        )}
        {failed && (
          <View style={[StyleSheet.absoluteFill, styles.failure]}>
            <Text accessibilityLiveRegion="polite" testID="case-footage-error" style={styles.status}>The footage didn’t load.</Text>
            <Pressable testID="case-footage-retry" accessibilityRole="button" accessibilityLabel="Try loading the footage again" onPress={() => void tryAgain()} style={styles.retryTarget}>
              <View style={styles.retryPill}><T style={{ color: C.ink, fontSize: 12, lineHeight: 16, fontWeight: "800" }}>Try again</T></View>
            </Pressable>
          </View>
        )}
      </View>
      {caption !== undefined && (
        <Animated.View accessibilityElementsHidden={!ready} importantForAccessibility={ready ? "auto" : "no-hide-descendants"} style={[styles.caption, { opacity: overlay }]}>
          <T numberOfLines={2} style={{ color: "white", fontSize: 13, lineHeight: 18, fontWeight: "600", textAlign: "center" }}>{caption}</T>
        </Animated.View>
      )}
    </View>
  );
}

function LoadingDashes({ active, reduced }: { active: boolean; reduced: boolean }) {
  const dashes = useRef([new Animated.Value(0.2), new Animated.Value(0.2), new Animated.Value(0.2)]).current;
  useEffect(() => {
    dashes.forEach((dash) => dash.setValue(reduced ? 1 : 0.2));
    if (!active || reduced) return;
    const animations = dashes.map((dash, index) => Animated.sequence([
      Animated.delay(index * 200),
      Animated.loop(Animated.sequence([
        Animated.timing(dash, { toValue: 1, duration: 360, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
        Animated.timing(dash, { toValue: 0.2, duration: 360, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
        Animated.delay(480),
      ])),
    ]));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [active, reduced, dashes]);
  return (
    <View accessible={false} style={styles.dashes}>
      {dashes.map((opacity, index) => <Animated.View key={index} style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: "white", opacity }} />)}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { borderRadius: 16, overflow: "hidden", backgroundColor: C.dark },
  picture: { aspectRatio: 16 / 9, backgroundColor: C.dark, overflow: "hidden" },
  dashes: { position: "absolute", top: "50%", left: "50%", marginLeft: -2, marginTop: -27, width: 4, height: 54, gap: 6 },
  status: { fontFamily: "Manrope", fontSize: 13, lineHeight: 18, fontWeight: "600", color: "rgba(255,255,255,0.72)", textAlign: "center" },
  failure: { alignItems: "center", justifyContent: "center", padding: 12 },
  retryTarget: { minHeight: 44, minWidth: 100, marginTop: 2, alignItems: "center", justifyContent: "center" },
  retryPill: { borderRadius: 12, backgroundColor: "white", minHeight: 24, paddingHorizontal: 12, justifyContent: "center" },
  caption: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 8, justifyContent: "center" },
});
