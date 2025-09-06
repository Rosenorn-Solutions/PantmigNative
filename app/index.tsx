import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, Button, Text, View } from "react-native";
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
        <Text style={{ marginBottom: 20, color: '#555' }}>Din rolle: {user.role}</Text>
      )}
      <Button title="Se tilgængelige opslag" onPress={() => router.push("./listings")} />
      {user?.role === 'Donator' && (
        <Button title="Opret opslag" onPress={() => router.push("./create-listing")} />
      )}
  <Button title="Log ud" color="#dc2626" onPress={async () => { await logout(); show('Du er nu logget ud', 'success'); }} />
    </View>
  );
}
