import React from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from "react-native";
import { fontFamily } from "../theme";

// Text that always uses the app's own font. Android lets a person pick a
// decorative or script system font in Settings, and any Text without a
// fontFamily of its own falls back to it — which is why some labels showed up
// in cursive on such phones. Every screen imports Text / TextInput from here
// instead of "react-native", so nothing depends on the phone's font setting.
function withFont(style) {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) return style;
  const w = String(flat.fontWeight || "400");
  const family =
    w === "bold" || w === "700"
      ? fontFamily.bold
      : w === "800" || w === "900"
        ? fontFamily.extrabold
        : w === "600"
          ? fontFamily.semibold
          : w === "500"
            ? fontFamily.medium
            : fontFamily.regular;
  // The weight is in the font itself; asking for it again would fake-bold it.
  return [style, { fontFamily: family, fontWeight: "normal" }];
}

export function Text({ style, ...props }) {
  return <RNText maxFontSizeMultiplier={1.15} {...props} style={withFont(style)} />;
}

export function TextInput({ style, ...props }) {
  return <RNTextInput maxFontSizeMultiplier={1.15} {...props} style={withFont(style)} />;
}
