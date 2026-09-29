import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "../theme";
import { Button } from "../components/ui";

export default function DeliveredScreen({ route, navigation }) {
  const { code } = route.params;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Delivered</Text>
      <Text style={styles.code}>{code}</Text>
      <Text style={styles.body}>
        Handover confirmed with the customer's code. The store has been updated.
      </Text>

      <View style={styles.actions}>
        <Button title="Back to my queue" onPress={() => navigation.replace("Tabs")} />
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
  mark: { fontSize: 66, marginBottom: spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.success },
  code: { ...type.small, marginTop: 4, letterSpacing: 1 },
  body: {
    ...type.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.lg,
    maxWidth: 300,
    lineHeight: 22,
  },
  actions: { marginTop: spacing.xxl, alignSelf: "stretch" },
});
