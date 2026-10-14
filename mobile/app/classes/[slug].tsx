import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { ArrowLeft, Info, ShieldCheck } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { BrainModel3D } from '@/components/BrainModel3D';
import { classDescriptions } from '@/lib/classes';
import { colors, font } from '@/lib/theme';

export default function ClassDetailScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const pathname = usePathname();
  const paramSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const pathSlug = pathname.split('/').filter(Boolean).at(-1);
  const slug = (paramSlug ?? pathSlug ?? '').trim().toLowerCase();
  const classInfo = classDescriptions.find((item) => item.slug === slug);

  if (!classInfo) {
    return (
      <AppScreen>
        <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={18} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>
        <Text style={styles.title}>Class not found</Text>
        <Text style={styles.body}>This class page is not available.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={18} color={colors.text} /><Text style={styles.backText}>All classes</Text></Pressable>
      <View style={styles.hero}>
        <Text style={styles.kicker}>DATASET CLASS</Text>
        <Text style={styles.title}>{classInfo.name}</Text>
        <Text style={styles.subtitle}>{classInfo.shortDescription}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interactive 3D brain model</Text>
        <BrainModel3D marker={classInfo.marker} markerLabel={classInfo.markerLabel} />
        <Text style={styles.body}>{classInfo.diagramCaption}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Anatomy connection</Text>
        <Text style={styles.body}>{classInfo.anatomyName}</Text>
        <Text style={styles.body}>{classInfo.overview}</Text>
      </View>

      <View style={styles.meaningCard}>
        <Info size={17} color={colors.mint} />
        <View style={styles.meaningCopy}>
          <Text style={styles.meaningTitle}>What a model result means</Text>
          <Text style={styles.body}>{classInfo.modelMeaning}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Understand the visual marker</Text>
        <Text style={styles.body}>{classInfo.visualExplanation}</Text>
      </View>

      <View style={styles.imageVsModel}>
        <Text style={styles.meaningTitle}>How this relates to your MRI</Text>
        <Text style={styles.body}>The classifier analyzes the uploaded 2D image. This rotatable 3D brain is a separate teaching illustration: it is not reconstructed from your scan, does not use scan data, and does not show where the model found evidence.</Text>
      </View>

      <View style={styles.facts}>
        {classInfo.facts.map((fact) => (
          <View key={fact.title} style={styles.fact}>
            <Text style={styles.factTitle}>{fact.title}</Text>
            <Text style={styles.factBody}>{fact.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.disclaimer}>
        <ShieldCheck size={17} color={colors.amber} />
        <Text style={styles.disclaimerText}>Educational information only. This app is not a medical device, and its outputs are not diagnoses or medical advice.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 9 },
  backText: { color: colors.text, fontFamily: font.medium, fontSize: 13 },
  hero: { gap: 7, marginTop: 2 },
  kicker: { color: colors.mint, fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 32 },
  subtitle: { color: colors.muted, fontFamily: font.body, fontSize: 14, lineHeight: 21 },
  section: { gap: 10 },
  sectionTitle: { color: colors.text, fontFamily: font.display, fontSize: 19 },
  body: { color: colors.muted, fontFamily: font.body, fontSize: 13, lineHeight: 20, flexShrink: 1 },
  meaningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 },
  meaningCopy: { flex: 1, gap: 6 },
  meaningTitle: { color: colors.text, fontFamily: font.semibold, fontSize: 13 },
  imageVsModel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 15, padding: 14, gap: 7 },
  facts: { gap: 9 },
  fact: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 13, gap: 4 },
  factTitle: { color: colors.mint, fontFamily: font.semibold, fontSize: 10, letterSpacing: 0.7 },
  factBody: { color: colors.text, fontFamily: font.body, fontSize: 12, lineHeight: 18 },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#211F18', padding: 12, borderRadius: 14 },
  disclaimerText: { color: '#C3B9A5', fontFamily: font.body, fontSize: 11, lineHeight: 16, flex: 1 },
});
