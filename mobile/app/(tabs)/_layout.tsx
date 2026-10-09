import { Tabs } from 'expo-router';
import { Activity, Clock3, ScanLine, ShieldCheck } from 'lucide-react-native';
import { colors, font } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.lime,
      tabBarInactiveTintColor: colors.subtle,
      tabBarStyle: { backgroundColor: '#10191A', borderTopColor: colors.border, height: 86, paddingTop: 11, paddingBottom: 22 },
      tabBarLabelStyle: { fontFamily: font.medium, fontSize: 10 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: ({ color, size }) => <Activity size={size} color={color} /> }} />
      <Tabs.Screen name="classify" options={{ title: 'Analyze', tabBarIcon: ({ color, size }) => <ScanLine size={size} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color, size }) => <Clock3 size={size} color={color} /> }} />
      <Tabs.Screen name="about" options={{ title: 'Safety', tabBarIcon: ({ color, size }) => <ShieldCheck size={size} color={color} /> }} />
    </Tabs>
  );
}