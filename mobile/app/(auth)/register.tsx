import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { ArrowLeft, CircleAlert, MoveRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { colors, font } from '@/lib/theme';

export default function RegisterScreen() {
  const { authenticate } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true); setError('');
    try { await authenticate(email.trim(), password, true); router.replace('/(tabs)'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create your account.'); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Link href="/(auth)/login" asChild><Pressable style={styles.back}><ArrowLeft size={18} color={colors.text} /><Text style={styles.backText}>Sign in</Text></Pressable></Link>
      <View style={styles.intro}><Text style={styles.kicker}>A PRIVATE WORKSPACE</Text><Text style={styles.title}>Create your{ '\n' }account.</Text><Text style={styles.subtitle}>Your analysis history is visible only to your account.</Text></View>
      <View style={styles.form}><Text style={styles.label}>EMAIL</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.subtle} style={styles.input} /><Text style={styles.label}>PASSWORD</Text><TextInput value={password} onChangeText={setPassword} autoComplete="new-password" secureTextEntry placeholder="At least 10 characters" placeholderTextColor={colors.subtle} style={styles.input} />
        {error ? <View style={styles.error}><CircleAlert size={16} color={colors.coral} /><Text style={styles.errorText}>{error}</Text></View> : null}
        <Pressable onPress={submit} disabled={busy || !email || password.length < 10} style={[styles.submit, (busy || !email || password.length < 10) && styles.disabled]}>{busy ? <ActivityIndicator color={colors.background} /> : <><Text style={styles.submitText}>Create account</Text><MoveRight size={18} color={colors.background} /></>}</Pressable>
      </View>
      <Text style={styles.disclaimer}>By continuing, you understand that this tool is not a medical device.</Text>
    </KeyboardAvoidingView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: 24, justifyContent: 'space-between', paddingTop: 22, paddingBottom: 30 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40 },
  backText: { color: colors.text, fontFamily: font.medium, fontSize: 13 },
  intro: { gap: 8, marginTop: 25 },
  kicker: { color: colors.mint, fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.2 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 39, lineHeight: 44 },
  subtitle: { color: colors.muted, fontFamily: font.body, fontSize: 14, lineHeight: 20 },
  form: { gap: 10 },
  label: { color: colors.muted, fontFamily: font.semibold, fontSize: 9, letterSpacing: 1.1, marginTop: 7 },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 14, color: colors.text, fontFamily: font.body, fontSize: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#2A1C1B', borderRadius: 12, padding: 11, marginTop: 3 },
  errorText: { color: colors.coral, fontFamily: font.medium, fontSize: 11, flex: 1 },
  submit: { height: 53, marginTop: 7, borderRadius: 15, backgroundColor: colors.lime, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 17 },
  submitText: { color: colors.background, fontFamily: font.semibold, fontSize: 14 },
  disabled: { opacity: 0.45 },
  disclaimer: { textAlign: 'center', color: colors.subtle, fontFamily: font.body, fontSize: 10, lineHeight: 15 },
});