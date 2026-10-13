import React from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from "react-native";
import { fontFamily } from "../theme";

// Every Text and TextInput in the app goes through these, so type renders in
// the website's Poppins everywhere — including on phones where the owner has
// picked a decorative system font (Android falls back to it for any Text with
// no fontFamily, which used to clip pills and badges).
//
// Custom fonts ship one file per weight, and fontWeight alone does not switch
// between them on Android, so the weight asked for picks the file instead.
const BY_WEIGHT = {
  100: fontFamily.regular,
  200: fontFamily.regular,
  300: fontFamily.regular,
  400: fontFamily.regular,
  normal: fontFamily.regular,
  500: fontFamily.medium,
  600: fontFamily.semibold,
  700: fontFamily.bold,
  bold: fontFamily.bold,
  800: fontFamily.extrabold,
  900: fontFamily.extrabold,
};
const OURS = new Set(Object.values(fontFamily));

function resolve(style) {
  const flat = StyleSheet.flatten(style) || {};
  // A deliberate other family (the serif headings) is left alone.
  if (flat.fontFamily && !OURS.has(flat.fontFamily)) return style;
  const family =
    flat.fontWeight !== undefined ? BY_WEIGHT[String(flat.fontWeight)] || fontFamily.regular : flat.fontFamily || fontFamily.regular;
  return [style, { fontFamily: family, fontWeight: undefined }];
}

export const Text = React.forwardRef(function Text({ style, ...props }, ref) {
  return <RNText ref={ref} style={resolve(style)} {...props} />;
});

export const TextInput = React.forwardRef(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} style={resolve(style)} {...props} />;
});
