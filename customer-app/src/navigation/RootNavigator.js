import React from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../components/Text";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useCart } from "../context/CartContext";
import { colors, fontFamily } from "../theme";

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
import SupportScreen from "../screens/SupportScreen";
import SupportTicketScreen from "../screens/SupportTicketScreen";
import ReturnRequestScreen from "../screens/ReturnRequestScreen";
import RateOrderScreen from "../screens/RateOrderScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// The website's mobile bottom bar: line icons, green when active, with a short
// green bar over the active tab. Ionicons ship with Expo, so this works in
// Expo Go and in builds alike.
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

function TabIcon({ route, focused, color }) {
  const { count } = useCart();
  const showBadge = route.name === "CartTab" && count > 0;

  return (
    <View style={styles.tabIcon}>
      {focused ? <View style={styles.activeBar} /> : null}
      <Ionicons name={TAB_ICONS[route.name]} size={23} color={color} />
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : Math.round(count)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function MainTabs() {
  // A fixed bar height would sit under the phone's gesture/button bar; the
  // inset keeps the bar above it.
  const { bottom } = useSafeAreaInsets();
  const padBottom = Math.max(bottom, 10);

  return (
    <Tabs.Navigator
      // Back from a tab goes to the tab you came from, not always Home.
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => <TabIcon route={route} focused={focused} color={color} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [styles.tabBar, { height: 58 + padBottom, paddingBottom: padBottom }],
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
        <Stack.Screen name="Support" component={SupportScreen} options={{ title: "Help & support" }} />
        <Stack.Screen name="SupportTicket" component={SupportTicketScreen} options={{ title: "Support request" }} />
        <Stack.Screen name="ReturnRequest" component={ReturnRequestScreen} options={{ title: "Return items" }} />
        <Stack.Screen name="RateOrder" component={RateOrderScreen} options={{ title: "Rate your items" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: colors.surface, borderTopColor: colors.border, paddingTop: 6 },
  back: { width: 40, height: 40, marginRight: 4, alignItems: "center", justifyContent: "center" },
  // Sized so "Categories" still fits five-across on a 320px phone.
  tabLabel: { fontSize: Dimensions.get("window").width < 360 ? 10 : 11, fontFamily: fontFamily.medium, marginTop: 2 },
  tabItem: { paddingHorizontal: 0 },

  tabIcon: { width: 40, height: 26, alignItems: "center", justifyContent: "center" },
  activeBar: { position: "absolute", top: -7, width: 28, height: 3, borderRadius: 2, backgroundColor: colors.primary },
  badge: {
    position: "absolute",
    top: -5,
    right: 0,
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
