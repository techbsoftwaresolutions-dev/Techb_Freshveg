import React, { useEffect, useRef } from "react";
import { Animated, Easing, useWindowDimensions, View } from "react-native";
import LottieView from "lottie-react-native";

// The delivery rider scoots along the top edge of the login sheet, left to
// right, every few seconds - his wheels run right on the sheet's edge.
// Put it inside the sheet; it hangs above the sheet's top.

const W = 150; // animation width
const H = (W * 1080) / 1920; // the animation's canvas is 1920 x 1080
const WHEELS = 0.845; // wheels touch the ground this far down the canvas
const SIDE = 0.13; // empty canvas left of the scooter, as a fraction of W

export default function LoginRider({ delay = 1800 }) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(x, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(4500),
      ])
    );
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [x, delay]);

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: -H * WHEELS + 2, height: H }}>
      <Animated.View
        style={{
          width: W,
          height: H,
          // starts fully off the left edge, ends fully off the right
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-W * (1 - SIDE), width - W * SIDE] }) }, { scaleX: -1 }],
        }}
      >
        <LottieView source={require("../../assets/lottie/welcome-rider.json")} autoPlay loop resizeMode="contain" style={{ width: W, height: H }} />
      </Animated.View>
    </View>
  );
}
