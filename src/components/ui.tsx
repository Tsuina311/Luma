import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button as GSButton, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider as GSDivider } from '@/components/ui/divider';
import { Input, InputField } from '@/components/ui/input';
import { ScrollView } from '@/components/ui/scroll-view';
import { useTheme } from '@/src/ui/theme';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const content = (
    <View className="flex-1 gap-5 px-5 pb-10 pt-5 web:mx-auto web:w-full web:max-w-3xl">
      {children}
    </View>
  );
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow">
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return (
    <Text className="mt-1 text-xs font-bold uppercase tracking-[1.8px] text-muted-foreground">
      {children}
    </Text>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">{label}</Text>
      {props.multiline ? (
        <TextInput
          {...props}
          className={`min-h-28 rounded-2xl border bg-card px-4 py-3 text-base text-foreground web:outline-none ${
            error ? 'border-destructive' : 'border-border'
          }`}
          placeholderTextColor="#888196"
          textAlignVertical="top"
        />
      ) : (
        <Input className={`min-h-13 rounded-2xl bg-card px-1 shadow-sm ${error ? 'border-destructive' : 'border-border'}`}>
          <InputField
            {...props}
            className="px-3 text-base text-foreground"
            placeholderTextColor="#888196"
          />
        </Input>
      )}
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </View>
  );
}

export function Button({
  children,
  variant = 'primary',
  onPress,
  disabled,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  onPress?: () => void;
  disabled?: boolean;
}) {
  const gsVariant = variant === 'primary' ? 'default' : variant === 'danger' ? 'destructive' : 'outline';
  return (
    <GSButton
      variant={gsVariant}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 rounded-2xl px-5 shadow-sm ${variant === 'primary' ? 'shadow-primary/20' : ''}`}
    >
      <ButtonText className="text-[15px] font-bold">{children}</ButtonText>
    </GSButton>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <Card className="my-3 min-h-64 items-center justify-center gap-3 rounded-3xl border-border bg-card p-8 shadow-sm">
      <View className="mb-1 h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <Text className="text-2xl text-primary">✦</Text>
      </View>
      <Text className="text-center text-2xl font-bold tracking-tight text-foreground">{title}</Text>
      <Text className="mb-2 max-w-sm text-center text-base leading-6 text-muted-foreground">{message}</Text>
      {action}
    </Card>
  );
}

export function LoadingState() {
  const theme = useTheme();
  return (
    <View className="min-h-64 flex-1 items-center justify-center">
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <EmptyState title="Something went wrong" message={message} action={<Button onPress={retry}>Try again</Button>} />;
}

export function Divider() {
  return <GSDivider className="bg-border" />;
}
