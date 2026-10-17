import React, { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "../components/Text";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { colors, radius, spacing, type } from "../theme";
import { EmptyState, Loading, Pill } from "../components/ui";
import ProductCard from "../components/ProductCard";
import { useTabBarScroll, useTabBarSpace } from "../navigation/tabBarScroll";

const POPULAR = ["Tomato", "Onion", "Rice", "Milk", "Apple", "Atta", "Oil"];

export default function SearchScreen({ navigation, route }) {
  const scroll = useTabBarScroll();
  const { space } = useTabBarSpace();
  const { storeId } = useStore();
  const cart = useCart();

  // A banner or link can open search with a term already in place.
  const [term, setTerm] = useState(route.params?.q || "");
  const [results, setResults] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    clearTimeout(debounce.current);

    if (term.trim().length < 2) {
      setResults(null);
      setSuggestions([]);
      return;
    }

    // Debounced so typing "tomato" is one request, not six.
    setLoading(true);
    debounce.current = setTimeout(() => {
      api
        .get("/storefront/search", { q: term.trim(), store: storeId || undefined, limit: 20 })
        .then((data) => {
          setResults(data.items);
          setSuggestions(data.suggestions || []);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 280);

    return () => clearTimeout(debounce.current);
  }, [term, storeId]);

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={19} color={colors.textMuted} />
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Search for “Tomatoes”"
          placeholderTextColor={colors.textFaint}
          autoFocus
          returnKeyType="search"
          style={styles.input}
        />
        {term ? (
          <Pressable onPress={() => setTerm("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {!results ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={type.h3}>Popular searches</Text>
          <View style={styles.chipWrap}>
            {POPULAR.map((word) => (
              <Pressable key={word} style={styles.chip} onPress={() => setTerm(word)}>
                <Text style={styles.chipText}>{word}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : loading ? (
        <Loading />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xxl + space }}
          {...scroll}
          ListHeaderComponent={
            suggestions.length ? (
              <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 6 }}>
                <Text style={type.small}>Categories</Text>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {suggestions.map((category) => (
                    <Pressable
                      key={category.id}
                      onPress={() =>
                        navigation.navigate("ProductList", { slug: category.slug, title: category.name })
                      }
                    >
                      <Pill tone="primary">{category.name}</Pill>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={`Nothing for "${term}"`}
              hint="Try a shorter word, or browse the categories."
            />
          }
          renderItem={({ item }) => {
            const variantId = item.defaultVariant;
            const line = cart.items.find((i) => String(i.variant) === String(variantId));
            return (
              <View style={styles.cell}>
                <ProductCard
                  product={item}
                  variant={line}
                  quantity={line?.quantity || 0}
                  busy={Boolean(cart.pending[variantId])}
                  onPress={() => navigation.navigate("ProductDetail", { slug: item.slug })}
                  onAdd={() => cart.add(variantId).catch(() => {})}
                  onChange={(q) => cart.setQuantity(variantId, q).catch(() => {})}
                  onRemove={() => cart.remove(variantId).catch(() => {})}
                />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // The website's search pill.
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    margin: spacing.lg,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#F2F4F3",
    borderWidth: 1,
    borderColor: colors.border,
  },
  // minWidth 0: a web TextInput otherwise keeps an intrinsic width and pushes
  // past the right edge.
  input: { flex: 1, minWidth: 0, height: "100%", fontSize: 15, color: colors.text },
  // Half the row even when a result is alone on its row.
  cell: { flex: 1, maxWidth: "50%" },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    height: 32,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
});
