import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, formatAddress, radius, relativeTime, rupees, spacing, type } from "../theme";
import { Button, Card, Pill, callNumber, openMaps } from "./ui";

// What the rider should do next, per status. The engine owns the transitions;
// this only decides the wording on the card.
const NEXT_ACTION = {
  ASSIGNED_TO_DELIVERY: "Go to store",
  PICKED_UP: "Start delivery",
  OUT_FOR_DELIVERY: "Continue",
  ARRIVED: "Hand over",
};

const STAGE_LABEL = {
  ASSIGNED_TO_DELIVERY: "Pick up from store",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "On the way",
  ARRIVED: "At the door",
};

// Plain icons, no text and no button chrome: location opens maps to where the
// rider is heading next, the phone icon dials. Tapping them does not open the order.
function ContactActions({ address, location, phone }) {
  return (
    <View style={styles.actions}>
      <Pressable
        hitSlop={10}
        onPress={() => openMaps({ coordinates: location?.coordinates, address: formatAddress(address) })}
        accessibilityLabel="Navigate"
      >
        <Ionicons name="location" size={26} color={colors.primaryDark} />
      </Pressable>
      <Pressable
        hitSlop={10}
        onPress={() => callNumber(phone)}
        disabled={!phone}
        accessibilityLabel="Call"
        style={!phone && { opacity: 0.35 }}
      >
        <Ionicons name="call" size={24} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

const collectLine = (item) =>
  item.payment?.method === "cod" && item.payment?.status !== "paid"
    ? `Collect ${rupees(item.pricing?.total)}`
    : "Prepaid";

// An order in the rider's hands: store → customer, with the next action.
export function LiveRunCard({ item, onPress }) {
  const atStore = item.status === "ASSIGNED_TO_DELIVERY";
  const target = atStore ? item.pickup?.address : item.delivery?.address;

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.accent} />
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name={atStore ? "storefront-outline" : "home-map-marker"} size={22} color="#fff" />
          </View>
          <Text style={styles.code} numberOfLines={1}>{item.code}</Text>
          <Pill tone={item.status === "ARRIVED" ? "success" : "primary"}>
            {STAGE_LABEL[item.status] || item.status}
          </Pill>
        </View>

        <View style={styles.legRow}>
          <View style={[styles.leg, { flex: 1 }]}>
            <Text style={styles.legLabel}>{atStore ? "Pick up from" : "Deliver to"}</Text>
            <Text style={styles.legName} numberOfLines={1}>
              {atStore ? item.pickup?.name || "Store" : item.delivery?.address?.contactName || "Customer"}
            </Text>
            <Text style={type.small} numberOfLines={2}>{formatAddress(target)}</Text>
          </View>
          <ContactActions
            address={target}
            location={atStore ? item.pickup?.location : item.delivery?.address?.location}
            phone={atStore ? item.pickup?.phone : item.delivery?.address?.contactPhone || item.customerSnapshot?.phone}
          />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <MaterialCommunityIcons name="package-variant-closed" size={18} color={colors.primaryDark} />
            <Text style={styles.metaText}>
              {item.items?.length} item{item.items?.length === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.meta}>
            <MaterialCommunityIcons name="currency-inr" size={18} color={colors.primaryDark} />
            <Text style={styles.metaText}>{collectLine(item)}</Text>
          </View>
        </View>

        <View style={styles.foot}>
          <Text style={[type.tiny, { flex: 1 }]}>Assigned {relativeTime(item.delivery?.assignedAt)}</Text>
          <Button
            title={NEXT_ACTION[item.status] || "Open"}
            onPress={onPress}
            style={styles.cta}
          />
        </View>
      </View>
    </Card>
  );
}

