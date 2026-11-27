import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";

// Intro page 2: the customer sits looking at their phone, and a bubble next
// to the phone shows them ordering - the cart pops up, its count goes
// 1, 2, 3 as items are added, then a green tick: order placed. Then again.
// Positions are fractions of `size`.

const G = { deep: "#0A5A29", main: "#16A04A" };

export default function OrderingScene({ size }) {
  const bubble = useRef(new Animated.Value(0)).current;
  const n1 = useRef(new Animated.Value(0)).current;
  const n2 = useRef(new Animated.Value(0)).current;
  const n3 = useRef(new Animated.Value(0)).current;
  const done = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = (v, to, d, e = Easing.out(Easing.back(1.8))) => Animated.timing(v, { toValue: to, duration: d, easing: e, useNativeDriver: true });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([n1, n2, n3, done].map((v) => t(v, 0, 0))),
        Animated.delay(400),
        t(bubble, 1, 420),
        Animated.delay(250),
        t(n1, 1, 300),
        Animated.delay(450),
        t(n2, 1, 300),
        Animated.delay(450),
        t(n3, 1, 300),
        Animated.delay(450),
        t(done, 1, 420),
        Animated.delay(1500),
        t(bubble, 0, 280, Easing.in(Easing.quad)),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bubble, n1, n2, n3, done]);

  const s = size;
  const px = (f) => f * s;
  const pop = (v) => ({ opacity: v, transform: [{ scale: v }] });

  return (
    <View style={{ width: s, height: s }}>
      <LottieView source={require("../../assets/lottie/ordering.json")} autoPlay loop resizeMode="contain" style={{ width: s, height: s }} />

      {/* The order bubble beside the phone */}
      <Animated.View
        style={[
          styles.bubble,
          { left: px(0.06), top: px(0.07), width: px(0.28), height: px(0.2), borderRadius: px(0.06) },
          pop(bubble),
        ]}
      >
        <Ionicons name="cart" size={px(0.11)} color={G.main} />
        <Animated.View style={[styles.badge, { width: px(0.085), height: px(0.085), borderRadius: px(0.0425), top: -px(0.025), right: -px(0.02) }, pop(n1)]}>
          {[
            { n: "1", o: Animated.subtract(n1, n2) },
            { n: "2", o: Animated.subtract(n2, n3) },
            { n: "3", o: n3 },
          ].map(({ n, o }) => (
            <Animated.Text key={n} style={[styles.badgeText, { fontSize: px(0.045), opacity: o }]}>
              {n}
            </Animated.Text>
          ))}
        </Animated.View>
        {/* tail pointing at the phone */}
        <View style={[styles.tail, { right: -px(0.018), bottom: px(0.04), width: px(0.04), height: px(0.04) }]} />
      </Animated.View>

      {/* Order placed */}
      <Animated.View
        style={[
          styles.done,
          { left: px(0.22), top: px(0.2), width: px(0.11), height: px(0.11), borderRadius: px(0.055), borderWidth: px(0.01) },
          pop(done),
        ]}
      >
        <Ionicons name="checkmark" size={px(0.07)} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A2A14",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  badge: { position: "absolute", backgroundColor: G.deep, alignItems: "center", justifyContent: "center" },
  badgeText: { position: "absolute", color: "#FFFFFF", fontWeight: "800" },
  tail: { position: "absolute", backgroundColor: "#FFFFFF", transform: [{ rotate: "45deg" }] },
  done: { position: "absolute", backgroundColor: G.main, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", elevation: 6 },
});
