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
  cityQuery: string;
  cityOpen: boolean;
  cityResults: readonly CitySearchResult[];
  cityLoading: boolean;
  errorCity?: string;
  onCityChange: (t: string) => void;
  onCityFocus: () => void;
  onCityBlur: () => void;
  onCityPressIn: () => void;
  onCitySelect: (c: CitySearchResult) => void;
  onBack: () => void;
  onNext: () => void;
  styles: Styles;
}>;

export default function CityStep({ cityQuery, cityOpen, cityResults, cityLoading, errorCity, onCityChange, onCityFocus, onCityBlur, onCityPressIn, onCitySelect, onBack, onNext, styles }: Props) {
  const inputRef = React.useRef<TextInput>(null as any);
  const handleSelect = React.useCallback((c: CitySearchResult) => {
    onCitySelect(c);
    // Focus immediately and again after interactions to survive Android responder churn
    setTimeout(() => inputRef.current?.focus(), 0);
    InteractionManager.runAfterInteractions(() => setTimeout(() => inputRef.current?.focus(), 0));
  }, [onCitySelect]);
  React.useEffect(() => {
    if (cityOpen) {
      // Ensure input retains focus when dropdown opens after async search
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [cityOpen]);
  React.useEffect(() => {
    if (!cityOpen) return;
    // When results populate or loading ends, refocus to avoid any transient blur
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [cityResults, cityLoading, cityOpen]);
  return (
    <>
      <View style={[styles.typeaheadContainer, cityOpen && styles.typeaheadOpen]}>
        <Text style={styles.webPickerLabel}>By (krævet)</Text>
        <TextInput
          ref={inputRef as any}
          style={[styles.input, errorCity && styles.inputError, cityOpen ? { marginBottom: 0 } : null]}
          placeholder="By (fx. København)"
          value={cityQuery}
          onChangeText={onCityChange}
          onFocus={onCityFocus}
          onBlur={() => {
            // On Android, guard against unintended blur shifts when dropdown mounts/updates
            if (Platform.OS === 'android' && cityOpen) {
              setTimeout(() => inputRef.current?.focus(), 0);
              return;
            }
            onCityBlur();
          }}
        />
        {!!errorCity && <Text style={styles.errorText}>{errorCity}</Text>}
          {cityOpen && (cityLoading || cityResults.length > 0 || (!cityLoading && cityQuery.trim().length > 0)) && (
            <View style={styles.dropdown} focusable={false} pointerEvents="box-none" importantForAccessibility="no-hide-descendants">
              {cityLoading && <Text style={styles.dropdownHint}>Søger...</Text>}
              {!cityLoading && cityResults.length === 0 && cityQuery.trim().length > 0 && (
                <Text style={styles.dropdownHint}>Ingen resultater</Text>
              )}
              {!cityLoading && cityResults.length > 0 && (
                <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="always" focusable={false}>
                  {cityResults.map((c, idx) => {
                  const pcs = c.postalCodes?.slice(0, 3).join(', ');
                  const hasMore = (c.postalCodes?.length ?? 0) > 3;
                  let suffix = '';
                  if (pcs && pcs.length > 0) suffix = ` (${pcs}${hasMore ? '…' : ''})`;
                  return (
                    <Pressable key={c.externalId || c.name || String(idx)} focusable={false} onPress={() => handleSelect(c)} style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}>
                      <Text style={styles.dropdownText}>{c.name}{suffix}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
      </View>
      <View style={styles.navRow}>
        <PressableButton title="Tilbage" onPress={onBack} color="#6b7280" iconName="arrow-left" style={styles.button} />
        <PressableButton title="Næste" onPress={onNext} color="#2563eb" iconName="arrow-right" style={styles.button} />
      </View>
    </>
  );
}
