import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import type { Manifest } from 'expo-updates';

export type AppReleaseInfo = {
  appVersion: string;
  runtimeVersion: string;
  channel: string;
  source: 'ota' | 'embedded' | 'dev';
  updateId: string | null;
  updateShortId: string | null;
  publishedAt: string | null;
  message: string | null;
  summary: string;
};

function formatPublishedAt(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function readUpdateMessage(manifest: Partial<Manifest>): string | null {
  const record = manifest as Record<string, unknown>;
  const metadata = record.metadata;
  if (metadata && typeof metadata === 'object') {
    const meta = metadata as Record<string, unknown>;
    if (typeof meta.updateMessage === 'string' && meta.updateMessage.trim()) {
      return meta.updateMessage.trim();
    }
    if (typeof meta.message === 'string' && meta.message.trim()) {
      return meta.message.trim();
    }
  }
  return null;
}

export function getAppReleaseInfo(): AppReleaseInfo {
  const appVersion =
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    'unknown';
  const runtimeVersion = Updates.runtimeVersion ?? appVersion;
  const channel = Updates.channel ?? (__DEV__ ? 'dev' : 'unknown');
  const updateId = Updates.updateId;
  const updateShortId = updateId ? updateId.slice(0, 8) : null;
  const publishedAt = formatPublishedAt(Updates.createdAt);
  const message = readUpdateMessage(Updates.manifest);

  let source: AppReleaseInfo['source'] = 'embedded';
  if (__DEV__ && !Updates.isEnabled) source = 'dev';
  else if (!Updates.isEmbeddedLaunch && updateId) source = 'ota';

  const summary = `${appVersion}${
    source === 'ota' && updateShortId
      ? ` · OTA ${updateShortId}`
      : source === 'dev'
        ? ' · dev'
        : source === 'embedded'
          ? ' · embedded'
          : ''
  }`;

  return {
    appVersion,
    runtimeVersion,
    channel,
    source,
    updateId,
    updateShortId,
    publishedAt,
    message,
    summary,
  };
}

export type UpdateCheckOutcome =
  | { status: 'disabled' }
  | { status: 'upToDate' }
  | { status: 'updated'; message: string | null }
  | { status: 'error'; message: string };

/** Check, download, and reload if a newer OTA exists. */
export async function checkAndApplyUpdate(): Promise<UpdateCheckOutcome> {
  if (__DEV__ || !Updates.isEnabled) return { status: 'disabled' };

  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return { status: 'upToDate' };

    const fetched = await Updates.fetchUpdateAsync();
    const message = fetched.isNew
      ? readUpdateMessage(fetched.manifest as Partial<Manifest>)
      : null;
    await Updates.reloadAsync();
    return { status: 'updated', message };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Update check failed.',
    };
  }
}
