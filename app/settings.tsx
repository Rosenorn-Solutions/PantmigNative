import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import PressableButton from '../components/PressableButton';
import { useAuth } from './AuthContext';
import { authApi } from './services/api';
import { isEmailTaken } from './services/validators';
import { useToast } from './Toast';
import { formStyles } from './utils/formStyles';
import { isValidEmail } from './utils/validators';

export default function SettingsScreen() {
  const { token, setAuthFromResponse, logout } = useAuth();
  const { show } = useToast();
  const router = useRouter();

  const [showPw, setShowPw] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Change password form state
  const [curPw1, setCurPw1] = useState('');
  const [curPw2, setCurPw2] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  // Change email form state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});

  // Disable account modal
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disableBusy, setDisableBusy] = useState(false);

  if (!token) return <Redirect href="/login" />;

  const validatePw = () => {
    const next: Record<string, string> = {};
    if (!curPw1) next.curPw1 = 'Nuværende adgangskode er påkrævet';
    if (!curPw2) next.curPw2 = 'Gentag adgangskoden';
    if (curPw1 && curPw2 && curPw1 !== curPw2) next.curPw2 = 'Adgangskoderne er ikke ens';
    if (!newPw || newPw.length < 6) next.newPw = 'Ny adgangskode skal være mindst 6 tegn';
    setPwErrors(next);
    return Object.keys(next).length === 0;
  };

  const onChangePassword = async () => {
    if (!validatePw()) return;
    try {
      setBusy('pw');
      const res = await authApi.authChangePassword({ changePasswordRequest: { oldPassword: curPw1, newPassword: newPw } });
      if (res?.success) {
        if (res.authResponse?.accessToken) await setAuthFromResponse(res.authResponse);
        show('Adgangskoden er opdateret', 'success');
        setCurPw1(''); setCurPw2(''); setNewPw(''); setShowPw(false);
      } else {
        const msg = res?.errorMessage || 'Kunne ikke opdatere adgangskoden';
        show(msg, 'error');
      }
    } catch (e) {
      console.error('change-password failed', e);
      show('Kunne ikke opdatere adgangskoden', 'error');
    } finally { setBusy(null); }
  };

  const validateEmail = async () => {
    const next: Record<string, string> = {};
    const e = newEmail.trim();
    if (!e) next.newEmail = 'Email er påkrævet';
    else if (!isValidEmail(e)) next.newEmail = 'Ugyldig email';
    if (!emailPassword) next.emailPassword = 'Adgangskode er påkrævet';
    setEmailErrors(next);
    if (Object.keys(next).length > 0) return false;
    try {
      if (await isEmailTaken(e)) {
        setEmailErrors(prev => ({ ...prev, newEmail: 'Email er allerede i brug' }));
        return false;
      }
    } catch {}
    return true;
  };

  const onChangeEmail = async () => {
    if (!(await validateEmail())) return;
    try {
      setBusy('email');
      const res = await authApi.authChangeEmail({ changeEmailRequest: { newEmail: newEmail.trim(), currentPassword: emailPassword } });
      if (res?.success) {
        show('Vi har sendt en bekræftelsesmail til din nye email.', 'success');
        setShowEmail(false);
        setNewEmail(''); setEmailPassword('');
      } else {
        const msg = res?.errorMessage || 'Kunne ikke opdatere email';
        setEmailErrors(prev => ({ ...prev, newEmail: msg }));
        show(msg, 'error');
      }
    } catch (e) {
      console.error('change-email failed', e);
      show('Kunne ikke opdatere email', 'error');
    } finally { setBusy(null); }
  };

  const onDisableAccount = async () => {
    try {
      setDisableBusy(true);
      const res = await authApi.authDisableAccount({ disableAccountRequest: {} });
      if (res?.success) {
        show('Din konto er deaktiveret', 'success');
        await logout();
        router.replace('/login');
      } else {
        show(res?.errorMessage || 'Kunne ikke deaktivere konto', 'error');
      }
    } catch (e) {
      console.error('disable-account failed', e);
      show('Kunne ikke deaktivere konto', 'error');
    } finally {
      setDisableBusy(false);
      setConfirmDisable(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Brugerindstillinger</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sikkerhed</Text>
        <View style={{ gap: 8 }}>
          <PressableButton
            title={showPw ? 'Skjul password-form' : 'Skift password'}
            onPress={() => setShowPw(s => !s)}
            color="#16a34a"
            iconName="key"
            style={styles.button}
          />
          {showPw ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Nuværende adgangskode</Text>
              <TextInput
                value={curPw1}
                onChangeText={(v) => { setCurPw1(v); if (pwErrors.curPw1) setPwErrors({ ...pwErrors, curPw1: '' }); }}
                secureTextEntry
                style={[formStyles.input, pwErrors.curPw1 ? formStyles.inputError : undefined]}
                placeholder="••••••••"
              />
              {pwErrors.curPw1 ? <Text style={formStyles.errorText}>{pwErrors.curPw1}</Text> : null}

              <Text style={styles.label}>Nuværende adgangskode (gentag)</Text>
              <TextInput
                value={curPw2}
                onChangeText={(v) => { setCurPw2(v); if (pwErrors.curPw2) setPwErrors({ ...pwErrors, curPw2: '' }); }}
                secureTextEntry
                style={[formStyles.input, pwErrors.curPw2 ? formStyles.inputError : undefined]}
                placeholder="••••••••"
              />
              {pwErrors.curPw2 ? <Text style={formStyles.errorText}>{pwErrors.curPw2}</Text> : null}

              <Text style={styles.label}>Ny adgangskode</Text>
              <TextInput
                value={newPw}
                onChangeText={(v) => { setNewPw(v); if (pwErrors.newPw) setPwErrors({ ...pwErrors, newPw: '' }); }}
                secureTextEntry
                style={[formStyles.input, pwErrors.newPw ? formStyles.inputError : undefined]}
                placeholder="Mindst 6 tegn"
              />
              {pwErrors.newPw ? <Text style={formStyles.errorText}>{pwErrors.newPw}</Text> : null}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <PressableButton
                  title={busy === 'pw' ? 'Opdaterer…' : 'Opdater password'}
                  onPress={onChangePassword}
                  color="#2563eb"
                  iconName="floppy-disk"
                  style={styles.button}
                />
                <PressableButton title="Annullér" onPress={() => { setShowPw(false); }} color="#6b7280" iconName="xmark" style={styles.button} />
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Konto</Text>
        <View style={{ gap: 8 }}>
          <PressableButton
            title={showEmail ? 'Skjul email-form' : 'Skift Email'}
            onPress={() => setShowEmail(s => !s)}
            color="#2563eb"
            iconName="envelope"
            style={styles.button}
          />
          <Text style={{ color: '#475569', fontSize: 12 }}>
            Efter ændring skal du bekræfte via mail.
          </Text>
          {showEmail ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Ny email</Text>
              <TextInput
                value={newEmail}
                onChangeText={(v) => { setNewEmail(v); if (emailErrors.newEmail) setEmailErrors({ ...emailErrors, newEmail: '' }); }}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[formStyles.input, emailErrors.newEmail ? formStyles.inputError : undefined]}
                placeholder="name@example.com"
              />
              {emailErrors.newEmail ? <Text style={formStyles.errorText}>{emailErrors.newEmail}</Text> : null}

              <Text style={styles.label}>Nuværende adgangskode</Text>
              <TextInput
                value={emailPassword}
                onChangeText={(v) => { setEmailPassword(v); if (emailErrors.emailPassword) setEmailErrors({ ...emailErrors, emailPassword: '' }); }}
                secureTextEntry
                style={[formStyles.input, emailErrors.emailPassword ? formStyles.inputError : undefined]}
                placeholder="••••••••"
              />
              {emailErrors.emailPassword ? <Text style={formStyles.errorText}>{emailErrors.emailPassword}</Text> : null}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <PressableButton
                  title={busy === 'email' ? 'Opdaterer…' : 'Opdater email'}
                  onPress={onChangeEmail}
                  color="#16a34a"
                  iconName="paper-plane"
                  style={styles.button}
                />
                <PressableButton title="Annullér" onPress={() => { setShowEmail(false); }} color="#6b7280" iconName="xmark" style={styles.button} />
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Farezone</Text>
        <PressableButton
          title="Deaktiver konto"
          onPress={() => setConfirmDisable(true)}
          color="#dc2626"
          iconName="user-slash"
          style={styles.button}
        />
      </View>

      {/* Disable account modal */}
      <Modal visible={confirmDisable} transparent animationType="fade" onRequestClose={() => setConfirmDisable(false)}>
        <View style={modalStyles.overlay}>
          <Pressable style={modalStyles.backdrop} onPress={() => setConfirmDisable(false)} />
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>Deaktiver konto</Text>
            <Text style={modalStyles.message}>Er du sikker?</Text>
            <View style={modalStyles.buttonsRow}>
              <PressableButton title="Tilbage" color="#6b7280" iconName="arrow-left" onPress={() => setConfirmDisable(false)} />
              <PressableButton title={disableBusy ? 'Deaktiverer…' : 'Ja, deaktiver'} color="#dc2626" iconName="circle-minus" onPress={onDisableAccount} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, maxWidth: '100%', alignSelf: 'center', width: 480 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#111827' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 16, backgroundColor: '#fff' },
  label: { fontSize: 12, color: '#444', marginBottom: 6 },
  button: { justifyContent: 'center' },
});

const modalStyles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', zIndex: 50,
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  card: {
    width: '92%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 6, color: '#111827' },
  message: { color: '#374151' },
  buttonsRow: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' },
});
