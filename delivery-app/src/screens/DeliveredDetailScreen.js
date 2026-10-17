import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { clockTime, colors, formatAddress, rupees, spacing, type } from "../theme";
import { Button, Card, Divider, EmptyState, Loading, Notice, Pill, callNumber } from "../components/ui";

const fullTime = (value) =>
  value
    ? `${new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${clockTime(value)}`
    : "—";

// Read-only record of a finished delivery, opened from History.
export default function DeliveredDetailScreen({ route }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);

  useEffect(() => {
    api
      .get(`/orders/${orderId}`)
      .then((data) => setOrder(data.order))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <Loading label="Loading the order" />;
  if (!order) return <EmptyState icon="" title="Couldn't load this order" hint={error} />;

  const address = order.delivery?.address;
  const customerName = address?.contactName || order.customerSnapshot?.name || "Customer";
  const customerPhone = address?.contactPhone || order.customerSnapshot?.phone;
  const cod = order.payment?.method === "cod";

  const times = [
    ["Assigned", order.delivery?.assignedAt],
    ["Picked up", order.delivery?.pickedUpAt],
    ["Arrived", order.delivery?.arrivedAt],
    ["Delivered", order.delivery?.deliveredAt],
  ].filter(([, value]) => value);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
    >
      <Card style={styles.head}>
        <Text style={styles.code}>{order.code}</Text>
        <Pill tone="success">Delivered</Pill>
        <Text style={type.small}>{fullTime(order.delivery?.deliveredAt)}</Text>
      </Card>

      <Card style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={styles.label}>Delivered to</Text>
        <Text style={type.h3}>{customerName}</Text>
        <Text style={type.body}>{formatAddress(address)}</Text>
        {customerPhone ? (
          <Button title={`Call ${customerPhone}`} variant="outline" onPress={() => callNumber(customerPhone)} />
        ) : null}
      </Card>

      <Card style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={styles.label}>Payment</Text>
        <View style={styles.row}>
          <Text style={type.body}>{cod ? "Cash on delivery" : "Prepaid"}</Text>
          <Pill tone={cod ? "cash" : "success"}>{cod ? "Cash collected" : "Paid"}</Pill>
        </View>
        <View style={styles.row}>
          <Text style={type.body}>Order total</Text>
          <Text style={styles.amount}>{rupees(order.pricing?.total)}</Text>
        </View>
      </Card>

      <Card style={{ padding: spacing.md }}>
        <Text style={styles.label}>
          {order.items?.length} item{order.items?.length === 1 ? "" : "s"}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          {(order.items || []).map((item, index) => (
            <View key={item.id || item.sku || index}>
              {index > 0 ? <Divider style={{ marginVertical: spacing.sm }} /> : null}
              <View style={styles.row}>
                <Text style={[type.body, { flex: 1 }]} numberOfLines={2}>
                  {item.name}
                  {item.variantName ? ` · ${item.variantName}` : ""}
                </Text>
                <Text style={styles.amount}>×{item.pickedQuantity ?? item.quantity}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {times.length ? (
        <Card style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text style={styles.label}>Timeline</Text>
          {times.map(([name, value]) => (
            <View key={name} style={styles.row}>
              <Text style={type.body}>{name}</Text>
              <Text style={type.small}>{fullTime(value)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {order.delivery?.proofPhoto ? (
        <Card style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text style={styles.label}>Delivery photo</Text>
          <Pressable onPress={() => setPhotoOpen(true)}>
            <Image source={{ uri: order.delivery.proofPhoto }} style={styles.photo} resizeMode="cover" />
          </Pressable>
          <Text style={type.small}>Tap the photo to see it full size.</Text>
        </Card>
      ) : null}

      <Modal visible={photoOpen} transparent animationType="fade" onRequestClose={() => setPhotoOpen(false)}>
        <Pressable style={styles.viewer} onPress={() => setPhotoOpen(false)}>
          <Image source={{ uri: order.delivery?.proofPhoto }} style={styles.viewerImage} resizeMode="contain" />
          <Text style={styles.viewerHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>

      {error ? <Notice tone="error">{error}</Notice> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { padding: spacing.md, gap: spacing.sm, alignItems: "flex-start" },
  code: { ...type.h2, fontVariant: ["tabular-nums"] },
  label: { ...type.tiny, textTransform: "uppercase", fontWeight: "800", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  amount: { ...type.body, fontWeight: "800" },
  photo: { width: "100%", height: 220, borderRadius: 12, backgroundColor: colors.border },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
  viewerImage: { width: "100%", height: "85%" },
  viewerHint: { color: "#fff", marginTop: 12, opacity: 0.7 },
});
