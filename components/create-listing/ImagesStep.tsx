import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import PressableButton from '../PressableButton';

type PickedImage = { id: string; uri: string; name: string; type: string };

type Props = Readonly<{
  images: ReadonlyArray<PickedImage>;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onBack: () => void;
  onSubmit: () => void;
  loading?: boolean;
  navRowStyle: any;
  buttonStyle: any;
}>;

export default function ImagesStep({ images, onRemove, onAdd, onBack, onSubmit, loading, navRowStyle, buttonStyle }: Props) {
  return (
    <>
      <View style={{ marginTop: 8 }}>
        <Text style={{ marginBottom: 6, fontWeight: '500' }}>Billeder (valgfrit)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {images.map((img) => (
            <Pressable key={img.id} onLongPress={() => onRemove(img.id)} style={{ position: 'relative' }}>
              <Image source={{ uri: img.uri }} style={{ width: 72, height: 72, borderRadius: 6, borderWidth: 1, borderColor: '#ddd' }} />
            </Pressable>
          ))}
          <Pressable onPress={onAdd} style={{ width: 72, height: 72, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: '#64748b' }}>+</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Langt tryk på et billede for at fjerne. Maks (ikke håndhævet) 6 anbefales.</Text>
      </View>
      <View style={navRowStyle}>
        <PressableButton title="Tilbage" onPress={onBack} color="#6b7280" iconName="arrow-left" style={buttonStyle} />
        <PressableButton title={loading ? 'Opretter...' : 'Opret'} onPress={onSubmit} disabled={!!loading} color="#16a34a" iconName="save" style={buttonStyle} />
      </View>
    </>
  );
}
