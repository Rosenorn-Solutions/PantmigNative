import React from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { GEOCODER_DEBOUNCE_MS, GEOCODER_MIN_CHARS, geocodeSuggest } from '../app/services/geocoding';

type Styles = {
  input: any;
  inputError: any;
  webPickerLabel: any;
  typeaheadContainer: any;
  typeaheadOpen: any;
  dropdown: any;
  dropdownHint: any;
  dropdownItem: any;
  dropdownItemPressed: any;
  dropdownText: any;
};

type GeocodePick = { display: string; lat: number; lon: number };

type Props = Readonly<{
  label?: string;
  value: string;
  error?: string;
  cityHint?: string;
  onChangeText: (text: string) => void;
  onSelect: (pick: GeocodePick) => void;
  onFocus?: () => void;
  closeSignal?: number;
  styles: Styles;
}>;

export default function AddressTypeahead({ label = 'Adresse (krævet)', value, error, cityHint, onChangeText, onSelect, onFocus, closeSignal, styles }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<GeocodePick[]>([]);
  const inputRef = React.useRef<TextInput>(null as any);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRef = React.useRef(false);

  // Debounced suggest
  React.useEffect(() => {
    if (skipNextRef.current) { skipNextRef.current = false; return; }
    const qRaw = (value || '').trim();
    const min = Math.max(1, Number(GEOCODER_MIN_CHARS || 3));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (qRaw.length < min) { setResults([]); setOpen(false); return; }
    const q = cityHint && !qRaw.toLowerCase().includes(cityHint.toLowerCase()) ? `${qRaw}, ${cityHint}` : qRaw;
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const list = await geocodeSuggest(q, 8);
        setResults(list || []);
        setTimeout(() => setOpen(true), 50);
      } catch {
        setResults([]); setOpen(false);
      } finally { setLoading(false); }
    }, Number(GEOCODER_DEBOUNCE_MS || 400));
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, cityHint]);

  // Allow parent to force-close dropdown when another dropdown gains focus
  React.useEffect(() => {
    if (closeSignal != null) {
      setOpen(false);
    }
  }, [closeSignal]);

  return (
    <View style={[styles.typeaheadContainer, open && styles.typeaheadOpen, { zIndex: open ? 50 : 20 }]}>
      <Text style={styles.webPickerLabel}>{label}</Text>
      <TextInput
        ref={inputRef as any}
        style={[styles.input, error && styles.inputError, open ? { marginBottom: 0 } : null]}
        placeholder="Søg adresse"
        value={value}
        onChangeText={(t) => onChangeText(t)}
        onFocus={() => { onFocus?.(); if (results.length > 0) setOpen(true); }}
        onBlur={() => {
          if (Platform.OS === 'android' && open) { setTimeout(() => inputRef.current?.focus(), 0); }
          /* keep default close behavior to parent if needed */
        }}
      />
      {!!error && <Text style={{ color: '#dc2626', marginTop: 4 }}>{error}</Text>}
      {open && (loading || results.length > 0 || (!loading && (value || '').trim().length > 0)) && (
        <View style={styles.dropdown} focusable={false} pointerEvents="box-none" importantForAccessibility="no-hide-descendants">
          {loading && <Text style={styles.dropdownHint}>Søger adresser...</Text>}
          {!loading && results.length === 0 && (value || '').trim().length > 0 && (
            <Text style={styles.dropdownHint}>Ingen adresser fundet</Text>
          )}
          {!loading && results.length > 0 && (
            <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="always" focusable={false}>
              {results.map((r, idx) => (
                <Pressable
                  key={`${r.lat},${r.lon}-${idx}`}
                  focusable={false}
                  onPress={() => { skipNextRef.current = true; onSelect(r); setOpen(false); setResults([]); setTimeout(() => inputRef.current?.focus(), 0); }}
                  style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                >
                  <Text style={styles.dropdownText}>{r.display}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
