import { Text, View } from 'react-native';
import type { AttentionItem } from '@/src/domain/shared';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Pressable } from '@/components/ui/pressable';

const urgencyLabel = {
  red: 'Critical',
  orange: 'Needs attention',
  yellow: 'Upcoming',
  green: 'On track',
};

const urgencyClasses = {
  red: { rail: 'bg-urgency-red', signal: 'bg-urgency-red/10', text: 'text-urgency-red' },
  orange: { rail: 'bg-urgency-orange', signal: 'bg-urgency-orange/10', text: 'text-urgency-orange' },
  yellow: { rail: 'bg-urgency-yellow', signal: 'bg-urgency-yellow/10', text: 'text-urgency-yellow' },
  green: { rail: 'bg-urgency-green', signal: 'bg-urgency-green/10', text: 'text-urgency-green' },
};

export function AttentionRow({ item, onPress }: { item: AttentionItem; onPress: () => void }) {
  const colors = urgencyClasses[item.urgency];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${urgencyLabel[item.urgency]}. ${item.subtitle}`}
      className="active:opacity-70"
    >
      <Card className="relative min-h-24 flex-row items-center gap-4 overflow-hidden rounded-3xl border-border bg-card px-4 py-4 shadow-sm">
        <View className={`absolute bottom-0 left-0 top-0 w-1.5 ${colors.rail}`} />
        <View className={`ml-1 h-12 w-12 items-center justify-center rounded-2xl ${colors.signal}`}>
          <Text className={`text-base font-black ${colors.text}`}>{item.icon}</Text>
        </View>
        <View className="flex-1 gap-1.5">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-[17px] font-bold tracking-tight text-foreground" numberOfLines={2}>
              {item.title}
            </Text>
            <Badge variant="secondary" className="rounded-full px-2.5 py-1">
              <BadgeText className={`text-[10px] font-bold ${colors.text}`}>
                {urgencyLabel[item.urgency]}
              </BadgeText>
            </Badge>
          </View>
          <Text className="text-sm font-medium text-muted-foreground">{item.subtitle}</Text>
        </View>
        <Text className="text-2xl font-light text-muted-foreground">›</Text>
      </Card>
    </Pressable>
  );
}
