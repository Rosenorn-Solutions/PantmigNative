import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, token } = useAuth();
  const { show } = useToast();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.authResponse?.accessToken) {
        show('Du er nu logget ind!', 'success');
        router.replace('/');
      } else {
        const msg = result?.errorMessage || 'Login mislykkedes. Tjek dine oplysninger.';
        show(msg, 'error');
      }
    } catch (error: any) {
      console.error('Login error', error);
      show('Login mislykkedes. Tjek dine oplysninger.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (token) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log ind</Text>
      <TextInput
        style={styles.input}
        placeholder="Email eller brugernavn"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        // Allow username input too; default keyboard is fine across platforms
      />
      <TextInput
        style={styles.input}
        placeholder="Adgangskode"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
  <Button title={loading ? 'Logger ind...' : 'Log ind'} onPress={handleLogin} disabled={loading} />
  <View style={{ height: 12 }} />
  <Button title="Opret konto" onPress={() => router.push('/register')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
