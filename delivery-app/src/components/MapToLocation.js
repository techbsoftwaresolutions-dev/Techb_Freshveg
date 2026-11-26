import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Intro page 3: a little map in a circle. The delivery rider rides along the
// route (the dots light up behind him): straight up the road, turns left,
// up again, turns right and on to the customer's pin. He slows down at each
// corner and the scooter turns to point along the new road. He is drawn from
// above (like the rider on a delivery-tracking map) so he looks right whichever
// way he points. The pin pulses and a tick pops when he arrives. Then it
// starts again.
// All positions are fractions of `size` so it scales to any screen.

const G = { deep: "#0A5A29", dark: "#0F7A38", main: "#16A04A", mid: "#4CC274", soft: "#BFE8CC" };

// Route on the map (x, y as fractions): straight up the right road, left
// along the middle road, up the left road, then right along the top road
// towards the customer's house.
const ROUTE = [
  [0.7, 0.9],
  [0.7, 0.66],
  [0.3, 0.66],
  [0.3, 0.34],
  [0.47, 0.34],
];
// Which way the scooter points on each leg, in degrees (0 = up the screen,
// -90 = left, 90 = right). It turns a quarter turn at each corner.
const HEADING = [
  0, // straight up
  -90, // turn left
  0, // turn right, up again
  90, // turn right, to the customer
];
// The pin sits just past the end of the route, so the rider stops in front of
// it instead of covering it.
const PIN = [0.7, 0.24];
const LENS = ROUTE.slice(1).map(([x, y], i) => Math.hypot(x - ROUTE[i][0], y - ROUTE[i][1]));
const TOTAL = LENS.reduce((a, b) => a + b, 0);
const STOPS = LENS.reduce((acc, l) => [...acc, acc[acc.length - 1] + l / TOTAL], [0]);
const RIDE_MS = 5600; // whole route
// Turning: around each corner the scooter swings a quarter turn to the new road.
const TURN = 0.03;
const TURN_IN = [0];
const ANGLE_OUT = [`${HEADING[0]}deg`];
HEADING.forEach((h, i) => {
  if (i === 0) return;
  TURN_IN.push(STOPS[i] - TURN, STOPS[i] + TURN);
  ANGLE_OUT.push(`${HEADING[i - 1]}deg`, `${h}deg`);
});
TURN_IN.push(1);
ANGLE_OUT.push(`${HEADING[HEADING.length - 1]}deg`);

// The rider seen from above, nose pointing up. Each part is a rounded box in
// fractions of the scooter's length: x, y, w, h, corner radius r, colour c.
// Drawn in order, so later parts sit on top.
const LOGO = require("../../assets/logo-mark.png");
const SKIN = "#F5A97F";
const TYRE = "#263238";
const SCOOTER_W = 0.6; // width as a fraction of the length
const SCOOTER = [
  { x: 0.1, y: 0.05, w: 0.46, h: 0.93, r: 0.2, c: "rgba(10,60,30,0.16)" }, // shadow
  { x: 0.17, y: -0.13, w: 0.26, h: 0.17, r: 0.13, c: "rgba(255,226,120,0.5)" }, // headlight glow
  { x: 0.235, y: 0, w: 0.13, h: 0.2, r: 0.06, c: TYRE }, // front wheel
  { x: 0.235, y: 0.8, w: 0.13, h: 0.2, r: 0.06, c: TYRE }, // back wheel
  { x: 0.16, y: 0.1, w: 0.28, h: 0.74, r: 0.14, c: G.main }, // scooter body
  { x: 0.19, y: 0.09, w: 0.22, h: 0.13, r: 0.09, c: G.deep }, // front shield
  { x: 0.25, y: 0.085, w: 0.1, h: 0.035, r: 0.02, c: "#FFF4C2" }, // headlamp
  { x: 0.09, y: 0.56, w: 0.42, h: 0.4, r: 0.05, c: "#FFFFFF", b: G.deep }, // delivery box
  { x: 0.12, y: 0.6, w: 0.36, h: 0.32, logo: true }, // HB logo on the box lid
  { x: 0.03, y: 0.205, w: 0.54, h: 0.045, r: 0.02, c: "#37474F" }, // handlebar
  { x: 0.075, y: 0.215, w: 0.075, h: 0.24, r: 0.035, c: SKIN }, // left arm
  { x: 0.45, y: 0.215, w: 0.075, h: 0.24, r: 0.035, c: SKIN }, // right arm
  { x: 0.055, y: 0.19, w: 0.1, h: 0.075, r: 0.035, c: SKIN }, // left hand
  { x: 0.445, y: 0.19, w: 0.1, h: 0.075, r: 0.035, c: SKIN }, // right hand
  { x: 0.06, y: 0.37, w: 0.48, h: 0.19, r: 0.09, c: G.dark }, // shoulders (green T-shirt)
  { x: 0.165, y: 0.3, w: 0.27, h: 0.27, r: 0.135, c: G.main }, // helmet
  { x: 0.205, y: 0.305, w: 0.19, h: 0.07, r: 0.035, c: G.deep }, // visor, at the front
  { x: 0.25, y: 0.42, w: 0.1, h: 0.06, r: 0.03, c: "rgba(255,255,255,0.45)" }, // helmet shine
];

function Scooter({ length }) {
  const L = length;
  return (
    <View style={{ width: L * SCOOTER_W, height: L }}>
      {SCOOTER.map((p, i) =>
        p.logo ? (
          <Image
            key={i}
            source={LOGO}
            resizeMode="contain"
            style={{ position: "absolute", left: p.x * L, top: p.y * L, width: p.w * L, height: p.h * L }}
          />
        ) : (
          <View
            key={i}
            style={{
              position: "absolute",
              left: p.x * L,
              top: p.y * L,
              width: p.w * L,
              height: p.h * L,
              borderRadius: p.r * L,
              backgroundColor: p.c,
              borderWidth: p.b ? Math.max(1, L * 0.015) : 0,
              borderColor: p.b,
            }}
          />
        )
      )}
    </View>
  );
}

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
        // one leg at a time, slowing into each corner and pulling away again
        ...LENS.map((l, i) =>
          Animated.timing(ride, {
            toValue: STOPS[i + 1],
            duration: (RIDE_MS * l) / TOTAL,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          })
        ),
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
  const scooter = s * 0.24; // length of the scooter
  const heading = ride.interpolate({ inputRange: TURN_IN, outputRange: ANGLE_OUT });
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

      {/* The rider moving along the route, centred on the road and pointing along it */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -(scooter * SCOOTER_W) / 2,
          top: -scooter / 2,
          opacity: fade,
          transform: [{ translateX: along(0) }, { translateY: along(1) }, { rotate: heading }],
        }}
      >
        <Scooter length={scooter} />
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
