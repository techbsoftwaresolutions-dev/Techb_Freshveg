import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Text } from "./Text";
import { colors, radius, spacing } from "../theme";

// A frame of a Cloudinary video as a JPEG — the same transform the website
// uses (website/lib/format.js videoPoster), so the hero is never black while
// the video loads, and is what shows when it can't play.
const poster = (url, width = 900) =>
  typeof url === "string" && url.includes("/video/upload/")
    ? url.replace("/video/upload/", `/video/upload/so_0,q_auto,w_${width},c_limit/`).replace(/\.\w+$/, ".jpg")
    : undefined;

// The website's mobile shade (.video-hero-shade): dark green, heaviest at the
// foot where the words are. Bands stand in for a CSS gradient, which React
// Native has no portable equivalent of without another dependency.
const BANDS = 32;

// The website's Video Hero (website/components/VideoHero.jsx) for the app:
// the admin's playlist, muted and looping, behind their text and a CTA. Pauses
// off-screen; reduced motion or a playlist that won't play leaves the poster.
export default function VideoHeroBanner({ videos, text, ctaLabel, onPress }) {
  const { width: windowWidth } = useWindowDimensions();
  const focused = useIsFocused();
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const failures = useRef(new Set());
  const count = videos.length;

  const player = useVideoPlayer(videos[0].url, (p) => {
    p.muted = true;
    p.loop = count === 1;
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);

  // Which entry is loaded, and whether it should be playing — read by the
  // player's listeners, which outlive any one render.
  const current = useRef(0);
  const active = useRef(true);
  const still = reduced || failed;

  useEffect(() => {
    // One video loops by itself; a playlist steps to the next entry that has
    // not failed, round and round.
    const next = (from) => {
      for (let step = 1; step <= count; step += 1) {
        const candidate = (from + step) % count;
        if (!failures.current.has(candidate)) return candidate;
      }
      return -1;
    };
    const go = (to) => {
      current.current = to;
      setIndex(to);
      player.replace(videos[to].url);
      if (active.current) player.play();
    };
    const ended = player.addListener("playToEnd", () => {
      const to = count > 1 ? next(current.current) : -1;
      if (to >= 0) go(to);
    });
    const status = player.addListener("statusChange", ({ status: state }) => {
      if (state === "readyToPlay") setReady(true);
      if (state !== "error") return;
      failures.current.add(current.current);
      const to = next(current.current);
      if (to < 0) setFailed(true);
      else go(to);
    });
    return () => {
      ended.remove();
      status.remove();
    };
  }, [player, videos, count]);

  useEffect(() => {
    active.current = !still && focused;
    if (active.current) player.play();
    else player.pause();
  }, [player, still, focused]);

  // Sized like the classic banner beside it (HomeScreen BannerStrip): a card
  // inset 16 from each edge, its height following its width. Taller than the
  // banner, because the words and a full-size button sit on the footage.
  // A minimum, not a fixed height: longer words grow the card.
  const width = Math.max(windowWidth - spacing.lg * 2, 0);
  const minHeight = Math.round(Math.min(Math.max(width / 1.25, 240), 420));
  // The website's clamp(22px, 6.4vw, 28px).
  const fontSize = Math.round(Math.min(Math.max(windowWidth * 0.064, 22), 28));
  const frame = poster(videos[index]?.url) || poster(videos[0].url);

  return (
    <View style={[styles.hero, { width, minHeight }]}>
      {frame ? <Image source={{ uri: frame }} style={styles.fill} resizeMode="cover" /> : null}
      {still ? null : (
        <VideoView
          player={player}
          style={[styles.fill, { opacity: ready ? 1 : 0 }]}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
          playsInline
          accessible={false}
        />
      )}

      <HeroShade fromLeft />
      <HeroShade />

      <View style={styles.copy}>
        {text ? <Text style={[styles.text, { fontSize, lineHeight: Math.round(fontSize * 1.22) }]}>{text}</Text> : null}
        {ctaLabel ? (
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.cta, pressed && { backgroundColor: colors.primarySoft }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Also behind the words on the classic banners (HomeScreen). `fromLeft` is
// the website's second, sideways shade: darkest at the left edge, gone by 70%.
export function HeroShade({ style, fromLeft = false }) {
  return (
    <View style={[fromLeft ? styles.shadeLeft : styles.shade, style]} pointerEvents="none">
      {Array.from({ length: BANDS }, (_, i) => {
        const alpha = fromLeft ? 0.55 * (1 - i / BANDS) : (0.7 * (i + 1)) / BANDS;
        return <View key={i} style={{ flex: 1, backgroundColor: `rgba(8, 28, 15, ${alpha.toFixed(3)})` }} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: colors.primaryDeep,
  },
  // On the web the VideoView is a bare <video>, which, unlike a div, does not
  // stretch between top/left/right/bottom: 0 and stays at the clip's own
  // resolution, so a phone showed a cropped corner of it. The explicit 100%
  // sizes make it fill the card, and contentFit "cover" crops it evenly.
  fill: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  shade: { ...StyleSheet.absoluteFillObject, top: "40%" },
  shadeLeft: { ...StyleSheet.absoluteFillObject, right: "30%", flexDirection: "row" },
  copy: { padding: spacing.lg, paddingTop: 48 },
  text: {
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
    maxWidth: 340,
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  cta: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  ctaText: { fontSize: 16, fontWeight: "700", color: colors.primaryDark },
});
