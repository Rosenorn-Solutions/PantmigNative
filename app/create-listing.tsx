import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import DetailsStep from '../components/create-listing/DetailsStep';
import ImagesStep from '../components/create-listing/ImagesStep';
import ItemsStep from '../components/create-listing/ItemsStep';
import TimeStep from '../components/create-listing/TimeStep';
import { CitiesApi } from './apis/pantmig-api/apis';
import type { CitySearchResult } from './apis/pantmig-api/models/CitySearchResult';
import { CreateRecycleListingRequest } from './apis/pantmig-api/models/CreateRecycleListingRequest';
import { useAuth } from './AuthContext';
import { authorizedMultipart, createRecycleListingsApi, pantmigApiConfig } from './services/api';
import { useToast } from './Toast';
import { formStyles } from './utils/formStyles';

// Web helpers for image compression (module scope to avoid deep nesting in component)
const webToJpegName = (name: string) => name.replace(/\.(heic|heif|png|webp|jpeg|jpg)$/i, '') + '.jpg';
const loadHtmlImageFromBlob = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image for compression')); };
  img.src = url;
});
async function webCompressFile(inputFile: File, opts?: { maxDim?: number; quality?: number; mimeType?: string; }): Promise<File> {
  const maxDim = opts?.maxDim ?? 1600;
  const quality = opts?.quality ?? 0.75;
  const mime = opts?.mimeType ?? 'image/jpeg';
  try {
    // Prefer createImageBitmap when available (avoids onload callbacks)
    let width: number; let height: number; let source: any;
    try {
      const anyWindow: any = globalThis as any;
      const bmp = anyWindow.createImageBitmap ? await anyWindow.createImageBitmap(inputFile) : null;
      if (bmp) { width = bmp.width; height = bmp.height; source = bmp; }
    } catch {
      const img = await loadHtmlImageFromBlob(inputFile);
      width = img.naturalWidth; height = img.naturalHeight; source = img;
    }
    const scale = Math.min(1, maxDim / Math.max(width!, height!));
    const cw = Math.max(1, Math.round(width! * scale));
    const ch = Math.max(1, Math.round(height! * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context missing');
    ctx.drawImage(source, 0, 0, cw, ch);
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, mime, quality));
    if (!blob) throw new Error('Compression failed');
    return new File([blob], webToJpegName(inputFile.name), { type: mime });
  } catch {
    return inputFile;
  }
}

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
  // selection is handled onPress inside the dropdown items; avoid separate selectingRef to reduce focus churn
  const suppressNextSearchRef = useRef(false);
  const citiesApi = useMemo(() => new CitiesApi(pantmigApiConfig), []);
  const [showFromPicker, setShowFromPicker] = useState(false); // date-only
  const [showToPicker, setShowToPicker] = useState(false);     // date-only
  const [showPickupFromTimePicker, setShowPickupFromTimePicker] = useState(false);
  const [showPickupToTimePicker, setShowPickupToTimePicker] = useState(false);
  // Web-only inline pickers
  const [webFromOpen, setWebFromOpen] = useState(false);
  const [webToOpen, setWebToOpen] = useState(false);
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  const timePart = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`; // used for preview only
  const [fromDateStr, setFromDateStr] = useState<string>('');
  const [fromTimeStr, setFromTimeStr] = useState<string>('');
  const [toDateStr, setToDateStr] = useState<string>('');
  const [toTimeStr, setToTimeStr] = useState<string>('');
  const [step, setStep] = useState<number>(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const stepAnim = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(stepAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [step]);
  const goTo = (next: number) => { setDir(next > step ? 1 : -1); stepAnim.setValue(0); setStep(next); };
  const MATERIALS = [
    { type: 1 as any as number, label: 'Plastikflasker' },
    { type: 2 as any as number, label: 'Glasflasker' },
    { type: 3 as any as number, label: 'Dåser' },
  ];
  const MAX_IMAGES = 6;
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  type PickedImage = { id: string; uri: string; name: string; type: string; file?: File; size?: number };
  const [images, setImages] = useState<PickedImage[]>([]);
  // removed picking spinner state to keep component simpler

  const updateField = (key: keyof CreateRecycleListingRequest, value: any) =>
    setForm((f: CreateRecycleListingRequest) => ({ ...f, [key]: value }));

  const validate = () => {
    // Merge all step validations for final submit
    const next = { ...getDetailsErrors(), ...getItemsErrors(), ...getTimeErrors() };
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (): CreateRecycleListingRequest => {
    const normalizeDate = (d: unknown): Date | undefined => {
      if (!d) return undefined;
      if (d instanceof Date) return d;
      if (typeof d === 'string') {
        const nd = new Date(d);
        return isNaN(nd.getTime()) ? undefined : nd;
      }
      return undefined;
    };
    const city = form.city || cityQuery;
    // availableFrom/To now date-only; pickupTimeFrom/To come from fromTimeStr/toTimeStr
    let pickupFromStr: string | undefined = undefined;
    let pickupToStr: string | undefined = undefined;
    if (/^\d{2}:\d{2}$/.test(fromTimeStr)) pickupFromStr = fromTimeStr;
    if (/^\d{2}:\d{2}$/.test(toTimeStr)) pickupToStr = toTimeStr;
    return {
      ...form,
      city,
      availableFrom: normalizeDate(form.availableFrom),
      availableTo: normalizeDate(form.availableTo),
      pickupTimeFrom: pickupFromStr,
      pickupTimeTo: pickupToStr,
    };
  };

  const createListingJson = async (payload: CreateRecycleListingRequest) => {
    const api = createRecycleListingsApi();
    await api.listingsCreate({ createRecycleListingRequest: {
      title: payload.title,
      description: payload.description,
      city: payload.city,
      location: payload.location,
      availableFrom: payload.availableFrom,
      availableTo: payload.availableTo,
      pickupTimeFrom: payload.pickupTimeFrom,
      pickupTimeTo: payload.pickupTimeTo,
      items: payload.items?.length ? payload.items : undefined,
    }});
  };

  const createListingMultipart = async (payload: CreateRecycleListingRequest) => {
    const formData = new FormData();
    if (payload.title) formData.append('title', payload.title);
    if (payload.description) formData.append('description', payload.description);
    if (payload.city || cityQuery) formData.append('city', (payload.city || cityQuery) as any);
    if (payload.location) formData.append('location', payload.location);
  const toDateOnly = (d: Date) => d.toISOString().substring(0, 10);
    if (payload.availableFrom) formData.append('availableFrom', toDateOnly(payload.availableFrom));
    if (payload.availableTo) formData.append('availableTo', toDateOnly(payload.availableTo));
    if (payload.pickupTimeFrom) formData.append('pickupTimeFrom', payload.pickupTimeFrom);
    if (payload.pickupTimeTo) formData.append('pickupTimeTo', payload.pickupTimeTo);
    if (payload.items?.length) {
      try { formData.append('items', JSON.stringify(payload.items)); } catch {}
    }
    // Defensive: enforce image constraints right before upload as well
    if (images.length > MAX_IMAGES) {
      throw new Error(`Maksimalt ${MAX_IMAGES} billeder er tilladt`);
    }
    const overLimit = images.filter((im) => (im.file?.size ?? im.size ?? 0) > MAX_BYTES);
    if (overLimit.length > 0) {
      throw new Error('Et eller flere billeder overstiger 5 MB');
    }
    images.forEach((img, idx) => {
      if (img.file) {
        formData.append('images', img.file, img.name || `image_${idx}.jpg`);
      } else {
        formData.append('images', { uri: img.uri, name: img.name || `image_${idx}.jpg`, type: img.type } as any);
      }
    });
    const resp = await authorizedMultipart('/listings', formData);
    if (!resp.ok) throw new Error('Upload fejlede med status ' + resp.status);
  };

  const handleRemoveImage = (id: string) => setImages(arr => arr.filter(x => x.id !== id));

  /* eslint-disable sonarjs/cognitive-complexity */
  const pickImages = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { show('Tilladelse kræves', 'error'); return; }
      }
      // keep using mediaTypes to match type definition and avoid deprecation warning
  const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, quality: 0.6 });
      if ((result as any).canceled) return;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const picked = (result as any).assets.map((a: any) => ({ uri: a.uri, name: a.fileName || 'listing.jpg', type: a.mimeType || 'image/jpeg', size: (a as any).fileSize }));
      if (Platform.OS === 'web') {
        const converted: PickedImage[] = [];
        for (const p of picked) {
          try {
            const resp = await fetch(p.uri);
            const blob = await resp.blob();
            const original = new File([blob], p.name, { type: p.type });
            // Only try to compress if it's an image and larger than ~150KB
            const shouldCompress = original.type?.startsWith('image/') && original.size > 150 * 1024;
            const file = shouldCompress ? await webCompressFile(original) : original;
            const outName = shouldCompress ? webToJpegName(p.name) : p.name;
            converted.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, uri: p.uri, name: outName, type: file.type || p.type, file, size: file.size });
          } catch {
            converted.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, uri: p.uri, name: p.name, type: p.type, size: undefined });
          }
        }
        // Enforce per-file size and max count on web
        const filtered = converted.filter(img => (img.file?.size ?? img.size ?? 0) <= MAX_BYTES);
        const combined = [...images, ...filtered];
        if (converted.length !== filtered.length) {
          show('Billeder over 5 MB blev udeladt', 'error');
        }
        if (combined.length > MAX_IMAGES) {
          show(`Maks ${MAX_IMAGES} billeder. Overskydende blev udeladt.`, 'error');
        }
        setImages([...combined.slice(0, MAX_IMAGES)]);
      } else {
        // Native: respect per-file size if available and cap total count
        const appended = picked
          .filter((p: any) => (p.size == null || p.size <= MAX_BYTES))
          .map((p: any) => ({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, ...p }));
        if (appended.length < picked.length) {
          show('Billeder over 5 MB blev udeladt', 'error');
        }
        const combined = [...images, ...appended];
        if (combined.length > MAX_IMAGES) {
          show(`Maks ${MAX_IMAGES} billeder. Overskydende blev udeladt.`, 'error');
        }
        setImages([...combined.slice(0, MAX_IMAGES)]);
      }
    } catch (err) {
      console.error(err);
      show('Kunne ikke vælge billede(r)', 'error');
    } finally { /* no-op */ }
  };
  /* eslint-enable sonarjs/cognitive-complexity */

  const submit = async () => {
    if (!validate()) {
      const firstError = Object.values(errors)[0] || 'Udfyld venligst de påkrævede felter.';
      show(firstError, 'error');
      return;
    }
    if (!token) {
      show('Session udløbet. Log ind igen.', 'error');
      return;
    }
    setLoading(true);
    try {
      const payload = buildPayload();
      if (images.length === 0) await createListingJson(payload); else await createListingMultipart(payload);
      show('Opslaget blev oprettet.', 'success');
      router.replace('/listings');
    } catch (e) {
      console.error(e);
      show('Kunne ikke oprette opslag.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getDetailsErrors = () => {
    const next: Record<string, string> = {};
    if (!form.title?.trim()) next.title = 'Titel er påkrævet';
    if (!form.description?.trim()) next.description = 'Beskrivelse er påkrævet';
    const cityVal = (form.city || cityQuery || '').trim();
    if (!cityVal) next.city = 'By er påkrævet';
    return next;
  };

  const getItemsErrors = () => {
    const next: Record<string, string> = {};
    const count = form.items?.length ?? 0;
    if (count === 0) next.items = 'Tilføj mindst én type genanvendeligt materiale';
    return next;
  };

  const getTimeErrors = () => {
    const next: Record<string, string> = {};
    if (!form.availableFrom) next.availableFrom = 'Startdato er påkrævet';
    if (!form.availableTo) next.availableTo = 'Slutdato er påkrævet';
    if (form.availableFrom && form.availableTo && form.availableFrom > form.availableTo) {
      next.availableTo = 'Slutdato skal være samme dag eller efter startdato';
    }
    // pickup time window checks (time-only)
    const timeRe = /^\d{2}:\d{2}$/;
    if (!timeRe.test(fromTimeStr)) next.pickupTimeFrom = 'Afhentningstid fra er påkrævet (TT:MM)';
    if (!timeRe.test(toTimeStr)) next.pickupTimeTo = 'Afhentningstid til er påkrævet (TT:MM)';
    if (timeRe.test(fromTimeStr) && timeRe.test(toTimeStr)) {
      const [fh, fm] = fromTimeStr.split(':').map(Number);
      const [th, tm] = toTimeStr.split(':').map(Number);
      const fromMins = fh * 60 + fm;
      const toMins = th * 60 + tm;
      if (toMins <= fromMins) next.pickupTimeTo = 'Sluttid skal være efter starttid';
    }
    return next;
  };

  const validateStep = (s: number) => {
    let next: Record<string, string> = {};
    if (s === 0) next = getDetailsErrors();
    else if (s === 1) next = getItemsErrors();
    else if (s === 2) next = getTimeErrors();
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // items state helpers (mutate form.items directly to keep compat with generated type)
  const ensureItems = () => form.items ?? [];
  const isSelected = (t: number) => ensureItems().some(i => (i as any).type === t);
  const getQty = (t: number) => ensureItems().find(i => (i as any).type === t)?.quantity ?? '';
  const toggleItem = (t: number) => {
    setForm(prev => {
      const items = [...(prev.items || [])];
      const idx = items.findIndex(i => (i as any).type === t);
      if (idx >= 0) items.splice(idx, 1); else items.push({ type: t, quantity: undefined } as any);
      return { ...prev, items };
    });
  };
  const setQty = (t: number, txt: string) => {
    setForm(prev => {
      const items = [...(prev.items || [])];
      const idx = items.findIndex(i => (i as any).type === t);
      const val = txt.trim() === '' ? undefined : Number(txt.replace(',', '.'));
      if (idx >= 0) items[idx] = { ...items[idx], quantity: Number.isFinite(val as number) ? (val as number) : undefined } as any;
      else items.push({ type: t, quantity: Number.isFinite(val as number) ? (val as number) : undefined } as any);
      return { ...prev, items };
    });
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
    if (q.length < 2) {
      setCityResults([]);
      setCityOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setCityLoading(true);
        const results = await citiesApi.citiesSearch({ q, take: 8 });
        setCityResults(results || []);
        setTimeout(() => setCityOpen(true), 50);
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
      // Force date-only (zero time)
      return new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), 0, 0, 0, 0);
    } else {
      // For pickup times, we don't store on form dates; handled via fromTimeStr/toTimeStr
      return picked;
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
      if (field === 'availableFrom') { setShowFromPicker(false); } else { setShowToPicker(false); }
    }
  };

  const onTimePick = (field: 'availableFrom' | 'availableTo') => (event: DateTimePickerEvent, date?: Date) => {
    // Repurpose for pickup time selection on native
    if (event.type === 'dismissed') return;
    if (!date) return;
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const str = `${hh}:${mm}`;
    if (field === 'availableFrom') setFromTimeStr(str); else setToTimeStr(str);
    if (field === 'availableFrom' && errors.pickupTimeFrom) setErrors({ ...errors, pickupTimeFrom: '' });
    if (field === 'availableTo' && errors.pickupTimeTo) setErrors({ ...errors, pickupTimeTo: '' });
    if (Platform.OS !== 'ios') {
      if (field === 'availableFrom') setShowPickupFromTimePicker(false); else setShowPickupToTimePicker(false);
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
      {showPickupFromTimePicker && (
        <DateTimePicker
          value={new Date()}
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
      {showPickupToTimePicker && (
        <DateTimePicker
          value={new Date()}
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
      setToDateStr(form.availableTo ? datePart(t) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseLocal = (d: string, t: string): Date | null => {
    // Keep for compatibility if needed elsewhere; here date-only handled in TimeStep modal
    if (!/^\d{2}-\d{2}-\d{4}$/.test(d)) return null;
    const [day, m, y] = d.split('-').map(Number);
    return new Date(y, m - 1, day, 0, 0, 0, 0);
  };

  if (!token || user?.role !== 'Donator') {
    return <Redirect href={!token ? '/login' : '/'} />;
  }

  return (
  <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <Text style={styles.title}>Opret opslag</Text>
  <Text style={styles.stepIndicator}>Trin {step + 1} af 4</Text>

      {step === 0 && (
        <Animated.View style={{ opacity: stepAnim, transform: [{ translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [dir * 16, 0] }) }] }}>
          <DetailsStep
          errors={{ title: errors.title, description: errors.description, city: errors.city }}
          cityQuery={cityQuery}
          cityOpen={cityOpen}
          cityResults={cityResults}
          cityLoading={cityLoading}
          onTitleChange={(t) => { updateField('title', t); if (errors.title) setErrors({ ...errors, title: '' }); }}
          onDescriptionChange={(t) => { updateField('description', t); if (errors.description) setErrors({ ...errors, description: '' }); }}
          onCityChange={(t) => { setCityQuery(t); /* open will be set after results to avoid flicker */ updateField('city', ''); if (errors.city) setErrors({ ...errors, city: '' }); }}
          onCityFocus={() => { if (cityResults.length > 0) setCityOpen(true); }}
          onCityBlur={() => { /* no-op to avoid blur-induced focus jumps */ }}
          onCityPressIn={() => { /* no-op; selection handled onPress in child */ }}
          onCitySelect={(c) => { suppressNextSearchRef.current = true; updateField('city', c.name || ''); setCityQuery(c.name || ''); setCityOpen(false); setCityResults([]); }}
          onLocationChange={(t) => updateField('location', t)}
          onBack={() => router.back()}
          onNext={() => { if (validateStep(0)) goTo(1); }}
          styles={styles as any}
          />
        </Animated.View>
      )}

      {step === 1 && (
        <Animated.View style={{ opacity: stepAnim, transform: [{ translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [dir * 16, 0] }) }] }}>
          <ItemsStep
          materials={MATERIALS}
          isSelected={isSelected}
          getQty={getQty}
          toggleItem={toggleItem}
          setQty={setQty}
          error={errors.items}
          onBack={() => goTo(0)}
          onNext={() => { if (validateStep(1)) goTo(2); }}
          inputStyle={styles.input}
          labelStyle={styles.webPickerLabel}
          navRowStyle={styles.navRow}
          buttonStyle={styles.button}
          errorTextStyle={styles.errorText}
          />
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View style={{ opacity: stepAnim, transform: [{ translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [dir * 16, 0] }) }] }}>
          <TimeStep
          errors={{ availableFrom: errors.availableFrom, availableTo: errors.availableTo, pickupTimeFrom: errors.pickupTimeFrom, pickupTimeTo: errors.pickupTimeTo }}
          formAvailableFrom={form.availableFrom}
          formAvailableTo={form.availableTo}
          datePart={datePart}
          timePart={timePart}
          onDatePick={onDatePick}
          onTimePick={onTimePick}
          renderFromPickers={renderFromPickers}
          renderToPickers={renderToPickers}
          fromDateStr={fromDateStr}
          fromTimeStr={fromTimeStr}
          toDateStr={toDateStr}
          toTimeStr={toTimeStr}
          setFromDateStr={setFromDateStr}
          setFromTimeStr={setFromTimeStr}
          setToDateStr={setToDateStr}
          setToTimeStr={setToTimeStr}
          parseLocal={parseLocal}
          setWebFromOpen={setWebFromOpen}
          setWebToOpen={setWebToOpen}
          webFromOpen={webFromOpen}
          webToOpen={webToOpen}
          setErrorAvailableFrom={(msg) => setErrors({ ...errors, availableFrom: msg })}
          setErrorAvailableTo={(msg) => setErrors({ ...errors, availableTo: msg })}
          setAvailableFrom={(d) => updateField('availableFrom', d)}
          setAvailableTo={(d) => updateField('availableTo', d)}
          onOpenFrom={() => { setShowFromPicker(true); }}
          onOpenTo={() => { setShowToPicker(true); }}
          onOpenPickupFrom={() => { setShowPickupFromTimePicker(true); }}
          onOpenPickupTo={() => { setShowPickupToTimePicker(true); }}
          shiftEndIfNeeded={shiftEndIfNeeded}
          onBack={() => goTo(1)}
          onNext={() => { if (validateStep(2)) goTo(3); }}
          styles={styles as any}
          />
        </Animated.View>
      )}

      {step === 3 && (
        <Animated.View style={{ opacity: stepAnim, transform: [{ translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [dir * 16, 0] }) }] }}>
          <ImagesStep
          images={images}
          onRemove={handleRemoveImage}
          onAdd={pickImages}
          onBack={() => goTo(2)}
          onSubmit={() => { if (validateStep(3)) submit(); }}
          loading={loading}
          navRowStyle={styles.navRow}
          buttonStyle={styles.button}
          />
        </Animated.View>
      )}
    </ScrollView>
  );
}

// Screen-specific styles excluding shared form styles
const localStyles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', justifyContent: 'flex-start', width: 480, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  stepIndicator: { color: '#6b7280', marginTop: -8, marginBottom: 8 },
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
  button: { justifyContent: 'center' },
});

const styles = { ...formStyles, ...localStyles } as const;
