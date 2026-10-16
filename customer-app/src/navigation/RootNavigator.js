import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../components/Text";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useCart } from "../context/CartContext";
import { colors, fontFamily, shadow } from "../theme";

import HomeScreen from "../screens/HomeScreen";
import CategoriesScreen from "../screens/CategoriesScreen";
import ProductListScreen from "../screens/ProductListScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import SearchScreen from "../screens/SearchScreen";
import CartScreen from "../screens/CartScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import OrdersScreen from "../screens/OrdersScreen";
import OrderTrackScreen from "../screens/OrderTrackScreen";
import OrderPlacedScreen from "../screens/OrderPlacedScreen";
import AccountScreen from "../screens/AccountScreen";
import LoginScreen from "../screens/LoginScreen";
import LocationScreen from "../screens/LocationScreen";
import AddressesScreen from "../screens/AddressesScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ReferralScreen from "../screens/ReferralScreen";
import CouponsScreen from "../screens/CouponsScreen";
import SupportScreen from "../screens/SupportScreen";
import SupportTicketScreen from "../screens/SupportTicketScreen";
import ReturnRequestScreen from "../screens/ReturnRequestScreen";
import RateOrderScreen from "../screens/RateOrderScreen";
import LegalScreen from "../screens/LegalScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// The website's mobile bottom bar, a floating dock: line icons in round
// buttons, the active one green on a soft-green circle that springs up a
// little. Ionicons ship with Expo, so this works in Expo Go and in builds alike.
const TAB_ICONS = {
  HomeTab: "home-outline",
  CategoriesTab: "grid-outline",
  CartTab: "cart-outline",
  OrdersTab: "bag-handle-outline",
  AccountTab: "person-outline",
};

// The website's .cat-mobile-head back arrow. Goes back through the stack, then
// the tab history; with nowhere to go back to it lands on Home. Ignoring taps
// once the screen has lost focus stops a double tap from going back twice.
function BackButton({ navigation }) {
  const onPress = () => {
    if (!navigation.isFocused()) return;
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Main", { screen: "HomeTab", params: { screen: "Home" } });
  };
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
      <Ionicons name="arrow-back" size={23} color={colors.text} />
    </Pressable>
  );
}

// Page headers: white, back arrow, bold title on the left — the website's
// .cat-mobile-head. Every header, including the tab roots', gets the same arrow.
const HEADER = ({ navigation }) => ({
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { fontFamily: fontFamily.bold, fontSize: 19, color: colors.text },
  headerTitleAlign: "left",
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerLeft: () => <BackButton navigation={navigation} />,
  contentStyle: { backgroundColor: colors.bg },
});

// Browsing happens inside whichever tab it started from, so the bottom bar
// stays on category, product and search pages and each tab keeps its own
// back path.
function browseScreens() {
  return (
    <>
      <Stack.Screen name="ProductList" component={ProductListScreen} options={{ title: "Browse" }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
    </>
  );
}

function tabStack(name, title, component, options = {}) {
  return function TabStack() {
    return (
      <Stack.Navigator screenOptions={HEADER}>
        <Stack.Screen name={name} component={component} options={{ title, ...options }} />
        {browseScreens()}
      </Stack.Navigator>
    );
  };
}

const TABS = [
  ["HomeTab", "Home", tabStack("Home", "Home", HomeScreen, { headerShown: false })],
  ["CategoriesTab", "Categories", tabStack("Categories", "Categories", CategoriesScreen)],
  ["CartTab", "Cart", tabStack("Cart", "Cart", CartScreen)],
  ["OrdersTab", "Orders", tabStack("Orders", "My orders", OrdersScreen)],
  ["AccountTab", "Account", tabStack("Account", "My account", AccountScreen)],
];

// The tab bar draws every icon twice (an active and an inactive copy, swapped
// by opacity), so `focused` is fixed per copy; `active` is the tab's real state
// and drives the spring.
function TabIcon({ route, active, color }) {
  const { count } = useCart();
  const showBadge = route.name === "CartTab" && count > 0;
  const lift = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(lift, { toValue: active ? 1 : 0, friction: 5, tension: 160, useNativeDriver: Platform.OS !== "web" }).start();
  }, [active, lift]);

  const transform = [
    { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
    { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
  ];

  return (
    <Animated.View style={[styles.tabIcon, active && styles.tabIconActive, { transform }]}>
      <Ionicons name={TAB_ICONS[route.name]} size={22} color={color} />
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : Math.round(count)}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function MainTabs() {
  // A floating, rounded bar. It still takes its own space in the layout (it is
  // not absolutely positioned), so screens end above it and never need extra
  // bottom padding: cart totals and checkout buttons can't slide under it.
  // The margin below keeps it above the phone's gesture or button bar.
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      // Back from a tab goes to the tab you came from, not always Home.
      backBehavior="history"
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        tabBarIcon: ({ color }) => <TabIcon route={route} active={navigation.isFocused()} color={color} />,
        tabBarIconStyle: styles.tabIconSlot,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [styles.tabBar, { marginBottom: Math.max(bottom, 10) }],
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      })}
    >
      {TABS.map(([name, label, component]) => (
        <Tabs.Screen key={name} name={name} component={component} options={{ title: label }} />
      ))}
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={HEADER}>
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />

        {/* Flows that take the whole screen: checkout, tracking, sign-in and
            the account pages. */}
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
        <Stack.Screen name="OrderTrack" component={OrderTrackScreen} options={{ title: "Track order" }} />
        <Stack.Screen
          name="OrderPlaced"
          component={OrderPlacedScreen}
          // No way back to a checkout whose cart is now converted.
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false, presentation: "modal" }}
        />
        <Stack.Screen
          name="Location"
          component={LocationScreen}
          options={{ title: "Delivery location", presentation: "modal" }}
        />
        <Stack.Screen name="Addresses" component={AddressesScreen} options={{ title: "Saved addresses" }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit profile" }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
        <Stack.Screen name="Referral" component={ReferralScreen} options={{ title: "Refer & earn" }} />
        <Stack.Screen name="Coupons" component={CouponsScreen} options={{ title: "My coupons" }} />
        <Stack.Screen name="Support" component={SupportScreen} options={{ title: "Help & support" }} />
        <Stack.Screen name="SupportTicket" component={SupportTicketScreen} options={{ title: "Support request" }} />
        <Stack.Screen name="ReturnRequest" component={ReturnRequestScreen} options={{ title: "Return items" }} />
        <Stack.Screen name="RateOrder" component={RateOrderScreen} options={{ title: "Rate your items" }} />
        <Stack.Screen name="Legal" component={LegalScreen} options={{ title: "Legal & about" }} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: "Delete account" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 72,
    paddingTop: 4,
    paddingBottom: 4,
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
  back: { width: 40, height: 40, marginRight: 4, alignItems: "center", justifyContent: "center" },
  // Sized so "Categories" still fits five-across in the inset bar on a 320px
  // phone; there the label also borrows the tab button's own 5px side padding.
  tabLabel: {
    fontSize: Dimensions.get("window").width < 400 ? 10 : 11,
    marginHorizontal: Dimensions.get("window").width < 360 ? -5 : 0,
    maxWidth: "120%",
    fontFamily: fontFamily.medium,
    marginTop: 2,
  },
  // No vertical padding: the round icon (36) and the label need the full height.
  tabItem: { paddingHorizontal: 0, paddingVertical: 0 },

  tabIconSlot: { width: 40, height: 36 },
  tabIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tabIconActive: { backgroundColor: colors.primarySoft },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
