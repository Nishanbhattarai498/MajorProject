import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Brain, ChevronRight, CircleAlert, ScanLine, ShieldCheck, Sparkles } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { BrandHeader } from '@/components/BrandHeader';
import { classDescriptions } from '@/lib/classes';
import { getRecentPredictions, formatClassName, formatPercent, type Prediction } from '@/lib/api';
import { colors, font } from '@/lib/theme';

export default function HomeScreen() {
  const [recent, setRecent] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentError, setRecentError] = useState(false);

  useEffect(() => {
    getRecentPredictions(1)
      .then(({ predictions }) => setRecent(predictions))
      .catch(() => setRecentError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppScreen>
      <BrandHeader />
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroArtwork}>
          <View style={styles.orbitOuter} />
          <View style={styles.orbitInner} />
          <View style={styles.brainMark}><Brain size={40} color={colors.lime} strokeWidth={1.4} /></View>
          <View style={styles.orbitDot} />
        </View>
        <View style={styles.heroEyebrow}>
          <View style={styles.liveDot} />
          <Text style={styles.eyebrowText}>MRI CLASSIFICATION</Text>
          <View style={styles.researchPill}><Sparkles size={11} color={colors.mint} /><Text style={styles.researchText}>RESEARCH</Text></View>
        </View>
        <Text style={styles.heroTitle}>A clearer view{ '\n' }of the scan.</Text>
        <Text style={styles.heroBody}>Explore brain MRI predictions and the visual explanations behind them.</Text>
        <Pressable onPress={() => router.push('/(tabs)/classify')} style={styles.primaryButton}>
          <ScanLine size={19} color={colors.background} /><Text style={styles.primaryText}>Analyze an image</Text><ArrowRight size={18} color={colors.background} />
        </Pressable>
      </View>
      <Text style={styles.buttonHint}>JPEG · PNG · WEBP  /  UP TO 8 MB</Text>

      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Workspace</Text><Text style={styles.sectionMeta}>MODEL OUTPUTS</Text></View>
      <View style={styles.metricsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore explanations for four classification labels"
          onPress={() => router.push('/classes')}
          style={({ pressed }) => [styles.metric, pressed && styles.metricPressed]}
        >
          <View style={styles.metricIcon}><Brain size={18} color={colors.mint} /></View>
          <Text style={styles.metricValue}>04</Text>
          <View style={styles.metricLabelRow}><Text style={styles.metricLabel}>CLASS LABELS</Text><ChevronRight size={13} color={colors.mint} /></View>
          <Text style={styles.metricHint}>TAP TO EXPLORE</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Learn how to read the Grad-CAM heatmap"
          onPress={() => router.push('/heatmap')}
          style={({ pressed }) => [styles.metric, pressed && styles.metricPressed]}
        >
          <View style={styles.metricIcon}><ScanLine size={18} color={colors.lime} /></View>
          <Text style={styles.metricValue}>CAM</Text>
          <View style={styles.metricLabelRow}><Text style={styles.metricLabel}>HEATMAP VIEW</Text><ChevronRight size={13} color={colors.mint} /></View>
          <Text style={styles.metricHint}>TAP TO LEARN</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Latest analysis</Text><Pressable onPress={() => router.push('/(tabs)/history')} style={styles.link}><Text style={styles.linkText}>All scans</Text><ChevronRight size={15} color={colors.lime} /></Pressable></View>
      {loading ? <ActivityIndicator color={colors.lime} style={{ alignSelf: 'flex-start' }} /> : recentError ? (
        <View style={styles.emptyRecent}><Text style={styles.emptyText}>Couldn’t load your latest analysis. Check your connection or open history to try again.</Text></View>
      ) : recent[0] ? (
        <Pressable onPress={() => router.push(`/result/${recent[0]._id}`)} style={styles.recentRow}>
          <View style={styles.recentMark}><Brain size={19} color={colors.lime} /></View>
          <View style={{ flex: 1 }}><Text style={styles.recentName}>{formatClassName(recent[0].predictedClass)}</Text><Text style={styles.recentDate}>{new Date(recent[0].createdAt).toLocaleDateString()}</Text></View>
          <Text style={styles.recentConfidence}>{formatPercent(recent[0].confidence)}</Text>
        </Pressable>
      ) : <View style={styles.emptyRecent}><Text style={styles.emptyText}>Your recent analyses will appear here.</Text></View>}

      <View style={styles.notice}>
        <ShieldCheck size={18} color={colors.amber} />
        <View style={{ flex: 1 }}><Text style={styles.noticeTitle}>For research and education</Text><Text style={styles.noticeBody}>This model is not a medical device. Results are not a diagnosis.</Text></View>
        <CircleAlert size={16} color={colors.subtle} />
      </View>

    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroArtwork: { position: 'absolute', width: 166, height: 166, right: -27, top: 16, alignItems: 'center', justifyContent: 'center' },
  orbitOuter: { position: 'absolute', width: 148, height: 148, borderRadius: 74, borderWidth: 1, borderColor: 'rgba(123,224,192,0.16)' },
  orbitInner: { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 1, borderColor: 'rgba(213,244,122,0.22)' },
  brainMark: { width: 72, height: 72, borderRadius: 25, backgroundColor: 'rgba(213,244,122,0.08)', borderWidth: 1, borderColor: 'rgba(213,244,122,0.18)', alignItems: 'center', justifyContent: 'center' },
  orbitDot: { position: 'absolute', right: 23, top: 37, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 21 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.mint },
  eyebrowText: { fontFamily: font.semibold, color: colors.muted, fontSize: 9, letterSpacing: 1 },
  researchPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(123,224,192,0.18)', backgroundColor: 'rgba(123,224,192,0.07)', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 9, marginLeft: 2 },
  researchText: { fontFamily: font.semibold, color: colors.mint, fontSize: 8, letterSpacing: 0.7 },
  hero: { padding: 19, paddingTop: 18, paddingBottom: 17, backgroundColor: '#12211F', borderRadius: 22, borderWidth: 1, borderColor: '#29413C', overflow: 'hidden', marginTop: 9 },
  heroTitle: { fontFamily: font.display, color: colors.text, fontSize: 36, lineHeight: 41, maxWidth: 260 },
  heroBody: { color: colors.muted, fontFamily: font.body, fontSize: 13, lineHeight: 20, marginTop: 10, maxWidth: 270 },
  primaryButton: { backgroundColor: colors.lime, height: 55, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, marginTop: 22 },
  primaryText: { color: colors.background, fontFamily: font.semibold, fontSize: 15, flex: 1, marginLeft: 11 },
  buttonHint: { textAlign: 'center', marginTop: -14, color: colors.subtle, fontFamily: font.medium, fontSize: 9, letterSpacing: 1.1 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  sectionTitle: { color: colors.text, fontFamily: font.display, fontSize: 19 },
  sectionMeta: { color: colors.subtle, fontFamily: font.semibold, fontSize: 9, letterSpacing: 1.1 },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 15, minHeight: 119 },
  metricPressed: { opacity: 0.78, borderColor: colors.mint },
  metricIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  metricValue: { color: colors.text, fontFamily: font.display, fontSize: 24, marginTop: 9 },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricLabel: { color: colors.muted, fontFamily: font.medium, fontSize: 9, letterSpacing: 1 },
  metricHint: { color: colors.subtle, fontFamily: font.semibold, fontSize: 8, letterSpacing: 0.8, marginTop: 5 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { color: colors.lime, fontFamily: font.medium, fontSize: 12 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16 },
  recentMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  recentName: { color: colors.text, fontFamily: font.semibold, fontSize: 14 },
  recentDate: { color: colors.muted, fontFamily: font.body, fontSize: 11, marginTop: 3 },
  recentConfidence: { color: colors.mint, fontFamily: font.display, fontSize: 16 },
  emptyRecent: { borderRadius: 15, borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed', padding: 16 },
  emptyText: { color: colors.muted, fontFamily: font.body, fontSize: 13 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: '#1C201B', borderRadius: 15, padding: 14, marginTop: 2 },
  noticeTitle: { color: colors.text, fontFamily: font.semibold, fontSize: 12 },
  noticeBody: { color: colors.muted, fontFamily: font.body, fontSize: 11, lineHeight: 16, marginTop: 3 },
});