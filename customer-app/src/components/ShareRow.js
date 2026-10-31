import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, Share, StyleSheet, View } from "react-native";
import { Text } from "./AppText";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import { colors, radius, spacing } from "../theme";

// Public website the shared link points at. Set WEB_BASE_URL in .env to
// change it (e.g. http://localhost:3100 while testing).
const WEB_BASE_URL = (
  Constants.expoConfig?.extra?.webBaseUrl || "https://hosurbasket.com"
).replace(/\/+$/, "");

// "Share on WhatsApp" on the left, "Copy link" on the right, one line.
export default function ShareRow({ slug, name }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const link = `${WEB_BASE_URL}/p/${slug}`;
  const message = `Check out ${name} on Hosur Basket: ${link}`;

  const shareWhatsApp = async () => {
    const text = encodeURIComponent(message);
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(`https://wa.me/?text=${text}`);
        return;
      }
      const app = `whatsapp://send?text=${text}`;
      if (await Linking.canOpenURL(app)) await Linking.openURL(app);
      else await Linking.openURL(`https://wa.me/?text=${text}`);
    } catch {
      // WhatsApp isn't installed — fall back to the system share sheet.
      Share.share({ message }).catch(() => {});
    }
  };

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(link);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      Share.share({ message: link }).catch(() => {});
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={shareWhatsApp}
        accessibilityRole="button"
        accessibilityLabel="Share on WhatsApp"
        style={({ pressed }) => [styles.btn, styles.whatsapp, pressed && styles.pressed]}
      >
        <Text style={[styles.label, { color: colors.primaryDark }]} numberOfLines={1}>
          Share on WhatsApp
        </Text>
      </Pressable>
      <Pressable
        onPress={copyLink}
        accessibilityRole="button"
        accessibilityLabel="Copy link"
        style={({ pressed }) => [styles.btn, styles.copy, pressed && styles.pressed]}
      >
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {copied ? "Link copied ✓" : "Copy link"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm || 8, marginTop: spacing.md || 12 },
  btn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: radius.md || 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  whatsapp: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  copy: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  pressed: { opacity: 0.7 },
  label: { fontSize: 14, fontWeight: "700" },
});
