import React from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import PressableButton from '../PressableButton';

export type MaterialOption = { type: number; label: string };

type Props = Readonly<{
  materials: ReadonlyArray<MaterialOption>;
  isSelected: (type: number) => boolean;
  getQty: (type: number) => number | '' | undefined;
  toggleItem: (type: number) => void;
  setQty: (type: number, txt: string) => void;
  error?: string;
  onBack: () => void;
  onNext: () => void;
  inputStyle: any;
  labelStyle?: any;
  navRowStyle: any;
  buttonStyle: any;
  errorTextStyle: any;
}>;

export default function ItemsStep({ materials, isSelected, getQty, toggleItem, setQty, error, onBack, onNext, inputStyle, labelStyle, navRowStyle, buttonStyle, errorTextStyle }: Props) {
  return (
    <>
      <Text style={{ fontWeight: '500', marginTop: 8 }}>Genanvendelige materialer</Text>
      <View style={{ gap: 8 }}>
        {materials.map(m => {
          const selected = isSelected(m.type);
          const qty = getQty(m.type);
          return (
            <View key={String(m.type)} style={{ gap: 6 }}>
              <Pressable onPress={() => toggleItem(m.type)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#aaa', backgroundColor: selected ? '#16a34a' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  {selected && <Text style={{ color: 'white', fontSize: 14 }}>✓</Text>}
                </View>
                <Text>{m.label}</Text>
              </Pressable>
              {selected && (
                <>
                  {labelStyle ? <Text style={labelStyle}>Estimeret mængde</Text> : null}
                  <TextInput
                    style={inputStyle}
                    placeholder="Estimeret mængde"
                    inputMode={Platform.OS === 'web' ? 'numeric' : undefined}
                    keyboardType={Platform.OS !== 'web' ? 'numeric' : (undefined as any)}
                    value={qty != null && qty !== undefined ? String(qty) : ''}
                    onChangeText={(t) => setQty(m.type, t)}
                  />
                </>
              )}
            </View>
          );
        })}
        {!!error && <Text style={errorTextStyle}>{error}</Text>}
      </View>

      <View style={navRowStyle}>
        <PressableButton title="Tilbage" onPress={onBack} color="#6b7280" iconName="arrow-left" style={buttonStyle} />
        <PressableButton title="Næste" onPress={onNext} color="#2563eb" iconName="arrow-right" iconPosition="right" style={buttonStyle} />
      </View>
    </>
  );
}
