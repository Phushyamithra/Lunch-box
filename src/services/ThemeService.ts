import type { ResolvedThemeMode, ThemeMode } from '../models';
import { storageService } from './StorageService';

/** Resolves the user preference against the OS preference. */
export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedThemeMode {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

export const themeService = {
  async getMode(): Promise<ThemeMode> {
    return (await storageService.getThemeMode()) ?? 'system';
  },
  saveMode(mode: ThemeMode): Promise<void> {
    return storageService.saveThemeMode(mode);
  },
};
