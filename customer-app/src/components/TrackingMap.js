import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text } from "./AppText";
import { colors, radius, spacing } from "../theme";

// The order on a map: the store, where it's going, and the delivery partner
// moving between them (their position comes from the delivery app while the
// order is with them). The view re-fits as the rider moves.
export default function TrackingMap({ map, status }) {
  const ref = useRef(null);
  // Custom marker views must be drawn once with tracking on (Android), then frozen.
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 800);
    return () => clearTimeout(t);
  }, [map?.rider?.lat, map?.rider?.lng]);

  const points = useMemo(
    () => [map?.store, map?.rider, map?.destination].filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [map]
  );

  useEffect(() => {
    if (!ref.current || points.length < 2) return;
    ref.current.fitToCoordinates(
      points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
    );
  }, [points]);

  if (!points.length) return null;
  const first = points[0];
  const line = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  const caption = map.rider
    ? status === "ARRIVED"
      ? "Your delivery partner is at your door"
      : "Your delivery partner is on the way"
    : "Live location appears once your order is out for delivery";

  return (
    <View style={styles.card}>
      <MapView
        ref={ref}
        style={styles.map}
        initialRegion={{ latitude: first.lat, longitude: first.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        toolbarEnabled={false}
        showsPointsOfInterest={false}
        loadingEnabled
      >
        {line.length > 1 ? <Polyline coordinates={line} strokeColor={colors.primary} strokeWidth={3} lineDashPattern={[6, 6]} /> : null}

        {map.store ? (
          <Marker coordinate={{ latitude: map.store.lat, longitude: map.store.lng }} title={map.store.name || "Store"} tracksViewChanges={tracks}>
            <Pin icon="storefront" bg="#1b7a3a" />
          </Marker>
        ) : null}
        {map.destination ? (
          <Marker coordinate={{ latitude: map.destination.lat, longitude: map.destination.lng }} title="Delivery address" tracksViewChanges={tracks}>
            <Pin icon="home" bg="#d9480f" />
          </Marker>
        ) : null}
        {map.rider ? (
          <Marker
            coordinate={{ latitude: map.rider.lat, longitude: map.rider.lng }}
            title="Delivery partner"
            tracksViewChanges={tracks}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.rider}>
              <Ionicons name="bicycle" size={20} color="#fff" />
            </View>
          </Marker>
        ) : null}
      </MapView>

      <View style={styles.foot}>
        <View style={[styles.dot, { backgroundColor: map.rider ? "#2f9e44" : colors.textFaint }]} />
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  );
}

function Pin({ icon, bg }) {
  return (
    <View style={[styles.pin, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: { width: "100%", height: 230 },
  foot: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  caption: { flex: 1, fontSize: 13, color: colors.text, fontWeight: "600" },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  rider: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1c7ed6",
    borderWidth: 3,
    borderColor: "#fff",
  },
});
