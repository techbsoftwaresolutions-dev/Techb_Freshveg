import React, { useCallback, useEffect, useState } from "react";
import { AppState, DeviceEventEmitter, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "./Text";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, fontFamily, radius, spacing, type } from "../theme";
import { Button, Notice } from "./ui";

// After a delivery, asks the customer to rate what they got — the website's
// components/ReviewPrompt, as a bottom sheet.
//
// The list comes from GET /reviews/pending — delivered items with no review
// yet — so the server decides what is still owed. The phone only remembers
// what the customer chose to put off: closing the sheet (either way) hides the
// orders that were waiting for a day, while an order delivered after that
// still prompts straight away. It checks on sign-in, whenever the app comes
// back to the foreground, and when the track screen sees its order turn
// DELIVERED (checkReviews below).

const SNOOZE_KEY = "commerce.app.reviewSnooze";
const DAY = 24 * 60 * 60 * 1000;
const CHECK_EVENT = "reviews:check";

// Ask the prompt to look for delivered, unrated orders now.
export const checkReviews = () => DeviceEventEmitter.emit(CHECK_EVENT);

async function readSnooze() {
  try {
    return JSON.parse((await AsyncStorage.getItem(SNOOZE_KEY)) || "{}");
  } catch {
    return {};
  }
}

async function snooze(orderIds) {
  const now = Date.now();
  // Expired entries are dropped so the map never grows past the live ones.
  const kept = Object.fromEntries(Object.entries(await readSnooze()).filter(([, until]) => until > now));
  for (const id of orderIds) kept[id] = now + DAY;
  AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(kept)).catch(() => {});
}

// A review is per product, so two sizes of one product are one row.
export const oneRowPerProduct = (items) => [...new Map(items.map((i) => [String(i.product), i])).values()];

// Posts every starred item of an order. Resolves to { error } or
// { moderated }; a 409 means the item was already reviewed (say, from the
// website) — done either way.
export async function submitReviews(orderId, items, ratings) {
  const rated = items.filter((item) => ratings[item.product]?.stars);
  const results = await Promise.allSettled(
    rated.map((item) =>
      api.post("/reviews", {
        order: orderId,
        product: item.product,
        variant: item.variant,
        productRating: ratings[item.product].stars,
        comment: (ratings[item.product].comment || "").trim(),
      })
    )
  );
  const failed = results.filter((r) => r.status === "rejected" && r.reason?.status !== 409);
  if (failed.length) return { error: failed[0].reason?.message || "Could not save your review" };
  return { moderated: results.some((r) => r.value?.review?.status === "pending") };
}

// One product: thumb, name, five stars, and a comment box once it's starred.
export function RateItem({ item, rating = {}, onChange }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemRow}>
        <View style={styles.thumb}>
          {item.image ? <Image source={{ uri: item.image }} style={styles.thumbImg} /> : <Text style={type.h3}>{item.name?.[0]}</Text>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          {item.variantName ? <Text style={type.tiny}>{item.variantName}</Text> : null}
        </View>
      </View>
      <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel={`Rate ${item.name}`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= (rating.stars || 0);
          return (
            <Pressable
              key={n}
              onPress={() => onChange({ stars: n })}
              hitSlop={6}
              accessibilityRole="radio"
              accessibilityState={{ checked: rating.stars === n }}
              accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
            >
              <Ionicons name={on ? "star" : "star-outline"} size={30} color={on ? "#F5A623" : colors.borderStrong} />
            </Pressable>
          );
        })}
      </View>
      {rating.stars ? (
        <TextInput
          value={rating.comment || ""}
          onChangeText={(comment) => onChange({ comment })}
          placeholder="What did you like or dislike? (optional)"
          placeholderTextColor={colors.textFaint}
          maxLength={1000}
          multiline
          style={styles.textarea}
        />
      ) : null}
    </View>
  );
}

