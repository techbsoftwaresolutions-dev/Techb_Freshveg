import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";
import { Button } from "../components/ui";

export default function OrderPlacedScreen({ route, navigation }) {
  const { orderId, code } = route.params;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Order placed</Text>
      <Text style={styles.code}>{code}</Text>
      <Text style={styles.body}>
        The store is preparing your order. You'll get a handover code once a delivery partner picks
        it up.
      </Text>

      <View style={styles.actions}>
        <Button
          title="Track this order"
          onPress={() => navigation.replace("OrderTrack", { orderId })}
        />
        <Button
          title="Keep shopping"
          variant="ghost"
          onPress={() => navigation.navigate("HomeTab")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  mark: { fontSize: 60, marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  code: { ...type.small, marginTop: 4, letterSpacing: 1 },
  body: {
    ...type.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.lg,
    maxWidth: 300,
    lineHeight: 20,
  },
  actions: { marginTop: spacing.xxl, gap: spacing.sm, alignSelf: "stretch" },
});
