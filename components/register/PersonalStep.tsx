import React from 'react';
import { Text, TextInput, View } from 'react-native';
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
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  styles: Styles;
}>;

export default function PersonalStep({ firstName, lastName, phone, errorFirstName, errorLastName, onFirstNameChange, onLastNameChange, onPhoneChange, onBack, onNext, styles }: Props) {
  return (
    <>
      <Text style={styles.webPickerLabel}>Fornavn (krævet)</Text>
      <TextInput style={[styles.input, errorFirstName && styles.inputError]} placeholder="Fornavn" value={firstName} onChangeText={onFirstNameChange} />
      {!!errorFirstName && <Text style={styles.errorText}>{errorFirstName}</Text>}
      <Text style={styles.webPickerLabel}>Efternavn (krævet)</Text>
      <TextInput style={[styles.input, errorLastName && styles.inputError]} placeholder="Efternavn" value={lastName} onChangeText={onLastNameChange} />
      {!!errorLastName && <Text style={styles.errorText}>{errorLastName}</Text>}
      <Text style={styles.webPickerLabel}>Telefonnummer (valgfrit)</Text>
      <TextInput style={styles.input} placeholder="Telefonnummer" value={phone} onChangeText={onPhoneChange} keyboardType="phone-pad" />
      <View style={styles.navRow}>
        <PressableButton title="Tilbage" onPress={onBack} color="#6b7280" iconName="arrow-left" style={styles.button} />
        <PressableButton title="Næste" onPress={onNext} color="#2563eb" iconName="arrow-right" style={styles.button} />
      </View>
    </>
  );
}
