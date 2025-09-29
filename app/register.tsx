import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PressableButton from '../components/PressableButton';
import { CitiesApi } from './apis/pantmig-api/apis';
import type { CitySearchResult } from './apis/pantmig-api/models/CitySearchResult';
import { UserType } from './apis/pantmig-auth/models/UserType';
import { useAuth } from './AuthContext';
import { authApi, pantmigApiConfig } from './services/api';
import { useToast } from './Toast';

// NOTE: Do not create a new AuthApi() here; it would ignore configured basePath/middleware.

export default function RegisterScreen() {
  const { token, setAuthFromResponse } = useAuth();
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
  const deferredFirstOpenRef = useRef(false);
  const citiesApi = useMemo(() => new CitiesApi(pantmigApiConfig), []);
  const suppressNextSearchRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState<UserType>(UserType.NUMBER_0); // default to Donator
  const [errors, setErrors] = useState<Record<string, string>>({});
  const selectingRef = useRef(false);
  const router = useRouter();
  const { show } = useToast();

  // Animation refs (mirroring login sequence)
  const fadeLogo = useRef(new Animated.Value(0)).current;
  const scaleLogo = useRef(new Animated.Value(0.92)).current;
  const fadeTitle = useRef(new Animated.Value(0)).current;
  const transTitle = useRef(new Animated.Value(10)).current;
  const fadeFields = useRef(new Animated.Value(0)).current; // batch early fields
  const transFields = useRef(new Animated.Value(10)).current;
  const fadeCityBlock = useRef(new Animated.Value(0)).current;
  const transCityBlock = useRef(new Animated.Value(10)).current;
  const fadeRole = useRef(new Animated.Value(0)).current;
  const transRole = useRef(new Animated.Value(10)).current;
  const fadeButton = useRef(new Animated.Value(0)).current;
  const transButton = useRef(new Animated.Value(10)).current;
  const fadeTagline = useRef(new Animated.Value(0)).current;
  const transTagline = useRef(new Animated.Value(6)).current;

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => { AsyncStorage.getItem('ui:reduceMotion').then(v => { if (v === '1') setReduceMotion(true); }).catch(()=>{}); }, []);
  useEffect(() => {
    const run = async () => {
      try {
        const seen = await AsyncStorage.getItem('ui:firstAuthAnimSeen');
        if (seen || reduceMotion) {
          [fadeLogo, fadeTitle, fadeTagline, fadeFields, fadeCityBlock, fadeRole, fadeButton].forEach(v => v.setValue(1));
          [transTitle, transTagline, transFields, transCityBlock, transRole, transButton].forEach(v => v.setValue(0));
          scaleLogo.setValue(1);
          return;
        }
        Animated.sequence([
          Animated.parallel([
            Animated.timing(fadeLogo, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.spring(scaleLogo, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true, delay: 60 })
          ]),
          Animated.stagger(90, [
            Animated.parallel([
              Animated.timing(fadeTitle, { toValue: 1, duration: 280, useNativeDriver: true }),
              Animated.timing(transTitle, { toValue: 0, duration: 280, useNativeDriver: true })
            ]),
            Animated.parallel([
              Animated.timing(fadeTagline, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(transTagline, { toValue: 0, duration: 300, useNativeDriver: true })
            ]),
            Animated.parallel([
              Animated.timing(fadeFields, { toValue: 1, duration: 320, useNativeDriver: true }),
              Animated.timing(transFields, { toValue: 0, duration: 320, useNativeDriver: true })
            ]),
            Animated.parallel([
              Animated.timing(fadeCityBlock, { toValue: 1, duration: 320, useNativeDriver: true }),
              Animated.timing(transCityBlock, { toValue: 0, duration: 320, useNativeDriver: true })
            ]),
            Animated.parallel([
              Animated.timing(fadeRole, { toValue: 1, duration: 320, useNativeDriver: true }),
              Animated.timing(transRole, { toValue: 0, duration: 320, useNativeDriver: true })
            ]),
            Animated.parallel([
              Animated.timing(fadeButton, { toValue: 1, duration: 320, useNativeDriver: true }),
              Animated.timing(transButton, { toValue: 0, duration: 320, useNativeDriver: true })
            ])
          ])
        ]).start(() => { AsyncStorage.setItem('ui:firstAuthAnimSeen', '1').catch(()=>{}); });
      } catch {/* ignore */}
    };
    run();
  }, [reduceMotion, fadeLogo, scaleLogo, fadeTitle, transTitle, fadeFields, transFields, fadeCityBlock, transCityBlock, fadeRole, transRole, fadeButton, transButton, fadeTagline, transTagline]);

  const validate = () => {
    const next: Record<string, string> = {};
    const emailTrim = email.trim();
    if (!emailTrim) next.email = 'Email er påkrævet';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) next.email = 'Ugyldig email';
    if (!password || password.length < 6) next.password = 'Adgangskode skal være mindst 6 tegn';
    if (!firstName.trim()) next.firstName = 'Fornavn er påkrævet';
    if (!lastName.trim()) next.lastName = 'Efternavn er påkrævet';
    // phone optional; backend may validate further
    if (!(city?.trim() || cityQuery.trim())) next.city = 'By er påkrævet';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) {
      const firstError = Object.values(errors)[0] || 'Udfyld venligst alle påkrævede felter';
      show(firstError, 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.authRegister({ registerRequest: { email, password, firstName, lastName, phone, userType, city: city || cityQuery } });
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
    } finally {
      setLoading(false);
    }
  };

  // Debounced typeahead search for cities
  useEffect(() => {
    if (suppressNextSearchRef.current) { suppressNextSearchRef.current = false; return; }
    const q = cityQuery.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q) { setCityResults([]); setCityOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        setCityLoading(true);
        const results = await citiesApi.citiesSearch({ q, take: 8 });
        setCityResults(results || []);
        if (Platform.OS === 'android' && !deferredFirstOpenRef.current) {
          deferredFirstOpenRef.current = true;
          InteractionManager.runAfterInteractions(() => { requestAnimationFrame(() => setCityOpen(true)); });
        } else { setCityOpen(true); }
      } catch (e) {
        console.debug('City search failed', e);
        setCityResults([]); setCityOpen(false);
      } finally { setCityLoading(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityQuery, citiesApi]);

  const toggleReduceMotion = async () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    try {
      if (next) {
        await AsyncStorage.setItem('ui:reduceMotion', '1');
        [fadeLogo, fadeTitle, fadeTagline, fadeFields, fadeCityBlock, fadeRole, fadeButton].forEach(v => v.setValue(1));
        [transTitle, transTagline, transFields, transCityBlock, transRole, transButton].forEach(v => v.setValue(0));
        scaleLogo.setValue(1);
      } else {
        await AsyncStorage.removeItem('ui:reduceMotion');
      }
    } catch {}
  };

  if (token) return <Redirect href="/" />;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Animated.View style={[styles.logoWrapper, { opacity: fadeLogo, transform: [{ scale: scaleLogo }] }]}>        
        <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="contain" accessibilityRole="image" accessibilityLabel="Pantmig logo" />
      </Animated.View>
      <Animated.Text style={[styles.title, { opacity: fadeTitle, transform: [{ translateY: transTitle }] }]}>Opret konto</Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: fadeTagline, transform: [{ translateY: transTagline }] }]}>Bliv en del af genbrugskredsløbet</Animated.Text>
      <Animated.View style={{ opacity: fadeFields, transform: [{ translateY: transFields }] }}>
        <TextInput style={[styles.input, errors.email && styles.inputError]} placeholder="Email" value={email} onChangeText={(v)=>{ setEmail(v); if (errors.email) setErrors({ ...errors, email: '' }); }} autoCapitalize="none" autoComplete="off" textContentType="none" keyboardType="email-address" />
        {!!errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        <TextInput style={[styles.input, errors.password && styles.inputError]} placeholder="Adgangskode" value={password} onChangeText={(v)=>{ setPassword(v); if (errors.password) setErrors({ ...errors, password: '' }); }} secureTextEntry />
        {!!errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        <TextInput style={[styles.input, errors.firstName && styles.inputError]} placeholder="Fornavn" value={firstName} onChangeText={(v)=>{ setFirstName(v); if (errors.firstName) setErrors({ ...errors, firstName: '' }); }} />
        {!!errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
        <TextInput style={[styles.input, errors.lastName && styles.inputError]} placeholder="Efternavn" value={lastName} onChangeText={(v)=>{ setLastName(v); if (errors.lastName) setErrors({ ...errors, lastName: '' }); }} />
        {!!errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
        <TextInput style={styles.input} placeholder="Telefonnummer" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </Animated.View>
      <Animated.View style={[styles.typeaheadContainer, cityOpen && styles.typeaheadOpen, { opacity: fadeCityBlock, transform: [{ translateY: transCityBlock }] }]}>        
        <TextInput style={[styles.input, errors.city && styles.inputError]} placeholder="By (fx. København)" value={cityQuery} onChangeText={(t)=>{ setCityQuery(t); const shouldOpen = !!t && (Platform.OS !== 'android' || deferredFirstOpenRef.current); setCityOpen(shouldOpen); if (errors.city) setErrors({ ...errors, city: '' }); }} autoCapitalize="words" onBlur={()=>{ setTimeout(()=>{ if(!selectingRef.current){ setCityOpen(false); setCityResults([]);} },100); }} onFocus={()=>{ if(cityResults.length>0) setCityOpen(true); }} />
        {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
        {cityOpen && cityResults.length>0 && (
          <View style={styles.dropdown}>
            {cityLoading && <Text style={styles.dropdownHint}>Søger...</Text>}
            {!cityLoading && (
              <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
                {cityResults.map(c=>{ const pcs=c.postalCodes?.slice(0,3).join(', '); const hasMore=(c.postalCodes?.length??0)>3; let suffix=''; if(pcs&&pcs.length>0) suffix=` (${pcs}${hasMore?'…':''})`; return (
                  <Pressable key={c.id} onPressIn={()=>{ selectingRef.current=true; }} onPress={()=>{ suppressNextSearchRef.current=true; setCity(c.name||''); setCityQuery(c.name||''); setCityOpen(false); setCityResults([]); setTimeout(()=>{ selectingRef.current=false; },0); }} style={({pressed})=>[styles.dropdownItem, pressed && styles.dropdownItemPressed]}>
                    <Text style={styles.dropdownText}>{c.name}{suffix}</Text>
                  </Pressable>
                ); })}
              </ScrollView>
            )}
          </View>
        )}
      </Animated.View>
      <Animated.View style={[styles.segmented, { opacity: fadeRole, transform: [{ translateY: transRole }] }]}>        
        <Text style={styles.segmentedLabel}>Vælg rolle</Text>
        <View style={styles.segmentedRow}>
          <PressableButton title={`Donor${userType === UserType.NUMBER_0 ? ' ✓' : ''}`} onPress={()=>setUserType(UserType.NUMBER_0)} color={userType === UserType.NUMBER_0 ? '#2563eb' : '#4b4d50ff'} iconName="gift" />
          <PressableButton title={`Panter${userType === UserType.NUMBER_1 ? ' ✓' : ''}`} onPress={()=>setUserType(UserType.NUMBER_1)} color={userType === UserType.NUMBER_1 ? '#2563eb' : '#4b4d50ff'} iconName="recycle" />
        </View>
      </Animated.View>
      <Animated.View style={{ opacity: fadeButton, transform: [{ translateY: transButton }] }}>
        <PressableButton title={loading ? 'Opretter...' : 'Opret konto'} onPress={handleRegister} disabled={loading} color="#16a34a" iconName="user-plus" style={styles.button} />
        <Pressable onPress={async()=>{ const next=!reduceMotion; setReduceMotion(next); try { if(next) { await AsyncStorage.setItem('ui:reduceMotion','1'); [fadeLogo, fadeTitle, fadeTagline, fadeFields, fadeCityBlock, fadeRole, fadeButton].forEach(v=>v.setValue(1)); [transTitle, transTagline, transFields, transCityBlock, transRole, transButton].forEach(v=>v.setValue(0)); scaleLogo.setValue(1);} else { await AsyncStorage.removeItem('ui:reduceMotion'); } } catch {} }} style={{ marginTop:16, alignSelf:'center'}}>
          <Text style={{ fontSize:12, color:'#64748b' }}>{reduceMotion ? 'Aktiver animationer' : 'Reducer animationer'}</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', justifyContent: 'center', width: 480 },
  button: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
  },
  // Ensures the dropdown overlays subsequent fields
  typeaheadContainer: {
    position: 'relative',
    marginBottom: 16,
    overflow: 'visible',
  },
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
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    backgroundColor: '#fff',
  },
  dropdownItemPressed: {
    backgroundColor: '#f5f5f5',
  },
  dropdownText: {
    fontSize: 14,
    color: '#222',
  },
  dropdownHint: {
    padding: 12,
    fontSize: 12,
    color: '#666',
  },
  segmented: {
    marginBottom: 16,
  },
  segmentedLabel: {
    marginBottom: 8,
    color: '#444',
  },
  segmentedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  logoWrapper: { alignItems: 'center', marginBottom: 4 },
  logo: { width: 110, height: 110 },
  tagline: { textAlign: 'center', color: '#475569', marginTop: -12, marginBottom: 16, fontSize: 13, fontWeight: '500' }
});