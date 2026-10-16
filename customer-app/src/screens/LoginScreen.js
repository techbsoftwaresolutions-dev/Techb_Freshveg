import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "../components/Text";
import BrandLogo from "../components/BrandLogo";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadow, spacing, type } from "../theme";
import { Button, Notice } from "../components/ui";
import { pendingReferral } from "../api/client";

export default function LoginScreen({ navigation }) {
  const { requestOtp, verifyOtp } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralNote, setReferralNote] = useState("");
  // Prefilled from a referral link that opened the app.
  useEffect(() => {
    pendingReferral().then((code) => code && setReferralCode(code)).catch(() => {});
  }, []);
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  function startCountdown(seconds) {
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

  async function sendOtp() {
    setBusy(true);
    setError("");
    try {
      const data = await requestOtp(phone);
      // Outside production the API returns the code, so the app is usable
      // before an SMS provider is connected.
      setDevCode(data.devCode || null);
      setStep("code");
      startCountdown(data.expiresInSeconds ? Math.min(30, data.expiresInSeconds) : 30);
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
      const data = await verifyOtp(phone, code, name, referralCode);
      if (data.referral && !data.referral.applied) {
        // Say why the friend's code did not apply before closing.
        setReferralNote(data.referral.message);
        setTimeout(() => navigation.goBack(), 2500);
        return;
      }
      navigation.goBack();
    } catch (err) {
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
      <Pressable
        onPress={() => navigation.goBack()}
        style={[styles.close, { top: insets.top + spacing.sm }]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={24} color={colors.text} />
      </Pressable>

      {/* The website's sign-in card: logo, welcome, one field, one button. */}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 56 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.sheet}>
        <View style={styles.logoBox}>
          <BrandLogo style={styles.logo} />
        </View>

        {error ? <Notice tone="error" style={{ marginBottom: spacing.md }}>{error}</Notice> : null}

        {step === "phone" ? (
          <>
            <Text style={styles.title}>Welcome to The Farmers Basket</Text>
            <Text style={styles.subtitle}>
              Sign in or create an account with your mobile number. No password to remember.
            </Text>

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
                style={styles.phoneInput}
                maxLength={10}
              />
            </View>

            <Button
              title="Continue"
              onPress={sendOtp}
              loading={busy}
              disabled={phone.length !== 10}
              style={{ marginTop: spacing.lg }}
            />
            <Text style={styles.terms}>By continuing you agree to receive a one-time code by SMS on this number.</Text>
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

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name (new accounts only)"
              placeholderTextColor={colors.textFaint}
              style={styles.nameInput}
            />

            <TextInput
              value={referralCode}
              onChangeText={(text) => setReferralCode(text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
              placeholder="Friend's referral code (optional)"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.nameInput}
            />
            {referralNote ? (
              <Notice tone="warn" style={{ marginTop: spacing.sm }}>
                Signed in. Referral code not applied: {referralNote}
              </Notice>
            ) : null}

            <Button
              title="Verify & continue"
              onPress={verify}
              loading={busy}
              disabled={code.length !== 6}
              style={{ marginTop: spacing.lg }}
            />

            <Pressable
              onPress={secondsLeft > 0 ? undefined : sendOtp}
              style={{ marginTop: spacing.md, alignSelf: "center" }}
            >
              <Text style={[type.small, secondsLeft === 0 && styles.link]}>
                {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
              </Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: spacing.xl, alignSelf: "center" }}>
          <Text style={[type.small, styles.link]}>Keep browsing without signing in</Text>
        </Pressable>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg, paddingBottom: spacing.xxl },
  close: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow.card,
  },
  logoBox: { alignSelf: "center", width: 150, height: 84, overflow: "hidden", marginBottom: spacing.md },
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
    height: 50,
    overflow: "hidden",
  },
  prefixBox: { height: "100%", paddingHorizontal: 14, justifyContent: "center", backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.border },
  prefix: { fontSize: 15, fontWeight: "600", color: colors.textMuted },
  phoneInput: { flex: 1, height: "100%", paddingHorizontal: spacing.md, fontSize: 16, color: colors.text, letterSpacing: 1 },
  terms: { ...type.tiny, textAlign: "center", marginTop: spacing.md },

  codeInput: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 54,
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 10,
    color: colors.text,
    fontWeight: "700",
  },
  nameInput: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.text,
  },

  link: { color: colors.primary, fontWeight: "600" },
});
