import React from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, fontFamily, radius, shadow, spacing, type } from "../theme";

// The customer app's building blocks (customer-app/src/components/ui.js) with
// the delivery app's extras: a danger button, a subtitle line under a button
// and the Stat tile. Screens style layout; these own the look.

export function Button({ title, subtitle, onPress, variant = "primary", size = "md", disabled, loading, style, icon }) {
  const isPrimary = variant === "primary";
  const tint = isPrimary
    ? colors.onPrimary
    : variant === "danger"
      ? colors.danger
      : variant === "ghost"
        ? colors.textMuted
        : colors.primaryDark;

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        size === "sm" && styles.buttonSm,
        isPrimary && styles.buttonPrimary,
        variant === "outline" && styles.buttonOutline,
        variant === "soft" && styles.buttonSoft,
        variant === "danger" && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && (isPrimary ? { backgroundColor: colors.primaryDark } : { opacity: 0.8 }),
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 16 : 19} color={tint} /> : null}
          <View style={{ alignItems: "center", flexShrink: 1 }}>
            <Text style={[styles.buttonText, size === "sm" && { fontSize: 13.5 }, { color: tint }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[styles.buttonSub, { color: isPrimary ? "rgba(255,255,255,0.85)" : colors.textMuted }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    // No button role: cards hold their own buttons, and a button inside a
    // button is invalid on the web.
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }, style]}
    >
      {children}
    </Pressable>
  );
}

const PILL_TONES = {
  default: { bg: colors.bg, fg: colors.textMuted },
  primary: { bg: colors.primarySoft, fg: colors.primaryDark },
  success: { bg: colors.successSoft, fg: colors.success },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  cash: { bg: colors.cashSoft, fg: colors.cash },
  solid: { bg: colors.primary, fg: colors.onPrimary },
};

export function Pill({ children, tone = "default", style }) {
  const t = PILL_TONES[tone] || PILL_TONES.default;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.pillText, { color: t.fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

// A count on the queue header: an icon tile, the number, what it counts.
export function Stat({ label, value, icon, tone }) {
  return (
    <View style={styles.stat}>
      {icon ? <IconTile name={icon} size={16} box={30} tone={tone} /> : null}
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
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

// The customer app's empty state: a soft green icon tile, a heading, a line of
// help and the way forward.
export function EmptyState({ title, hint, action, icon = "cube-outline" }) {
  return (
    <View style={styles.centre}>
      <IconTile name={icon} size={30} box={64} style={{ marginBottom: spacing.lg }} />
      <Text style={[type.h2, { textAlign: "center" }]}>{title}</Text>
      {hint ? <Text style={[type.small, { textAlign: "center", marginTop: 6, maxWidth: 300 }]}>{hint}</Text> : null}
      {action ? <View style={{ marginTop: spacing.xl, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

const NOTICE_TONES = {
  info: { bg: colors.surfaceAlt, fg: colors.primaryDark, icon: "information-circle-outline" },
  error: { bg: colors.dangerSoft, fg: colors.danger, icon: "alert-circle-outline" },
  warn: { bg: colors.warnSoft, fg: colors.warn, icon: "alert-circle-outline" },
  success: { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle-outline" },
};

export function Notice({ tone = "info", children, style, icon }) {
  if (!children) return null;
  const t = NOTICE_TONES[tone] || NOTICE_TONES.info;
  return (
    <View
      style={[styles.notice, { backgroundColor: t.bg }, style]}
      accessibilityRole={tone === "error" ? "alert" : undefined}
    >
      <Ionicons name={icon || t.icon} size={18} color={t.fg} />
      <Text style={{ color: t.fg, fontSize: 13, flex: 1, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

// A soft tinted square holding a line icon, as in the customer app.
export function IconTile({ name, size = 20, box = 40, tone = "primary", style }) {
  const t = PILL_TONES[tone] || PILL_TONES.primary;
  return (
    <View
      style={[
        styles.iconTile,
        { width: box, height: box, borderRadius: box > 48 ? radius.lg : radius.md, backgroundColor: t.bg },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={t.fg} />
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
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
  // 52pt, a little over the customer app's 48: this is tapped with a thumb
  // while holding a bag.
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  buttonSm: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.md },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface },
  buttonSoft: { backgroundColor: colors.primarySoft },
  buttonDanger: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.surface },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 15, fontWeight: "600" },
  buttonSub: { fontSize: 11.5, marginTop: 1 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  // No fixed height: a font that sits taller than expected must grow the pill.
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", justifyContent: "center" },
  pillText: { fontSize: 11.5, lineHeight: 16, fontFamily: fontFamily.semibold, includeFontPadding: false },

  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  statLabel: { fontSize: 11.5, color: colors.textMuted },

  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.bg },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },

  iconTile: { alignItems: "center", justifyContent: "center" },

  divider: { height: 1, backgroundColor: colors.border },
});
