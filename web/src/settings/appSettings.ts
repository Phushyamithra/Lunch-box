import type { ThemeMode } from '../../../src/models';

/**
 * Cross-device UI preferences, stored in Supabase `app_settings`.
 * Only shared UI settings live here — never module data, and never
 * finance records.
 */
export interface AppSettings {
  themeMode: ThemeMode;
}

export const DEFAULT_APP_SETTINGS: AppSettings = { themeMode: 'dark' };

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

/** Accepts anything (remote JSON, old cache) and returns valid settings. */
export function parseAppSettings(raw: unknown): AppSettings {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const themeMode = THEME_MODES.includes(value.themeMode as ThemeMode)
    ? (value.themeMode as ThemeMode)
    : DEFAULT_APP_SETTINGS.themeMode;
  return { themeMode };
}

/** A settings snapshot with the time it was last changed. */
export interface SettingsSnapshot {
  settings: AppSettings;
  updatedAt: string; // ISO timestamp
}

/** Local cache entry; `dirty` = changed on this device but not yet saved. */
export interface CachedSettings extends SettingsSnapshot {
  dirty: boolean;
}

export interface Reconciled {
  snapshot: SettingsSnapshot;
  /** The local copy must be written to the cloud. */
  push: boolean;
}

/**
 * Last-write-wins merge between this device's cache and the cloud row.
 * A local edit only wins if it was never saved AND is newer than the
 * cloud copy, so an offline edit on one device cannot silently override
 * a later change made on another.
 */
export function reconcileSettings(
  local: CachedSettings | null,
  remote: SettingsSnapshot | null,
): Reconciled {
  if (!remote) {
    if (local) return { snapshot: local, push: true };
    return {
      snapshot: { settings: DEFAULT_APP_SETTINGS, updatedAt: new Date(0).toISOString() },
      push: false,
    };
  }
  if (local?.dirty && Date.parse(local.updatedAt) > Date.parse(remote.updatedAt)) {
    return { snapshot: local, push: true };
  }
  return { snapshot: remote, push: false };
}
