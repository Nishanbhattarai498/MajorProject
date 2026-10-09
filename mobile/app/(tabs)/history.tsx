import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AlertCircle, ArrowUpRight, Brain, Clock3, RotateCw } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { BrandHeader } from '@/components/BrandHeader';
import { getRecentPredictions, formatClassName, formatPercent, type Prediction } from '@/lib/api';
import { colors, font } from '@/lib/theme';

export default function HistoryScreen() {
  const [items, setItems] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { setItems((await getRecentPredictions(50)).predictions); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load history.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <AppScreen>
      <BrandHeader />
      <View style={styles.heading}><View><Text style={styles.kicker}>YOUR WORKSPACE</Text><Text style={styles.title}>Scan history</Text></View><View style={styles.count}><Text style={styles.countText}>{items.length.toString().padStart(2, '0')}</Text></View></View>
      <Text style={styles.subtitle}>Saved analyses and their model outputs.</Text>
      {loading ? <ActivityIndicator color={colors.lime} style={{ marginTop: 25 }} /> : error ? (
        <View style={styles.empty}><AlertCircle size={23} color={colors.coral} /><Text style={styles.emptyTitle}>History unavailable</Text><Text style={styles.emptyText}>{error}</Text><Pressable onPress={() => { setLoading(true); load(); }} style={styles.retry}><RotateCw size={15} color={colors.lime} /><Text style={styles.retryText}>Try again</Text></Pressable></View>
      ) : items.length ? (
        <FlatList
          data={items}
          scrollEnabled={false}
          keyExtractor={(item) => item._id}
          ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); load(); }} tintColor={colors.lime} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/result/${item._id}`)} style={styles.row}>
              <View style={styles.rowIcon}><Brain size={19} color={colors.mint} /></View>
              <View style={styles.rowContent}><Text style={styles.className}>{formatClassName(item.predictedClass)}</Text><Text style={styles.date}><Clock3 size={11} color={colors.subtle} /> {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text></View>
              <View style={styles.result}><Text style={styles.confidence}>{formatPercent(item.confidence)}</Text><ArrowUpRight size={15} color={colors.subtle} /></View>
            </Pressable>
          )}
        />
      ) : <View style={styles.empty}><Brain size={26} color={colors.subtle} /><Text style={styles.emptyTitle}>No analyses yet</Text><Text style={styles.emptyText}>New scan results will be saved here.</Text></View>}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  kicker: { color: colors.mint, fontFamily: font.semibold, fontSize: 10, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 30, marginTop: 3 },
  count: { width: 45, height: 45, borderRadius: 15, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.lime, fontFamily: font.display, fontSize: 16 },
  subtitle: { color: colors.muted, fontFamily: font.body, fontSize: 13, marginTop: -13 },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  rowContent: { flex: 1, gap: 5 },
  className: { color: colors.text, fontFamily: font.semibold, fontSize: 14 },
  date: { color: colors.subtle, fontFamily: font.body, fontSize: 10, flexDirection: 'row' },
  result: { alignItems: 'flex-end', gap: 5 },
  confidence: { color: colors.mint, fontFamily: font.display, fontSize: 15 },
  empty: { alignItems: 'center', paddingVertical: 45, paddingHorizontal: 22, gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontFamily: font.semibold, fontSize: 15, marginTop: 2 },
  emptyText: { color: colors.muted, fontFamily: font.body, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 8 },
  retryText: { color: colors.lime, fontFamily: font.medium, fontSize: 12 },
});