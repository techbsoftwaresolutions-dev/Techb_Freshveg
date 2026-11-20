import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors } from "../theme";

// Shown each time the app opens, before the login (or home) screen.
//
// It starts exactly where the phone's own launch image leaves off - the
// basket on cream (app.config.js -> splash) - so there is no jump between the
// two. Then the logo rises, the name and tagline fade in and the rider rides
// in from the left. `onDone` fires once the intro has played AND `ready` is
// true (the saved sign-in has been read), after a short fade out.

const CREAM = "#FBF3DF";
const MIN_SHOW_MS = 2400;

export default function SplashScreen({ ready, onDone }) {
  const { width } = useWindowDimensions();
  const bannerHeight = Math.round((width * 675) / 1200);

  const logoScale = useRef(new Animated.Value(0.86)).current;
  const logoLift = useRef(new Animated.Value(40)).current;
  const textIn = useRef(new Animated.Value(0)).current;
  const riderX = useRef(new Animated.Value(-width)).current;
  const dot = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const played = useRef(false);
  const doneSent = useRef(false);
  // The intro timer reads this, so it sees the latest value, not the first render's.
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(logoLift, { toValue: 0, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textIn, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(riderX, { toValue: 0, duration: 900, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
      ]),
    ]).start();

    const loop = Animated.loop(
      Animated.timing(dot, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();

    const timer = setTimeout(() => {
      played.current = true;
      finish();
    }, MIN_SHOW_MS);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sign-in finished loading after the intro: leave now.
  useEffect(() => {
    if (ready) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function finish() {
    if (!played.current || !readyRef.current || doneSent.current) return;
    doneSent.current = true;
    Animated.timing(fadeOut, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => onDone?.());
  }

  const textLift = textIn.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: fadeOut }]}>
      <View style={styles.center}>
        <Animated.Image
          source={require("../../assets/logo-mark.png")}
          resizeMode="contain"
          style={[styles.logo, { transform: [{ translateY: logoLift }, { scale: logoScale }] }]}
        />
        <Animated.View style={{ alignItems: "center", opacity: textIn, transform: [{ translateY: textLift }] }}>
          <Text style={styles.brand}>
            <Text style={{ color: colors.primaryDeep }}>Hosur </Text>
            <Text style={{ color: colors.primary }}>Basket</Text>
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>DELIVERY PARTNER</Text>
          </View>
          <Text style={styles.tagline}>Deliver fresh. Deliver on time.</Text>
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dotItem,
                {
                  opacity: dot.interpolate({
                    inputRange: [0, (i + 0.5) / 3, 1],
                    outputRange: [0.25, 1, 0.25],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            />
          ))}
        </View>
        <Animated.View style={{ transform: [{ translateX: riderX }] }}>
          <Image
            source={require("../../assets/rider-banner.png")}
            resizeMode="cover"
            style={{ width, height: bannerHeight }}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  logo: { width: 190, height: 160, marginBottom: 18 },
  brand: { fontSize: 32, fontWeight: "900", letterSpacing: -0.6 },
  pill: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: { fontSize: 12, fontWeight: "800", letterSpacing: 2.2, color: colors.primaryDark },
  tagline: { marginTop: 14, fontSize: 15, color: colors.textMuted, fontWeight: "600" },
  bottom: { alignItems: "center" },
  dots: { flexDirection: "row", gap: 8, marginBottom: 18 },
  dotItem: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
});
