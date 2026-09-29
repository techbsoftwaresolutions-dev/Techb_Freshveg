import React from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing, type } from "../theme";

export function Button({ title, subtitle, onPress, variant = "primary", disabled, loading, style }) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        variant === "outline" && styles.buttonOutline,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        (disabled || loading) && { opacity: 0.45 },
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.onPrimary : colors.primary} />
      ) : (
        <View style={{ alignItems: "center" }}>
          <Text
            style={[
              styles.buttonText,
              primary && { color: colors.onPrimary },
              variant === "outline" && { color: colors.primary },
              variant === "ghost" && { color: colors.textMuted },
              variant === "danger" && { color: colors.danger },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.buttonSub, primary && { color: "rgba(255,255,255,0.8)" }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={[styles.card, style]}>
      {children}
    </Wrapper>
  );
}

export function Pill({ children, tone = "default" }) {
  const tones = {
    default: [colors.surfaceAlt, colors.textMuted],
    primary: [colors.primarySoft, colors.primaryDark],
    success: [colors.successSoft, colors.success],
    warn: [colors.warnSoft, colors.warn],
    danger: [colors.dangerSoft, colors.danger],
    cash: [colors.cashSoft, colors.cash],
  };
  const [bg, fg] = tones[tone] || tones.default;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
      {tone ? <View style={[styles.statBar, { backgroundColor: colors[tone] }]} /> : null}
    </View>
  );
}

export function Loading({ label }) {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={[type.small, { marginTop: spacing.md }]}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon ="", title, hint, action}) {
  return (
    <View style={styles.centre}>
      <Text style={{ fontSize: 46, marginBottom: spacing.md }}>{icon}</Text>
      <Text style={[type.h2, { textAlign: "center" }]}>{title}</Text>
      {hint ? (
        <Text style={[type.small, { textAlign: "center", marginTop: 6, maxWidth: 300 }]}>{hint}</Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.xl, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

export function Notice({ tone = "info", children, style }) {
  if (!children) return null;
  const tones = {
    info: [colors.primarySoft, colors.primaryDark],
    error: [colors.dangerSoft, colors.danger],
    warn: [colors.warnSoft, colors.warn],
    success: [colors.successSoft, colors.success],
  };
  const [bg, fg] = tones[tone] || tones.info;
  return (
    <View style={[styles.notice, { backgroundColor: bg }, style]}>
      <Text style={{ color: fg, fontSize: 14, fontWeight: "600", flex: 1 }}>{children}</Text>
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

// Opens the platform's maps app. Coordinates win when the address has them —
// a pin is unambiguous where a written address in a small town often is not.
export function openMaps({ coordinates, address }) {
  let query = address || "";
  if (coordinates?.length === 2) {
    // GeoJSON is [lng, lat]; every maps URL wants lat,lng.
    query = `${coordinates[1]},${coordinates[0]}`;
  }
  if (!query) return;

  const encoded = encodeURIComponent(query);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${encoded}`,
    android: `google.navigation:q=${encoded}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
  });

  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`).catch(() => {});
  });
}

export const callNumber = (phone) => {
  if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
};

const styles = StyleSheet.create({
  // 52pt, not 44 — this is tapped with a thumb while holding something.
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDanger: { borderWidth: 2, borderColor: colors.danger, backgroundColor: colors.surface },
  buttonText: { fontSize: 16.5, fontWeight: "800", color: colors.text, letterSpacing: 0.2 },
  buttonSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "600" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  pillText: { fontSize: 12, fontWeight: "800" },

  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, overflow: "hidden" },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: "600", marginTop: 2 },
  statBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },

  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  notice: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.md },
});
