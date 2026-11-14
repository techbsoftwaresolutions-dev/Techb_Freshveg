import React from "react";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import LiveLocation from "./src/components/LiveLocation";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
        {/* After the screens, so its status pill draws on top of them. */}
        <LiveLocation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
