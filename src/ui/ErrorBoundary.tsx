import { Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { Button } from '@/src/components/ui';

/** Surfaced by Expo Router when a root render throws — show the real stack for device builds. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 24,
        paddingVertical: 48,
        backgroundColor: '#141C16',
      }}
    >
      <Text style={{ color: '#F7F1DF', fontSize: 22, fontWeight: '700' }}>Something went wrong</Text>
      <Text style={{ color: '#F47A68', fontSize: 15, fontWeight: '600' }}>{error.message}</Text>
      <Text
        selectable
        style={{ color: 'rgba(247,241,223,0.75)', fontSize: 11, lineHeight: 16, fontFamily: 'monospace' }}
      >
        {error.stack ?? 'No stack available'}
      </Text>
      <View style={{ alignSelf: 'flex-start', marginTop: 8 }}>
        <Button onPress={retry}>Try again</Button>
      </View>
    </View>
  );
}
