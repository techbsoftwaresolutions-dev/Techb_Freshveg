import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAuth } from "../context/AuthContext";
import { colors, type } from "../theme";
import { Loading } from "../components/ui";

import LoginScreen from "../screens/LoginScreen";
import QueueScreen from "../screens/QueueScreen";
import DeliveryScreen from "../screens/DeliveryScreen";
import DeliveredScreen from "../screens/DeliveredScreen";
import HistoryScreen from "../screens/HistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ICONS = { Queue: "\u{1F6F5}", History: "\u{1F4CB}", Profile: "\u{1F464}" };

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== "Queue",
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 21, opacity: focused ? 1 : 0.5 }}>{ICONS[route.name]}</Text>
        ),
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: type.h2,
        headerShadowVisible: false,
      })}
    >
      <Tabs.Screen name="Queue" component={QueueScreen} options={{ title: "My runs" }} />
      <Tabs.Screen name="History" component={HistoryScreen} options={{ title: "History" }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { signedIn, ready } = useAuth();

  if (!ready) return <Loading label="Starting up" />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: type.h2,
          headerShadowVisible: false,
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {!signedIn ? (
          // A rider is either on shift or signed out; there is no guest mode,
          // so the whole app sits behind the login rather than gating screens.
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Delivery" component={DeliveryScreen} options={{ title: "Delivery" }} />
            <Stack.Screen
              name="Delivered"
              component={DeliveredScreen}
              // No going back to a run that is finished.
              options={{ headerShown: false, gestureEnabled: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 62,
    paddingBottom: 7,
    paddingTop: 7,
  },
  tabLabel: { fontSize: 11.5, fontWeight: "700" },
});