// An order the store is still preparing: readable, nothing to press yet.
export function UpcomingRunCard({ item, onPress }) {
  const cod = item.payment?.method === "cod" && item.payment?.status !== "paid";
  const place = item.pickup?.address?.city || item.pickup?.address?.line2 || item.pickup?.address?.line1 || "";

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.accent} />
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={[styles.badge, styles.badgeLg]}>
            <MaterialCommunityIcons name="storefront-outline" size={26} color="#fff" />
          </View>
          <Text style={[styles.code, { fontSize: 17 }]} numberOfLines={1} adjustsFontSizeToFit>
            {item.code}
          </Text>
          <View style={styles.soon}>
            <Ionicons name="time-outline" size={15} color={colors.primaryDark} />
            <Text style={styles.soonText}>Coming up</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.cell}>
            <MaterialCommunityIcons name="store-outline" size={22} color={colors.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={type.tiny}>Pick up from</Text>
              <Text style={styles.cellText} numberOfLines={2}>{item.pickup?.name || "Store"}</Text>
            </View>
          </View>
          <View style={styles.vline} />
          <View style={styles.cell}>
            <Ionicons name="location" size={20} color={colors.primaryDark} />
            <Text style={[styles.cellText, { flex: 1 }]} numberOfLines={2}>{place || "Store"}</Text>
          </View>
        </View>

        {/* Under each column: location icon (navigate) on the left, phone icon (call) on the right. */}
        <View style={styles.grid}>
          <View style={[styles.cell, { paddingLeft: 3 }]}>
            <Pressable
              hitSlop={12}
              onPress={() =>
                openMaps({ coordinates: item.pickup?.location?.coordinates, address: formatAddress(item.pickup?.address) })
              }
              accessibilityLabel="Navigate to store"
            >
              <Ionicons name="location" size={28} color={colors.primaryDark} />
            </Pressable>
          </View>
          <View style={[styles.vline, { backgroundColor: "transparent" }]} />
          <View style={[styles.cell, { paddingLeft: 3 }]}>
            <Pressable
              hitSlop={12}
              onPress={() => callNumber(item.pickup?.phone)}
              disabled={!item.pickup?.phone}
              accessibilityLabel="Call store"
              style={!item.pickup?.phone && { opacity: 0.35 }}
            >
              <Ionicons name="call" size={26} color={colors.primaryDark} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hline} />

        <View style={styles.grid}>
          <View style={styles.cell}>
            <MaterialCommunityIcons name="package-variant-closed" size={22} color={colors.primaryDark} />
            <Text style={styles.cellText}>
              {item.items?.length} item{item.items?.length === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.vline} />
          <View style={styles.cell}>
            <MaterialCommunityIcons name="currency-inr" size={22} color={colors.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={type.tiny}>{cod ? "Collect" : "Payment"}</Text>
              <Text style={styles.cellStrong}>{cod ? rupees(item.pricing?.total) : "Prepaid"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.hint}>
          <Ionicons name="time-outline" size={20} color={colors.primaryDark} />
          <Text style={[type.small, { flex: 1 }]}>
            The store is preparing this order. Tap to see the details — you can start it as soon as it
            is ready for pickup.
          </Text>
          <View style={styles.details}>
            <Text style={styles.detailsText}>View Details</Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", padding: 0, overflow: "hidden" },
  accent: { width: 5, backgroundColor: colors.primary },
  body: { flex: 1, padding: spacing.md, gap: spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badgeLg: { width: 48, height: 48, borderRadius: 14 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  code: { ...type.h3, flex: 1, fontVariant: ["tabular-nums"] },
  leg: { gap: 2 },
  legLabel: { ...type.tiny, textTransform: "uppercase", fontWeight: "800", letterSpacing: 0.5 },
  legName: { ...type.body, fontWeight: "700" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { ...type.body, fontWeight: "600" },
  foot: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cta: { paddingHorizontal: spacing.lg, minHeight: 44 },
  soon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  soonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
  actions: { flexDirection: "row", alignItems: "center", gap: 18 },
  legRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  grid: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cell: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cellText: { ...type.body, fontWeight: "700" },
  cellStrong: { fontSize: 17, fontWeight: "800", color: colors.text },
  vline: { width: 1, alignSelf: "stretch", backgroundColor: colors.border },
  hline: { height: 1, backgroundColor: colors.border },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  details: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailsText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
