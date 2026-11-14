import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "../context/CartContext";
import { colors, fontFamily, type } from "../theme";

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
import NotificationsScreen from "../screens/NotificationsScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import WishlistScreen from "../screens/WishlistScreen";
import AddressesScreen from "../screens/AddressesScreen";
import SupportScreen from "../screens/SupportScreen";
import NewTicketScreen from "../screens/NewTicketScreen";
import TicketScreen from "../screens/TicketScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Icon per tab: filled when selected, outline otherwise (Ionicons, bundled
// with Expo, so they draw the same on every phone and take the tab colour).
const TAB_ICONS = {
  HomeTab: ["home", "home-outline"],
  CategoriesTab: ["grid", "grid-outline"],
  CartTab: ["cart", "cart-outline"],
  OrdersTab: ["bag-handle", "bag-handle-outline"],
  AccountTab: ["person", "person-outline"],
};

function TabIcon({ route, focused, color }) {
  const { count } = useCart();
  const showBadge = route.name === "CartTab" && count > 0;

  return (
    <View style={styles.tabIcon}>
      <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={23} color={color} />
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : Math.round(count)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function MainTabs() {
  // Room for the phone's own navigation / gesture bar under the tabs, so the
  // labels never sit on top of it.
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== "HomeTab",
        tabBarIcon: ({ focused, color }) => <TabIcon route={route} focused={focused} color={color} />,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: [styles.tabBar, { height: 58 + bottom, paddingBottom: bottom }],
        tabBarLabelStyle: styles.tabLabel,
        tabBarAllowFontScaling: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: type.h2,
        headerShadowVisible: false,
      })}
    >
      <Tabs.Screen name="HomeTab" component={HomeScreen} options={{ title: "Home" }} />
      <Tabs.Screen name="CategoriesTab" component={CategoriesScreen} options={{ title: "Categories" }} />
      <Tabs.Screen name="CartTab" component={CartScreen} options={{ title: "Cart" }} />
      <Tabs.Screen name="OrdersTab" component={OrdersScreen} options={{ title: "Orders" }} />
      <Tabs.Screen name="AccountTab" component={AccountScreen} options={{ title: "Account" }} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
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
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />

        <Stack.Screen name="ProductList" component={ProductListScreen} options={{ title: "Browse" }} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: "" }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
        <Stack.Screen name="OrderTrack" component={OrderTrackScreen} options={{ title: "Track order" }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: "Edit profile" }} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: "Saved items" }} />
        <Stack.Screen name="Addresses" component={AddressesScreen} options={{ title: "Saved addresses" }} />
        <Stack.Screen name="Support" component={SupportScreen} options={{ title: "Help & support" }} />
        <Stack.Screen name="NewTicket" component={NewTicketScreen} options={{ title: "New ticket" }} />
        <Stack.Screen name="Ticket" component={TicketScreen} options={{ title: "Ticket" }} />
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  tabLabel: { fontSize: 11, fontFamily: fontFamily.semibold },

  tabIcon: { width: 32, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -4,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
