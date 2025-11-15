import React from 'react';
import { Image, Text, TextInput, View } from 'react-native';
import PressableButton from '../PressableButton';

type Styles = {
  input: any;
  inputError: any;
  errorText: any;
  webPickerLabel: any;
  navRow: any;
  button: any;
};

type Props = Readonly<{
  firstName: string;
  lastName: string;
  phone: string;
  errorFirstName?: string;
  errorLastName?: string;
  errorPhone?: string;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  styles: Styles;
}>;

export default function PersonalStep({ firstName, lastName, phone, errorFirstName, errorLastName, errorPhone, onFirstNameChange, onLastNameChange, onPhoneChange, onBack, onNext, styles }: Props) {
  return (
    <>
      <Text style={styles.webPickerLabel}>Fornavn (krævet)</Text>
      <TextInput style={[styles.input, errorFirstName && styles.inputError]} placeholder="Fornavn" value={firstName} onChangeText={onFirstNameChange} />
      {!!errorFirstName && <Text style={styles.errorText}>{errorFirstName}</Text>}
      <Text style={styles.webPickerLabel}>Efternavn (krævet)</Text>
      <TextInput style={[styles.input, errorLastName && styles.inputError]} placeholder="Efternavn" value={lastName} onChangeText={onLastNameChange} />
      {!!errorLastName && <Text style={styles.errorText}>{errorLastName}</Text>}
      <Text style={styles.webPickerLabel}>Telefonnummer (valgfrit)</Text>
      <View style={[styles.input, errorPhone && styles.inputError, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, paddingVertical: 0 }]}> 
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRightWidth: 1, borderRightColor: '#e5e7eb' }}>
          <Image source={{ uri: 'https://flagcdn.com/w20/dk.png' }} style={{ width: 20, height: 14, marginRight: 6, borderRadius: 2 }} resizeMode="cover" />
          <Text style={{ color: '#111827', fontWeight: '600' }}>+45</Text>
        </View>
        <TextInput
          style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10 }}
          placeholder="12 34 56 78"
          value={phone}
          onChangeText={onPhoneChange}
          keyboardType="phone-pad"
          accessibilityLabel="Telefonnummer"
          maxLength={11}
        />
      </View>
      {!!errorPhone && <Text style={styles.errorText}>{errorPhone}</Text>}
      <View style={styles.navRow}>
        <PressableButton title="Tilbage" onPress={onBack} color="#6b7280" iconName="arrow-left" style={styles.button} />
        <PressableButton title="Næste" onPress={onNext} color="#2563eb" iconName="arrow-right" style={styles.button} />
      </View>
    </>
  );
}
