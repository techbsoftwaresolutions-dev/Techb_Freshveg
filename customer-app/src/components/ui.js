import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, shadow, spacing, type } from "../theme";

export function Button({ title, onPress, variant = "primary", size = "md", disabled, loading, style }) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        size === "sm" && styles.buttonSm,
        isPrimary && styles.buttonPrimary,
        variant === "outline" && styles.buttonOutline,
        isGhost && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? colors.onPrimary : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            size === "sm" && { fontSize: 13 },
            isPrimary && { color: colors.onPrimary },
            (variant === "outline" || isGhost) && { color: colors.primary },
          ]}
        >
          {title}
        </Text>
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

export function Pill({ children, tone = "default", style }) {
  const tones = {
    default: { bg: colors.surfaceAlt, fg: colors.textMuted },
    save: { bg: colors.saveSoft, fg: colors.save },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    primary: { bg: colors.primarySoft, fg: colors.primaryDark },
  };
  const tone_ = tones[tone] || tones.default;

  return (
    <View style={[styles.pill, { backgroundColor: tone_.bg }, style]}>
      <Text style={[styles.pillText, { color: tone_.fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

export function Loading({ label }) {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={[type.small, { marginTop: spacing.sm }]}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <View style={styles.centre}>
      <Text style={[type.h2, { textAlign: "center" }]}>{title}</Text>
      {hint ? (
        <Text style={[type.small, { textAlign: "center", marginTop: 6, maxWidth: 280 }]}>{hint}</Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function Notice({ tone = "info", children, style }) {
  if (!children) return null;
  const tones = {
    info: { bg: colors.accentSoft, fg: colors.accent },
    error: { bg: colors.dangerSoft, fg: colors.danger },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    save: { bg: colors.saveSoft, fg: colors.save },
  };
  const tone_ = tones[tone] || tones.info;

  return (
    <View style={[styles.notice, { backgroundColor: tone_.bg }, style]}>
      <Text style={{ color: tone_.fg, fontSize: 13, flex: 1 }}>{children}</Text>
    </View>
  );
}

export function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={type.h2}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonSm: { minHeight: 34, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 15, fontWeight: "700", color: colors.text },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 11, fontWeight: "700" },

  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionAction: { color: colors.primary, fontWeight: "700", fontSize: 13 },

  divider: { height: 1, backgroundColor: colors.border },
});
