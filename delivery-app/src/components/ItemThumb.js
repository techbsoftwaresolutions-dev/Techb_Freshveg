import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

// A product photo, sized for a list row. Falls back to the item's first
// letter when there's no image (or it fails to load), so rows stay aligned.
export function ItemThumb({ item, size = 44 }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: radius?.sm ?? 8 };

  return (
    <View style={[styles.box, box]}>
      {item?.image && !failed ? (
        <Image
          source={{ uri: item.image }}
          style={{ width: size, height: size }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={styles.letter}>{String(item?.name || "?").trim().charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

// A small overlapping-free strip of the first few product photos, with a
// "+N" chip for the rest — used on order cards in lists.
export function ItemThumbs({ items = [], max = 4, size = 36 }) {
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  if (!shown.length) return null;

  return (
    <View style={styles.strip}>
      {shown.map((item, index) => (
        <ItemThumb key={item.id || item.sku || index} item={item} size={size} />
      ))}
      {extra > 0 ? (
        <View style={[styles.box, styles.more, { width: size, height: size, borderRadius: radius?.sm ?? 8 }]}>
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border || "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  letter: { color: colors.primary, fontWeight: "800", fontSize: 16 },
  strip: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  more: { backgroundColor: colors.bg || "#F3F4F6" },
  moreText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
});
