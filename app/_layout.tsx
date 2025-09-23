import { Stack } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "./Toast";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import PressableButton from '../components/PressableButton';


const MAX_WIDTH = 900;

function WebHeader({ navigation, options, back }: any) {
  const title = options?.title ?? '';
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
          {back ? (
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
  return (
    <ToastProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            // Constrain all screens on web to a centered max width
            contentStyle: Platform.select({
              web: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
              default: undefined,
            }),
            // Custom header on web so title/back also respect max width
            header: Platform.select({
              web: renderWebHeader,
              default: undefined,
            }) as any,
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
      </AuthProvider>
    </ToastProvider>
  );
}
