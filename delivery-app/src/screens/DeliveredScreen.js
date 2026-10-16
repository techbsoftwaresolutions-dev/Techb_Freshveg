import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../components/Text";
import { colors, spacing, type } from "../theme";
import { Button, IconTile } from "../components/ui";

export default function DeliveredScreen({ route, navigation }) {
  const { code } = route.params;

  return (
    <View style={styles.screen}>
      <IconTile name="checkmark-done" size={34} box={72} tone="success" style={{ marginBottom: spacing.lg }} />
      <Text style={styles.title}>Delivered</Text>
      <Text style={styles.code}>{code}</Text>
      <Text style={styles.body}>
        Handover confirmed with the customer's code. The store has been updated.
      </Text>

      <View style={styles.actions}>
        {/* Back to the tabs already underneath (their queue refetches on
            focus) — replacing would stack a second copy above a stale one. */}
        <Button title="Back to my queue" onPress={() => navigation.popToTop()} />
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
  title: { ...type.h1, fontSize: 26 },
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
