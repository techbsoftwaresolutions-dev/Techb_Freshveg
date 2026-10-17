import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { api } from "../api/client";
import { colors, spacing } from "../theme";
import { Button, Card, EmptyState, Loading, Notice } from "../components/ui";
import { RateItem, oneRowPerProduct, submitReviews } from "../components/ReviewPrompt";

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
      .then(({ pending }) => setItems(oneRowPerProduct(pending.find((p) => p.order.id === orderId)?.items || [])))
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
    const result = await submitReviews(orderId, items, ratings);
    if (!result.error) return navigation.goBack();
    setError(result.error);
    setSending(false);
  }

  if (!items) return <Loading />;
  if (!items.length) return <EmptyState title="All rated" hint={error || "Thanks — every item on this order has a review."} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {items.map((item) => (
        <Card key={item.product} style={{ paddingHorizontal: spacing.md, paddingVertical: 0 }}>
          <RateItem item={item} rating={ratings[item.product]} onChange={(patch) => set(item.product, patch)} />
        </Card>
      ))}
      <Button title={rated.length ? `Submit ${rated.length} review${rated.length > 1 ? "s" : ""}` : "Tap the stars to rate"} loading={sending} disabled={!rated.length} onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
