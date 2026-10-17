import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { colors, spacing, type } from "../theme";
import { Button, EmptyState, Loading, Notice } from "../components/ui";
import ProductCard from "../components/ProductCard";

// Everything the shopper hearted (website twin: app/account/wishlist), as the
// shop's own cards: the heart takes an item off the list, "Add" puts it in the
// cart. Products come from GET /wishlist; WishlistContext only knows the ids,
// so an item un-hearted here drops out at once, before any refetch.
export default function WishlistScreen({ navigation }) {
  const { signedIn } = useAuth();
  const cart = useCart();
  const { isSaved } = useWishlist();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setError("");
    return api
      .get("/wishlist")
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err.message));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (signedIn) load();
    }, [signedIn, load])
  );

  // A guest's hearts live on the device as bare ids — they join the account
  // (and show here) once signed in.
  if (!signedIn) {
    return (
      <EmptyState
        icon="heart-outline"
        title="Sign in to see your wishlist"
        hint="Anything you heart now is kept and added to your account when you sign in."
        action={<Button title="Sign in" onPress={() => navigation.navigate("Login")} style={{ minWidth: 180 }} />}
      />
    );
  }
  if (!items && !error) return <Loading label="Loading your wishlist" />;

  const shown = (items || []).filter((item) => isSaved(item.product.id));
  const openProduct = (slug) =>
    navigation.navigate("Main", { screen: "AccountTab", params: { screen: "ProductDetail", params: { slug } } });

  return (
    <FlatList
      style={styles.screen}
      data={shown}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}
      contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {shown.length ? (
            <Text style={type.small}>
              {shown.length} saved item{shown.length === 1 ? "" : "s"}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        error ? null : (
          <EmptyState
            icon="heart-outline"
            title="Your wishlist is empty"
            hint="Tap the heart on any product to save it here for later."
            action={
              <Button
                title="Start shopping"
                onPress={() => navigation.navigate("Main", { screen: "HomeTab" })}
                style={{ minWidth: 180 }}
              />
            }
          />
        )
      }
      renderItem={({ item }) => {
        // The wishlist API has no pack label; the saved variant's name ("1 kg") is one.
        const product = { ...item.product, packLabel: item.variant?.name };
        const variantId = item.variant?.id || product.defaultVariant;
        const line = cart.items.find((i) => String(i.variant) === String(variantId));
        return (
          // Half the row even when a product is alone on the last row.
          <View style={{ flex: 1, maxWidth: "50%" }}>
            <ProductCard
              product={product}
              variant={line}
              quantity={line?.quantity || 0}
              busy={Boolean(cart.pending[variantId])}
              onPress={() => openProduct(product.slug)}
              onAdd={() => cart.add(variantId).catch(() => {})}
              onChange={(quantity) => cart.setQuantity(variantId, quantity).catch(() => {})}
              onRemove={() => cart.remove(variantId).catch(() => {})}
            />
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
