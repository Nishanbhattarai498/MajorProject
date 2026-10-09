import { Brain, Settings2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, font } from '@/lib/theme';

export function BrandHeader() {
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <View style={styles.mark}><Brain size={19} color={colors.background} strokeWidth={2.2} /></View>
        <View>
          <Text style={styles.name}>NEUROSCOPE</Text>
          <Text style={styles.caption}>IMAGING WORKSPACE</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open information" onPress={() => router.push('/(tabs)/about')} style={styles.iconButton}>
        <Settings2 size={19} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  mark: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontFamily: font.bold, fontSize: 13, letterSpacing: 1.1 },
  caption: { color: colors.muted, fontFamily: font.medium, fontSize: 9, marginTop: 2, letterSpacing: 1 },
  iconButton: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
});