import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Icon from "../components/Icon";
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
import AboutScreen from "../screens/AboutScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// The customer app's bottom bar and headers (customer-app/src/navigation/
// RootNavigator.js): the brand's duotone icons (components/Icon), icons only,
// in round buttons on the same floating pill; the active one fills dark green.
const TAB_ICONS = { Queue: "run", History: "history", Profile: "account" };
const ACTIVE_LINE = "#E3F4E8";
const ACTIVE_TINT = "rgba(198, 230, 207, 0.3)";

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

// The tab bar draws every icon twice (an active and an inactive copy, swapped
// by opacity), so `focused` is fixed per copy; `active` is the tab's real state
// and drives the spring.
function TabIcon({ name, active }) {
  const lift = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(lift, { toValue: active ? 1 : 0, friction: 5, tension: 160, useNativeDriver: Platform.OS !== "web" }).start();
  }, [active, lift]);

  const transform = [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }];

  return (
    <Animated.View style={[styles.tabIcon, active && styles.tabIconActive, { transform }]}>
      <Icon name={name} size={26} {...(active ? { color: ACTIVE_LINE, tint: ACTIVE_TINT, inverse: colors.primaryDark } : null)} />
    </Animated.View>
  );
}

function MainTabs() {
  // Takes its own space (not absolutely positioned), so lists end above it;
  // the margin keeps it clear of the phone's gesture or button bar.
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: route.name !== "Queue",
        tabBarIcon: () => <TabIcon name={TAB_ICONS[route.name]} active={navigation.isFocused()} />,
        // Icons only; each screen's tabBarAccessibilityLabel names its tab for
        // screen readers, since there is no visible text to read.
        tabBarShowLabel: false,
        tabBarIconStyle: styles.tabIconSlot,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: [styles.tabBar, { marginBottom: Math.max(bottom, 10) }],
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: TITLE,
        headerTitleAlign: "left",
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
      })}
    >
      <Tabs.Screen name="Queue" component={QueueScreen} options={{ title: "My runs", tabBarAccessibilityLabel: "My runs" }} />
      <Tabs.Screen name="History" component={HistoryScreen} options={{ title: "History", tabBarAccessibilityLabel: "History" }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile", tabBarAccessibilityLabel: "Profile" }} />
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
            <Stack.Screen name="About" component={AboutScreen} options={{ title: "Legal & account" }} />
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
  // A floating pill of equal round buttons: 64 tall, a 46 circle per tab
  // centred in it, so nothing clips and the spacing is even.
  tabBar: {
    height: 64,
    paddingTop: 0,
    paddingBottom: 0,
    marginHorizontal: 12,
    borderRadius: 32,
    borderWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.border,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
    elevation: 6,
  },
  tabItem: { paddingHorizontal: 0, paddingVertical: 0, justifyContent: "center", alignItems: "center" },
  // Fills the tab button's height (it pads 5 top and bottom and stacks from
  // the top); the icon is centred in this slot, so the circle sits mid-bar.
  tabIconSlot: { width: 46, flex: 1 },
  tabIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  tabIconActive: { backgroundColor: colors.primaryDark },
  back: { width: 40, height: 40, marginRight: 4, alignItems: "center", justifyContent: "center" },
});
