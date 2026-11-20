import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";

// Login hero: a fresh-produce clock.
// The basket drops in from above, squashes as it lands and springs back; then
// a ring of light and sparkles flash at its mouth as 12 fruits and vegetables
// jump out one after another and land on the 12 hours of a clock dial around
// it. A gold minute hand and a white hour hand turn behind the basket, and
// each fruit gives a little hop as the minute hand sweeps past it. Rings
// ripple out from behind and a warm glow breathes.
// Tap the basket and it shakes and the produce jumps out again.
// A clock "tik tik tik" (one every second) plays while the dial is showing.
// `small` (keyboard open) shows just a small logo, and the ticking stops.

const TILE = 132;
// The basket logo without its tile (transparent, cream fill removed).
const BASKET = require("../../assets/basket-cutout.png");
const BASKET_ASPECT = 488 / 399;
const HAND_FROM = 0.5; // hands start just outside the basket (fraction of TILE)
const ITEM = 34;
const DIAL_R = 136; // where the produce sits (centre of each item)
const RING_R = DIAL_R + 26; // outer dial ring with the minute ticks
const RIPPLES = 3; // rings spreading out from the basket, one after another
const RIPPLE_MS = 3000;
const MINUTE_MS = 12000; // one turn of the minute hand
const HOUR_MS = MINUTE_MS * 12;

// The 12 hours, clockwise from 12 o'clock: one fruit, one vegetable, in turn.
const FRUITS = ["🍎", "🍌", "🍇", "🍓", "🍊", "🍍"];
const VEGGIES = ["🥕", "🥦", "🍅", "🌽", "🥒", "🍆"];
const PRODUCE = FRUITS.flatMap((f, i) => [f, VEGGIES[i]]);
const ITEMS = PRODUCE.map((e, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { e, x: Math.sin(a) * DIAL_R, y: -Math.cos(a) * DIAL_R, r: i % 2 ? 14 : -14, at: i / 12 };
});
const STAGGER = 85;
// A 1-second loop holding one clock "tik", so it ticks the same every second.
const TICK = require("../../assets/sounds/clock-tick.wav");
const TICK_VOLUME = 1;
const TICK_START_MS = 1200; // once the basket has landed and the dial shows
// Sparks that fly off the basket's mouth when it bursts (angle in degrees, 0 = up).
const SPARKS = [-80, -55, -30, -8, 14, 36, 58, 82];
const MOUTH_Y = -TILE * 0.42; // at the basket's top edge

// Smooth bob for the float loop: sin samples, shifted per product.
const FLOAT_IN = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
const bob = (phase, amp) => FLOAT_IN.map((t) => Math.sin((t + phase) * Math.PI * 2) * amp);

// The hop an item gives when the minute hand reaches it (`at` = its place on
// the dial, 0-1 clockwise from 12).
const HOP = 0.035;
function hopRange(at) {
  if (at === 0) return { inputRange: [0, HOP, 1 - 0.01, 1], outputRange: [1.4, 1, 1, 1.4] };
  return { inputRange: [0, at - 0.01, at, at + HOP, 1], outputRange: [1, 1, 1.4, 1, 1] };
}

const t = (v, to, duration, easing = Easing.inOut(Easing.quad)) =>
  Animated.timing(v, { toValue: to, duration, easing, useNativeDriver: true });

// A line from the dial's centre outwards, turned to `rotate`: a column as tall
// as the dial's diameter, rotated about its middle, with the line in its top half.
function Spoke({ length, width, color, rotate, inset = 0, children }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: TILE / 2 - width / 2,
        top: TILE / 2 - length,
        width,
        height: length * 2,
        transform: [{ rotate }],
      }}
    >
      <View style={{ height: length - inset, width, borderRadius: width / 2, backgroundColor: color }} />
      {children}
    </Animated.View>
  );
}

