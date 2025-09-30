import { Redirect, useRouter } from "expo-router";
import { StyleSheet, ActivityIndicator, Text, View } from "react-native";
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
    <View style={{ flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', justifyContent: 'center', width: 480  }}>
      <Text style={{ marginBottom: 4 }}>Hej {user?.firstName} Vælg en handling:</Text>
      {/* {user?.role && (
        <Text style={{ marginBottom: 20, color: '#555' }}>Din rolle: {user.role == 'Donator' ? 'Donor' : 'Panter'}</Text>
      )}
      {user?.cityName && (
        <Text style={{ marginTop: -12, marginBottom: 20, color: '#555' }}>Din by: {user.cityName}</Text>
      )} */}
      
      {user?.role === 'Recycler' && (
        <>
          <PressableButton title="Se tilgængelige opslag" onPress={() => router.push("./listings")} color="#2563eb" iconName="list" style={styles.button} />
          <PressableButton title="Mine ansøgninger" onPress={() => router.push("./my-applications")} color="#6b7280" iconName="clipboard" style={styles.button} />
        </>
      )}
      {user?.role === 'Donator' && (
        <>
          <PressableButton title="Opret opslag" onPress={() => router.push("./create-listing")} color="#16a34a" iconName="file-circle-plus" style={styles.button} />
          <PressableButton title="Mine opslag" onPress={() => router.push("./my-listings")} color="#6b7280" iconName="folder-open" style={styles.button} />
        </>
      )}
  <PressableButton title="Log ud" color="#dc2626" onPress={async () => { await logout(); show('Du er nu logget ud', 'success'); }} iconName="arrow-right-from-bracket" style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
 
  button: {
    justifyContent: 'center',
  }
 });
