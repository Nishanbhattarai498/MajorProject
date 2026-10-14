import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { ArrowLeft, Eye, Info, ShieldCheck } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { colors, font } from '@/lib/theme';

const steps = [
  {
    title: 'Start with the original',
    detail: 'Look at the uploaded MRI first, then compare it with the Grad-CAM overlay. The overlay places the model explanation on top of that same image.',
  },
  {
    title: 'Find the stronger colors',
    detail: 'Warmer colors in this heatmap generally indicate areas with greater relative influence on the selected class score. Cooler colors indicate less relative influence.',
  },
  {
    title: 'Treat it as a clue about the model',
    detail: 'Use the map to ask what image regions may have affected the model output. It does not show a tumor boundary, prove the model is right, or explain clinical significance.',
  },
];

function HeatmapExample({ overlay }: { overlay: boolean }) {
  return (
    <View style={styles.examplePanel}>
      <Svg width="100%" height={92} viewBox="0 0 160 100" accessibilityLabel={overlay ? 'Illustrative brain heatmap overlay' : 'Illustrative grayscale brain image'}>
        <Rect x="0" y="0" width="160" height="100" rx="12" fill="#080D10" />
        <Ellipse cx="80" cy="50" rx="58" ry="39" fill={overlay ? '#39454A' : '#747D80'} stroke="#BAC4C2" strokeWidth="1.5" />
        <Ellipse cx="80" cy="50" rx="49" ry="32" fill={overlay ? '#4D585A' : '#9AA1A0'} opacity="0.86" />
        <Path d="M80 20 C74 32 84 39 78 48 C73 57 85 65 79 79 M54 31 C67 37 64 47 53 52 M108 31 C94 37 97 47 108 52 M48 59 C62 54 69 64 61 72 M112 59 C99 54 92 64 100 72" fill="none" stroke={overlay ? '#737F7E' : '#D4D8D4'} strokeWidth="2" strokeLinecap="round" opacity={overlay ? 0.55 : 0.75} />
        {overlay ? (
          <G>
            <Ellipse cx="63" cy="45" rx="18" ry="13" fill="#1E84DA" opacity="0.48" />
            <Ellipse cx="94" cy="52" rx="22" ry="16" fill="#F3DB38" opacity="0.55" />
            <Ellipse cx="99" cy="49" rx="12" ry="10" fill="#EB7934" opacity="0.68" />
            <Ellipse cx="103" cy="47" rx="6" ry="6" fill="#D63332" opacity="0.78" />
          </G>
        ) : null}
      </Svg>
      <Text style={styles.exampleLabel}>{overlay ? 'HEATMAP OVERLAY' : 'SOURCE IMAGE'}</Text>
    </View>
  );
}

export default function HeatmapScreen() {
  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <ArrowLeft size={18} color={colors.text} />
        <Text style={styles.backText}>Overview</Text>
      </Pressable>

      <View style={styles.intro}>
        <View style={styles.icon}><Eye size={19} color={colors.mint} /></View>
        <Text style={styles.kicker}>VISUAL EXPLANATION</Text>
        <Text style={styles.title}>How to read a heatmap</Text>
        <Text style={styles.subtitle}>Grad-CAM highlights image regions that influenced a model’s selected class score.</Text>
      </View>

      <View style={styles.visualCard}>
        <Text style={styles.cardTitle}>What the overlay looks like</Text>
        <View style={styles.exampleRow}>
          <HeatmapExample overlay={false} />
          <HeatmapExample overlay />
        </View>
        <Text style={styles.caption}>Illustrative example only—not a real scan or model output. A real result uses your uploaded MRI.</Text>
      </View>

      <View style={styles.visualCard}>
        <Text style={styles.cardTitle}>Relative influence color key</Text>
        <Svg width="100%" height={54}>
          <Defs>
            <LinearGradient id="influenceScale" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#2846B8" />
              <Stop offset="0.22" stopColor="#19A7DB" />
              <Stop offset="0.44" stopColor="#32C96A" />
              <Stop offset="0.64" stopColor="#F3E544" />
              <Stop offset="0.82" stopColor="#F49A38" />
              <Stop offset="1" stopColor="#D9362B" />
            </LinearGradient>
          </Defs>
          <Rect x="4" y="12" width="292" height="16" rx="8" fill="url(#influenceScale)" />
        </Svg>
        <View style={styles.scaleLabels}><Text style={styles.scaleLabel}>LESS RELATIVE INFLUENCE</Text><Text style={styles.scaleLabel}>MORE</Text></View>
        <Text style={styles.caption}>The app’s heatmap uses a color ramp to show relative influence. Its colors are not calibrated measurements and can vary with the image.</Text>
      </View>

      <View style={styles.stepsCard}>
        <Text style={styles.cardTitle}>A simple way to review it</Text>
        {steps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.stepIndex}><Text style={styles.stepIndexText}>0{index + 1}</Text></View>
            <View style={styles.stepCopy}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepDetail}>{step.detail}</Text></View>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <Info size={17} color={colors.mint} />
        <Text style={styles.noteText}>Heatmap colors are not the model’s class probabilities. Use the separate probability scores to see how it scored the four dataset labels.</Text>
      </View>

      <View style={styles.warning}>
        <ShieldCheck size={17} color={colors.amber} />
        <Text style={styles.warningText}>Grad-CAM is a limited research visualization, not a tumor outline, medical interpretation, diagnosis, or substitute for review by a qualified professional.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 9 },
  backText: { color: colors.text, fontFamily: font.medium, fontSize: 13 },
  intro: { gap: 8 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  kicker: { color: colors.mint, fontFamily: font.semibold, fontSize: 9, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 28 },
  subtitle: { color: colors.muted, fontFamily: font.body, fontSize: 13, lineHeight: 20 },
  visualCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 17, padding: 15, gap: 8 },
  exampleRow: { flexDirection: 'row', gap: 9 },
  examplePanel: { flex: 1, backgroundColor: '#080D10', borderRadius: 12, overflow: 'hidden', paddingBottom: 8 },
  exampleLabel: { color: colors.muted, fontFamily: font.semibold, fontSize: 8, textAlign: 'center', letterSpacing: 0.6, paddingTop: 3 },
  cardTitle: { color: colors.text, fontFamily: font.semibold, fontSize: 13 },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: { color: colors.muted, fontFamily: font.semibold, fontSize: 8, letterSpacing: 0.6 },
  caption: { color: colors.subtle, fontFamily: font.body, fontSize: 10, lineHeight: 15, marginTop: 3 },
  stepsCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 17, padding: 15, gap: 15 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  stepIndex: { width: 29, height: 29, borderRadius: 10, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepIndexText: { color: colors.lime, fontFamily: font.semibold, fontSize: 9 },
  stepCopy: { flex: 1, gap: 4 },
  stepTitle: { color: colors.text, fontFamily: font.semibold, fontSize: 12 },
  stepDetail: { color: colors.muted, fontFamily: font.body, fontSize: 11, lineHeight: 17 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: colors.surfaceRaised, padding: 13, borderRadius: 14 },
  noteText: { color: colors.muted, fontFamily: font.body, fontSize: 11, lineHeight: 16, flex: 1 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#211F18', padding: 13, borderRadius: 14 },
  warningText: { color: '#C3B9A5', fontFamily: font.body, fontSize: 11, lineHeight: 16, flex: 1 },
});