export default function BasketPop({ small }) {
  const { width, height } = useWindowDimensions();
  const k = Math.min(1, width / 400, height / 860);

  const drop = useRef(new Animated.Value(0)).current; // 0 above the screen, 1 landed
  const squash = useRef(new Animated.Value(0)).current; // 1 squashed flat, -1 stretched tall
  const jiggle = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const pops = useRef(ITEMS.map(() => new Animated.Value(0))).current;
  const float = useRef(new Animated.Value(0)).current;
  const dial = useRef(new Animated.Value(0)).current; // dial ring + hands fade in
  const minute = useRef(new Animated.Value(0)).current;
  const hour = useRef(new Animated.Value(0)).current;
  const ripples = useRef(Array.from({ length: RIPPLES }, () => new Animated.Value(0))).current;
  const glow = useRef(new Animated.Value(0)).current;
  const bursting = useRef(false);

  // The clock's ticking: mixed with any music the rider is playing,
  // and only while the full dial is on screen.
  const tick = useAudioPlayer(TICK);
  useEffect(() => {
    if (small) return undefined;
    let on = true;
    const start = setTimeout(() => {
      setAudioModeAsync({ interruptionMode: "mixWithOthers", shouldPlayInBackground: false, playsInSilentMode: false })
        .catch(() => {})
        .finally(() => {
          if (!on) return;
          try {
            tick.loop = true;
            tick.volume = TICK_VOLUME;
            tick.play();
          } catch {
            // no sound is fine - the clock still turns
          }
        });
    }, TICK_START_MS);
    return () => {
      on = false;
      clearTimeout(start);
      try {
        tick.pause();
      } catch {
        // player already released (screen closed)
      }
    };
  }, [small, tick]);

  function burst(fromStart) {
    if (bursting.current) return;
    bursting.current = true;
    if (!fromStart) pops.forEach((p) => p.setValue(0));
    ring.setValue(0);
    Animated.parallel([
      // the basket shakes as things jump out of it
      Animated.sequence([t(jiggle, 1, 140), t(jiggle, -1, 140), t(jiggle, 0.6, 140), t(jiggle, -0.3, 140), t(jiggle, 0, 160)]),
      t(ring, 1, 700, Easing.out(Easing.quad)),
      t(dial, 1, 900),
      Animated.stagger(
        STAGGER,
        pops.map((p) => t(p, 1, 620, Easing.out(Easing.back(1.6))))
      ),
    ]).start(() => {
      bursting.current = false;
    });
  }

  useEffect(() => {
    const loops = [
      Animated.loop(t(float, 1, 2600, Easing.linear)),
      Animated.loop(t(minute, 1, MINUTE_MS, Easing.linear)),
      Animated.loop(t(hour, 1, HOUR_MS, Easing.linear)),
      Animated.loop(Animated.sequence([t(glow, 1, 1800), t(glow, 0, 1800)])),
      // evenly spaced ripples, each spreading out and fading
      ...ripples.map((r, i) =>
        Animated.sequence([
          Animated.delay((i * RIPPLE_MS) / RIPPLES),
          Animated.loop(t(r, 1, RIPPLE_MS, Easing.out(Easing.quad))),
        ])
      ),
    ];
    loops.forEach((l) => l.start());
    Animated.sequence([
      // fall in, squash on landing, stretch up a little, settle
      t(drop, 1, 520, Easing.in(Easing.quad)),
      t(squash, 1, 110, Easing.out(Easing.quad)),
      t(squash, -0.45, 170, Easing.inOut(Easing.quad)),
      t(squash, 0, 220, Easing.out(Easing.back(2))),
    ]).start(() => burst(true));
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (small) {
    return <Image source={BASKET} style={styles.logoSmall} resizeMode="contain" />;
  }

  const R = DIAL_R * k;
  const RR = RING_R * k;
  // the basket is TILE tall; reserve room above and below for the whole dial
  const room = Math.max(0, RR + 4 - TILE / 2);

  return (
    <View style={[styles.wrap, { marginVertical: room }]}>
      {/* Rings rippling out from behind the basket */}
      {ripples.map((r, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ripple,
            {
              opacity: Animated.multiply(drop, r.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.3, 0] })),
              transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.75, (RR * 2.2) / 150] }) }],
            },
          ]}
        />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            opacity: Animated.multiply(drop, glow.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.26] })),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
          },
        ]}
      />

      {/* The clock face: a soft disc, the outer ring and 60 minute ticks
          (longer ones at the hours) */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: dial }]}>
        <View
          style={[
            styles.face,
            { width: RR * 2, height: RR * 2, borderRadius: RR, left: TILE / 2 - RR, top: TILE / 2 - RR },
          ]}
        />
        {Array.from({ length: 60 }, (_, i) => {
          const hourTick = i % 5 === 0;
          return (
            <Spoke
              key={i}
              length={RR - 4 * k}
              width={hourTick ? 3 : 1.5}
              inset={RR - 4 * k - (hourTick ? 11 : 6) * k}
              color={hourTick ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)"}
              rotate={`${i * 6}deg`}
            />
          );
        })}
      </Animated.View>

      {/* Hands, coming out from behind the basket: white hour hand, gold
          minute hand with a round tip */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: dial }]}>
        <Spoke length={R * 0.72} inset={TILE * HAND_FROM} width={7} color="rgba(255,255,255,0.75)" rotate={hour.interpolate({ inputRange: [0, 1], outputRange: ["300deg", "660deg"] })} />
        <Spoke length={R * 0.82} inset={TILE * HAND_FROM} width={4} color="#FFD54F" rotate={minute.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })}>
          <View style={styles.handTip} />
        </Spoke>
      </Animated.View>

      {/* The produce sits behind the basket, so it comes out of the basket's
          top, then lands on its hour of the dial */}
      {ITEMS.map((it, i) => {
        const p = pops[i];
        const x = it.x * k;
        const y = it.y * k;
        return (
          <Animated.View
            key={it.e}
            pointerEvents="none"
            style={[
              styles.item,
              {
                opacity: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
                transform: [
                  { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
                  {
                    // up out of the basket first, then out to its hour (an arc)
                    translateY: Animated.add(
                      p.interpolate({ inputRange: [0, 0.45, 1], outputRange: [-10, Math.min(y, 0) - 70 * k, y] }),
                      float.interpolate({ inputRange: FLOAT_IN, outputRange: bob(i / ITEMS.length, 3) })
                    ),
                  },
                  { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${it.r}deg`] }) },
                  {
                    scale: Animated.multiply(
                      p.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                      minute.interpolate(hopRange(it.at))
                    ),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.emoji}>{it.e}</Text>
          </Animated.View>
        );
      })}

      {/* The basket: drops in, squashes, shakes; tap it for another burst */}
      <Pressable onPress={() => burst(false)} accessibilityRole="button" accessibilityLabel="Hosur Basket">
        <Animated.View
          style={{
            opacity: drop.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
            transform: [
              { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-320, 0] }) },
              // keep the bottom edge on the ground while squashing
              { translateY: squash.interpolate({ inputRange: [-1, 1], outputRange: [-TILE * 0.09, TILE * 0.09] }) },
              { scaleX: squash.interpolate({ inputRange: [-1, 1], outputRange: [0.9, 1.14] }) },
              { scaleY: squash.interpolate({ inputRange: [-1, 1], outputRange: [1.14, 0.82] }) },
              { rotate: jiggle.interpolate({ inputRange: [-1, 1], outputRange: ["-5deg", "5deg"] }) },
            ],
          }}
        >
          <Image source={BASKET} style={styles.logo} resizeMode="contain" />
        </Animated.View>
      </Pressable>

      {/* Burst at the basket's mouth: a ring of light and flying sparks */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            opacity: ring.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.9, 0] }),
            transform: [{ translateY: MOUTH_Y }, { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.2] }) }],
          },
        ]}
      />
      {SPARKS.map((a, i) => {
        const rad = (a * Math.PI) / 180;
        const dist = (i % 2 ? 95 : 75) * k;
        return (
          <Animated.View
            key={a}
            pointerEvents="none"
            style={[
              styles.spark,
              i % 3 === 0 && styles.sparkGold,
              {
                opacity: ring.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
                transform: [
                  { translateX: ring.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * dist] }) },
                  { translateY: ring.interpolate({ inputRange: [0, 1], outputRange: [MOUTH_Y, MOUTH_Y - Math.cos(rad) * dist] }) },
                  { scale: ring.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 0.2] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: TILE, height: TILE, alignItems: "center", justifyContent: "center" },
  // the basket on its own (no tile), sitting straight on the clock
  logo: { width: TILE * BASKET_ASPECT, height: TILE },
  logoSmall: { width: 60 * BASKET_ASPECT, height: 60 },
  ripple: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    left: TILE / 2 - 75,
    top: TILE / 2 - 75,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  glow: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    left: TILE / 2 - 115,
    top: TILE / 2 - 115,
    backgroundColor: "#FFF6C8",
  },
  face: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  handTip: {
    position: "absolute",
    top: -5,
    left: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFD54F",
  },
  item: {
    position: "absolute",
    left: TILE / 2 - ITEM / 2,
    top: TILE / 2 - ITEM / 2,
    width: ITEM,
    height: ITEM,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 26,
    lineHeight: ITEM,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  ring: {
    position: "absolute",
    left: TILE / 2 - 40,
    top: TILE / 2 - 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  spark: {
    position: "absolute",
    left: TILE / 2 - 4,
    top: TILE / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  sparkGold: { backgroundColor: "#FFD54F" },
});
