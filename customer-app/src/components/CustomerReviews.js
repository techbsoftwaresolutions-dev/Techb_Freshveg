import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { colors, fontFamily, radius, spacing, type } from "../theme";
import { Card, Loading } from "./ui";

// Star-count -> how a grocery shopper actually talks about a rating. The
// reference design came from a shoe listing ("Perfect Fit" etc.) — these
// labels are reworded for produce and packaged goods instead.
const SENTIMENT = {
  5: { label: "Excellent", color: colors.primaryDark, bg: colors.primarySoft },
  4: { label: "Good", color: colors.save, bg: colors.saveSoft },
  3: { label: "Average", color: colors.warn, bg: colors.warnSoft },
  2: { label: "Below Average", color: colors.warn, bg: colors.warnSoft },
  1: { label: "Poor", color: colors.danger, bg: colors.dangerSoft },
};

function Stars({ value, size = 13 }) {
  const rounded = Math.round(value || 0);
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text
          key={n}
          style={{
            fontSize: size,
            lineHeight: size + 2,
            fontFamily: fontFamily.regular,
            color: n <= rounded ? "#F5A623" : colors.border,
            marginRight: 1,
          }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Fetches and renders the product page's "Ratings & Reviews" section: the
// average + sentiment breakdown, a "Real Photos" strip pulled from every
// review's images, and the individual review cards. Lives as its own
// component (rather than inline in ProductDetailScreen) because it owns a
// fetch and a fair amount of local state — read-more toggles, optimistic
// "Helpful" taps — that would otherwise clutter the screen's own state.
export default function CustomerReviews({ productId, ratingAverage = 0, ratingCount = 0 }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [helpfulGiven, setHelpfulGiven] = useState({});

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    api
      .get(`/reviews/product/${productId}`, { limit: 10 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items || []);
        setMeta(res.meta || null);
        setBreakdown(res.breakdown || []);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const photos = useMemo(
    () => items.flatMap((r) => (r.images || []).map((uri, i) => ({ uri, key: `${r.id}-${i}` }))),
    [items]
  );

  const maxBarCount = Math.max(1, ...breakdown.map((b) => b.count), 0);

  const onHelpful = (review) => {
    if (helpfulGiven[review.id]) return;
    setHelpfulGiven((prev) => ({ ...prev, [review.id]: true }));
    setItems((prev) =>
      prev.map((r) => (r.id === review.id ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r))
    );
    // Best-effort — an optimistic bump that fails silently just stays local
    // for the rest of this visit rather than blocking the tap on a reply.
    api.post(`/reviews/${review.id}/helpful`).catch(() => {});
  };

  if (!productId || failed) return null;

  if (loading) {
    return (
      <>
        <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
        <Loading />
      </>
    );
  }

  const totalReviews = meta?.total ?? items.length;
  const visiblePhotos = photos.slice(0, 6);
  const extraPhotoCount = photos.length - visiblePhotos.length;

  return (
    <>
      <Text style={styles.sectionTitle}>Ratings & Reviews</Text>

      {totalReviews ? (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryAverage}>{(ratingAverage || 0).toFixed(1)}</Text>
              <Stars value={ratingAverage} size={14} />
              <Text style={styles.summarySub}>
                {ratingCount} Rating{ratingCount === 1 ? "" : "s"}
              </Text>
              <Text style={styles.summarySub}>
                {totalReviews} Review{totalReviews === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={styles.summaryRight}>
              {breakdown.map((row) => (
                <View key={row.stars} style={styles.barRow}>
                  <Text
                    style={[styles.barLabel, { color: SENTIMENT[row.stars]?.color }]}
                    numberOfLines={1}
                  >
                    {SENTIMENT[row.stars]?.label}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.round((row.count / maxBarCount) * 100)}%`,
                          backgroundColor: SENTIMENT[row.stars]?.color,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.barCount, { color: SENTIMENT[row.stars]?.color }]}
                  >
                    {row.count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Card>
      ) : (
        <Text style={[type.small, { marginBottom: spacing.lg }]}>
          No reviews yet — be the first to review this product after it's delivered to you.
        </Text>
      )}

      {visiblePhotos.length ? (
        <>
          <Text style={styles.photosLabel}>Real Photos ({photos.length})</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photosRow}
          >
            {visiblePhotos.map((photo, index) => {
              const isLast = index === visiblePhotos.length - 1 && extraPhotoCount > 0;
              return (
                <View key={photo.key} style={styles.photoTile}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                  {isLast ? (
                    <View style={styles.photoOverlay}>
                      <Text style={styles.photoOverlayText}>+{extraPhotoCount} More</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {items.length ? (
        <View style={{ gap: spacing.md }}>
          {items.map((review) => {
            const isExpanded = Boolean(expanded[review.id]);
            const sentiment = SENTIMENT[review.productRating] || SENTIMENT[3];
            return (
              <Card key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeadRow}>
                  <View style={[styles.sentimentBadge, { backgroundColor: sentiment.bg }]}>
                    <Text style={[styles.sentimentStars, { color: sentiment.color }]}>
                      {"★".repeat(review.productRating || 0)}
                    </Text>
                    <Text style={[styles.sentimentLabel, { color: sentiment.color }]}>
                      {sentiment.label}
                    </Text>
                  </View>
                  <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                </View>

                {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}

                {review.comment ? (
                  <>
                    <Text style={styles.reviewText} numberOfLines={isExpanded ? undefined : 3}>
                      {review.comment}
                    </Text>
                    {review.comment.length > 120 ? (
                      <Pressable
                        onPress={() => setExpanded((prev) => ({ ...prev, [review.id]: !isExpanded }))}
                        hitSlop={6}
                      >
                        <Text style={styles.readMore}>{isExpanded ? "Read Less" : "Read More"}</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}

                {review.images?.length ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.sm }}
                  >
                    {review.images.map((uri, index) => (
                      <Image key={index} source={{ uri }} style={styles.reviewImage} resizeMode="cover" />
                    ))}
                  </ScrollView>
                ) : null}

                <Text style={styles.reviewerName}>
                  {review.customerName || "Shopper"}
                  {review.verifiedPurchase ? <Text style={styles.verified}>   •   Verified Purchase</Text> : null}
                </Text>

                <Pressable
                  onPress={() => onHelpful(review)}
                  style={[styles.helpfulBtn, helpfulGiven[review.id] && styles.helpfulBtnActive]}
                  hitSlop={6}
                >
                  <Text style={[styles.helpfulText, helpfulGiven[review.id] && styles.helpfulTextActive]}>
                    Helpful ({review.helpfulCount || 0})
                  </Text>
                </Pressable>
              </Card>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...type.h2, marginTop: spacing.xl, marginBottom: spacing.md },

  summaryCard: { padding: spacing.md, marginBottom: spacing.lg },
  summaryRow: { flexDirection: "row", gap: spacing.lg },
  summaryLeft: { width: 84, alignItems: "flex-start", gap: 4 },
  summaryAverage: { fontSize: 30, fontFamily: fontFamily.extrabold, color: colors.text },
  summarySub: { ...type.tiny, marginTop: 2 },
  summaryRight: { flex: 1, justifyContent: "center", gap: 6 },

  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { ...type.tiny, width: 84, fontFamily: fontFamily.semibold },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  barCount: { ...type.tiny, width: 20, textAlign: "right", fontFamily: fontFamily.semibold },

  photosLabel: { ...type.h3, marginBottom: spacing.sm },
  photosRow: { gap: spacing.sm, paddingBottom: spacing.lg },
  photoTile: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
  },
  photoImage: { width: "100%", height: "100%" },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoOverlayText: { color: "#fff", fontSize: 12, fontFamily: fontFamily.bold },

  reviewCard: { padding: spacing.md },
  reviewHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sentimentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  sentimentStars: { fontSize: 11, fontFamily: fontFamily.regular },
  sentimentLabel: { fontSize: 11, fontFamily: fontFamily.semibold },
  reviewDate: { ...type.tiny },

  reviewTitle: { ...type.h3, marginTop: spacing.sm },
  reviewText: { ...type.body, marginTop: spacing.sm, lineHeight: 19 },
  readMore: { color: colors.primary, fontFamily: fontFamily.semibold, fontSize: 12.5, marginTop: 4 },

  reviewImage: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },

  reviewerName: { ...type.small, fontFamily: fontFamily.semibold, color: colors.text, marginTop: spacing.sm },
  verified: { fontSize: 11, fontFamily: fontFamily.regular, color: colors.save },

  helpfulBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpfulBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  helpfulText: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.textMuted },
  helpfulTextActive: { color: colors.primaryDark },
});
