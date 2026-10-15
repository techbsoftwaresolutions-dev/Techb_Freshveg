import React, { useEffect, useRef, useState } from "react";
import { Image, Modal, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors, radius, spacing, type } from "../theme";
import { Button, Notice } from "./ui";

// Full-screen camera for the optional delivery photo. Calls onCaptured(uri)
// once the rider is happy with the shot (Use photo), so a blurry picture can
// be retaken before it's kept.
export default function PhotoCaptureModal({ visible, onClose, onCaptured }) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef(null);
  const [shot, setShot] = useState("");
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setShot("");
      setError("");
      if (permission && !permission.granted && permission.canAskAgain) requestPermission();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  async function take() {
    if (!camera.current || taking) return;
    setTaking(true);
    setError("");
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      setShot(picture.uri);
    } catch {
      setError("Couldn't take the photo. Try again.");
    } finally {
      setTaking(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <Text style={styles.title}>Delivery photo</Text>
        <Text style={styles.sub}>Optional — a quick photo of the order at the door.</Text>

        <View style={styles.cameraWrap}>
          {shot ? (
            <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : permission?.granted ? (
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
          ) : (
            <View style={styles.noCamera}>
              <Text style={[type.body, { color: "#fff", textAlign: "center" }]}>
                Camera access is needed to take the photo.
              </Text>
              <Button title="Allow camera" onPress={requestPermission} style={{ marginTop: spacing.md }} />
            </View>
          )}
        </View>

        {error ? <Notice tone="error">{error}</Notice> : null}

        {shot ? (
          <View style={{ gap: spacing.sm }}>
            <Button title="Use photo" onPress={() => onCaptured(shot)} />
            <Button title="Retake" variant="outline" onPress={() => setShot("")} />
          </View>
        ) : (
          <Button title="Take photo" loading={taking} disabled={!permission?.granted} onPress={take} />
        )}

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
    flex: 1,
    maxHeight: 460,
    borderRadius: radius.lg || 16,
    overflow: "hidden",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  noCamera: { padding: spacing.lg },
});
