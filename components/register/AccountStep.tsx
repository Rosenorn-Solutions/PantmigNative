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
  email: string;
  password: string;
  errorEmail?: string;
  errorPassword?: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  styles: Styles;
}>;

export default function AccountStep({ email, password, errorEmail, errorPassword, onEmailChange, onPasswordChange, onBack, onNext, styles }: Props) {
  return (
    <>
      <Text style={styles.webPickerLabel}>Email (krævet)</Text>
      <TextInput
        style={[styles.input, errorEmail && styles.inputError]}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="off"
        textContentType="none"
        keyboardType="email-address"
        value={email}
        onChangeText={onEmailChange}
      />
      {!!errorEmail && <Text style={styles.errorText}>{errorEmail}</Text>}
      <Text style={styles.webPickerLabel}>Adgangskode (krævet)</Text>
      <TextInput
        style={[styles.input, errorPassword && styles.inputError]}
        placeholder="Adgangskode"
        secureTextEntry
        value={password}
        onChangeText={onPasswordChange}
      />
      {!!errorPassword && <Text style={styles.errorText}>{errorPassword}</Text>}
      <View style={styles.navRow}>
        <PressableButton title="Tilbage" onPress={onBack} color="#6b7280" iconName="arrow-left" style={styles.button} />
        <PressableButton title="Næste" onPress={onNext} color="#2563eb" iconName="arrow-right" style={styles.button} />
      </View>
    </>
  );
}
