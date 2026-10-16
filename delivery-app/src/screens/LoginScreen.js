import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { Text, TextInput } from "../components/Text";
import BrandLogo from "../components/BrandLogo";
import { colors, radius, shadow, spacing, type } from "../theme";
import { Button, Notice, Pill } from "../components/ui";

export default function LoginScreen() {
  const { requestOtp, verifyOtp } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timer = useRef(null);

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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      {/* The customer app's sign-in card: logo, one field, one button. */}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.sheet}>
        <View style={styles.logoBox}>
          <BrandLogo style={styles.logo} />
        </View>
        <Pill tone="primary" style={{ alignSelf: "center", marginBottom: spacing.lg }}>
          Delivery staff
        </Pill>

        {error ? <Notice tone="error" style={{ marginBottom: spacing.md }}>{error}</Notice> : null}

        {step === "phone" ? (
          <>
            <Text style={styles.title}>Sign in to start your shift</Text>
            <Text style={styles.subtitle}>Use the number your store registered you with.</Text>

            <Text style={styles.label}>Mobile number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefixBox}>
                <Text style={styles.prefix}>+91</Text>
              </View>
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
            <Text style={styles.title}>Enter the code</Text>
            <Text style={[styles.subtitle, { marginBottom: 0 }]}>
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
              style={{ marginTop: spacing.md, alignSelf: "center", padding: spacing.xs }}
              accessibilityRole="button"
            >
              <Text style={[type.small, secondsLeft === 0 && styles.link]}>
                {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
              </Text>
            </Pressable>
          </>
        )}

        {/* Development builds only: the riders npm run seed:delivery:dev creates. */}
        {__DEV__ ? (
          <Text style={[type.tiny, { textAlign: "center", marginTop: spacing.xl }]}>
            Dev riders: 9000000003, 9000000004
          </Text>
        ) : null}
      </View>
      <Text style={[type.tiny, { textAlign: "center", marginTop: spacing.lg }]}>
        Your store's deliveries, in one place.
      </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // As customer-app/src/screens/LoginScreen.js.
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg, paddingBottom: spacing.xxl },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow.card,
  },
  logoBox: { alignSelf: "center", width: 150, height: 84, overflow: "hidden", marginBottom: spacing.sm },
  logo: { width: 150, height: 84, transform: [{ scale: 1.2 }] },
  title: { fontSize: 21, fontWeight: "700", color: colors.text, textAlign: "center" },
  subtitle: { ...type.small, textAlign: "center", marginTop: 6, marginBottom: spacing.lg, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "500", color: colors.text, marginBottom: 6 },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 52,
    overflow: "hidden",
  },
  prefixBox: {
    height: "100%",
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: colors.bg,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  prefix: { fontSize: 15, fontWeight: "600", color: colors.textMuted },
  phoneInput: { flex: 1, height: "100%", paddingHorizontal: spacing.md, fontSize: 16, color: colors.text, letterSpacing: 1 },

  codeInput: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 56,
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 10,
    color: colors.text,
    fontWeight: "700",
  },

  link: { color: colors.primary, fontWeight: "600" },
});
