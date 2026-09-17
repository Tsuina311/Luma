import { Screen } from '@/src/components/ui';
import { ConfigurationPanel } from '@/src/features/settings/ConfigurationPanel';
import { selectionFeedback } from '@/src/ui/feedback';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <Screen compact>
      <View className="mb-4 flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => {
            selectionFeedback();
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        >
          <Text className="text-[17px] font-medium text-[#F7F1DF]">‹ Back</Text>
        </Pressable>
        <Text className="text-[17px] font-semibold text-[#F7F1DF]">Settings</Text>
      </View>
      <ConfigurationPanel />
    </Screen>
  );
}
