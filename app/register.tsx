import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import AccountStep from '../components/register/AccountStep';
import CityStep from '../components/register/CityStep';
import PersonalStep from '../components/register/PersonalStep';
import RoleBirthStep from '../components/register/RoleBirthStep';
import { CitiesApi } from './apis/pantmig-api/apis';
import type { CitySearchResult } from './apis/pantmig-api/models/CitySearchResult';
import { UserType } from './apis/pantmig-auth/models/UserType';
import { useAuth } from './AuthContext';
import { authApi, pantmigApiConfig } from './services/api';
import { useToast } from './Toast';
import { formStyles } from './utils/formStyles';

// NOTE: Do not create a new AuthApi() here; it would ignore configured basePath/middleware.

export default function RegisterScreen() {
  const { token, setAuthFromResponse } = useAuth();
  const router = useRouter();
  const { show } = useToast();

  // Step state and form fields
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const [city, setCity] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const citiesApi = useMemo(() => new CitiesApi(pantmigApiConfig), []);
  const suppressNextSearchRef = useRef(false);

  const [userType, setUserType] = useState<UserType>(UserType.NUMBER_0); // default Donor
  const [gender, setGender] = useState<number>(0);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [birthDateStr, setBirthDateStr] = useState(''); // web input holds YYYY-MM-DD

  const [errors, setErrors] = useState<Record<string, string>>({});
  const stepAnim = React.useRef(new Animated.Value(1)).current;

  // Inject minimal web-only CSS for the native date input
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const id = 'pmg-register-web-css';
      if (typeof document !== 'undefined' && !document.getElementById(id)) {
        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
          .pmg-date-input { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 16px; width: 100%; box-sizing: border-box; font-size: 14px; color: #111827; }
          .pmg-date-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }
          .pmg-date-input-error { border-color: #dc2626 !important; }
          .pmg-date-label { display:block; font-size:12px; color:#444; margin-bottom:6px; }
        `;
        document.head.appendChild(style);
      }
    } catch {}
  }, []);

  // Debounced typeahead search for cities
  useEffect(() => {
    if (suppressNextSearchRef.current) { suppressNextSearchRef.current = false; return; }
    const q = cityQuery.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setCityResults([]); setCityOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        setCityLoading(true);
        const results = await citiesApi.citiesSearch({ q, take: 8 });
        setCityResults(results || []);
        // Slight delay before opening to avoid flicker on fast results
        setTimeout(() => setCityOpen(true), 50);
      } catch (e) {
        console.debug('City search failed', e);
        setCityResults([]); setCityOpen(false);
      } finally { setCityLoading(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityQuery, citiesApi]);

  // Validations split per-step
  const getAccountErrors = () => {
    const next: Record<string, string> = {};
    const emailTrim = email.trim();
    if (!emailTrim) next.email = 'Email er påkrævet';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) next.email = 'Ugyldig email';
    if (!password || password.length < 6) next.password = 'Adgangskode skal være mindst 6 tegn';
    return next;
  };
  const getPersonalErrors = () => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = 'Fornavn er påkrævet';
    if (!lastName.trim()) next.lastName = 'Efternavn er påkrævet';
    return next;
  };
  const getCityErrors = () => {
    const next: Record<string, string> = {};
    if (!(city?.trim() || cityQuery.trim())) next.city = 'By er påkrævet';
    return next;
  };
  const getRoleBirthErrors = () => {
    const next: Record<string, string> = {};
    if (gender == null || gender < 0) next.gender = 'Køn er påkrævet';
    if (!birthDate) next.birthDate = 'Fødselsdato er påkrævet';
    else {
      const now = new Date();
      const thirteenYearsMs = 13 * 365.25 * 24 * 60 * 60 * 1000;
      if (now.getTime() - birthDate.getTime() < thirteenYearsMs) next.birthDate = 'Minimumsalder er 13 år';
    }
    return next;
  };
  const validateStep = (s: number) => {
    let next: Record<string, string> = {};
    if (s === 0) next = getAccountErrors();
    else if (s === 1) next = getPersonalErrors();
    else if (s === 2) next = getCityErrors();
    else if (s === 3) next = getRoleBirthErrors();
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validateStep(3)) {
      const firstError = Object.values(errors)[0] || 'Udfyld venligst alle påkrævede felter';
      show(firstError, 'error');
      return;
    }
    setLoading(true);
    try {
      const birthDateToSend = birthDate ? new Date(Date.UTC(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())) : undefined;
      const res = await authApi.authRegister({ registerRequest: { email, password, firstName, lastName, phone, userType, city: city || cityQuery, gender: gender as any, birthDate: birthDateToSend } });
      if (res?.authResponse?.accessToken) {
        await setAuthFromResponse(res.authResponse);
        show('Din konto er oprettet!', 'success');
        router.replace('/');
      } else {
        show('Din konto er oprettet. Log venligst ind.', 'success');
        router.replace('/login');
      }
    } catch (error: any) {
      console.error('Register error', error);
      show('Registrering mislykkedes. Tjek dine oplysninger.', 'error');
    } finally { setLoading(false); }
  };

  const onBirthChange = (e: DateTimePickerEvent, d?: Date) => {
    if (e.type === 'dismissed') { setShowBirthPicker(false); return; }
    if (d) { setBirthDate(d); setShowBirthPicker(false); if (errors.birthDate) setErrors({ ...errors, birthDate: '' }); }
  };

  // Animate on step change
  useEffect(() => {
    Animated.timing(stepAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [step]);

  const goTo = (next: number) => {
    setDir(next > step ? 1 : -1);
    stepAnim.setValue(0);
    setStep(next);
  };

  if (token) return <Redirect href="/" />;

  // Helper: format YYYY-MM-DD for web date input
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
  const maxStr = fmt(maxDate);
  const valueStr = birthDate ? fmt(birthDate) : (birthDateStr || '');
  const webDateInput = (
    <View>
      <label htmlFor="birthDate" className="pmg-date-label">Fødselsdato</label>
      <input
        id="birthDate"
        type="date"
        value={valueStr}
        max={maxStr}
        className={errors.birthDate ? 'pmg-date-input pmg-date-input-error' : 'pmg-date-input'}
        onChange={(e: any) => {
          const v = e.target.value as string;
          setBirthDateStr(v);
          if (v) {
            const [y, m, d] = v.split('-').map(Number);
            const nd = new Date(y, (m || 1) - 1, d || 1);
            if (!isNaN(nd.getTime())) { setBirthDate(nd); if (errors.birthDate) setErrors({ ...errors, birthDate: '' }); }
            else { setBirthDate(null); }
          } else { setBirthDate(null); }
        }}
        placeholder="Vælg fødselsdato"
        aria-label="Fødselsdato"
      />
    </View>
  );

  return (
  <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <View style={styles.logoWrapper}>
        <Image source={require('../assets/images/logo-dark.png')} style={styles.logo} resizeMode="contain" accessibilityRole="image" accessibilityLabel="Pantmig logo" />
      </View>
      <Text style={styles.title}>Opret konto</Text>
      <Text style={styles.tagline}>Bliv en del af genbrugskredsløbet</Text>
      <Text style={styles.stepText}>Trin {step + 1} af 4</Text>

      {step === 0 && (
        <Animated.View style={{ opacity: stepAnim, transform: [{ translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [dir * 16, 0] }) }] }}>
          <AccountStep
          email={email}
          password={password}
          errorEmail={errors.email}
          errorPassword={errors.password}
          onEmailChange={(v) => { setEmail(v); if (errors.email) setErrors({ ...errors, email: '' }); }}
          onPasswordChange={(v) => { setPassword(v); if (errors.password) setErrors({ ...errors, password: '' }); }}
          onBack={() => router.back()}
          onNext={() => { if (validateStep(0)) goTo(1); }}
          styles={styles as any}
          />
        </Animated.View>
      )}

      {step === 1 && (
        <Animated.View style={{ opacity: stepAnim, transform: [{ translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [dir * 16, 0] }) }] }}>
          <PersonalStep
          firstName={firstName}
          lastName={lastName}
          phone={phone}
          errorFirstName={errors.firstName}
          errorLastName={errors.lastName}
          onFirstNameChange={(v) => { setFirstName(v); if (errors.firstName) setErrors({ ...errors, firstName: '' }); }}
          onLastNameChange={(v) => { setLastName(v); if (errors.lastName) setErrors({ ...errors, lastName: '' }); }}
          onPhoneChange={setPhone}
          onBack={() => goTo(0)}
          onNext={() => { if (validateStep(1)) goTo(2); }}
          styles={styles as any}
          />
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View style={{ opacity: stepAnim, transform: [{ translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [dir * 16, 0] }) }] }}>
          <CityStep
          cityQuery={cityQuery}
          cityOpen={cityOpen}
          cityResults={cityResults}
          cityLoading={cityLoading}
          errorCity={errors.city}
          onCityChange={(t) => {
            setCityQuery(t);
            // Let effect open the dropdown after results arrive to avoid open/close flicker while typing
            if (errors.city) {
              setErrors({ ...errors, city: '' });
            }
            setCity('');
          }}
          onCityFocus={() => { if (cityResults.length > 0) setCityOpen(true); }}
          onCityBlur={() => { /* no-op to avoid blur-induced focus jumps */ }}
          onCityPressIn={() => { /* no-op; selection handled onPress in child */ }}
          onCitySelect={(c) => { suppressNextSearchRef.current = true; setCity(c.name || ''); setCityQuery(c.name || ''); setCityOpen(false); setCityResults([]); }}
          onBack={() => goTo(1)}
          onNext={() => { if (validateStep(2)) goTo(3); }}
          styles={styles as any}
          />
        </Animated.View>
      )}

      {step === 3 && (
        <Animated.View style={{ opacity: stepAnim, transform: [{ translateX: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [dir * 16, 0] }) }] }}>
          <RoleBirthStep
          userTypeLabel={userType === UserType.NUMBER_0 ? 'Donor' : 'Panter'}
          gender={gender}
          onSelectRoleDonor={() => setUserType(UserType.NUMBER_0)}
          onSelectRoleRecycler={() => setUserType(UserType.NUMBER_1)}
          onSelectGender={(g) => setGender(g)}
          birthDate={birthDate}
          setShowBirthPicker={setShowBirthPicker}
          showBirthPicker={showBirthPicker}
          onBirthChange={onBirthChange}
          errors={{ gender: errors.gender, birthDate: errors.birthDate }}
          webDateInput={Platform.OS === 'web' ? webDateInput : undefined}
          styles={styles as any}
          onBack={() => goTo(2)}
          onSubmit={() => { if (validateStep(3)) handleRegister(); }}
          />
        </Animated.View>
      )}

      {step === 3 && (
        <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 8 }}>{loading ? 'Opretter...' : ''}</Text>
      )}
    </ScrollView>
  );
}

// Merge centralized form styles with local screen-specific styles
const localStyles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', justifyContent: 'flex-start', width: 480, minWidth: 0 },
  button: { justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 24, textAlign: 'center' },
  stepText: { color: '#6b7280', marginTop: -16, marginBottom: 8, textAlign: 'center' },
  dateInput: { justifyContent: 'center', marginBottom: 16 },
  placeholder: { color: '#64748b' },
  segmented: { marginBottom: 16 },
  segmentedLabel: { marginBottom: 8, color: '#444' },
  segmentedRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  logoWrapper: { alignItems: 'center', marginBottom: 4 },
  logo: { width: 110, height: 110 },
  tagline: { textAlign: 'center', color: '#475569', marginTop: -12, marginBottom: 16, fontSize: 13, fontWeight: '500' },
});

const styles = { ...formStyles, ...localStyles } as const;