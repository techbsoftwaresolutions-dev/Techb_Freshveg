import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/Text";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, type } from "../theme";
import { Card, Divider, IconTile } from "../components/ui";

// The policies live on the website, one version for the site and both apps
// (website/app/(legal)/); this screen links to them rather than keeping a copy.
export const SITE_URL = Constants.expoConfig?.extra?.siteUrl || "https://thefarmersbasket.in";

const POLICIES = [
  { label: "Privacy policy", path: "/privacy-policy", icon: "shield-checkmark-outline" },
  { label: "Terms & conditions", path: "/terms-and-conditions", icon: "document-text-outline" },
  { label: "Cancellations, returns & refunds", path: "/refund-cancellation-policy", icon: "refresh-outline" },
  { label: "Shipping & delivery", path: "/shipping-delivery-policy", icon: "bicycle-outline" },
  { label: "Referral & coupon terms", path: "/referral-terms", icon: "gift-outline" },
  { label: "Account deletion & data retention", path: "/account-deletion", icon: "trash-outline" },
];

const open = (path) => Linking.openURL(`${SITE_URL}${path}`).catch(() => {});

export default function LegalScreen({ navigation }) {
  const { signedIn } = useAuth();
  const rows = [
    ...POLICIES.map((p) => ({ ...p, onPress: () => open(p.path), external: true })),
    ...(signedIn
      ? [{ label: "Delete my account", icon: "person-remove-outline", onPress: () => navigation.navigate("DeleteAccount"), danger: true }]
      : []),
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card style={{ paddingVertical: spacing.xs }}>
        {rows.map((row, index) => (
          <View key={row.label}>
            {index > 0 ? <Divider style={{ marginLeft: 68 }} /> : null}
            <Pressable style={styles.row} onPress={row.onPress} accessibilityRole={row.external ? "link" : "button"}>
              <IconTile name={row.icon} />
              <Text style={[styles.label, row.danger && { color: colors.danger }]}>{row.label}</Text>
              <Ionicons name={row.external ? "open-outline" : "chevron-forward"} size={18} color={colors.textFaint} />
            </Pressable>
          </View>
        ))}
      </Card>

      <Card style={{ padding: spacing.lg, gap: 4 }}>
        <Text style={type.h3}>About</Text>
        <Text style={type.small}>
          {Constants.expoConfig?.name || "The Farmers Basket"} · version {Constants.expoConfig?.version || "—"}
        </Text>
        <Pressable onPress={() => open("/")} accessibilityRole="link">
          <Text style={styles.link}>{SITE_URL.replace(/^https?:\/\//, "")}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Support")} accessibilityRole="button">
          <Text style={styles.link}>Help & support, complaints and grievances</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, minHeight: 60 },
  label: { flex: 1, fontSize: 14.5, fontWeight: "600", color: colors.text },
  link: { color: colors.primary, fontWeight: "600", fontSize: 13.5, marginTop: 6 },
});
