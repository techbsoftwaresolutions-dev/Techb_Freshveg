import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors, radius, spacing, type } from "../theme";
import { Button, Notice } from "./ui";

// Full-screen QR scanner. Calls onScanned(value) once with the QR's text.
// `expectedCode` is the order's code, used only for the "can't scan" fallback.
export default function QrScanModal({ visible, onClose, onScanned, expected }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [done, setDone] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setDone(false);
      setManual("");
      setError("");
      if (permission && !permission.granted && permission.canAskAgain) requestPermission();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function handle({ data }) {
    if (done) return;
    const value = String(data || "").trim();
    if (expected && value !== expected) {
      setError("That QR is for a different order. Scan the QR on this customer's order screen.");
      return;
    }
    setDone(true);
    onScanned(value);
  }

  function submitManual() {
    const code = manual.trim().toUpperCase();
    if (!code) return;
    handle({ data: `HBORDER:${code}` });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <Text style={styles.title}>Scan the customer's QR</Text>
        <Text style={styles.sub}>Ask the customer to open this order and show the QR code.</Text>

        {permission?.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={done ? undefined : handle}
            />
            <View pointerEvents="none" style={styles.frame} />
          </View>
        ) : (
          <View style={[styles.cameraWrap, styles.noCamera]}>
            <Text style={[type.body, { color: "#fff", textAlign: "center" }]}>
              Camera access is needed to scan the QR.
            </Text>
            <Button title="Allow camera" onPress={requestPermission} style={{ marginTop: spacing.md }} />
          </View>
        )}

        {error ? <Notice tone="error">{error}</Notice> : null}

        <View style={styles.manual}>
          <Text style={styles.manualLabel}>Can't scan? Type the order code shown under the QR</Text>
          <TextInput
            value={manual}
            onChangeText={setManual}
            placeholder="ORD-000000-0000"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            style={styles.input}
          />
          <Button title="Use code" variant="outline" disabled={!manual.trim()} onPress={submitManual} />
        </View>

        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: 56, gap: spacing.md },
  title: { ...type.h2 },
  sub: { ...type.small },
  cameraWrap: {
    height: 320,
    borderRadius: radius.lg || 16,
    overflow: "hidden",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  noCamera: { padding: spacing.lg },
  frame: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 16,
    opacity: 0.85,
  },
  manual: { gap: spacing.sm },
  manualLabel: { ...type.tiny, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md || 10,
    backgroundColor: "#fff",
    padding: spacing.md,
    fontSize: 15,
  },
});
