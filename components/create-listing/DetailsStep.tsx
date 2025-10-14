import React from 'react';
import { InteractionManager, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { CitySearchResult } from '../../app/apis/pantmig-api';
import PressableButton from '../PressableButton';

type Styles = {
  input: any;
  inputError: any;
  errorText: any;
  webPickerLabel: any;
  typeaheadContainer: any;
  typeaheadOpen: any;
  dropdown: any;
  dropdownHint: any;
  dropdownItem: any;
  dropdownItemPressed: any;
  dropdownText: any;
  navRow: any;
  button: any;
};

type Props = Readonly<{
  errors: Readonly<{ title?: string; description?: string; city?: string }>;
  cityQuery: string;
  cityOpen: boolean;
  cityResults: readonly CitySearchResult[];
  cityLoading: boolean;
  onTitleChange: (t: string) => void;
  onDescriptionChange: (t: string) => void;
  onCityChange: (t: string) => void;
  onCityFocus: () => void;
  onCityBlur: () => void;
  onCityPressIn: () => void;
  onCitySelect: (c: CitySearchResult) => void;
  onLocationChange: (t: string) => void;
  onBack: () => void;
  onNext: () => void;
  styles: Styles;
}>;

export default function DetailsStep({ errors, cityQuery, cityOpen, cityResults, cityLoading, onTitleChange, onDescriptionChange, onCityChange, onCityFocus, onCityBlur, onCityPressIn, onCitySelect, onLocationChange, onBack, onNext, styles }: Props) {
  const inputRef = React.useRef<TextInput>(null as any);
  const handleSelect = React.useCallback((c: CitySearchResult) => {
    onCitySelect(c);
    setTimeout(() => inputRef.current?.focus(), 0);
    InteractionManager.runAfterInteractions(() => setTimeout(() => inputRef.current?.focus(), 0));
  }, [onCitySelect]);
  React.useEffect(() => {
    if (cityOpen) {
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [cityOpen]);
  React.useEffect(() => {
    if (!cityOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [cityResults, cityLoading, cityOpen]);
  return (
    <>
      <Text style={styles.webPickerLabel}>Titel (krævet)</Text>
      <TextInput style={[styles.input, errors.title && styles.inputError]} placeholder="Titel" onChangeText={onTitleChange} />
      {!!errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
      <Text style={styles.webPickerLabel}>Beskrivelse (krævet)</Text>
      <TextInput style={[styles.input, errors.description && styles.inputError]} placeholder="Beskrivelse" onChangeText={onDescriptionChange} />
      {!!errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
      <View style={[styles.typeaheadContainer, cityOpen && styles.typeaheadOpen]}>
        <Text style={styles.webPickerLabel}>By (krævet)</Text>
        <TextInput
          ref={inputRef as any}
          style={[styles.input, errors.city && styles.inputError, cityOpen ? { marginBottom: 0 } : null]}
          placeholder="By"
          value={cityQuery}
          onChangeText={onCityChange}
          onFocus={onCityFocus}
          onBlur={() => {
            if (Platform.OS === 'android' && cityOpen) {
              setTimeout(() => inputRef.current?.focus(), 0);
              return;
            }
            onCityBlur();
          }}
        />
        {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
        {cityOpen && (cityLoading || cityResults.length > 0 || (!cityLoading && cityQuery.trim().length > 0)) && (
          <View style={styles.dropdown} focusable={false} pointerEvents="box-none" importantForAccessibility="no-hide-descendants">
            {cityLoading && <Text style={styles.dropdownHint}>Søger...</Text>}
            {!cityLoading && cityResults.length === 0 && cityQuery.trim().length > 0 && (
              <Text style={styles.dropdownHint}>Ingen resultater</Text>
            )}
            {!cityLoading && cityResults.length > 0 && (
              <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="always" focusable={false}>
                {cityResults.map((c) => {
                  const pcs = c.postalCodes?.slice(0, 3).join(', ');
                  const hasMore = (c.postalCodes?.length ?? 0) > 3;
                  let suffix = '';
                  if (pcs && pcs.length > 0) suffix = ` (${pcs}${hasMore ? '…' : ''})`;
                  return (
                    <Pressable
                      key={c.id}
                      focusable={false}
                      onPress={() => handleSelect(c)}
                      style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                    >
                      <Text style={styles.dropdownText}>{c.name}{suffix}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
      </View>
      <Text style={styles.webPickerLabel}>Adresse (valgfrit)</Text>
      <TextInput style={styles.input} placeholder="Adresse (valgfrit)" onChangeText={onLocationChange} />
      <View style={styles.navRow}>
        <PressableButton title="Fortryd" onPress={onBack} color="#6b7280" iconName="arrow-left" style={styles.button} />
        <PressableButton title="Næste" onPress={onNext} color="#2563eb" iconName="arrow-right" style={styles.button} />
      </View>
    </>
  );
}
