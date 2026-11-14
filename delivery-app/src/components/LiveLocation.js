import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

// Shares the rider's position with the customer's tracking map — but only
// while an order is actually with them (assigned, picked up, on the way,
// arrived) and only while this app is open. With nothing in hand, GPS is off.
//
// Every 20 s it asks "do I have a live order?"; when yes, it sends the current
// position straight away, then keeps sending as the rider moves (at most every
// 5 s, or after ~15 m). A small pill tells the rider whether sharing works, so
// a denied permission or GPS switched off is never a silent failure.
const CHECK_EVERY_MS = 20000;
const SEND_EVERY_MS = 5000;

export default function LiveLocation() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const watcher = useRef(null);
  const lastSent = useRef(0);
  const asked = useRef(false);
  // idle (no live order) | starting | sharing | denied | gps_off | error
  const [state, setState] = useState("idle");
  const [sentAt, setSentAt] = useState(0);
  const [, tick] = useState(0);
  const retry = useRef(null);

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    let timer = null;

    function send(pos) {
      const now = Date.now();
      if (now - lastSent.current < SEND_EVERY_MS - 500) return;
      lastSent.current = now;
      api
        .post("/orders/delivery/location", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
        })
        .then(() => {
          if (!alive) return;
          setSentAt(Date.now());
          setState("sharing");
        })
        .catch(() => alive && setState("error"));
    }

    async function stop() {
      watcher.current?.remove?.();
      watcher.current = null;
    }

    async function start({ prompt = false } = {}) {
      if (watcher.current) return;
      setState((s) => (s === "sharing" ? s : "starting"));
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted" && (prompt || !asked.current) && canAskAgain !== false) {
        asked.current = true; // ask once per app session unless the rider taps the pill
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (!alive) return;
      if (status !== "granted") {
        setState("denied");
        return;
      }
      if (!(await Location.hasServicesEnabledAsync().catch(() => true))) {
        setState("gps_off");
        return;
      }
      // A first fix right away, so the customer sees the rider at once.
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        .then((pos) => alive && send(pos))
        .catch(() => {});
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: SEND_EVERY_MS, distanceInterval: 15 },
        (pos) => alive && send(pos)
      );
    }

    async function check({ prompt = false } = {}) {
      if (!alive) return;
      clearTimeout(timer);
      try {
        if (AppState.currentState !== "active") {
          await stop();
        } else {
          const data = await api.get("/orders/delivery/queue");
          if ((data.orders || []).length) {
            await start({ prompt });
          } else {
            await stop();
            setState("idle");
          }
        }
      } catch {
        // Offline for a moment — keep whatever state we had.
      }
      if (alive) timer = setTimeout(check, CHECK_EVERY_MS);
    }
    retry.current = () => {
      stop();
      check({ prompt: true });
    };

    const sub = AppState.addEventListener("change", (s) => {
      clearTimeout(timer);
      if (s === "active") check();
      else stop();
    });
    check();

    return () => {
      alive = false;
      clearTimeout(timer);
      sub.remove();
      stop();
    };
  }, [user]);

  // Re-render every few seconds so "updated Xs ago" stays true.
  useEffect(() => {
    if (state !== "sharing") return undefined;
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [state]);

  if (!user || state === "idle") return null;

  const ago = sentAt ? Math.max(0, Math.round((Date.now() - sentAt) / 1000)) : null;
  const look = {
    starting: { tone: styles.info, text: "Starting live location…" },
    sharing: { tone: styles.ok, text: `Sharing live location with the customer${ago != null ? ` · ${ago}s ago` : ""}` },
    denied: { tone: styles.bad, text: "Location is off — tap to allow, so the customer can track you" },
    gps_off: { tone: styles.bad, text: "Turn on GPS so the customer can track you — tap to retry" },
    error: { tone: styles.warn, text: "Couldn't send your location — tap to retry" },
  }[state];
  if (!look) return null;

  async function onPress() {
    if (state === "denied") {
      const { canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (canAskAgain === false) {
        Linking.openSettings().catch(() => {});
        return;
      }
    }
    retry.current?.();
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 76 }]}>
      <Pressable onPress={onPress} disabled={state === "sharing" || state === "starting"} style={[styles.pill, look.tone]}>
        <View style={[styles.dot, state === "sharing" ? styles.dotOk : state === "starting" ? styles.dotInfo : styles.dotBad]} />
        <Text style={styles.text} numberOfLines={2}>
          {look.text}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, alignItems: "center", zIndex: 50, elevation: 50 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 480,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  ok: { backgroundColor: "#E8F5E9" },
  info: { backgroundColor: "#E3F2FD" },
  warn: { backgroundColor: "#FFF4E5" },
  bad: { backgroundColor: "#FDECEA" },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotOk: { backgroundColor: "#2E7D32" },
  dotInfo: { backgroundColor: "#1565C0" },
  dotBad: { backgroundColor: "#C62828" },
  text: { flexShrink: 1, fontSize: 12.5, fontWeight: "600", color: "#1B1B1B" },
});
