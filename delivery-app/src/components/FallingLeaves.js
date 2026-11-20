import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, useWindowDimensions } from "react-native";

// A few leaves drift slowly down the green login background, swaying and
// turning. Purely decoration: faint, behind everything, never touchable.

const LEAVES = [
  { e: "🍃", x: 0.08, size: 18, ms: 11000, wait: 0 },
  { e: "🌿", x: 0.86, size: 16, ms: 13500, wait: 2500 },
  { e: "🍃", x: 0.32, size: 14, ms: 12500, wait: 5200 },
  { e: "🍀", x: 0.68, size: 15, ms: 14500, wait: 1200 },
  { e: "🍃", x: 0.5, size: 13, ms: 16000, wait: 7600 },
];
const SWAY_IN = [0, 0.25, 0.5, 0.75, 1];

export default function FallingLeaves({ height }) {
  const { width } = useWindowDimensions();
  const fall = useRef(LEAVES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = fall.map((v, i) =>
      Animated.sequence([
        Animated.delay(LEAVES[i].wait),
        Animated.loop(Animated.timing(v, { toValue: 1, duration: LEAVES[i].ms, easing: Easing.linear, useNativeDriver: true })),
      ])
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [fall]);

  if (!height) return null;
  return LEAVES.map((leaf, i) => {
    const v = fall[i];
    const sway = 18 + leaf.size;
    return (
      <Animated.View
        key={i}
        pointerEvents="none"
        style={[
          styles.leaf,
          {
            left: leaf.x * width,
            opacity: v.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 0.4, 0.4, 0] }),
            transform: [
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-30, height] }) },
              { translateX: v.interpolate({ inputRange: SWAY_IN, outputRange: [0, sway, 0, -sway, 0] }) },
              { rotate: v.interpolate({ inputRange: SWAY_IN, outputRange: ["-20deg", "35deg", "-10deg", "40deg", "-20deg"] }) },
            ],
          },
        ]}
      >
        <Text style={{ fontSize: leaf.size }}>{leaf.e}</Text>
      </Animated.View>
    );
  });
}

const styles = StyleSheet.create({
  leaf: { position: "absolute", top: 0 },
});
