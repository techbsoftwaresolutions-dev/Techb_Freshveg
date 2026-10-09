import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, type } from "../theme";
import { Button, Notice } from "../components/ui";

export default function LoginScreen({ navigation }) {
  const { requestOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
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
      await verifyOtp(phone, code, name);
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
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>The Farmers Basket</Text>
        <Text style={styles.heroSub}>Farm-fresh vegetables, fruits and milk, delivered.</Text>
      </View>

      <View style={styles.sheet}>
        {error ? <Notice tone="error" style={{ marginBottom: spacing.md }}>{error}</Notice> : null}

        {step === "phone" ? (
          <>
            <Text style={type.h2}>Enter your mobile number</Text>
            <Text style={[type.small, { marginTop: 4, marginBottom: spacing.lg }]}>
              We'll send you a one-time code to sign in.
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
                style={styles.phoneInput}
                maxLength={10}
              />
            </View>

            <Button
              title="Send code"
              onPress={sendOtp}
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

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name (new accounts only)"
              placeholderTextColor={colors.textFaint}
              style={styles.nameInput}
            />

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
          <Text style={type.small}>Keep browsing without signing in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  heroMark: { fontSize: 56, marginBottom: spacing.md },
  heroTitle: { fontSize: 26, fontWeight: "800", color: "#fff" },
  heroSub: { color: "rgba(255,255,255,0.85)", marginTop: 4, fontSize: 13.5 },

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
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  prefix: { fontSize: 15, fontWeight: "700", color: colors.textMuted, marginRight: spacing.sm },
  phoneInput: { flex: 1, fontSize: 16, color: colors.text, letterSpacing: 1.5 },

  codeInput: {
    marginTop: spacing.lg,
    borderWidth: 1.5,
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
    height: 44,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.text,
  },

  link: { color: colors.primary, fontWeight: "700" },
});
