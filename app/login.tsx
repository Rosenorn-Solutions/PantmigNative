import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import PressableButton from '../components/PressableButton';
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
  <PressableButton title={loading ? 'Logger ind...' : 'Log ind'} onPress={handleLogin} disabled={loading} color="#2563eb" iconName="right-to-bracket" style={styles.button} />
  <View style={{ height: 34 }} />
  <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>Har du ikke en konto?</Text>
  <PressableButton title="Opret konto" onPress={() => router.push('/register')} color="#6b7280" iconName="user-plus" style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', justifyContent: 'center', width: 480 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  stepIndicator: { color: '#6b7280', marginTop: -8, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  inputError: { borderColor: '#dc2626' },
  errorText: { color: '#dc2626', fontSize: 12, marginTop: -6, marginBottom: 8 },
  // Ensures the dropdown can overlay subsequent fields
  typeaheadContainer: { position: 'relative', overflow: 'visible' },
  typeaheadOpen: { zIndex: 9999, elevation: 50 },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 50,
    maxHeight: 240,
    zIndex: 9999,
    overflow: 'hidden',
  },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f1f1', backgroundColor: '#fff' },
  dropdownItemPressed: { backgroundColor: '#f5f5f5' },
  dropdownText: { fontSize: 14, color: '#222' },
  dropdownHint: { padding: 12, fontSize: 12, color: '#666' },
  dateInput: { justifyContent: 'center' },
  placeholder: { color: '#888' },
  webPickerPane: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 200,
    padding: 12,
  },
  webPickerLabel: { fontSize: 12, color: '#444' },
  webModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  webModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  button: {
    justifyContent: 'center',
  },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 8 },
});
