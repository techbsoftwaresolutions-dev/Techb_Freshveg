import React, { useCallback, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../components/AppText";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading, Pill } from "../components/ui";

// Everything the shopper has hearted, with what changed since: a price drop,
// or back in stock. Needs an account — a guest's hearts only live on the phone.
export default function WishlistScreen({ navigation }) {
  const { signedIn } = useAuth();
  const cart = useCart();
  const wishlist = useWishlist();
  const [items, setItems] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/wishlist");
      setItems(data.items || []);
      setError("");
    } catch (err) {
      setError(err.message);
      setItems((current) => current || []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (signedIn) load();
    }, [signedIn, load])
  );

  if (!signedIn) {
    return (
      <EmptyState
        title="Sign in to see your saved items"
        hint="Tap the heart on any product to keep it here."
        action={<Button title="Sign in" onPress={() => navigation.navigate("Login")} />}
      />
    );
  }
  if (items === null) return <Loading />;

  async function remove(item) {
    setItems((list) => list.filter((x) => x.id !== item.id));
    await wishlist.toggle(item.product.id).catch(() => {});
  }

  async function addToCart(item) {
    const variantId = item.variant?.id || (item.product.variantCount > 1 ? null : item.product.defaultVariant);
    if (!variantId) return navigation.navigate("ProductDetail", { slug: item.product.slug });
    await cart.add(variantId, 1).catch(() => {});
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        <EmptyState
          title="Nothing saved yet"
          hint={error || "Tap the heart on any product to keep it here for later."}
          action={<Button title="Start shopping" onPress={() => navigation.navigate("Main", { screen: "HomeTab" })} />}
        />
      }
      renderItem={({ item }) => {
        const price = item.variant?.sellingPrice ?? item.product.priceFrom;
        const mrp = item.variant?.mrp ?? item.product.mrpFrom;
        const image = item.product.media?.[0]?.url;
        const out = !item.product.inStock;
        return (
          <Card style={styles.row}>
            <Pressable
              style={styles.imageBox}
              onPress={() => navigation.navigate("ProductDetail", { slug: item.product.slug })}
            >
              {image ? <Image source={{ uri: image }} style={[styles.image, out && { opacity: 0.45 }]} resizeMode="contain" /> : null}
            </Pressable>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
              <Text style={type.small} numberOfLines={1}>{item.variant?.name || item.product.unit || ""}</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={styles.price}>{rupees(price)}</Text>
                {mrp > price ? <Text style={styles.mrp}>{rupees(mrp)}</Text> : null}
              </View>
              {item.priceDropped ? <Pill tone="save">Price dropped by {rupees(item.priceDrop)}</Pill> : null}
              {out ? <Pill tone="danger">Out of stock</Pill> : null}
            </View>
            <View style={{ gap: spacing.sm, alignItems: "flex-end" }}>
              <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityLabel="Remove from saved">
                <Text style={styles.remove}>✕</Text>
              </Pressable>
              <Button title="Add" size="sm" disabled={out} onPress={() => addToCart(item)} />
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  imageBox: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  image: { width: "86%", height: "86%" },
  name: { fontSize: 14, fontWeight: "600", color: colors.text },
  price: { fontSize: 15, fontWeight: "800", color: colors.text },
  mrp: { fontSize: 12, color: colors.textFaint, textDecorationLine: "line-through" },
  remove: { fontSize: 16, color: colors.textFaint },
});
