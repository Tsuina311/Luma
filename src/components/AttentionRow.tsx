import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AttentionItem } from '@/src/domain/shared';
import { urgencyColor, useTheme } from '@/src/ui/theme';

const urgencyLabel = {
  red: 'Critical',
  orange: 'Needs attention',
  yellow: 'Upcoming',
  green: 'On track',
};

export function AttentionRow({ item, onPress }: { item: AttentionItem; onPress: () => void }) {
  const theme = useTheme();
  const color = urgencyColor(theme, item.urgency);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${urgencyLabel[item.urgency]}. ${item.subtitle}`}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && styles.pressed]}
    >
      <View style={[styles.signal, { borderColor: color }]}>
        <Text style={[styles.signalText, { color }]}>{item.icon}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{item.subtitle}</Text>
      </View>
      <Text style={[styles.chevron, { color: theme.textMuted }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  signal: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  signalText: { fontSize: 15, fontWeight: '900' },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 15 },
  chevron: { fontSize: 28, fontWeight: '300' },
  pressed: { opacity: 0.58 },
});
