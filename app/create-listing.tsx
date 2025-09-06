import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { CreateRecycleListingRequest } from './apis/pantmig-api/models/CreateRecycleListingRequest';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi } from './services/api';
import { useToast } from './Toast';

export default function CreateListingScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { show } = useToast();
  const [form, setForm] = useState<CreateRecycleListingRequest>({});
  const [loading, setLoading] = useState(false);

  const updateField = (key: keyof CreateRecycleListingRequest, value: any) =>
    setForm((f: CreateRecycleListingRequest) => ({ ...f, [key]: value }));

  const submit = async () => {
    setLoading(true);
    try {
      if (!form.title || !form.description || !form.city) {
        show('Udfyld mindst titel, beskrivelse og by.', 'error');
        return;
      }
      const api = createRecycleListingsApi();
      await api.listingsCreate({ createRecycleListingRequest: form });
      show('Opslaget blev oprettet.', 'success');
      router.replace('/listings');
    } catch (e) {
      console.error(e);
      show('Kunne ikke oprette opslag.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <Redirect href="/login" />;
  }
  if (user?.role !== 'Donator') {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Opret opslag</Text>
      <TextInput style={styles.input} placeholder="Titel" onChangeText={(t) => updateField('title', t)} />
      <TextInput style={styles.input} placeholder="Beskrivelse" onChangeText={(t) => updateField('description', t)} />
      <TextInput style={styles.input} placeholder="By" onChangeText={(t) => updateField('city', t)} />
      <TextInput style={styles.input} placeholder="Adresse (valgfrit)" onChangeText={(t) => updateField('location', t)} />
      <TextInput style={styles.input} placeholder="Estimeret værdi" onChangeText={(t) => updateField('estimatedValue', t)} />
      <TextInput style={styles.input} placeholder="Estimeret antal" keyboardType="numeric" onChangeText={(t) => updateField('estimatedAmount', Number(t))} />
      <Button title={loading ? 'Opretter...' : 'Opret'} onPress={submit} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 12, maxWidth: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
});
