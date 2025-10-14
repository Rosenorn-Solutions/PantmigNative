import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import PressableButton from '../components/PressableButton';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { formStyles } from './utils/formStyles';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, token } = useAuth();
  const { show } = useToast();

  // Animation refs
  const fadeLogo = useRef(new Animated.Value(0)).current;
  const scaleLogo = useRef(new Animated.Value(0.92)).current;
  const fadeTitle = useRef(new Animated.Value(0)).current;
  const transTitle = useRef(new Animated.Value(10)).current;
  const fadeTagline = useRef(new Animated.Value(0)).current;
  const transTagline = useRef(new Animated.Value(10)).current;
  const fadeEmail = useRef(new Animated.Value(0)).current;
  const transEmail = useRef(new Animated.Value(10)).current;
  const fadePassword = useRef(new Animated.Value(0)).current;
  const transPassword = useRef(new Animated.Value(10)).current;
  const fadeLoginBtn = useRef(new Animated.Value(0)).current;
  const transLoginBtn = useRef(new Animated.Value(10)).current;
  const fadeSignupBlock = useRef(new Animated.Value(0)).current;
  const transSignupBlock = useRef(new Animated.Value(10)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => { AsyncStorage.getItem('ui:reduceMotion').then(v => { if (v === '1') setReduceMotion(true); }).catch(()=>{}); }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const seen = await AsyncStorage.getItem('ui:firstAuthAnimSeen');
        if (seen || reduceMotion) {
          fadeLogo.setValue(1); scaleLogo.setValue(1);
          fadeTitle.setValue(1); transTitle.setValue(0);
          fadeTagline.setValue(1); transTagline.setValue(0);
          fadeEmail.setValue(1); transEmail.setValue(0);
            fadePassword.setValue(1); transPassword.setValue(0);
            fadeLoginBtn.setValue(1); transLoginBtn.setValue(0);
            fadeSignupBlock.setValue(1); transSignupBlock.setValue(0);
          return;
        }
        Animated.sequence([
          Animated.parallel([
            Animated.timing(fadeLogo, { toValue: 1, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.spring(scaleLogo, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true, delay: 80 })
          ]),
          Animated.stagger(90, [
            Animated.parallel([
              Animated.timing(fadeTitle, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(transTitle, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(fadeTagline, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(transTagline, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(fadeEmail, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(transEmail, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(fadePassword, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(transPassword, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(fadeLoginBtn, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(transLoginBtn, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(fadeSignupBlock, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(transSignupBlock, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]),
          ])
        ]).start(() => { AsyncStorage.setItem('ui:firstAuthAnimSeen', '1').catch(() => {}); });
      } catch {
        // ignore
      }
    };
    run();
  }, [reduceMotion, fadeLogo, scaleLogo, fadeTitle, transTitle, fadeTagline, transTagline, fadeEmail, transEmail, fadePassword, transPassword, fadeLoginBtn, transLoginBtn, fadeSignupBlock, transSignupBlock]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.authResponse?.accessToken) {
        show('Du er nu logget ind!', 'success');
        router.replace('/');
      } else {
        const msg = result?.errorMessage || 'Login mislykkedes. Tjek dine oplysninger.';
        show(msg, 'error');
      }
    } catch (error: any) {
      console.error('Login error', error);
      show('Login mislykkedes. Tjek dine oplysninger.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleReduceMotion = async () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    try {
      if (next) {
        await AsyncStorage.setItem('ui:reduceMotion', '1');
        // Snap everything fully visible
        [fadeLogo, fadeTitle, fadeTagline, fadeEmail, fadePassword, fadeLoginBtn, fadeSignupBlock].forEach(v => v.setValue(1));
        [transTitle, transTagline, transEmail, transPassword, transLoginBtn, transSignupBlock].forEach(v => v.setValue(0));
        scaleLogo.setValue(1);
      } else {
        await AsyncStorage.removeItem('ui:reduceMotion');
      }
    } catch {}
  };

  if (token) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrapper, { opacity: fadeLogo, transform: [{ scale: scaleLogo }] }]}>        
        <Image
          source={require('../assets/images/logo-dark.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Pantmig logo"
        />
      </Animated.View>
      <Animated.Text style={[styles.title, { opacity: fadeTitle, transform: [{ translateY: transTitle }] }]}>Log ind</Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: fadeTagline, transform: [{ translateY: transTagline }] }]}>Velkommen tilbage</Animated.Text>
      <Animated.View style={{ opacity: fadeEmail, transform: [{ translateY: transEmail }] }}>
        <Text style={styles.webPickerLabel}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email eller brugernavn"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
      </Animated.View>
      <Animated.View style={{ opacity: fadePassword, transform: [{ translateY: transPassword }] }}>
        <Text style={styles.webPickerLabel}>Adgangskode</Text>
        <TextInput
          style={styles.input}
          placeholder="Adgangskode"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </Animated.View>
      <Animated.View style={{ opacity: fadeLoginBtn, transform: [{ translateY: transLoginBtn }] }}>
        <PressableButton title={loading ? 'Logger ind...' : 'Log ind'} onPress={handleLogin} disabled={loading} color="#2563eb" iconName="right-to-bracket" style={styles.button} />
      </Animated.View>
      <Animated.View style={{ height: 34, opacity: fadeSignupBlock, transform: [{ translateY: transSignupBlock }] }} />
      <Animated.View style={{ opacity: fadeSignupBlock, transform: [{ translateY: transSignupBlock }], alignItems: 'center' }}>
        <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>Har du ikke en konto?</Text>
        <PressableButton title="Opret konto" onPress={() => router.push('/register')} color="#6b7280" iconName="user-plus" style={styles.button} />
        <Pressable onPress={toggleReduceMotion} style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 12, color: '#64748b' }}>{reduceMotion ? 'Aktiver animationer' : 'Reducer animationer'}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Merge shared form styles with screen-specific styles
const localStyles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', justifyContent: 'flex-start', width: 480 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  button: { justifyContent: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  logoWrapper: { alignItems: 'center', marginBottom: 8 },
  logo: { width: 120, height: 120 },
  tagline: { fontSize: 14, color: '#64748b', marginBottom: 8 },
});

const styles = { ...formStyles, ...localStyles } as const;
