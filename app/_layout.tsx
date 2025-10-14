import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Stack } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "./Toast";


const MAX_WIDTH = 900;

function WebHeader({ navigation, options, back }: any) {
  const title = options?.title ?? '';
  // React Navigation sometimes omits the `back` prop on web even when a previous
  // entry exists in history (e.g. after full reload). Fallback to canGoBack().
  const canGoBack = back || navigation?.canGoBack?.();
  return (
    <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', justifyContent: 'center' }}>
      <View
        style={{
          width: '100%',
            maxWidth: MAX_WIDTH,
            alignSelf: 'center',
            minHeight: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            gap: 8,
        }}
      >
        <View style={{ width: 64, justifyContent: 'center' }}>
          {canGoBack ? (
            <Pressable onPress={() => navigation.goBack()} style={{ paddingVertical: 8, paddingHorizontal: 8 }}>
              <FontAwesome6 name="arrow-left" size={18} color="black" style={{ marginRight: 6 }} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={{ width: 64 }} />
      </View>
    </View>
  );
}

const renderWebHeader = (props: any) => <WebHeader {...props} />;

export default function RootLayout() {
  // We'll provide a subtle elevated card look only on web.
  const webWrapperEnabled = Platform.OS === 'web';
  return (
    <ToastProvider>
      <AuthProvider>
        <View
          style={webWrapperEnabled ? {
            flex: 1,
            // Align web with native: no colored page background
            backgroundColor: 'transparent',
            paddingHorizontal: 32,
            paddingVertical: 40,
            boxSizing: 'border-box' as any,
          } : { flex: 1 }}
        >
          <View
            style={webWrapperEnabled ? {
              flex: 1,
              maxWidth: MAX_WIDTH,
              alignSelf: 'center',
              width: '100%',
              // Remove card visuals; keep layout constraints only
              // backgroundColor: 'transparent' is implicit on web
            } : { flex: 1 }}
          >
            <Stack
              screenOptions={{
                contentStyle: Platform.select({
                  web: { width: '100%', maxWidth: '100%', alignSelf: 'center', backgroundColor: 'transparent' },
                  default: undefined,
                }),
                header: Platform.select({
                  web: renderWebHeader,
                  default: undefined,
                }) as any,
                // Add some interior padding for body content across all screens (web only, keep native unchanged)
                // We'll rely on individual screens for their own padding currently; leaving this commented for potential future use.
              }}
            >
              <Stack.Screen name="index" options={{ title: 'Forside' }} />
              {/* Backward direction (e.g., after logout) */}
              <Stack.Screen name="login" options={{ title: 'Log ind', animation: Platform.OS === 'web' ? undefined : 'slide_from_left', animationTypeForReplace: Platform.OS === 'web' ? undefined as any : 'pop' }} />

              {/* Forward flows slide from right */}
              <Stack.Screen name="register" options={{ title: 'Opret konto', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              <Stack.Screen name="listings" options={{ title: 'Opslag', animation: Platform.OS === 'web' ? undefined : 'slide_from_right', animationTypeForReplace: Platform.OS === 'web' ? undefined as any : 'pop' }} />
              <Stack.Screen name="create-listing" options={{ title: 'Opret opslag', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              <Stack.Screen name="my-listings" options={{ title: 'Mine opslag', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              <Stack.Screen name="my-applications" options={{ title: 'Mine ansøgninger', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              <Stack.Screen name="listing-applicants" options={{ title: 'Ansøgere', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              <Stack.Screen name="chat/[listingId]" options={{ title: 'Chat', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              <Stack.Screen name="meeting-point/[listingId]" options={{ title: 'Mødested', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              {/* If present, also treat receipt upload as forward */}
              <Stack.Screen name="receipt-upload/[listingId]" options={{ title: 'Kvittering', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
            </Stack>
          </View>
        </View>
      </AuthProvider>
    </ToastProvider>
  );
}
