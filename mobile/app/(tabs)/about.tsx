import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Database, Eye, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { BrandHeader } from '@/components/BrandHeader';
import { colors, font } from '@/lib/theme';
import { useAuth } from '@/lib/auth';

const items = [
  { icon: Eye, title: 'What the output means', body: 'The class score reflects the model’s relative confidence among four labels. It is not the probability that a person has a condition.' },
  { icon: ShieldAlert, title: 'Grad-CAM limits', body: 'The heatmap highlights image regions that influenced this model output. It does not show a tumor boundary or prove clinical relevance.' },
  { icon: Database, title: 'Saved scan data', body: 'Images and results are saved to the configured MongoDB service so they can appear in your history. Remove an entry from its result page to delete it.' },
];

export default function AboutScreen() {
  const { account, signOut } = useAuth();
  return (
    <AppScreen>
      <BrandHeader />
      <View style={styles.titleBlock}><Text style={styles.kicker}>IMPORTANT INFORMATION</Text><Text style={styles.title}>Built to explore.{ '\n' }Not to diagnose.</Text><Text style={styles.subtitle}>NeuroScope is an educational interface for a research image classifier.</Text></View>
      <View style={styles.warning}><ShieldCheck size={22} color={colors.amber} /><View style={{ flex: 1 }}><Text style={styles.warningTitle}>Not for medical decisions</Text><Text style={styles.warningBody}>Do not use this app to diagnose, rule out, or treat a medical condition. Consult a qualified medical professional.</Text></View></View>
      <View style={styles.information}>{items.map(({ icon: Icon, title, body }) => <View key={title} style={styles.infoRow}><View style={styles.icon}><Icon size={18} color={colors.mint} /></View><View style={{ flex: 1, gap: 5 }}><Text style={styles.infoTitle}>{title}</Text><Text style={styles.infoBody}>{body}</Text></View></View>)}</View>
      <View style={styles.model}><Text style={styles.modelLabel}>CURRENT CLASS LABELS</Text><Text style={styles.modelClasses}>Glioma · Meningioma · No tumor · Pituitary</Text><Text style={styles.modelCaption}>Dataset categories; not clinical conclusions.</Text></View>
      <View style={styles.account}><Text style={styles.accountLabel}>SIGNED IN AS</Text><Text style={styles.accountEmail}>{account?.email}</Text></View>
      <Pressable onPress={async () => { await signOut(); router.replace('/(auth)/login'); }} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
      <Pressable onPress={() => router.push('/(tabs)/classify')} style={styles.action}><Text style={styles.actionText}>Continue to image analysis</Text><ArrowRight size={17} color={colors.lime} /></Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: 7, marginTop: 10 },
  kicker: { color: colors.mint, fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.2 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 31, lineHeight: 36 },
  subtitle: { color: colors.muted, fontFamily: font.body, fontSize: 13, lineHeight: 20, marginTop: 2 },
  warning: { flexDirection: 'row', gap: 12, backgroundColor: '#211F18', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#40392B' },
  warningTitle: { color: colors.amber, fontFamily: font.semibold, fontSize: 14 },
  warningBody: { color: '#C3B9A5', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 5 },
  information: { gap: 17 },
  infoRow: { flexDirection: 'row', gap: 12 },
  icon: { width: 37, height: 37, backgroundColor: colors.surfaceRaised, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { color: colors.text, fontFamily: font.semibold, fontSize: 13 },
  infoBody: { color: colors.muted, fontFamily: font.body, fontSize: 12, lineHeight: 18 },
  model: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 15, borderRadius: 15, gap: 6 },
  modelLabel: { color: colors.subtle, fontFamily: font.semibold, fontSize: 9, letterSpacing: 1.1 },
  modelClasses: { color: colors.text, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  modelCaption: { color: colors.muted, fontFamily: font.body, fontSize: 11 },
  action: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  actionText: { color: colors.lime, fontFamily: font.semibold, fontSize: 13 },
  account: { gap: 4 },
  accountLabel: { color: colors.subtle, fontFamily: font.semibold, fontSize: 9, letterSpacing: 1.1 },
  accountEmail: { color: colors.muted, fontFamily: font.body, fontSize: 12 },
  signOut: { alignSelf: 'flex-start', paddingVertical: 2 },
  signOutText: { color: colors.coral, fontFamily: font.medium, fontSize: 12 },
});