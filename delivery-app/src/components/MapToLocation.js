import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";

// Intro page 3: a little map in a circle. The delivery rider rides along the
// route (the dots light up behind him) to the customer's pin, the pin pulses
// and a tick pops when he arrives. Then it starts again.
// All positions are fractions of `size` so it scales to any screen.

const G = { deep: "#0A5A29", dark: "#0F7A38", main: "#16A04A", mid: "#4CC274", soft: "#BFE8CC" };

// Route on the map (x, y as fractions): up the left road, along the middle
// road, up the right road to the customer's house.
const ROUTE = [
  [0.3, 0.98],
  [0.3, 0.66],
  [0.7, 0.66],
  [0.7, 0.5],
];
// The pin sits just past the end of the route, so the rider stops in front of
// it instead of covering it.
const PIN = [0.7, 0.24];
const LENS = ROUTE.slice(1).map(([x, y], i) => Math.hypot(x - ROUTE[i][0], y - ROUTE[i][1]));
const TOTAL = LENS.reduce((a, b) => a + b, 0);
const STOPS = LENS.reduce((acc, l) => [...acc, acc[acc.length - 1] + l / TOTAL], [0]);
// Dots every ~6% of the size along the route, with the progress at which each is reached.
const DOTS = (() => {
  const out = [];
  let done = 0;
  ROUTE.slice(1).forEach(([x, y], i) => {
    const [x0, y0] = ROUTE[i];
    const n = Math.max(1, Math.round(LENS[i] / 0.06));
    for (let k = 1; k <= n; k += 1) {
      const f = k / n;
      out.push({ x: x0 + (x - x0) * f, y: y0 + (y - y0) * f, at: (done + LENS[i] * f) / TOTAL });
    }
    done += LENS[i];
  });
  return out;
})();

