import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useCart } from "../context/CartContext";
import { colors, type } from "../theme";

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

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Emoji rather than an icon font: it keeps the dependency list short and reads
// the same on every platform. Swap for react-native-vector-icons when the
// brand needs it.
const TAB_ICONS = {
 HomeTab:"",
 CategoriesTab:"",
 CartTab:"",
 OrdersTab:"",
 AccountTab:"",
};

function TabIcon({ route, focused }) {
  const { count } = useCart();
  const showBadge = route.name === "CartTab" && count > 0;

  return (
    <View style={styles.tabIcon}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{TAB_ICONS[route.name]}</Text>
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : Math.round(count)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== "HomeTab",
        tabBarIcon: ({ focused }) => <TabIcon route={route} focused={focused} />,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
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
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabLabel: { fontSize: 11, fontWeight: "600" },

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
