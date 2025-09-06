import { Stack } from "expo-router";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "./Toast";


export default function RootLayout() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Forside' }} />
          <Stack.Screen name="login" options={{ title: 'Log ind' }} />
          <Stack.Screen name="register" options={{ title: 'Opret konto' }} />
          <Stack.Screen name="listings" options={{ title: 'Opslag' }} />
          <Stack.Screen name="create-listing" options={{ title: 'Opret opslag' }} />
        </Stack>
      </AuthProvider>
    </ToastProvider>
  );
}
