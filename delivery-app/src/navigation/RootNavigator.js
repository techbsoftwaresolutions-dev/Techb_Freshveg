import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAuth } from "../context/AuthContext";
import { colors, fontFamily, shadow } from "../theme";
import { Loading } from "../components/ui";

import LoginScreen from "../screens/LoginScreen";
import QueueScreen from "../screens/QueueScreen";
import DeliveryScreen from "../screens/DeliveryScreen";
import DeliveredScreen from "../screens/DeliveredScreen";
import HistoryScreen from "../screens/HistoryScreen";
import ProfileScreen from "../screens/ProfileScreen";
import RunDetailScreen from "../screens/RunDetailScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// The customer app's bottom bar and headers (customer-app/src/navigation/
// RootNavigator.js): line icons, green when active with a short bar over the
// active tab, in the same floating rounded bar.
const TAB_ICONS = { Queue: "bicycle-outline", History: "time-outline", Profile: "person-outline" };

const TITLE = { fontFamily: fontFamily.bold, fontSize: 19, color: colors.text };

function BackButton({ navigation }) {
  return (
    <Pressable
      // Ignoring taps once the screen has lost focus stops a double tap from
      // going back twice.
      onPress={() => navigation.isFocused() && navigation.canGoBack() && navigation.goBack()}
      hitSlop={12}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="arrow-back" size={23} color={colors.text} />
    </Pressable>
  );
}

function TabIcon({ focused, color, name }) {
  return (
    <View style={styles.tabIcon}>
      {focused ? <View style={styles.activeBar} /> : null}
      <Ionicons name={name} size={23} color={color} />
    </View>
  );
}

function MainTabs() {
  // Takes its own space (not absolutely positioned), so lists end above it;
  // the margin keeps it clear of the phone's gesture or button bar.
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== "Queue",
        tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} name={TAB_ICONS[route.name]} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [styles.tabBar, { marginBottom: Math.max(bottom, 10) }],
        tabBarLabelStyle: styles.tabLabel,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: TITLE,
        headerTitleAlign: "left",
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
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
        screenOptions={({ navigation }) => ({
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: TITLE,
          headerTitleAlign: "left",
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerLeft: navigation.canGoBack() ? () => <BackButton navigation={navigation} /> : undefined,
          contentStyle: { backgroundColor: colors.bg },
        })}
      >
        {!signedIn ? (
          // A rider is either on shift or signed out; there is no guest mode,
          // so the whole app sits behind the login rather than gating screens.
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Delivery" component={DeliveryScreen} options={{ title: "Delivery" }} />
            <Stack.Screen name="RunDetail" component={RunDetailScreen} options={{ title: "Delivery details" }} />
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
    height: 68,
    paddingTop: 6,
    paddingBottom: 6,
    marginHorizontal: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.border,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
    elevation: 6,
  },
  tabLabel: { fontSize: 11, fontFamily: fontFamily.medium, marginTop: 2 },
  tabIcon: { width: 40, height: 26, alignItems: "center", justifyContent: "center" },
  activeBar: { position: "absolute", top: -7, width: 28, height: 3, borderRadius: 2, backgroundColor: colors.primary },
  back: { width: 40, height: 40, marginRight: 4, alignItems: "center", justifyContent: "center" },
});
