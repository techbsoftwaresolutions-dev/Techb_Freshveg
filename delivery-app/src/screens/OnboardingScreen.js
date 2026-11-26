import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import MapToLocation from "../components/MapToLocation";
import OrderingScene from "../components/OrderingScene";
import WelcomeRide from "../components/WelcomeRide";

// Four intro pages before the login, laid out like the design reference:
// white screen, round back button and "Skip" pill on top, the animation on a
// big yellow circle in the middle, page dots bottom-left and a dark round
// arrow button bottom-right whose yellow ring fills up page by page.
// Only pictures - no titles or text. Skip and the last arrow open the login.
// Animations: assets/lottie (see CREDITS.md there).

const C = {
  bg: "#FFFFFF",
  soft: "#F3F3F3", // back button, Skip border
  circle: "#DDF3E4", // big circle behind the art (light brand green)
  halo: "#F1FAF4", // pale ring around it
  accent: "#16A04A", // active dot + progress ring (brand green)
  dot: "#E6E6E6",
  dark: "#0A5A29", // arrow button + icons (deep brand green)
};

const PAGES = [
  // scale: some animations fill less of their canvas, so show them bigger.
  // ride: box opens, groceries go in, then he rides off (WelcomeRide).
  { key: "welcome", ride: true, scale: 1.55 },
  // order: the customer on their phone with the order bubble (OrderingScene).
  { key: "ordering", order: true },
  // map: the rider riding along a map route to the customer's pin (MapToLocation).
  { key: "location", map: true },
  { key: "delivered", anim: require("../../assets/lottie/delivered.json"), scale: 1.05 },
];

// The green ring around the arrow button: a quarter more of it per page.
function ProgressRing({ part, size }) {
  const quarters = Math.round(part * 4);
  const sides = ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"];
  const style = { width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: "transparent" };
  sides.slice(0, quarters).forEach((s) => (style[s] = C.accent));
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, style, { transform: [{ rotate: "-45deg" }] }]} />;
}

export default function OnboardingScreen({ onDone }) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const page = PAGES[index];
  const last = index === PAGES.length - 1;

  const artIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    artIn.setValue(0);
    Animated.timing(artIn, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, artIn]);

  const circle = Math.min(width * 0.72, height * 0.38, 320);
  const art = circle * 1.12;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <Pressable
          onPress={() => index > 0 && setIndex(index - 1)}
          hitSlop={10}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={C.dark} />
        </Pressable>
        <Pressable onPress={onDone} hitSlop={10} style={styles.skip} accessibilityRole="button" accessibilityLabel="Skip">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <View style={[styles.halo, { width: circle * 1.12, height: circle * 1.12, borderRadius: circle * 0.56 }]} />
        <View style={[styles.circle, { width: circle, height: circle, borderRadius: circle / 2 }]} />
        <Animated.View
          style={{ position: "absolute", opacity: artIn, transform: [{ scale: artIn.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}
        >
          {page.ride ? (
            <WelcomeRide key={page.key} size={art * page.scale} />
          ) : page.map ? (
            <MapToLocation key={page.key} size={circle} />
          ) : page.order ? (
            <OrderingScene key={page.key} size={art} />
          ) : (
            <LottieView
              key={page.key}
              source={page.anim}
              autoPlay
              loop
              resizeMode="contain"
              style={{
                width: art * (page.scale || 1),
                height: art * (page.scale || 1),
                transform: page.flip ? [{ scaleX: -1 }] : undefined,
              }}
            />
          )}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View key={p.key} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
        <Pressable
          onPress={() => (last ? onDone?.() : setIndex(index + 1))}
          accessibilityRole="button"
          accessibilityLabel={last ? "Login" : "Next"}
          style={({ pressed }) => [styles.nextWrap, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <ProgressRing part={(index + 1) / PAGES.length} size={64} />
          <View style={styles.next}>
            <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  back: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" },
  skip: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.soft,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  skipText: { fontSize: 15, color: "#555555" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", backgroundColor: C.halo },
  circle: { position: "absolute", backgroundColor: C.circle },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingBottom: 26,
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.dot },
  dotOn: { width: 36, backgroundColor: C.accent },
  nextWrap: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  next: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.dark, alignItems: "center", justifyContent: "center" },
});
