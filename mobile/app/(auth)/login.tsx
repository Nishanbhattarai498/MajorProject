import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Link } from 'expo-router';
import { Brain, CircleAlert, MoveRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { colors, font } from '@/lib/theme';

export default function LoginScreen() {
  const { authenticate } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    try { await authenticate(email.trim(), password); router.replace('/(tabs)'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brand}><View style={styles.mark}><Brain size={21} color={colors.background} /></View><Text style={styles.brandName}>NEUROSCOPE</Text></View>
      <View style={styles.intro}><Text style={styles.kicker}>PRIVATE IMAGING WORKSPACE</Text><Text style={styles.title}>Welcome{ '\n' }back.</Text><Text style={styles.subtitle}>Sign in to access your saved analyses.</Text></View>
      <View style={styles.form}><Text style={styles.label}>EMAIL</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.subtle} style={styles.input} /><Text style={styles.label}>PASSWORD</Text><TextInput value={password} onChangeText={setPassword} autoComplete="current-password" secureTextEntry placeholder="Your password" placeholderTextColor={colors.subtle} style={styles.input} />
        {error ? <View style={styles.error}><CircleAlert size={16} color={colors.coral} /><Text style={styles.errorText}>{error}</Text></View> : null}
        <Pressable onPress={submit} disabled={busy || !email || !password} style={[styles.submit, (busy || !email || !password) && styles.disabled]}>{busy ? <ActivityIndicator color={colors.background} /> : <><Text style={styles.submitText}>Sign in</Text><MoveRight size={18} color={colors.background} /></>}</Pressable>
      </View>
      <View style={styles.footer}><Text style={styles.footerText}>New to NeuroScope?</Text><Link href="/(auth)/register" style={styles.link}>Create account</Link></View>
      <Text style={styles.disclaimer}>Educational use only · Not for clinical decisions</Text>
    </KeyboardAvoidingView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: 24, justifyContent: 'space-between', paddingTop: 22, paddingBottom: 30 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { height: 38, width: 38, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: colors.text, fontFamily: font.bold, fontSize: 13, letterSpacing: 1.2 },
  intro: { gap: 8, marginTop: 20 },
  kicker: { color: colors.mint, fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.2 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 43, lineHeight: 48 },
  subtitle: { color: colors.muted, fontFamily: font.body, fontSize: 14 },
  form: { gap: 10 },
  label: { color: colors.muted, fontFamily: font.semibold, fontSize: 9, letterSpacing: 1.1, marginTop: 7 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 14, color: colors.text, fontFamily: font.body, fontSize: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#2A1C1B', borderRadius: 12, padding: 11, marginTop: 3 },
  errorText: { color: colors.coral, fontFamily: font.medium, fontSize: 11, flex: 1 },
  submit: { height: 53, marginTop: 7, borderRadius: 15, backgroundColor: colors.lime, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 17 },
  submitText: { color: colors.background, fontFamily: font.semibold, fontSize: 14 },
  disabled: { opacity: 0.45 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  footerText: { color: colors.muted, fontFamily: font.body, fontSize: 12 },
  link: { color: colors.lime, fontFamily: font.semibold, fontSize: 12 },
  disclaimer: { textAlign: 'center', color: colors.subtle, fontFamily: font.body, fontSize: 10 },
});