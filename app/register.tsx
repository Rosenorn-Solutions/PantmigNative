import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthApi } from './apis/pantmig-auth/apis/AuthApi';
import { UserType } from './apis/pantmig-auth/models/UserType';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';

const authApi = new AuthApi();

export default function RegisterScreen() {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState<UserType>(UserType.NUMBER_0); // default to Donator
  const router = useRouter();
  const { show } = useToast();

  const handleRegister = async () => {
    setLoading(true);
    try {
      await authApi.authRegister({ registerRequest: { email, password, firstName, lastName, phone, userType } });
  show('Din konto er oprettet!', 'success');
      router.replace('/');
    } catch (error: any) {
      console.error('Register error', error);
  show('Registrering mislykkedes. Tjek dine oplysninger.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (token) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Opret konto</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Adgangskode"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Fornavn"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        placeholder="Efternavn"
        value={lastName}
        onChangeText={setLastName}
      />
      <TextInput
        style={styles.input}
        placeholder="Telefonnummer"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <View style={styles.segmented}>
        <Text style={styles.segmentedLabel}>Vælg rolle</Text>
        <View style={styles.segmentedRow}>
          <Button
            title={`Donator${userType === UserType.NUMBER_0 ? ' ✓' : ''}`}
            onPress={() => setUserType(UserType.NUMBER_0)}
            color={userType === UserType.NUMBER_0 ? '#16a34a' : undefined}
          />
          <Button
            title={`Recycler${userType === UserType.NUMBER_1 ? ' ✓' : ''}`}
            onPress={() => setUserType(UserType.NUMBER_1)}
            color={userType === UserType.NUMBER_1 ? '#16a34a' : undefined}
          />
        </View>
      </View>
      <Button title={loading ? 'Opretter...' : 'Opret konto'} onPress={handleRegister} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  segmented: {
    marginBottom: 16,
  },
  segmentedLabel: {
    marginBottom: 8,
    color: '#444',
  },
  segmentedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
