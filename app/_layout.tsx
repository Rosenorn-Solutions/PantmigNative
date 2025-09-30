import { Stack } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "./Toast";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import PressableButton from '../components/PressableButton';


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
            // Darker neutral background so white card pops more
            backgroundColor: '#e2e8f0', // slate-200 / tailwind-ish
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
              backgroundColor: '#ffffff',
              borderRadius: 18,
              // Enhanced shadow for clearer separation
              shadowColor: '#0f172a',
              shadowOpacity: 0.09,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 6 },
              borderWidth: 1,
              borderColor: '#d1d5db', // slightly darker border
              overflow: 'hidden',
            } : { flex: 1 }}
          >
            <Stack
              screenOptions={{
                contentStyle: Platform.select({
                  web: { width: '100%', maxWidth: '100%', alignSelf: 'center' },
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
              <Stack.Screen name="login" options={{ title: 'Log ind' }} />
              <Stack.Screen name="register" options={{ title: 'Opret konto' }} />
              <Stack.Screen name="listings" options={{ title: 'Opslag' }} />
              <Stack.Screen name="create-listing" options={{ title: 'Opret opslag' }} />
              <Stack.Screen name="my-listings" options={{ title: 'Mine opslag' }} />
              <Stack.Screen name="my-applications" options={{ title: 'Mine ansøgninger' }} />
              <Stack.Screen name="listing-applicants" options={{ title: 'Ansøgere' }} />
              <Stack.Screen name="chat/[listingId]" options={{ title: 'Chat' }} />
              <Stack.Screen name="meeting-point/[listingId]" options={{ title: 'Mødested' }} />
            </Stack>
          </View>
        </View>
      </AuthProvider>
    </ToastProvider>
  );
}
