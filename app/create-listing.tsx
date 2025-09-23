import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import PressableButton from '../components/PressableButton';
import { CitiesApi } from './apis/pantmig-api/apis';
import type { CitySearchResult } from './apis/pantmig-api/models/CitySearchResult';
import { CreateRecycleListingRequest } from './apis/pantmig-api/models/CreateRecycleListingRequest';
import { useAuth } from './AuthContext';
import { createRecycleListingsApi, pantmigApiConfig } from './services/api';
import { useToast } from './Toast';

export default function CreateListingScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { show } = useToast();
  const [form, setForm] = useState<CreateRecycleListingRequest>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // City typeahead state
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectingRef = useRef(false);
  const suppressNextSearchRef = useRef(false);
  const citiesApi = useMemo(() => new CitiesApi(pantmigApiConfig), []);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showFromTimePicker, setShowFromTimePicker] = useState(false);
  const [showToTimePicker, setShowToTimePicker] = useState(false);
  // Web-only inline pickers
  const [webFromOpen, setWebFromOpen] = useState(false);
  const [webToOpen, setWebToOpen] = useState(false);
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  const timePart = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const [fromDateStr, setFromDateStr] = useState<string>('');
  const [fromTimeStr, setFromTimeStr] = useState<string>('');
  const [toDateStr, setToDateStr] = useState<string>('');
  const [toTimeStr, setToTimeStr] = useState<string>('');
  const [step, setStep] = useState<number>(0);

  const updateField = (key: keyof CreateRecycleListingRequest, value: any) =>
    setForm((f: CreateRecycleListingRequest) => ({ ...f, [key]: value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.title?.trim()) next.title = 'Titel er påkrævet';
    if (!form.description?.trim()) next.description = 'Beskrivelse er påkrævet';
    const cityVal = (form.city || cityQuery || '').trim();
    if (!cityVal) next.city = 'By er påkrævet';
    if (!form.availableFrom) next.availableFrom = 'Startdato og tid er påkrævet';
    if (!form.availableTo) next.availableTo = 'Slutdato og tid er påkrævet';

    // Estimated value validation
    if (form.estimatedValue != null) {
      if (Number.isNaN(form.estimatedValue as any)) next.estimatedValue = 'Ugyldigt tal';
      else if (form.estimatedValue < 0) next.estimatedValue = 'Skal være >= 0';
    }
    if (form.estimatedAmount != null) {
      const raw = String(form.estimatedAmount).trim();
      if (raw && !/^\d+$/.test(raw)) next.estimatedAmount = 'Kun tal er tilladt';
    }
    if (form.availableFrom && form.availableTo && form.availableFrom > form.availableTo) {
      next.availableTo = 'Sluttid skal være efter starttid';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      const firstError = Object.values(errors)[0] || 'Udfyld venligst de påkrævede felter.';
      show(firstError, 'error');
      return;
    }
    setLoading(true);
    try {
      // Prefer selected city, fall back to typed query
      const city = form.city || cityQuery;
      // Sanitize payload: ensure types align with current (generated) contract.
      const payload: CreateRecycleListingRequest = { ...form, city };
      if (payload.estimatedAmount != null) {
        const amtStr = String(payload.estimatedAmount).trim();
        payload.estimatedAmount = amtStr.length === 0 ? undefined : amtStr; // API expects string
      }
      if (payload.estimatedValue != null) {
        const num = Number(payload.estimatedValue);
        payload.estimatedValue = Number.isNaN(num) ? undefined : num; // API expects number
      }
      const api = createRecycleListingsApi();
      await api.listingsCreate({ createRecycleListingRequest: payload });
      show('Opslaget blev oprettet.', 'success');
      router.replace('/listings');
    } catch (e) {
      console.error(e);
      show('Kunne ikke oprette opslag.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateStep = (s: number) => {
    const next: Record<string, string> = {};
    if (s === 0) {
      if (!form.title?.trim()) next.title = 'Titel er påkrævet';
      if (!form.description?.trim()) next.description = 'Beskrivelse er påkrævet';
      const cityVal = (form.city || cityQuery || '').trim();
      if (!cityVal) next.city = 'By er påkrævet';
    } else if (s === 1) {
      if (!form.availableFrom) next.availableFrom = 'Startdato og tid er påkrævet';
      if (!form.availableTo) next.availableTo = 'Slutdato og tid er påkrævet';
      if (form.availableFrom && form.availableTo && form.availableFrom > form.availableTo) {
        next.availableTo = 'Sluttid skal være efter starttid';
      }
    } else if (s === 2) {
      if (form.estimatedValue != null) {
        if (Number.isNaN(form.estimatedValue as any)) next.estimatedValue = 'Ugyldigt tal';
        else if (form.estimatedValue < 0) next.estimatedValue = 'Skal være >= 0';
      }
      if (form.estimatedAmount != null) {
        const raw = String(form.estimatedAmount).trim();
        if (raw && !/^[0-9]+$/.test(raw)) next.estimatedAmount = 'Kun tal er tilladt';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Debounced typeahead for city
  useEffect(() => {
    if (suppressNextSearchRef.current) {
      // Skip triggering a new search immediately after selecting a suggestion
      suppressNextSearchRef.current = false;
      return;
    }
    const q = cityQuery.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q) {
      setCityResults([]);
      setCityOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setCityLoading(true);
        const results = await citiesApi.citiesSearch({ q, take: 8 });
        setCityResults(results || []);
        setCityOpen(true);
      } catch (err) {
        console.debug('City search failed', err);
        setCityResults([]);
        setCityOpen(false);
      } finally {
        setCityLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityQuery, citiesApi]);

  const mergeDate = (base: Date | undefined, picked: Date, part: 'date' | 'time') => {
    if (part === 'date') {
      const time = base ?? picked;
      return new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), time.getHours(), time.getMinutes(), 0, 0);
    } else {
      const d = base ?? new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), picked.getHours(), picked.getMinutes(), 0, 0);
    }
  };

  const shiftEndIfNeeded = (from: Date) => {
    setForm(prev => {
      const to = prev.availableTo;
      if (!to || to <= from) {
        const newTo = new Date(from.getTime() + 60 * 60 * 1000);
        return { ...prev, availableTo: newTo };
      }
      return prev;
    });
    if (errors.availableTo) setErrors({ ...errors, availableTo: '' });
  };

  const onDatePick = (field: 'availableFrom' | 'availableTo') => (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      if (field === 'availableFrom') setShowFromPicker(false); else setShowToPicker(false);
      return;
    }
    if (date) {
      const merged = mergeDate(form[field], date, 'date');
      updateField(field, merged);
      if (errors[field]) setErrors({ ...errors, [field]: '' });
      if (field === 'availableFrom') { setShowFromPicker(false); setShowFromTimePicker(true); } else { setShowToPicker(false); setShowToTimePicker(true); }
    }
  };

  const onTimePick = (field: 'availableFrom' | 'availableTo') => (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') {
      field === 'availableFrom' ? setShowFromTimePicker(false) : setShowToTimePicker(false);
    }
    if (event.type === 'dismissed') {
      return;
    }
    if (date) {
      const merged = mergeDate(form[field], date, 'time');
      updateField(field, merged);
      if (errors[field]) setErrors({ ...errors, [field]: '' });
      if (field === 'availableFrom') {
        shiftEndIfNeeded(merged);
      }
    }
  };

  const renderFromPickers = () => (
    <>
      {showFromPicker && (
        <DateTimePicker
          value={form.availableFrom || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onDatePick('availableFrom')}
        />
      )}
      {showFromTimePicker && (
        <DateTimePicker
          value={form.availableFrom || new Date()}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onTimePick('availableFrom')}
        />
      )}
    </>
  );

  const renderToPickers = () => (
    <>
      {showToPicker && (
        <DateTimePicker
          value={form.availableTo ?? form.availableFrom ?? new Date()}
          mode="date"
          minimumDate={form.availableFrom || undefined}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onDatePick('availableTo')}
        />
      )}
      {showToTimePicker && (
        <DateTimePicker
          value={form.availableTo ?? form.availableFrom ?? new Date()}
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onTimePick('availableTo')}
        />
      )}
    </>
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      const f = form.availableFrom || new Date();
      const t = form.availableTo || form.availableFrom || new Date();
      setFromDateStr(form.availableFrom ? datePart(f) : '');
      setFromTimeStr(form.availableFrom ? timePart(f) : '');
      setToDateStr(form.availableTo ? datePart(t) : '');
      setToTimeStr(form.availableTo ? timePart(t) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseLocal = (d: string, t: string): Date | null => {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) return null;
    const [day, m, y] = d.split('-').map(Number);
    const [hh, mm] = t.split(':').map(Number);
    return new Date(y, m - 1, day, hh, mm, 0, 0);
  };

  if (!token || user?.role !== 'Donator') {
    return <Redirect href={!token ? '/login' : '/'} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Opret opslag</Text>
      <Text style={styles.stepIndicator}>Trin {step + 1} af 3</Text>

      {step === 0 && (
        <>
          <TextInput style={[styles.input, errors.title && styles.inputError]} placeholder="Titel" onChangeText={(t) => { updateField('title', t); if (errors.title) setErrors({ ...errors, title: '' }); }} />
          {!!errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
          <TextInput style={[styles.input, errors.description && styles.inputError]} placeholder="Beskrivelse" onChangeText={(t) => { updateField('description', t); if (errors.description) setErrors({ ...errors, description: '' }); }} />
          {!!errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
          <View style={[styles.typeaheadContainer, cityOpen && styles.typeaheadOpen]}>
            <TextInput
              style={[styles.input, errors.city && styles.inputError]}
              placeholder="By"
              value={cityQuery}
              onChangeText={(t) => { setCityQuery(t); setCityOpen(!!t); updateField('city', ''); if (errors.city) setErrors({ ...errors, city: '' }); }}
              onFocus={() => { if (cityResults.length > 0) setCityOpen(true); }}
              onBlur={() => {
                setTimeout(() => {
                  if (!selectingRef.current) { setCityOpen(false); setCityResults([]); }
                }, 100);
              }}
            />
            {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
            {cityOpen && cityResults.length > 0 && (
              <View style={styles.dropdown}>
                {cityLoading && <Text style={styles.dropdownHint}>Søger...</Text>}
                {!cityLoading && (
                  <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
                    {cityResults.map((c) => {
                      const pcs = c.postalCodes?.slice(0, 3).join(', ');
                      const hasMore = (c.postalCodes?.length ?? 0) > 3;
                      let suffix = '';
                      if (pcs && pcs.length > 0) suffix = ` (${pcs}${hasMore ? '…' : ''})`;
                      return (
                        <Pressable
                          key={c.id}
                          onPressIn={() => { selectingRef.current = true; }}
                          onPress={() => {
                            suppressNextSearchRef.current = true;
                            updateField('city', c.name || '');
                            setCityQuery(c.name || '');
                            setCityOpen(false);
                            setCityResults([]);
                            setTimeout(() => { selectingRef.current = false; }, 0);
                          }}
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
          <TextInput style={styles.input} placeholder="Adresse (valgfrit)" onChangeText={(t) => updateField('location', t)} />
          <View style={styles.navRow}>
            <PressableButton title="Fortryd" onPress={() => router.back()} color="#6b7280" iconName="arrow-left" style={styles.button} />
            <PressableButton title="Næste" onPress={() => { if (validateStep(0)) setStep(1); }} color="#2563eb" iconName="arrow-right" style={styles.button} />
          </View>
        </>
      )}

      {step === 1 && (
        <>
          {Platform.OS === 'web' ? (
            <>
              <View style={{ position: 'relative' }}>
                <Pressable style={[styles.input, styles.dateInput, errors.availableFrom && styles.inputError]} onPress={() => setWebFromOpen(true)}>
                  <Text style={!form.availableFrom ? styles.placeholder : undefined}>{form.availableFrom ? `${datePart(form.availableFrom)} ${timePart(form.availableFrom)}` : 'Tilgængelig fra (krævet)'}</Text>
                </Pressable>
                {!!errors.availableFrom && <Text style={styles.errorText}>{errors.availableFrom}</Text>}
              </View>
              <View style={{ position: 'relative' }}>
                <Pressable style={[styles.input, styles.dateInput, errors.availableTo && styles.inputError]} onPress={() => setWebToOpen(true)}>
                  <Text style={!form.availableTo ? styles.placeholder : undefined}>{form.availableTo ? `${datePart(form.availableTo)} ${timePart(form.availableTo)}` : 'Tilgængelig til (krævet)'}</Text>
                </Pressable>
                {!!errors.availableTo && <Text style={styles.errorText}>{errors.availableTo}</Text>}
              </View>

              <Modal visible={webFromOpen} transparent animationType="fade" onRequestClose={() => setWebFromOpen(false)}>
                <View style={styles.webModalBackdrop}>
                  <View style={styles.webModalCard}>
                    <Text style={styles.webPickerLabel}>Dato (DD-MM-ÅÅÅÅ)</Text>
                    <TextInput style={styles.input} value={fromDateStr} placeholder="11-09-2025" onChangeText={setFromDateStr} />
                    <Text style={[styles.webPickerLabel, { marginTop: 8 }]}>Tid (TT:MM)</Text>
                    <TextInput style={styles.input} value={fromTimeStr} placeholder="14:30" onChangeText={setFromTimeStr} />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                      <PressableButton title="Annuller" onPress={() => setWebFromOpen(false)} color="#6b7280" iconName="close-outline" />
                      <PressableButton title="Vælg" onPress={() => {
                        const d = parseLocal(fromDateStr, fromTimeStr);
                        if (!d) { setErrors({ ...errors, availableFrom: 'Ugyldigt dato/tid-format' }); return; }
                        updateField('availableFrom', d);
                        setErrors({ ...errors, availableFrom: '' });
                        shiftEndIfNeeded(d);
                        setWebFromOpen(false);
                      }} color="#16a34a" iconName="checkmark-outline" />
                    </View>
                  </View>
                </View>
              </Modal>

              <Modal visible={webToOpen} transparent animationType="fade" onRequestClose={() => setWebToOpen(false)}>
                <View style={styles.webModalBackdrop}>
                  <View style={styles.webModalCard}>
                    <Text style={styles.webPickerLabel}>Dato (DD-MM-ÅÅÅÅ)</Text>
                    <TextInput style={styles.input} value={toDateStr} placeholder="11-09-2025" onChangeText={setToDateStr} />
                    <Text style={[styles.webPickerLabel, { marginTop: 8 }]}>Tid (TT:MM)</Text>
                    <TextInput style={styles.input} value={toTimeStr} placeholder="15:45" onChangeText={setToTimeStr} />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                      <PressableButton title="Annuller" onPress={() => setWebToOpen(false)} color="#6b7280" iconName="close-outline" />
                      <PressableButton title="Vælg" onPress={() => {
                        const d = parseLocal(toDateStr, toTimeStr);
                        if (!d) { setErrors({ ...errors, availableTo: 'Ugyldigt dato/tid-format' }); return; }
                        if (form.availableFrom && d <= form.availableFrom) { setErrors({ ...errors, availableTo: 'Sluttid skal være efter starttid' }); return; }
                        updateField('availableTo', d);
                        setErrors({ ...errors, availableTo: '' });
                        setWebToOpen(false);
                      }} color="#16a34a" iconName="checkmark-outline" />
                    </View>
                  </View>
                </View>
              </Modal>
            </>
          ) : (
            <>
              <View>
                <Pressable style={[styles.input, styles.dateInput, errors.availableFrom && styles.inputError]} onPress={() => { setShowFromPicker(true); setShowFromTimePicker(false); }}>
                  <Text style={!form.availableFrom ? styles.placeholder : undefined}>{form.availableFrom ? `${datePart(form.availableFrom)} ${timePart(form.availableFrom)}` : 'Tilgængelig fra (krævet)'}</Text>
                </Pressable>
                {!!errors.availableFrom && <Text style={styles.errorText}>{errors.availableFrom}</Text>}
                {renderFromPickers()}
              </View>
              <View>
                <Pressable style={[styles.input, styles.dateInput, errors.availableTo && styles.inputError]} onPress={() => { setShowToPicker(true); setShowToTimePicker(false); }}>
                  <Text style={!form.availableTo ? styles.placeholder : undefined}>{form.availableTo ? `${datePart(form.availableTo)} ${timePart(form.availableTo)}` : 'Tilgængelig til (krævet)'}</Text>
                </Pressable>
                {!!errors.availableTo && <Text style={styles.errorText}>{errors.availableTo}</Text>}
                {renderToPickers()}
              </View>
            </>
          )}
          <View style={styles.navRow}>
            <PressableButton title="Tilbage" onPress={() => setStep(0)} color="#6b7280" iconName="arrow-left" style={styles.button} />
            <PressableButton title="Næste" onPress={() => { if (validateStep(1)) setStep(2); }} color="#2563eb" iconName="arrow-right" iconPosition="right" style={styles.button} />
          </View>
        </>
      )}

      {step === 2 && (
        <>
          <TextInput
            style={[styles.input, errors.estimatedValue && styles.inputError]}
            placeholder="Estimeret værdi (kr)"
            keyboardType="numeric"
            onChangeText={(t) => {
              const num = t.replace(',', '.');
              updateField('estimatedValue', num === '' ? undefined : Number(num));
              if (errors.estimatedValue) setErrors({ ...errors, estimatedValue: '' });
            }}
          />
          {!!errors.estimatedValue && <Text style={styles.errorText}>{errors.estimatedValue}</Text>}
          <TextInput
            style={[styles.input, errors.estimatedAmount && styles.inputError]}
            placeholder="Estimeret antal"
            keyboardType="numeric"
            onChangeText={(t) => {
              const cleaned = t.replace(/\D/g, '');
              updateField('estimatedAmount', cleaned === '' ? undefined : cleaned);
              if (errors.estimatedAmount) setErrors({ ...errors, estimatedAmount: '' });
            }}
          />
          {!!errors.estimatedAmount && <Text style={styles.errorText}>{errors.estimatedAmount}</Text>}
          <View style={styles.navRow}>
            <PressableButton title="Tilbage" onPress={() => setStep(1)} color="#6b7280" iconName="arrow-left" style={styles.button} />
            <PressableButton title={loading ? 'Opretter...' : 'Opret'} onPress={() => { if (validateStep(2)) submit(); }} disabled={loading} color="#16a34a" iconName="save" style={styles.button} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', justifyContent: 'center', width: 480 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  stepIndicator: { color: '#6b7280', marginTop: -8, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  inputError: { borderColor: '#dc2626' },
  errorText: { color: '#dc2626', fontSize: 12, marginTop: -6, marginBottom: 8 },
  // Ensures the dropdown can overlay subsequent fields
  typeaheadContainer: { position: 'relative', overflow: 'visible' },
  typeaheadOpen: { zIndex: 9999, elevation: 50 },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 50,
    maxHeight: 240,
    zIndex: 9999,
    overflow: 'hidden',
  },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f1f1', backgroundColor: '#fff' },
  dropdownItemPressed: { backgroundColor: '#f5f5f5' },
  dropdownText: { fontSize: 14, color: '#222' },
  dropdownHint: { padding: 12, fontSize: 12, color: '#666' },
  dateInput: { justifyContent: 'center' },
  placeholder: { color: '#888' },
  webPickerPane: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 200,
    padding: 12,
  },
  webPickerLabel: { fontSize: 12, color: '#444' },
  webModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  webModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  button: {
    justifyContent: 'center',
  },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 8 },
});
