import React from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { RootStackParamList } from "./types";
import { theme } from "../constants/theme";

// Placeholder imports for screens
import SplashScreen from "../screens/SplashScreen";
import HomeScreen from "../screens/HomeScreen";
import PatientDetailsScreen from "../screens/PatientDetailsScreen";
import SessionScreen from "../screens/SessionScreen";
import CameraScreen from "../screens/CameraScreen";
import ImageReviewScreen from "../screens/ImageReviewScreen";
import GalleryScreen from "../screens/GalleryScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.primary,
        },
      }}
    >
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Dashboard", headerLeft: () => null }}
        />
        <Stack.Screen
          name="PatientDetails"
          component={PatientDetailsScreen}
          options={{ title: "Patient Details" }}
        />
        <Stack.Screen
          name="Session"
          component={SessionScreen}
          options={{ title: "Imaging Session" }}
        />
        <Stack.Screen
          name="Camera"
          component={CameraScreen}
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="ImageReview"
          component={ImageReviewScreen}
          options={{ title: "Review Image" }}
        />
        <Stack.Screen
          name="Gallery"
          component={GalleryScreen}
          options={{ title: "History & Gallery" }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: "Settings" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
