import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
    if (suppressNextSearchRef.current) {
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
        if (Platform.OS === 'android' && !deferredFirstOpenRef.current) {
          deferredFirstOpenRef.current = true;
          InteractionManager.runAfterInteractions(() => {
            requestAnimationFrame(() => setCityOpen(true));
          });
        } else {
          setCityOpen(true);
        }
      } catch (e) {
        // Log and close dropdown on error to satisfy lint rules
        console.debug('City search failed', e);
        setCityResults([]);
        setCityOpen(false);
      } finally {
        setCityLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [cityQuery, citiesApi]);

  if (token) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Opret konto</Text>
      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        placeholder="Email"
        value={email}
        onChangeText={(v) => { setEmail(v); if (errors.email) setErrors({ ...errors, email: '' }); }}
        autoCapitalize="none"
        autoComplete="off"
        textContentType="none"
        keyboardType="email-address"
      />
      {!!errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      <TextInput
        style={[styles.input, errors.password && styles.inputError]}
        placeholder="Adgangskode"
        value={password}
        onChangeText={(v) => { setPassword(v); if (errors.password) setErrors({ ...errors, password: '' }); }}
        secureTextEntry
      />
      {!!errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      <TextInput
        style={[styles.input, errors.firstName && styles.inputError]}
        placeholder="Fornavn"
        value={firstName}
        onChangeText={(v) => { setFirstName(v); if (errors.firstName) setErrors({ ...errors, firstName: '' }); }}
      />
      {!!errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
      <TextInput
        style={[styles.input, errors.lastName && styles.inputError]}
        placeholder="Efternavn"
        value={lastName}
        onChangeText={(v) => { setLastName(v); if (errors.lastName) setErrors({ ...errors, lastName: '' }); }}
      />
      {!!errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
      <TextInput
        style={styles.input}
        placeholder="Telefonnummer"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <View style={[styles.typeaheadContainer, cityOpen && styles.typeaheadOpen]}>
        <TextInput
          style={[styles.input, errors.city && styles.inputError]}
          placeholder="By (fx. København)"
          value={cityQuery}
          onChangeText={(t) => {
            setCityQuery(t);
            const shouldOpen = !!t && (Platform.OS !== 'android' || deferredFirstOpenRef.current);
            setCityOpen(shouldOpen);
            if (errors.city) setErrors({ ...errors, city: '' });
          }}
          autoCapitalize="words"
          onBlur={() => {
            // Defer close so suggestion press can apply value first
            setTimeout(() => {
              if (!selectingRef.current) {
                setCityOpen(false);
                setCityResults([]);
              }
            }, 100);
          }}
          onFocus={() => {
            if (cityResults.length > 0) setCityOpen(true);
          }}
        />
        {!!errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
        {cityOpen && cityResults.length > 0 && (
          <View style={styles.dropdown}>
            {cityLoading && (
              <Text style={styles.dropdownHint}>Søger...</Text>
            )}
            {!cityLoading && (
              <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
                {cityResults.map((c) => {
                  const pcs = c.postalCodes?.slice(0, 3).join(', ');
                  const hasMore = (c.postalCodes?.length ?? 0) > 3;
                  let suffix = '';
                  if (pcs && pcs.length > 0) {
                    suffix = ` (${pcs}${hasMore ? '…' : ''})`;
                  }
                  return (
                    <Pressable
                      key={c.id}
                      onPressIn={() => { selectingRef.current = true; }}
                      onPress={() => {
                        suppressNextSearchRef.current = true;
                        setCity(c.name || '');
                        setCityQuery(c.name || '');
                        setCityOpen(false);
                        setCityResults([]);
                        setTimeout(() => { selectingRef.current = false; }, 0);
                      }}
                      style={({ pressed }) => [
                        styles.dropdownItem,
                        pressed && styles.dropdownItemPressed,
                      ]}
                    >
                      <Text style={styles.dropdownText}>
                        {c.name}
                        {suffix}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
      </View>
      <View style={styles.segmented}>
        <Text style={styles.segmentedLabel}>Vælg rolle</Text>
        <View style={styles.segmentedRow}>
          <PressableButton
            title={`Donor${userType === UserType.NUMBER_0 ? ' ✓' : ''}`}
            onPress={() => setUserType(UserType.NUMBER_0)}
            color={userType === UserType.NUMBER_0 ? '#2563eb' : '#4b4d50ff'}
            iconName="gift"
          />
          <PressableButton
            title={`Panter${userType === UserType.NUMBER_1 ? ' ✓' : ''}`}
            onPress={() => setUserType(UserType.NUMBER_1)}
            color={userType === UserType.NUMBER_1 ? '#2563eb' : '#4b4d50ff'}
            iconName="recycle"
          />
        </View>
      </View>
      <PressableButton title={loading ? 'Opretter...' : 'Opret konto'} onPress={handleRegister} disabled={loading} color="#16a34a" iconName="user-plus" style={styles.button} />
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
});