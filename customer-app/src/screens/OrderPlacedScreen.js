import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/Text";
import { colors, fontFamily, radius, spacing, type } from "../theme";
import { Button } from "../components/ui";

// The website's "placed" confirmation (.placed-banner), as a full screen.
export default function OrderPlacedScreen({ route, navigation }) {
  const { orderId, code } = route.params;

  return (
    <View style={styles.screen}>
      <View style={styles.check}>
        <Ionicons name="checkmark" size={44} color={colors.onPrimary} />
      </View>
      <Text style={styles.title}>Thank you! Your order is placed.</Text>
      <View style={styles.codeChip}>
        <Text style={styles.code}>Order {code}</Text>
      </View>
      <Text style={styles.body}>
        The store is preparing it now — you can follow every step from the order page. You'll get a handover code once a
        delivery partner picks it up.
      </Text>

      <View style={styles.actions}>
        <Button title="Track this order" icon="navigate-outline" onPress={() => navigation.replace("OrderTrack", { orderId })} />
        <Button title="Keep shopping" variant="outline" onPress={() => navigation.navigate("Main", { screen: "HomeTab" })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  check: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: colors.primarySoft,
    marginBottom: spacing.xl,
  },
  title: { fontFamily: fontFamily.serif, fontSize: 26, color: colors.primaryDeep, textAlign: "center" },
  codeChip: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  code: { fontSize: 13.5, fontWeight: "600", color: colors.primaryDark, letterSpacing: 0.5, fontVariant: ["tabular-nums"] },
  body: { ...type.small, textAlign: "center", marginTop: spacing.lg, maxWidth: 320, lineHeight: 20 },
  actions: { marginTop: spacing.xxl, gap: spacing.sm, alignSelf: "stretch" },
});
