import { Screen } from '@/src/components/ui';
import { ConfigurationPanel } from '@/src/features/settings/ConfigurationPanel';

export default function SettingsScreen() {
  return (
    <Screen compact>
      <ConfigurationPanel />
    </Screen>
  );
}