export default function ReviewPrompt() {
  const { signedIn } = useAuth();
  const { bottom } = useSafeAreaInsets();

  const [waiting, setWaiting] = useState([]); // every pending order when the prompt opened
  const [ratings, setRatings] = useState({}); // product -> { stars, comment }
  const [state, setState] = useState({ submitting: false, error: "", thanks: "" });

  const order = waiting[0] || null;

  const check = useCallback(async () => {
    if (!signedIn || order) return;
    try {
      const { pending } = await api.get("/reviews/pending");
      const now = Date.now();
      const skip = await readSnooze();
      const due = (pending || [])
        .filter((p) => !(skip[p.order.id] > now))
        .map((p) => ({ ...p, items: oneRowPerProduct(p.items) }));
      if (due.length) {
        setRatings({});
        setState({ submitting: false, error: "", thanks: "" });
        setWaiting(due);
      }
    } catch {
      // A prompt is never worth an error on screen.
    }
  }, [signedIn, order]);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    const event = DeviceEventEmitter.addListener(CHECK_EVENT, check);
    const app = AppState.addEventListener("change", (next) => next === "active" && check());
    return () => {
      event.remove();
      app.remove();
    };
  }, [check]);

  const close = useCallback(() => {
    snooze(waiting.map((p) => p.order.id));
    setWaiting([]);
  }, [waiting]);

  if (!order) return null;

  const rated = order.items.filter((item) => ratings[item.product]?.stars);
  const set = (product, patch) => setRatings((r) => ({ ...r, [product]: { ...r[product], ...patch } }));

  async function submit() {
    setState({ submitting: true, error: "", thanks: "" });
    const { error, moderated } = await submitReviews(order.order.id, order.items, ratings);
    if (error) return setState({ submitting: false, error, thanks: "" });
    setState({
      submitting: false,
      error: "",
      thanks: moderated ? "Thanks! Your review will appear once it has been checked." : "Thanks for your review!",
    });
  }

  const deliveredOn = order.order.deliveredAt
    ? ` on ${new Date(order.order.deliveredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : "";

  return (
    // Back button (Android) and a tap on the dimmed backdrop both mean "later".
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close — remind me later" />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + bottom }]} accessibilityViewIsModal>
          <Pressable onPress={close} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Close — remind me later">
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>

          {state.thanks ? (
            <View style={styles.thanks}>
              <View style={styles.check}>
                <Ionicons name="checkmark" size={30} color={colors.onPrimary} />
              </View>
              <Text style={[type.h2, { textAlign: "center" }]} accessibilityRole="header">{state.thanks}</Text>
              <Button title="Done" onPress={close} style={{ alignSelf: "stretch" }} />
            </View>
          ) : (
            <>
              <Text style={styles.title} accessibilityRole="header">How was your order?</Text>
              <Text style={styles.sub}>
                Order {order.order.code} was delivered{deliveredOn}. Rate what you got — it helps other shoppers.
              </Text>

              <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
                {order.items.map((item, index) => (
                  <View key={item.product} style={index ? styles.divider : null}>
                    <RateItem item={item} rating={ratings[item.product]} onChange={(patch) => set(item.product, patch)} />
                  </View>
                ))}
              </ScrollView>

              {state.error ? <Notice tone="error" style={{ marginTop: spacing.md }}>{state.error}</Notice> : null}

              <View style={styles.actions}>
                <Button
                  title={rated.length > 1 ? `Submit ${rated.length} reviews` : "Submit review"}
                  loading={state.submitting}
                  disabled={!rated.length}
                  onPress={submit}
                />
                <Button title="Do it later" variant="ghost" onPress={close} />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10, 30, 20, 0.45)" },
  sheet: {
    maxHeight: "88%",
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  close: { position: "absolute", top: spacing.md, right: spacing.md, zIndex: 1, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.text, marginRight: 40, marginBottom: 6 },
  sub: { ...type.small, marginBottom: spacing.md },

  item: { paddingVertical: spacing.md, gap: spacing.sm },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbImg: { width: "100%", height: "100%" },
  itemName: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text },
  stars: { flexDirection: "row", gap: spacing.sm, paddingLeft: 44 + spacing.md },
  textarea: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },

  actions: { gap: spacing.sm, marginTop: spacing.md },
  thanks: { alignItems: "center", gap: spacing.lg, paddingTop: spacing.sm },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
