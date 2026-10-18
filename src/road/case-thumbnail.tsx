import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { demoFrameFor } from "./media";
import { type RoadCase } from "./model";
import { C, Icon } from "./ui";

export function CaseThumbnail({ c }: { c: RoadCase }) {
  const [failed, setFailed] = useState<string | null>(null);
  const uri = c.evidence.thumbnailUrl?.startsWith("https://")
    ? c.evidence.thumbnailUrl : null;
  return (
    <View style={styles.frame} accessible={false}>
      <Icon name="Video" size={22} color={C.muted} />
      {(c.provenance.isDemo || (uri && uri !== failed)) && (
        <Image
          key={c.provenance.isDemo ? c.id : uri}
          source={c.provenance.isDemo ? demoFrameFor(c) : { uri: uri! }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(uri)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 64,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: C.lilac,
    alignItems: "center",
    justifyContent: "center",
  },
});
