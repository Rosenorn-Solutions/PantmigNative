import { Redirect } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import SettingsPanel from '../../components/profile/SettingsPanel';
import { useAuth } from '../providers/AuthContext';

export default function SettingsScreen() {
  const { token } = useAuth();
  if (!token) return <Redirect href="/login" />;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Brugerindstillinger</Text>

      <SettingsPanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', width: 480 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#111827' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 16, backgroundColor: '#fff' },
  label: { fontSize: 12, color: '#444', marginBottom: 6 },
  button: { justifyContent: 'center' },
});

