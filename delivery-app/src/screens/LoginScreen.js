import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, type } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { Button, Notice } from "../components/ui";
import BasketPop from "../components/BasketPop";
import FallingLeaves from "../components/FallingLeaves";
import LoginRider from "../components/LoginRider";

// OTP sign-in is switched off until an SMS provider is connected: riders sign in
// with the email and password the store set for them. Set to true to bring the
// phone + OTP screens back (all of that code is still below).
const OTP_LOGIN = false;

// Where each sign-in part pops in from: heading, hint, Email, Password, button.
const FORM_POPS = [{ y: 26 }, { y: 26 }, { x: -70 }, { x: 70 }, { y: 30, scale: 0.6 }];

export default function LoginScreen() {
  const { requestOtp, verifyOtp, signInWithPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef(null);

  // While the keyboard is up, shrink the green area so the sign-in sheet (and
  // the box being typed in) stays visible above the keyboard.
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => () => clearInterval(timer.current), []);

  // Opening: the basket pops and products jump out of it (BasketPop); while
  // they are landing the sign-in sheet slides up.
  // Then, like the products, the sign-in parts pop in one after another with
  // a bounce: heading, hint, Email from the left, Password from the right,
  // and the Start shift button last.
  const intro = useRef(new Animated.Value(0)).current;
  const form = useRef(FORM_POPS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(650),
      Animated.timing(intro, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.stagger(
        130,
        form.map((v) => Animated.timing(v, { toValue: 1, duration: 560, easing: Easing.out(Easing.back(1.8)), useNativeDriver: true }))
      ),
    ]).start();
  }, [intro, form]);
  // Which box is being typed in (it glows green), the hero's height (for the
  // falling leaves) and the button's width (for its shine).
  const [focus, setFocus] = useState(null);
  const [heroH, setHeroH] = useState(0);
  const [btnW, setBtnW] = useState(0);

  // Once both boxes are filled the button gives a little hop and a shine
  // sweeps across it every couple of seconds: ready to go.
  const ready = Boolean(email.trim() && password) && !busy;
  const shine = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) {
      shine.setValue(0);
      return undefined;
    }
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(hop, { toValue: 0, duration: 320, easing: Easing.out(Easing.back(3)), useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(shine, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(1700),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ready, shine, hop]);

  const rise = (from) => ({ opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] });
  const pop = (i) => {
    const v = form[i];
    const { x = 0, y = 0, scale = 0.85 } = FORM_POPS[i];
    return {
      opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
      transform: [
        { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [x, 0] }) },
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) },
        { scale: v.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
      ],
    };
  };

  function countdown(seconds) {
    setSecondsLeft(seconds);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function send() {
    setBusy(true);
    setError("");
    try {
      const data = await requestOtp(phone);
      setDevCode(data.devCode || null);
      if (data.devCode) setCode(data.devCode); // dev: no copy and paste
      setStep("code");
      countdown(30);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await signInWithPassword(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      await verifyOtp(phone, code);
    } catch (err) {
      // The most likely failure is a number that is not on the roster, and the
      // API says exactly that — worth showing verbatim.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.screen}
    >
      <View style={[styles.hero, keyboard && styles.heroCompact]} onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}>
        {keyboard ? null : <FallingLeaves height={heroH} />}
        <BasketPop small={keyboard} />
      </View>

      <Animated.View style={[styles.sheet, rise(160)]}>
        {keyboard ? null : <LoginRider />}
        {error ? <Notice tone="error" style={{ marginBottom: spacing.md }}>{error}</Notice> : null}

        {!OTP_LOGIN ? (
          <>
            <Animated.View style={pop(0)}>
              <Text style={type.h2}>Sign in to start your shift</Text>
            </Animated.View>
            <Animated.View style={pop(1)}>
              <Text style={[type.small, { marginTop: 4, marginBottom: spacing.lg }]}>
                Use the email and password your store gave you.
              </Text>
            </Animated.View>

            <Animated.View style={[styles.fieldInput, styles.fieldRow, focus === "email" && styles.fieldFocus, pop(2)]}>
              <Ionicons name="mail-outline" size={20} color={focus === "email" ? colors.primary : colors.textFaint} style={styles.fieldIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocus("email")}
                onBlur={() => setFocus(null)}
                placeholder="Email"
                placeholderTextColor={colors.textFaint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                style={styles.passwordInput}
              />
            </Animated.View>
            <Animated.View style={[styles.fieldInput, styles.passwordRow, focus === "password" && styles.fieldFocus, pop(3)]}>
              <Ionicons name="lock-closed-outline" size={20} color={focus === "password" ? colors.primary : colors.textFaint} style={styles.fieldIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                onFocus={() => setFocus("password")}
                onBlur={() => setFocus(null)}
                onSubmitEditing={email.trim() && password ? signIn : undefined}
                style={styles.passwordInput}
              />
              <Text style={styles.link} onPress={() => setShowPassword((v) => !v)}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.buttonWrap,
                pop(4),
                { transform: [...pop(4).transform, { scale: hop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] },
              ]}
              onLayout={(e) => setBtnW(e.nativeEvent.layout.width)}
            >
              <Button title="Start shift" onPress={signIn} loading={busy} disabled={!email.trim() || !password} />
              {ready && btnW ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.shine,
                    { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-90, btnW + 30] }) }, { skewX: "-20deg" }] },
                  ]}
                />
              ) : null}
            </Animated.View>
          </>
        ) : step === "phone" ? (
          <>
            <Text style={type.h2}>Sign in to start your shift</Text>
            <Text style={[type.small, { marginTop: 4, marginBottom: spacing.lg }]}>
              Use the number your store registered you with.
            </Text>

            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit number"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                autoFocus
                maxLength={10}
                style={styles.phoneInput}
              />
            </View>

            <Button
              title="Send code"
              onPress={send}
              loading={busy}
              disabled={phone.length !== 10}
              style={{ marginTop: spacing.lg }}
            />
          </>
        ) : (
          <>
            <Text style={type.h2}>Enter the code</Text>
            <Text style={[type.small, { marginTop: 4 }]}>
              Sent to +91 {phone}.{" "}
              <Text style={styles.link} onPress={() => setStep("phone")}>
                Change
              </Text>
            </Text>

            {devCode ? (
              <Notice tone="info" style={{ marginTop: spacing.md }}>
                Development mode — your code is {devCode}
              </Notice>
            ) : null}

            <TextInput
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
              placeholder="······"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
              style={styles.codeInput}
            />

            <Button
              title="Start shift"
              onPress={verify}
              loading={busy}
              disabled={code.length !== 6}
              style={{ marginTop: spacing.lg }}
            />

            <Pressable
              onPress={secondsLeft > 0 ? undefined : send}
              style={{ marginTop: spacing.md, alignSelf: "center" }}
            >
              <Text style={[type.small, secondsLeft === 0 && styles.link]}>
                {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
              </Text>
            </Pressable>
          </>
        )}

        {OTP_LOGIN && !keyboard ? (
          <Text style={[type.tiny, { textAlign: "center", marginTop: spacing.xl }]}>
            Seeded partners: 9000000003, 9000000004
          </Text>
        ) : null}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primaryDark },
  hero: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  heroCompact: { flex: 1, minHeight: 0, padding: spacing.md, paddingTop: spacing.xl },

  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  prefix: { fontSize: 17, fontWeight: "800", color: colors.textMuted, marginRight: spacing.sm },
  phoneInput: { flex: 1, fontSize: 18, color: colors.text, letterSpacing: 1.5, fontWeight: "600" },

  fieldInput: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 56,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
    justifyContent: "center",
  },
  passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 0 },
  fieldRow: { flexDirection: "row", alignItems: "center" },
  fieldFocus: { borderColor: colors.primary, backgroundColor: "#F6FCF8" },
  fieldIcon: { marginRight: spacing.sm },
  buttonWrap: { marginTop: spacing.lg, borderRadius: radius.md, overflow: "hidden" },
  shine: { position: "absolute", top: -10, bottom: -10, left: 0, width: 46, backgroundColor: "rgba(255,255,255,0.35)" },
  passwordInput: { flex: 1, fontSize: 16, color: colors.text, height: "100%" },

  codeInput: {
    marginTop: spacing.lg,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 60,
    textAlign: "center",
    fontSize: 26,
    letterSpacing: 12,
    color: colors.text,
    fontWeight: "800",
  },

  link: { color: colors.primary, fontWeight: "800" },
});
