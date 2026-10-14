import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../context/AuthContext";
import { colors, type } from "../theme";
import { Loading } from "../components/ui";

import LoginScreen from "../screens/LoginScreen";
import QueueScreen from "../screens/QueueScreen";
import DeliveryScreen from "../screens/DeliveryScreen";
import DeliveredScreen from "../screens/DeliveredScreen";
import DeliveredDetailScreen from "../screens/DeliveredDetailScreen";
import OrdersScreen from "../screens/OrdersScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// [active, inactive] icon per tab.
const ICONS = {
  Queue: ["home", "home-outline"],
  Orders: ["clipboard", "clipboard-outline"],
  Profile: ["person", "person-outline"],
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== "Queue",
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={24} color={color} />
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
      <Tabs.Screen name="Queue" component={QueueScreen} options={{ title: "Home" }} />
      <Tabs.Screen name="Orders" component={OrdersScreen} options={{ title: "Orders" }} />
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
            <Stack.Screen name="DeliveredDetail" component={DeliveredDetailScreen} options={{ title: "Delivery details" }} />
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
    height: 72,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 0,
    shadowColor: "#0A2A14",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  tabLabel: { fontSize: 11.5, fontWeight: "700" },
});
