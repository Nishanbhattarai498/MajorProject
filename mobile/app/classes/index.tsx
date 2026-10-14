import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Brain, ChevronRight } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { classDescriptions } from '@/lib/classes';
import { colors, font } from '@/lib/theme';

export default function ClassesScreen() {
  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.back}><ChevronRight size={17} color={colors.text} style={styles.backIcon} /><Text style={styles.backText}>Overview</Text></Pressable>
      <View style={styles.intro}>
        <View style={styles.icon}><Brain size={19} color={colors.mint} /></View>
        <Text style={styles.kicker}>MODEL LABELS</Text>
        <Text style={styles.title}>Explore the four classes</Text>
        <Text style={styles.subtitle}>Learn what each training-dataset label represents and what a model result can—and cannot—tell you.</Text>
      </View>
      <View style={styles.list}>
        {classDescriptions.map((item, index) => (
          <Pressable
            key={item.slug}
            accessibilityRole="button"
            onPress={() => router.push(`/classes/${item.slug}`)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.number}><Text style={styles.numberText}>0{index + 1}</Text></View>
            <View style={styles.copy}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.description}>{item.shortDescription}</Text>
            </View>
            <ArrowRight size={17} color={colors.mint} />
          </Pressable>
        ))}
      </View>
      <View style={styles.note}><Text style={styles.noteText}>All four labels are educational dataset categories, not diagnoses.</Text></View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backIcon: { transform: [{ rotate: '180deg' }] },
  backText: { color: colors.text, fontFamily: font.medium, fontSize: 13 },
  intro: { gap: 8 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  kicker: { color: colors.mint, fontFamily: font.semibold, fontSize: 9, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 28 },
  subtitle: { color: colors.muted, fontFamily: font.body, fontSize: 13, lineHeight: 20 },
  list: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 14 },
  cardPressed: { opacity: 0.78, borderColor: colors.mint },
  number: { height: 34, width: 34, borderRadius: 12, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: colors.mint, fontFamily: font.semibold, fontSize: 10 },
  copy: { flex: 1, gap: 4 },
  name: { color: colors.text, fontFamily: font.semibold, fontSize: 14 },
  description: { color: colors.muted, fontFamily: font.body, fontSize: 11, lineHeight: 16 },
  note: { backgroundColor: '#211F18', borderRadius: 14, padding: 13 },
  noteText: { color: '#C3B9A5', fontFamily: font.body, fontSize: 11, lineHeight: 16 },
});
