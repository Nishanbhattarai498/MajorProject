import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function EntryScreen() {
  const { account, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}><ActivityIndicator color={colors.lime} /></View>;
  return <Redirect href={account ? '/(tabs)' : '/(auth)/login'} />;
}