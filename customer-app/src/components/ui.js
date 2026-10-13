import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, fontFamily, radius, shadow, spacing, type } from "../theme";

// The website's mobile building blocks (website/app/globals.css: .btn, .panel,
// .pill, .notice, .section-head, .empty), as native components. Screens style
// layout; these own the look.

export function Button({ title, onPress, variant = "primary", size = "md", disabled, loading, style, icon }) {
  const isPrimary = variant === "primary";
  const tint = isPrimary ? colors.onPrimary : colors.primaryDark;

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        size === "sm" && styles.buttonSm,
        isPrimary && styles.buttonPrimary,
        variant === "outline" && styles.buttonOutline,
        variant === "soft" && styles.buttonSoft,
        variant === "ghost" && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && (isPrimary ? { backgroundColor: colors.primaryDark } : { opacity: 0.8 }),
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={tint} /> : null}
          <Text style={[styles.buttonText, size === "sm" && { fontSize: 13.5 }, { color: tint }]} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }, style]}>
      {children}
    </Pressable>
  );
}

const PILL_TONES = {
  default: { bg: colors.bg, fg: colors.textMuted },
  save: { bg: colors.saveSoft, fg: colors.save },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  accent: { bg: colors.accentSoft, fg: colors.accent },
  primary: { bg: colors.primarySoft, fg: colors.primaryDark },
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

export function Loading({ label }) {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={[type.small, { marginTop: spacing.md }]}>{label}</Text> : null}
    </View>
  );
}

// The website's empty state: a soft green icon tile, a heading, a line of help
// and the way forward.
export function EmptyState({ title, hint, action, icon = "leaf-outline" }) {
  return (
    <View style={styles.centre}>
      <IconTile name={icon} size={30} box={64} style={{ marginBottom: spacing.lg }} />
      <Text style={[type.h2, { textAlign: "center" }]}>{title}</Text>
      {hint ? <Text style={[type.small, { textAlign: "center", marginTop: 6, maxWidth: 290 }]}>{hint}</Text> : null}
      {action ? <View style={{ marginTop: spacing.xl, alignItems: "center" }}>{action}</View> : null}
    </View>
  );
}

const NOTICE_TONES = {
  info: { bg: colors.surfaceAlt, fg: colors.primaryDark, icon: "information-circle-outline" },
  error: { bg: colors.dangerSoft, fg: colors.danger, icon: "alert-circle-outline" },
  warn: { bg: colors.warnSoft, fg: colors.warn, icon: "time-outline" },
  save: { bg: colors.saveSoft, fg: colors.save, icon: "checkmark-circle-outline" },
};

export function Notice({ tone = "info", children, style }) {
  if (!children) return null;
  const t = NOTICE_TONES[tone] || NOTICE_TONES.info;
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }, style]} accessibilityRole={tone === "error" ? "alert" : undefined}>
      <Ionicons name={t.icon} size={18} color={t.fg} />
      <Text style={{ color: t.fg, fontSize: 13, flex: 1, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

// "Best Sellers —                View All →"
export function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={type.section} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.sectionDash} />
      </View>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={10} style={styles.sectionAction} accessibilityRole="link">
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

// A soft green square holding a line icon — the website's .am-menu-icon /
// offer / pincode tiles.
export function IconTile({ name, size = 20, box = 40, style }) {
  return (
    <View style={[styles.iconTile, { width: box, height: box, borderRadius: box > 48 ? radius.lg : radius.md }, style]}>
      <Ionicons name={name} size={size} color={colors.primary} />
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  buttonSm: { minHeight: 38, paddingHorizontal: spacing.md, borderRadius: radius.md },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface },
  buttonSoft: { backgroundColor: colors.primarySoft },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 15, fontWeight: "600" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  // No fixed height: a font that sits taller than expected must grow the pill,
  // not clip it.
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "center",
    justifyContent: "center",
  },
  pillText: { fontSize: 11.5, lineHeight: 16, fontFamily: fontFamily.semibold, includeFontPadding: false },

  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.bg },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  sectionDash: { width: 22, height: 3, borderRadius: 2, backgroundColor: colors.primary },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  sectionActionText: { color: colors.primary, fontWeight: "600", fontSize: 13.5 },

  iconTile: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },

  divider: { height: 1, backgroundColor: colors.border },
});
