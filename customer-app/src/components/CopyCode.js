import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text } from "./AppText";

// A coupon code chip: tap it to copy the code. It shows a copy icon, and
// "Copied" with a tick for a moment after the tap.
export default function CopyCode({ code, chipStyle, textStyle }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable: nothing to do.
    }
  };

  return (
    <Pressable
      onPress={copy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={copied ? `Coupon code ${code} copied` : `Copy coupon code ${code}`}
      style={({ pressed }) => [chipStyle, styles.row, copied && styles.copied, pressed && styles.pressed]}
    >
      <Text style={[textStyle, copied && styles.copiedText]}>{copied ? "Copied" : `Code ${code}`}</Text>
      <Ionicons
        name={copied ? "checkmark" : "copy-outline"}
        size={12}
        color={copied ? "#1b7a3a" : StyleSheet.flatten(textStyle)?.color || "#fff"}
        style={styles.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  icon: { marginLeft: 5 },
  pressed: { opacity: 0.7 },
  copied: { backgroundColor: "#fff", borderColor: "#fff" },
  copiedText: { color: "#1b7a3a" },
});
