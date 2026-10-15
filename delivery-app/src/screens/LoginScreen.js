import React, { useEffect, useRef, useState } from "react";
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, type } from "../theme";
import { Button, Notice } from "../components/ui";

export default function LoginScreen() {
  const { requestOtp, verifyOtp } = useAuth();

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
      <View style={[styles.hero, keyboard && styles.heroCompact]}>
        <Image
          source={require("../../assets/hb-logo.png")}
          style={keyboard ? styles.heroLogoSmall : styles.heroLogo}
          resizeMode="contain"
        />
        <Text style={styles.heroTitle}>Hosur Basket Partner</Text>
        {keyboard ? null : <Text style={styles.heroSub}>Deliveries, routes and earnings.</Text>}
      </View>

      <View style={styles.sheet}>
        {error ? <Notice tone="error" style={{ marginBottom: spacing.md }}>{error}</Notice> : null}

        {step === "phone" ? (
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

        {keyboard ? null : (
          <Text style={[type.tiny, { textAlign: "center", marginTop: spacing.xl }]}>
            Seeded partners: 9000000003, 9000000004
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primaryDark },
  hero: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  heroLogo: { width: 190, height: 94, marginBottom: spacing.lg },
  heroLogoSmall: { width: 96, height: 48, marginBottom: spacing.sm },
  heroCompact: { flex: 1, minHeight: 0, padding: spacing.md, paddingTop: spacing.xl },
  heroTitle: { fontSize: 27, fontWeight: "800", color: "#fff" },
  heroSub: { color: "rgba(255,255,255,0.8)", marginTop: 4, fontSize: 14 },

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
