import React from "react";
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "./AppText";
import { colors, spacing } from "../theme";

// The "Coming soon" banner shown instead of starting a checkout before the opening date.
export default function ComingSoonModal({ visible, onClose }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - spacing.lg * 2, 520);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={{ width: w }}>
          <Image source={require("../../assets/coming-soon.jpg")} style={{ width: w, height: (w * 896) / 1344, borderRadius: 16 }} resizeMode="cover" />
          <Pressable style={styles.close} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Text style={styles.x}>✕</Text>
          </Pressable>
          <Text style={styles.note}>Orders open on 13 November. You can fill your cart now!</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(10,20,14,.72)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  close: { position: "absolute", top: -14, right: -6, width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  x: { fontSize: 15, fontWeight: "800", color: colors.text },
  note: { color: "#fff", textAlign: "center", marginTop: spacing.md, fontSize: 13 },
});
