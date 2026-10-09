import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Info, Trash2 } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { getPrediction, deletePrediction, formatClassName, formatPercent, type Prediction } from '@/lib/api';
import { colors, font } from '@/lib/theme';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPrediction(id).then(setResult).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load result.'));
  }, [id]);

  async function removeResult() {
    if (!id || deleting) return;
    setDeleting(true);
    try { await deletePrediction(id); router.replace('/(tabs)/history'); }
    catch (cause) { Alert.alert('Could not delete', cause instanceof Error ? cause.message : 'Please try again.'); setDeleting(false); }
  }

  if (!result) return <AppScreen><Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={18} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />}</AppScreen>;
  const probabilities = [...result.probabilities].sort((a, b) => b.confidence - a.confidence);

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={18} color={colors.text} /><Text style={styles.backText}>Analysis result</Text><Text style={styles.date}>{new Date(result.createdAt).toLocaleDateString()}</Text></Pressable>
      <View style={styles.resultHeader}><View style={styles.success}><Check size={14} color={colors.background} /></View><Text style={styles.kicker}>MODEL PREDICTION</Text><Text style={styles.className}>{formatClassName(result.predictedClass)}</Text><Text style={styles.confidence}>{formatPercent(result.confidence)}<Text style={styles.confidenceLabel}> confidence</Text></Text></View>

      <View style={styles.imageBlock}><View style={styles.imageHeading}><Text style={styles.imageTitle}>Grad-CAM overlay</Text><Text style={styles.imageTag}>PREDICTED CLASS</Text></View><Image source={{ uri: result.gradcamImage }} style={styles.resultImage} resizeMode="contain" /><View style={styles.legend}><View style={styles.legendWarm} /><Text style={styles.legendText}>Higher influence</Text><View style={styles.legendCool} /><Text style={styles.legendText}>Lower influence</Text></View></View>
      <View style={styles.imageBlock}><View style={styles.imageHeading}><Text style={styles.imageTitle}>Source image</Text><Text style={styles.imageTag}>UPLOADED MRI</Text></View><Image source={{ uri: result.originalImage }} style={styles.resultImage} resizeMode="contain" /></View>

      <View style={styles.probabilityBlock}><View style={styles.imageHeading}><Text style={styles.imageTitle}>Class probabilities</Text><Text style={styles.imageTag}>{formatClassName(result.model)}</Text></View>{probabilities.map((item) => <View key={item.className} style={styles.probabilityRow}><View style={styles.probabilityLabel}><Text style={[styles.probabilityName, item.className === result.predictedClass && styles.predictedName]}>{formatClassName(item.className)}</Text><Text style={styles.probabilityValue}>{formatPercent(item.confidence)}</Text></View><View style={styles.track}><View style={[styles.bar, { width: `${Math.max(item.confidence * 100, 1)}%` }, item.className === result.predictedClass && styles.activeBar]} /></View></View>)}</View>

      <View style={styles.caveat}><Info size={16} color={colors.amber} /><Text style={styles.caveatText}>Grad-CAM highlights model influence, not a tumor boundary. This output is not a diagnosis.</Text></View>
      <Pressable onPress={removeResult} disabled={deleting} style={styles.delete}><Trash2 size={16} color={colors.coral} /><Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete saved analysis'}</Text></Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 9 },
  backText: { color: colors.text, fontFamily: font.medium, fontSize: 13 },
  date: { marginLeft: 'auto', color: colors.muted, fontFamily: font.body, fontSize: 11 },
  error: { color: colors.coral, fontFamily: font.body, marginTop: 20 },
  resultHeader: { alignItems: 'center', paddingTop: 7, paddingBottom: 3 },
  success: { width: 27, height: 27, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kicker: { color: colors.muted, fontFamily: font.semibold, fontSize: 9, letterSpacing: 1.3 },
  className: { color: colors.text, fontFamily: font.display, fontSize: 30, textAlign: 'center', marginTop: 3 },
  confidence: { color: colors.mint, fontFamily: font.display, fontSize: 20, marginTop: 2 },
  confidenceLabel: { color: colors.muted, fontFamily: font.body, fontSize: 12 },
  imageBlock: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden' },
  imageHeading: { minHeight: 45, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  imageTitle: { color: colors.text, fontFamily: font.semibold, fontSize: 12 },
  imageTag: { color: colors.subtle, fontFamily: font.semibold, fontSize: 8, letterSpacing: 0.7, maxWidth: '55%' },
  resultImage: { width: '100%', height: 240, backgroundColor: '#050809' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 11 },
  legendWarm: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F28856' },
  legendCool: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5978C6', marginLeft: 8 },
  legendText: { color: colors.muted, fontFamily: font.body, fontSize: 10 },
  probabilityBlock: { gap: 13 },
  probabilityRow: { gap: 7 },
  probabilityLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  probabilityName: { color: colors.muted, fontFamily: font.medium, fontSize: 12 },
  predictedName: { color: colors.text, fontFamily: font.semibold },
  probabilityValue: { color: colors.text, fontFamily: font.semibold, fontSize: 11 },
  track: { height: 6, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4, backgroundColor: '#63716E' },
  activeBar: { backgroundColor: colors.mint },
  caveat: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#211F18', padding: 12, borderRadius: 13 },
  caveatText: { flex: 1, color: '#C3B9A5', fontFamily: font.body, fontSize: 11, lineHeight: 16 },
  delete: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
  deleteText: { color: colors.coral, fontFamily: font.medium, fontSize: 12 },
});