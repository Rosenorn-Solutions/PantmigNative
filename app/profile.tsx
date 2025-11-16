import { Redirect } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import SettingsPanel from '../components/profile/SettingsPanel';
import { useAuth } from './AuthContext';

export default function ProfileScreen() {
  const { token, user } = useAuth();
  if (!token) return <Redirect href="/login" />;

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Profil</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Brugeroplysninger</Text>
        <View style={{ gap: 6 }}>
          <Row label="Navn" value={fullName || '—'} />
          <Row label="Email" value={user?.email || '—'} />
          <Row label="Rolle" value={user?.role || '—'} />
          <Row label="By" value={user?.cityName || '—'} />
          {user?.birthDate ? <Row label="Fødselsdato" value={user.birthDate} /> : null}
        </View>
      </View>

      <SettingsPanel />
    </ScrollView>
  );
}

type RowProps = Readonly<{ label: string; value: string }>;
function Row({ label, value }: RowProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', width: 480 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#111827' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 16, backgroundColor: '#fff' },
  rowLabel: { color: '#6b7280' },
  rowValue: { color: '#111827', fontWeight: Platform.OS === 'web' ? '500' as any : '500' },
});
