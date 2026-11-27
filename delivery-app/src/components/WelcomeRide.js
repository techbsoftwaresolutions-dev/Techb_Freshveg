import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";

// Intro page 1: the rider waits, the delivery box lid opens from the top,
// groceries drop in, the lid closes, and then he rides off (the animation
// plays: wheels turn, road moves). Then it starts again.
//
// The lid and groceries are drawn here, on top of the animation, in the
// animation's own coordinates (1920 x 1080 canvas, first frame). The whole
// thing is mirrored so the rider faces right - the logo inside the animation
// is pre-mirrored to read correctly.

const CANVAS_W = 1920;
const CANVAS_H = 1080;
// Delivery box on frame 0 (canvas coordinates, before mirroring).
const BOX = { left: 1105, right: 1335, top: 337 };
const LID_H = 52; // white band + grey seam at the top of the box

const ITEMS = [
  { key: "tomato", dx: -45 },
  { key: "carrot", dx: 15 },
  { key: "greens", dx: 55 },
  { key: "milk", dx: -10 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (anim) => new Promise((r) => anim.start(() => r()));

export default function WelcomeRide({ size }) {
  const lottie = useRef(null);
  const lid = useRef(new Animated.Value(0)).current; // 0 closed, 1 open
  const overlay = useRef(new Animated.Value(1)).current; // our lid shown while loading
  const drops = useRef(ITEMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let alive = true;
    const t = (v, to, d, e = Easing.inOut(Easing.quad)) => Animated.timing(v, { toValue: to, duration: d, easing: e, useNativeDriver: true });
    (async () => {
      while (alive) {
        // waiting, box closed
        lottie.current?.reset();
        drops.forEach((v) => v.setValue(0));
        lid.setValue(0);
        overlay.setValue(1);
        await sleep(600);
        if (!alive) break;
        await run(t(lid, 1, 480, Easing.out(Easing.back(1.4)))); // open
        for (const v of drops) {
          if (!alive) break;
          await run(t(v, 1, 520, Easing.in(Easing.quad))); // drop in
        }
        await sleep(150);
        await run(t(lid, 0, 380, Easing.in(Easing.quad))); // close
        overlay.setValue(0); // the animation's own lid takes over while riding
        if (!alive) break;
        lottie.current?.play();
        await sleep(3200); // ride
      }
    })();
    return () => {
      alive = false;
    };
  }, [lid, overlay, drops]);

  const k = size / CANVAS_W;
  const yOff = (size - CANVAS_H * k) / 2;
  const X = (x) => x * k;
  const Y = (y) => yOff + y * k;
  const boxW = (BOX.right - BOX.left) * k;
  const lidH = LID_H * k;

  return (
    <View style={{ width: size, height: size, transform: [{ scaleX: -1 }] }}>
      <LottieView ref={lottie} source={require("../../assets/lottie/welcome-rider.json")} autoPlay={false} loop resizeMode="contain" style={{ width: size, height: size }} />

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: overlay }]}>
        {/* inside of the box, seen when the lid is up */}
        <Animated.View
          style={{
            position: "absolute",
            left: X(BOX.left),
            top: Y(BOX.top),
            width: boxW,
            height: lidH,
            borderTopLeftRadius: 6 * k,
            borderTopRightRadius: 6 * k,
            backgroundColor: "#0A3D1E",
            opacity: lid,
          }}
        />

        {/* groceries dropping in */}
        {ITEMS.map((item, i) => {
          const v = drops[i];
          const cx = (BOX.left + BOX.right) / 2 + item.dx;
          const s = 78 * k;
          return (
            <Animated.View
              key={item.key}
              style={{
                position: "absolute",
                left: X(cx) - s / 2,
                top: Y(BOX.top) - s / 2,
                width: s,
                height: s,
                alignItems: "center",
                justifyContent: "center",
                opacity: v.interpolate({ inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-230 * k, 20 * k] }) },
                  { scale: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.9, 0.6] }) },
                  { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["-15deg", "20deg"] }) },
                ],
              }}
            >
              <Grocery kind={item.key} s={s} />
            </Animated.View>
          );
        })}

        {/* the lid: swings open on the box's back edge (right, before mirroring) */}
        <Animated.View
          style={{
            position: "absolute",
            left: X(BOX.left),
            top: Y(BOX.top),
            width: boxW,
            height: lidH,
            transform: [
              { translateX: boxW / 2 },
              { rotate: lid.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "115deg"] }) },
              { translateX: -boxW / 2 },
            ],
          }}
        >
          <View style={[styles.lid, { borderTopLeftRadius: 6 * k, borderTopRightRadius: 6 * k }]}>
            <View style={{ position: "absolute", left: 23 * k, right: 7 * k, top: 8 * k, height: 19 * k, borderRadius: 9 * k, backgroundColor: "#FFFFFF" }} />
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 2 * k, height: 7 * k, backgroundColor: "#808285" }} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// Simple grocery shapes (symmetric, so mirroring doesn't matter).
function Grocery({ kind, s }) {
  if (kind === "tomato")
    return (
      <View style={{ width: s * 0.8, height: s * 0.72, borderRadius: s * 0.4, backgroundColor: "#E5484D", alignItems: "center" }}>
        <View style={{ width: s * 0.3, height: s * 0.14, borderRadius: s * 0.07, backgroundColor: "#16A04A", marginTop: -s * 0.04 }} />
      </View>
    );
  if (kind === "carrot")
    return (
      <View style={{ alignItems: "center" }}>
        <View style={{ width: s * 0.26, height: s * 0.18, borderTopLeftRadius: s * 0.1, borderTopRightRadius: s * 0.1, backgroundColor: "#16A04A" }} />
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: s * 0.2,
            borderRightWidth: s * 0.2,
            borderTopWidth: s * 0.62,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: "#F28A2E",
          }}
        />
      </View>
    );
  if (kind === "greens")
    return (
      <View style={{ width: s, height: s * 0.7, alignItems: "center", justifyContent: "flex-end" }}>
        <View style={{ position: "absolute", left: s * 0.1, bottom: s * 0.05, width: s * 0.45, height: s * 0.45, borderRadius: s * 0.23, backgroundColor: "#4CC274" }} />
        <View style={{ position: "absolute", right: s * 0.1, bottom: s * 0.05, width: s * 0.45, height: s * 0.45, borderRadius: s * 0.23, backgroundColor: "#22B358" }} />
        <View style={{ position: "absolute", bottom: s * 0.25, width: s * 0.45, height: s * 0.45, borderRadius: s * 0.23, backgroundColor: "#16A04A" }} />
      </View>
    );
  // milk
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: s * 0.22, height: s * 0.12, borderRadius: s * 0.03, backgroundColor: "#3B82F6" }} />
      <View style={{ width: s * 0.42, height: s * 0.62, borderRadius: s * 0.08, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C9D6CD", justifyContent: "center" }}>
        <View style={{ height: s * 0.16, backgroundColor: "#3B82F6", opacity: 0.85 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lid: { flex: 1, backgroundColor: "#16A04A" },
});
