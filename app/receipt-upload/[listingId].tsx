import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Text, TextInput, View } from 'react-native';
import PressableButton from '../../components/PressableButton';
import { useToast } from '../Toast';
import { createRecycleListingsApi } from '../services/api';

export default function ReceiptUploadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const listingId = useMemo(() => Number(params.listingId), [params.listingId]);
  const { show } = useToast();
  const [imageUri, setImageUri] = useState<string | null>(null);
  type NativeUploadFile = { uri: string; name: string; type: string };
  const [fileForUpload, setFileForUpload] = useState<File | NativeUploadFile | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          show('Tilladelse til billeder kræves', 'error');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setImageUri(asset.uri);
      if (Platform.OS === 'web') {
        try {
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          const file = new File([blob], 'receipt.jpg', { type: blob.type || 'image/jpeg' });
          setFileForUpload(file);
        } catch {
          setFileForUpload(null);
        }
      } else {
        // React Native FormData prefers { uri, name, type }
        const typeGuess = asset.mimeType || 'image/jpeg';
        setFileForUpload({ uri: asset.uri, name: 'receipt.jpg', type: typeGuess });
      }
    } catch (e) {
      console.error(e);
      show('Kunne ikke vælge billede', 'error');
    }
  };

  const onSubmit = async () => {
    if (!listingId) {
      show('Ugyldigt opslag', 'error');
      return;
    }
    const parsed = Number(amount.replace(',', '.'));
    if (!parsed || parsed <= 0) {
      show('Indtast beløb', 'error');
      return;
    }
    if (!fileForUpload) {
      show('Vælg et billede af kvitteringen', 'error');
      return;
    }
    setSubmitting(true);
    try {
  const api = createRecycleListingsApi();
  await api.listingsReceiptUpload({ listingId, reportedAmount: parsed, file: fileForUpload as unknown as Blob });
      show('Kvittering uploadet', 'success');
      router.back();
    } catch (e) {
      console.error(e);
      show('Upload fejlede', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>Upload kvittering</Text>
      <View style={{ marginBottom: 12 }}>
  <PressableButton title={imageUri ? 'Vælg andet billede' : 'Vælg billede'} onPress={pickImage} color="#6b7280" iconName="image-outline" />
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: 240, marginTop: 12, borderRadius: 8 }} resizeMode="contain" />
        ) : null}
      </View>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ marginBottom: 4 }}>Indtast beløb (kr)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0,00"
          style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6 }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PressableButton title="Annuller" color="#6b7280" onPress={() => router.back()} iconName="close-outline" />
        <PressableButton title={submitting ? 'Uploader...' : 'Upload'} onPress={onSubmit} disabled={submitting} color="#10b981" iconName="cloud-upload-outline" />
      </View>
      {submitting ? (
        <View style={{ marginTop: 12 }}>
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}
