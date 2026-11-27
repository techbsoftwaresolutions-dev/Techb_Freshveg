import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "./api/client";

export async function registerForPushNotifications() {
  if (!["android", "ios"].includes(Platform.OS) || (Platform.OS === "ios" && !Device.isDevice)) {
    return { status: "unsupported" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("delivery_assignments_v2", {
      name: "Delivery assignments",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return { status: "permission-denied" };

  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("The Expo project ID is missing from app configuration");

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post("/notifications/devices", { token, platform: Platform.OS });
  const channel =
    Platform.OS === "android"
      ? await Notifications.getNotificationChannelAsync("delivery_assignments_v2")
      : null;
  return {
    status: "registered",
    channelEnabled: !channel || channel.importance !== Notifications.AndroidImportance.NONE,
  };
}
