import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import PressableButton from "../components/PressableButton";
import { useAuth } from "./AuthContext";
import { useToast } from "./Toast";

export default function Index() {
  const router = useRouter();
  const { token, user, loading, logout } = useAuth();
  const { show } = useToast();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
      <Text style={{ marginBottom: 4 }}>Velkommen! Vælg en handling:</Text>
      {user?.role && (
        <Text style={{ marginBottom: 20, color: '#555' }}>Din rolle: {user.role == 'Donator' ? 'Donor' : 'Panter'}</Text>
      )}
      {user?.cityName && (
        <Text style={{ marginTop: -12, marginBottom: 20, color: '#555' }}>Din by: {user.cityName}</Text>
      )}
      <PressableButton title="Se tilgængelige opslag" onPress={() => router.push("./listings")} color="#2563eb" iconName="list-outline" />
      {user?.role === 'Recycler' && (
        <PressableButton title="Mine ansøgninger" onPress={() => router.push("./my-applications")} color="#6b7280" iconName="document-text-outline" />
      )}
      {user?.role === 'Donator' && (
        <>
          <PressableButton title="Opret opslag" onPress={() => router.push("./create-listing")} color="#16a34a" iconName="add-circle-outline" />
          <PressableButton title="Mine opslag" onPress={() => router.push("./my-listings")} color="#6b7280" iconName="albums-outline" />
        </>
      )}
  <PressableButton title="Log ud" color="#dc2626" onPress={async () => { await logout(); show('Du er nu logget ud', 'success'); }} iconName="log-out-outline" />
    </View>
  );
}
