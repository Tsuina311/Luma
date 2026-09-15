import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

function run(feedback: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  void feedback().catch(() => undefined);
}

export function selectionFeedback() {
  run(() => Haptics.selectionAsync());
}

export function progressFeedback() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function completionFeedback() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function destructiveFeedback() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
