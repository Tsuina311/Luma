import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/ui/theme';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const theme = useTheme();
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['bottom']}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{children}</Text>;
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          { color: theme.text, borderColor: error ? theme.red : theme.border, backgroundColor: theme.surface },
          props.multiline && styles.multiline,
        ]}
      />
      {error ? <Text style={[styles.error, { color: theme.red }]}>{error}</Text> : null}
    </View>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: PressableProps & { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger' }) {
  const theme = useTheme();
  const background = variant === 'primary'
    ? theme.primary
    : variant === 'danger'
      ? theme.dangerSurface
      : theme.surface;
  const color = variant === 'primary' ? theme.primaryText : variant === 'danger' ? theme.red : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: variant === 'secondary' ? theme.border : background },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, { color }]}>{children}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: theme.textMuted }]}>{message}</Text>
      {action}
    </View>
  );
}

export function LoadingState() {
  const theme = useTheme();
  return <ActivityIndicator style={styles.loader} size="large" color={theme.primary} />;
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <EmptyState title="Something went wrong" message={message} action={<Button onPress={retry}>Try again</Button>} />;
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: 20, gap: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 6 },
  field: { gap: 7 },
  label: { fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 48 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  error: { fontSize: 13 },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  empty: { flex: 1, minHeight: 280, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  emptyMessage: { fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 8 },
  loader: { flex: 1, minHeight: 240 },
  divider: { height: StyleSheet.hairlineWidth },
});
