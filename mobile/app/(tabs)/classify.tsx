import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { AlertCircle, ArrowRight, Check, FileImage, ImagePlus, ScanLine, X } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { BrandHeader } from '@/components/BrandHeader';
import { classifyImage } from '@/lib/api';
import { colors, font } from '@/lib/theme';

type SelectedImage = { uri: string; mimeType?: string | null; fileName?: string | null };

export default function ClassifyScreen() {
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function chooseImage() {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled) {
      const asset = result.assets[0];
      setSelected({ uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
    }
  }

  async function analyze() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const prediction = await classifyImage(selected.uri, selected.mimeType, selected.fileName);
      router.push(`/result/${prediction._id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Analysis failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <BrandHeader />
      <View style={styles.titleBlock}><Text style={styles.kicker}>NEW ANALYSIS</Text><Text style={styles.title}>Select an image</Text><Text style={styles.subtitle}>Choose a brain MRI image to classify and generate a Grad-CAM view.</Text></View>
      {selected ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: selected.uri }} style={styles.preview} resizeMode="contain" />
          <Pressable onPress={() => setSelected(null)} accessibilityRole="button" accessibilityLabel="Remove selected image" style={styles.remove}><X size={17} color={colors.text} /></Pressable>
        </View>
      ) : (
        <Pressable onPress={chooseImage} style={styles.dropZone}>
          <View style={styles.uploadMark}><ImagePlus size={25} color={colors.lime} /></View>
          <Text style={styles.dropTitle}>Choose from library</Text>
          <Text style={styles.dropText}>Select a scan image stored on this device</Text>
          <View style={styles.fileTypes}><FileImage size={14} color={colors.muted} /><Text style={styles.fileText}>JPG, PNG, WEBP · MAX 8 MB</Text></View>
        </Pressable>
      )}
      {selected && <Pressable onPress={chooseImage} style={styles.changeButton}><Text style={styles.changeText}>Choose a different image</Text></Pressable>}
      <View style={styles.steps}>
        <View style={styles.step}><View style={styles.stepNumber}><Check size={13} color={colors.mint} /></View><Text style={styles.stepText}>Image stays attached to your saved result</Text></View>
        <View style={styles.step}><View style={styles.stepNumber}><ScanLine size={13} color={colors.mint} /></View><Text style={styles.stepText}>Prediction includes class probabilities and a heatmap</Text></View>
      </View>
      {error ? <View style={styles.error}><AlertCircle size={17} color={colors.coral} /><Text style={styles.errorText}>{error}</Text></View> : null}
      <Pressable disabled={!selected || busy} onPress={analyze} style={[styles.submit, (!selected || busy) && styles.submitDisabled]}>
        {busy ? <ActivityIndicator color={colors.background} /> : <><Text style={styles.submitText}>Run analysis</Text><ArrowRight size={18} color={colors.background} /></>}
      </Pressable>
      <Text style={styles.footnote}>Research and educational use only. Not intended for diagnosis.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: 7, marginTop: 10 },
  kicker: { color: colors.mint, fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.4 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 30 },
  subtitle: { color: colors.muted, fontFamily: font.body, fontSize: 14, lineHeight: 21, maxWidth: 330 },
  dropZone: { minHeight: 244, borderWidth: 1, borderColor: '#3A4C49', borderStyle: 'dashed', borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10191A', padding: 20 },
  uploadMark: { height: 54, width: 54, borderRadius: 18, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  dropTitle: { color: colors.text, fontFamily: font.semibold, fontSize: 16 },
  dropText: { color: colors.muted, fontFamily: font.body, fontSize: 12, marginTop: 5, textAlign: 'center' },
  fileTypes: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18 },
  fileText: { color: colors.subtle, fontFamily: font.semibold, fontSize: 9, letterSpacing: 0.8 },
  previewWrap: { width: '100%', height: 280, borderRadius: 18, overflow: 'hidden', backgroundColor: '#050809', borderWidth: 1, borderColor: colors.border },
  preview: { width: '100%', height: '100%' },
  remove: { position: 'absolute', right: 12, top: 12, backgroundColor: '#152021', width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  changeButton: { alignSelf: 'center', paddingVertical: 2 },
  changeText: { color: colors.mint, fontFamily: font.medium, fontSize: 12 },
  steps: { gap: 13, paddingHorizontal: 3 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  stepNumber: { height: 25, width: 25, borderRadius: 9, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.muted, fontFamily: font.body, fontSize: 12, flex: 1, lineHeight: 18 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#2A1C1B', borderRadius: 12, padding: 12 },
  errorText: { flex: 1, color: colors.coral, fontFamily: font.medium, fontSize: 12 },
  submit: { minHeight: 54, borderRadius: 16, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  submitDisabled: { opacity: 0.42 },
  submitText: { color: colors.background, fontFamily: font.semibold, fontSize: 15 },
  footnote: { textAlign: 'center', color: colors.subtle, fontFamily: font.body, fontSize: 10 },
});