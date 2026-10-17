import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../components/Text";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import Icon from "../components/Icon";
import { tabBarHidden, useTabBarSpace } from "./tabBarScroll";

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
import WishlistScreen from "../screens/WishlistScreen";
import SupportScreen from "../screens/SupportScreen";
import SupportTicketScreen from "../screens/SupportTicketScreen";
import ReturnRequestScreen from "../screens/ReturnRequestScreen";
import RateOrderScreen from "../screens/RateOrderScreen";
import LegalScreen from "../screens/LegalScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// The website's mobile bottom bar, a floating dock: the brand's duotone icons
// (components/Icon) in round buttons, the active one on a soft-green circle
// that springs up a little.
const TAB_ICONS = {
  HomeTab: "home",
  CategoriesTab: "categories",
  CartTab: "cart",
  OrdersTab: "orders",
  AccountTab: "account",
};
// The active tab's icon, light green on the dark-green circle.
const ACTIVE_LINE = "#E3F4E8";
const ACTIVE_TINT = "rgba(198, 230, 207, 0.3)";

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
function TabIcon({ route, active }) {
  const { count } = useCart();
  const showBadge = route.name === "CartTab" && count > 0;
  const lift = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(lift, { toValue: active ? 1 : 0, friction: 5, tension: 160, useNativeDriver: Platform.OS !== "web" }).start();
  }, [active, lift]);

  const transform = [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }];

  // Active: the circle fills dark green and the icon turns light green.
  // Inactive: the icon's own dark-on-light-green duotone on the bar's white.
  return (
    <Animated.View style={[styles.tabIcon, active && styles.tabIconActive, { transform }]}>
      <Icon
        name={TAB_ICONS[route.name]}
        size={26}
        {...(active ? { color: ACTIVE_LINE, tint: ACTIVE_TINT, inverse: colors.primaryDark } : null)}
      />
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : Math.round(count)}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function MainTabs() {
  // A floating, rounded bar over the screens, so it can slide down out of the
  // way while a tab screen scrolls down (tabBarScroll). Tab screens pad their
  // scroll content and bottom bars by useTabBarSpace() to stay clear of it.
  // The margin below keeps it above the phone's gesture or button bar.
  const { bottom } = useSafeAreaInsets();
  const { space } = useTabBarSpace();
  // Hidden = below the screen edge, its shadow included.
  const slide = { transform: [{ translateY: tabBarHidden.interpolate({ inputRange: [0, 1], outputRange: [0, space + 16] }) }] };

  return (
    <Tabs.Navigator
      // Back from a tab goes to the tab you came from, not always Home.
      backBehavior="history"
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        tabBarIcon: () => <TabIcon route={route} active={navigation.isFocused()} />,
        // Icons only; tabBarAccessibilityLabel (below) names each tab for
        // screen readers, since there is no visible text to read.
        tabBarShowLabel: false,
        tabBarIconStyle: styles.tabIconSlot,
        tabBarStyle: [styles.tabBar, { marginBottom: Math.max(bottom, 10) }, slide],
        tabBarItemStyle: styles.tabItem,
      })}
    >
      {TABS.map(([name, label, component]) => (
        <Tabs.Screen key={name} name={name} component={component} options={{ title: label, tabBarAccessibilityLabel: label }} />
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
        <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: "Your wishlist" }} />
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
  // A floating pill of equal round buttons: 64 tall, a 46 circle per tab
  // centred in it, so nothing clips and the spacing is even.
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
  back: { width: 40, height: 40, marginRight: 4, alignItems: "center", justifyContent: "center" },
  tabItem: { paddingHorizontal: 0, paddingVertical: 0, justifyContent: "center", alignItems: "center" },

  // Fills the tab button's height (it pads 5 top and bottom and stacks from
  // the top); the icon is centred in this slot, so the circle sits mid-bar.
  tabIconSlot: { width: 46, flex: 1 },
  tabIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  tabIconActive: { backgroundColor: colors.primaryDark },
  badge: {
    position: "absolute",
    top: 1,
    right: -2,
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
