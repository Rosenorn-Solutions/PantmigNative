import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Stack } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { AuthProvider, useAuth } from "./AuthContext";
import { NotificationsProvider } from './NotificationsProvider';
import { ToastProvider } from "./Toast";
import { useNotifications } from './services/notificationsStore';


const MAX_WIDTH = 900;

function WebHeader({ navigation, options, back }: any) {
  const { unreadCount } = useNotifications();
  const { token } = useAuth();
  const title = options?.title ?? '';
  // React Navigation sometimes omits the `back` prop on web even when a previous
  // entry exists in history (e.g. after full reload). Fallback to canGoBack().
  const backAllowedByOptions = options?.headerBackVisible !== false;
  const canGoBack = backAllowedByOptions && (back || navigation?.canGoBack?.());
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
        <View style={{ width: 112, justifyContent: 'center', alignItems: 'flex-end', flexDirection: 'row', gap: 4 }}>
          {token ? (
            <>
              <Pressable onPress={() => navigation?.navigate?.('profile')} style={{ paddingVertical: 8, paddingHorizontal: 8 }}>
                <FontAwesome6 name="user" size={18} color="black" />
              </Pressable>
              <Pressable onPress={() => navigation?.navigate?.('notifications')} style={{ paddingVertical: 8, paddingHorizontal: 8, position: 'relative' }}>
                <FontAwesome6 name="bell" size={18} color="black" />
                {unreadCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: '#ef4444',
                      borderRadius: 9999,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 3,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const renderWebHeader = (props: any) => <WebHeader {...props} />;

function HeaderRightActions() {
  const nav = useNavigation<any>();
  const route = useRoute();
  const { token } = useAuth();
  const { unreadCount } = useNotifications();
  // Hide on web (custom header already shows bell), and hide on auth screens
  if (Platform.OS === 'web') return null;
  const name = (route as any)?.name as string | undefined;
  if (!token || name === 'login' || name === 'register') return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable onPress={() => nav.navigate('profile')} style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
        <FontAwesome6 name="user" size={18} color="black" />
      </Pressable>
      <Pressable onPress={() => nav.navigate('notifications')} style={{ paddingVertical: 6, paddingHorizontal: 12, position: 'relative' }}>
        <FontAwesome6 name="bell" size={18} color="black" />
        {unreadCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: 2,
              right: 6,
              backgroundColor: '#ef4444',
              borderRadius: 9999,
              minWidth: 14,
              height: 14,
              paddingHorizontal: 3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  // We'll provide a subtle elevated card look only on web.
  const webWrapperEnabled = Platform.OS === 'web';
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationsProvider>
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
              screenOptions={({ route }) => ({
                contentStyle: Platform.select({
                  web: { width: '100%', maxWidth: '100%', alignSelf: 'center', backgroundColor: 'transparent' },
                  default: undefined,
                }),
                header: Platform.select({
                  web: renderWebHeader,
                  default: undefined,
                }) as any,
                headerRight: () => <HeaderRightActions />,
              })}
            >
              <Stack.Screen name="index" options={{ title: 'Forside', headerBackVisible: false }} />
              {/* Backward direction (e.g., after logout) */}
              <Stack.Screen name="login" options={{ title: 'Log ind', headerBackVisible: false, animation: Platform.OS === 'web' ? undefined : 'slide_from_left', animationTypeForReplace: Platform.OS === 'web' ? undefined as any : 'pop' }} />

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
              <Stack.Screen name="notifications" options={{ title: 'Notifikationer', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              <Stack.Screen name="profile" options={{ title: 'Profil', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              <Stack.Screen name="settings" options={{ title: 'Indstillinger', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
              {/* Map screen */}
              <Stack.Screen name="listings-map" options={{ title: 'Kort over opslag', animation: Platform.OS === 'web' ? undefined : 'slide_from_right' }} />
            </Stack>
          </View>
        </View>
        </NotificationsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