export default function MapToLocation({ size }) {
  const ride = useRef(new Animated.Value(0)).current;
  const arrive = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ride, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(arrive, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(250),
        Animated.timing(ride, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(arrive, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    );
    const beat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    beat.start();
    return () => {
      loop.stop();
      beat.stop();
    };
  }, [ride, arrive, fade, pulse]);

  const s = size;
  const px = (f) => f * s;
  const along = (i) => ride.interpolate({ inputRange: STOPS, outputRange: ROUTE.map((p) => px(p[i])) });
  const riderSize = s * 0.34;
  const road = s * 0.085;

  return (
    <View style={{ width: s, height: s }}>
      {/* The map, clipped to the circle */}
      <View style={[styles.map, { width: s, height: s, borderRadius: s / 2 }]}>
        {/* blocks and park */}
        <View style={[styles.block, { left: px(0.02), top: px(0.06), width: px(0.22), height: px(0.2), backgroundColor: "#E7F1EA" }]} />
        <View style={[styles.block, { left: px(0.36), top: px(0.04), width: px(0.28), height: px(0.22), backgroundColor: G.soft }]}>
          {[[0.2, 0.35], [0.55, 0.6], [0.75, 0.3]].map(([x, y]) => (
            <View key={x} style={[styles.tree, { left: `${x * 100}%`, top: `${y * 100}%`, width: px(0.06), height: px(0.06), borderRadius: px(0.03) }]} />
          ))}
        </View>
        <View style={[styles.block, { left: px(0.76), top: px(0.4), width: px(0.22), height: px(0.2), backgroundColor: "#E7F1EA" }]} />
        <View style={[styles.block, { left: px(0.36), top: px(0.4), width: px(0.28), height: px(0.2), backgroundColor: "#DCEDE1" }]} />
        <View style={[styles.block, { left: px(0.02), top: px(0.4), width: px(0.22), height: px(0.2), backgroundColor: G.soft }]} />
        <View style={[styles.block, { left: px(0.36), top: px(0.72), width: px(0.28), height: px(0.24), backgroundColor: "#E7F1EA" }]} />
        <View style={[styles.block, { left: px(0.76), top: px(0.72), width: px(0.22), height: px(0.22), backgroundColor: "#DCEDE1" }]} />
        {/* roads */}
        <View style={[styles.road, { left: 0, right: 0, top: px(0.34) - road / 2, height: road }]} />
        <View style={[styles.road, { left: 0, right: 0, top: px(0.66) - road / 2, height: road }]} />
        <View style={[styles.road, { top: 0, bottom: 0, left: px(0.3) - road / 2, width: road }]} />
        <View style={[styles.road, { top: 0, bottom: 0, left: px(0.7) - road / 2, width: road }]} />
        {/* the customer's house at the pin */}
        <View style={[styles.house, { left: px(0.77), top: px(0.17), width: px(0.14), height: px(0.12), borderRadius: px(0.02) }]}>
          <Ionicons name="home" size={px(0.08)} color={G.deep} />
        </View>
      </View>

      {/* Route dots: grey, turning green as the rider passes */}
      {DOTS.map((d, i) => (
        <View key={i} pointerEvents="none" style={[styles.dotWrap, { left: px(d.x) - px(0.018), top: px(d.y) - px(0.018), width: px(0.036), height: px(0.036) }]}>
          <View style={[styles.dot, { borderRadius: px(0.018), backgroundColor: "#B9C9BE" }]} />
          <Animated.View
            style={[
              styles.dot,
              StyleSheet.absoluteFill,
              {
                borderRadius: px(0.018),
                backgroundColor: G.main,
                opacity: ride.interpolate({ inputRange: [Math.max(0, d.at - 0.02), d.at], outputRange: [0, 1], extrapolate: "clamp" }),
              },
            ]}
          />
        </View>
      ))}

      {/* Customer's pin: pulses, bounces when the rider arrives */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: px(PIN[0]) - px(0.09),
          top: px(PIN[1] + 0.06) - px(0.03),
          width: px(0.18),
          height: px(0.06),
          borderRadius: px(0.09),
          backgroundColor: G.main,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: px(PIN[0]) - px(0.09),
          top: px(PIN[1]) - px(0.15),
          transform: [
            { translateY: arrive.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -px(0.05), 0] }) },
            { scale: arrive.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
          ],
        }}
      >
        <Ionicons name="location" size={px(0.18)} color={G.deep} />
      </Animated.View>

      {/* The rider moving along the route */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -riderSize / 2,
          top: -riderSize * 0.72,
          width: riderSize,
          height: riderSize,
          opacity: fade,
          transform: [{ translateX: along(0) }, { translateY: along(1) }],
        }}
      >
        <LottieView
          source={require("../../assets/lottie/welcome-rider.json")}
          autoPlay
          loop
          resizeMode="contain"
          style={{ width: riderSize * 1.6, height: riderSize * 1.6, marginLeft: -riderSize * 0.3, marginTop: -riderSize * 0.3, transform: [{ scaleX: -1 }] }}
        />
      </Animated.View>

      {/* Arrived tick */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tick,
          {
            left: px(PIN[0]) + px(0.05),
            top: px(PIN[1]) - px(0.2),
            width: px(0.1),
            height: px(0.1),
            borderRadius: px(0.05),
            opacity: arrive,
            transform: [{ scale: arrive }],
          },
        ]}
      >
        <Ionicons name="checkmark" size={px(0.065)} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { position: "absolute", left: 0, top: 0, overflow: "hidden", backgroundColor: "#EEF7F0" },
  block: { position: "absolute", borderRadius: 10 },
  tree: { position: "absolute", backgroundColor: "#4CC274" },
  road: { position: "absolute", backgroundColor: "#FFFFFF" },
  house: { position: "absolute", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", elevation: 2 },
  dotWrap: { position: "absolute" },
  dot: { flex: 1 },
  tick: {
    position: "absolute",
    backgroundColor: "#16A04A",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
});
