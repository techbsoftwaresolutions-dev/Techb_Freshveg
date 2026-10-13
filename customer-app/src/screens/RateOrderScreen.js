import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "../components/Text";
import { api } from "../api/client";
import { colors, radius, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading, Notice } from "../components/ui";

// Rate the items of a delivered order. GET /reviews/pending is the list of
// what is still unrated, so the server decides what can be reviewed — the
// same source as the website's review prompt.
export default function RateOrderScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [items, setItems] = useState(null);
  const [ratings, setRatings] = useState({}); // product -> { stars, comment }
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/reviews/pending")
      .then(({ pending }) => setItems(pending.find((p) => p.order.id === orderId)?.items || []))
      .catch((err) => {
        setError(err.message);
        setItems([]);
      });
  }, [orderId]);

  const set = (product, patch) => setRatings((r) => ({ ...r, [product]: { ...r[product], ...patch } }));
  const rated = Object.entries(ratings).filter(([, r]) => r.stars);

  async function submit() {
    setSending(true);
    setError("");
    try {
      for (const [product, rating] of rated) {
        const item = items.find((i) => i.product === product);
        await api.post("/reviews", {
          order: orderId,
          product,
          variant: item.variant,
          productRating: rating.stars,
          comment: (rating.comment || "").trim(),
        });
      }
      navigation.goBack();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  if (!items) return <Loading />;
  if (!items.length) return <EmptyState title="All rated" hint={error || "Thanks — every item on this order has a review."} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {items.map((item) => {
        const rating = ratings[item.product] || {};
        return (
          <Card key={item.product} style={{ padding: spacing.md, gap: spacing.sm }}>
            <View style={styles.row}>
              {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} /> : null}
              <Text style={[type.body, { flex: 1, fontWeight: "600" }]}>
                {item.name}
                {item.variantName ? ` · ${item.variantName}` : ""}
              </Text>
            </View>
            <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={`Rating for ${item.name}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => set(item.product, { stars: n })} hitSlop={6} accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}>
                  <Ionicons name={n <= (rating.stars || 0) ? "star" : "star-outline"} size={30} color={n <= (rating.stars || 0) ? "#F5A524" : colors.borderStrong} />
                </Pressable>
              ))}
            </View>
            {rating.stars ? (
              <TextInput
                value={rating.comment || ""}
                onChangeText={(comment) => set(item.product, { comment })}
                placeholder="Anything to add? (optional)"
                placeholderTextColor={colors.textFaint}
                multiline
                style={styles.textarea}
              />
            ) : null}
          </Card>
        );
      })}
      <Button title={rated.length ? `Submit ${rated.length} review${rated.length > 1 ? "s" : ""}` : "Tap the stars to rate"} loading={sending} disabled={!rated.length} onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  stars: { flexDirection: "row", gap: spacing.sm },
  star: { fontSize: 30, color: colors.border },
  starOn: { color: "#F5A524" },
  textarea: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },
});
