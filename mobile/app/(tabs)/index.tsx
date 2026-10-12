import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Brain, ChevronRight, CircleAlert, ScanLine, ShieldCheck, X } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { BrandHeader } from '@/components/BrandHeader';
import { getRecentPredictions, formatClassName, formatPercent, type Prediction } from '@/lib/api';
import { colors, font } from '@/lib/theme';

const classDescriptions = [
  { name: 'Glioma', detail: 'A dataset category for tumors associated with glial cells, which support and surround nerve cells in the brain.' },
  { name: 'Meningioma', detail: 'A dataset category for tumors associated with the meninges, the membranes surrounding the brain and spinal cord.' },
  { name: 'No tumor', detail: 'Images in this dataset category are labeled as not showing a tumor. A model output is not a medical rule-out.' },
  { name: 'Pituitary tumor', detail: 'A dataset category for tumors associated with the pituitary gland, located near the base of the brain.' },
];

export default function HomeScreen() {
  const [recent, setRecent] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [classesVisible, setClassesVisible] = useState(false);

  useEffect(() => {
    getRecentPredictions(1).then(({ predictions }) => setRecent(predictions)).catch(() => setRecent([])).finally(() => setLoading(false));
  }, []);

  return (
    <AppScreen>
      <BrandHeader />
      <View style={styles.eyebrow}><View style={styles.liveDot} /><Text style={styles.eyebrowText}>MRI CLASSIFICATION / GRAD-CAM</Text></View>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>A clearer view{ '\n' }of the scan.</Text>
        <Text style={styles.heroBody}>Explore model predictions and visual explanations for brain MRI images.</Text>
        <Pressable onPress={() => router.push('/(tabs)/classify')} style={styles.primaryButton}>
          <ScanLine size={19} color={colors.background} /><Text style={styles.primaryText}>Analyze an image</Text><ArrowRight size={18} color={colors.background} />
        </Pressable>
        <Text style={styles.buttonHint}>JPEG · PNG · WEBP  /  UP TO 8 MB</Text>
      </View>

      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Workspace</Text><Text style={styles.sectionMeta}>MODEL OUTPUTS</Text></View>
      <View style={styles.metricsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View explanations for the four classification labels"
          onPress={() => setClassesVisible(true)}
          style={({ pressed }) => [styles.metric, pressed && styles.metricPressed]}
        >
          <View style={styles.metricIcon}><Brain size={18} color={colors.mint} /></View>
          <Text style={styles.metricValue}>04</Text>
          <View style={styles.metricLabelRow}><Text style={styles.metricLabel}>CLASS LABELS</Text><ChevronRight size={13} color={colors.mint} /></View>
          <Text style={styles.metricHint}>TAP TO EXPLORE</Text>
        </Pressable>
        <View style={styles.metric}><View style={styles.metricIcon}><ScanLine size={18} color={colors.lime} /></View><Text style={styles.metricValue}>CAM</Text><Text style={styles.metricLabel}>HEATMAP VIEW</Text></View>
      </View>

      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Latest analysis</Text><Pressable onPress={() => router.push('/(tabs)/history')} style={styles.link}><Text style={styles.linkText}>All scans</Text><ChevronRight size={15} color={colors.lime} /></Pressable></View>
      {loading ? <ActivityIndicator color={colors.lime} style={{ alignSelf: 'flex-start' }} /> : recent[0] ? (
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

      <Modal
        animationType="slide"
        transparent
        visible={classesVisible}
        onRequestClose={() => setClassesVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                <Text style={styles.modalKicker}>MODEL LABELS</Text>
                <Text style={styles.modalTitle}>Four dataset classes</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close class explanations"
                onPress={() => setClassesVisible(false)}
                style={styles.closeButton}
              >
                <X size={19} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.classList} showsVerticalScrollIndicator={false}>
              {classDescriptions.map((item, index) => (
                <View key={item.name} style={styles.classCard}>
                  <View style={styles.classIndex}><Text style={styles.classIndexText}>0{index + 1}</Text></View>
                  <View style={styles.classCopy}>
                    <Text style={styles.className}>{item.name}</Text>
                    <Text style={styles.classDetail}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.classDisclaimer}>
              <ShieldCheck size={16} color={colors.amber} />
              <Text style={styles.classDisclaimerText}>These are image-dataset categories, not diagnoses. Model results should not guide medical decisions.</Text>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.mint },
  eyebrowText: { fontFamily: font.semibold, color: colors.muted, fontSize: 10, letterSpacing: 1.1 },
  hero: { paddingTop: 4, paddingBottom: 2 },
  heroTitle: { fontFamily: font.display, color: colors.text, fontSize: 39, lineHeight: 43 },
  heroBody: { color: colors.muted, fontFamily: font.body, fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 310 },
  primaryButton: { backgroundColor: colors.lime, height: 55, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, marginTop: 22 },
  primaryText: { color: colors.background, fontFamily: font.semibold, fontSize: 15, flex: 1, marginLeft: 11 },
  buttonHint: { textAlign: 'center', marginTop: 10, color: colors.subtle, fontFamily: font.medium, fontSize: 9, letterSpacing: 1.1 },
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
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000AA' },
  modalCard: { maxHeight: '88%', backgroundColor: colors.background, borderTopLeftRadius: 25, borderTopRightRadius: 25, borderColor: colors.border, borderWidth: 1, padding: 22, paddingBottom: 30, gap: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalHeading: { gap: 4 },
  modalKicker: { color: colors.mint, fontFamily: font.semibold, fontSize: 9, letterSpacing: 1.3 },
  modalTitle: { color: colors.text, fontFamily: font.display, fontSize: 22 },
  closeButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  classList: { gap: 10, paddingBottom: 2 },
  classCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 13 },
  classIndex: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  classIndexText: { color: colors.mint, fontFamily: font.semibold, fontSize: 10 },
  classCopy: { flex: 1, gap: 5 },
  className: { color: colors.text, fontFamily: font.semibold, fontSize: 14 },
  classDetail: { color: colors.muted, fontFamily: font.body, fontSize: 12, lineHeight: 18 },
  classDisclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#211F18', borderRadius: 13, padding: 12 },
  classDisclaimerText: { flex: 1, color: '#C3B9A5', fontFamily: font.body, fontSize: 11, lineHeight: 16 },
});