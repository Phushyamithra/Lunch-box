import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS, parseAppSettings, reconcileSettings } from './appSettings';

const light = { themeMode: 'light' as const };
const dark = { themeMode: 'dark' as const };

describe('parseAppSettings', () => {
  it('defaults to dark and drops invalid values', () => {
    expect(DEFAULT_APP_SETTINGS.themeMode).toBe('dark');
    expect(parseAppSettings(null)).toEqual({ themeMode: 'dark' });
    expect(parseAppSettings({ themeMode: 'neon', extra: 1 })).toEqual({ themeMode: 'dark' });
    expect(parseAppSettings({ themeMode: 'system' })).toEqual({ themeMode: 'system' });
  });
});

describe('reconcileSettings (last write wins)', () => {
  it('first run with nothing anywhere uses defaults and pushes nothing', () => {
    const r = reconcileSettings(null, null);
    expect(r.snapshot.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(r.push).toBe(false);
  });

  it('creates the cloud row from the local cache when none exists', () => {
    const local = { settings: light, updatedAt: '2026-10-18T10:00:00.000Z', dirty: false };
    expect(reconcileSettings(local, null)).toEqual({ snapshot: local, push: true });
  });

  it('a newer unsaved local edit wins and is pushed', () => {
    const local = { settings: light, updatedAt: '2026-10-18T11:00:00.000Z', dirty: true };
    const remote = { settings: dark, updatedAt: '2026-10-18T10:00:00.000Z' };
    expect(reconcileSettings(local, remote)).toEqual({ snapshot: local, push: true });
  });

  it('a later change from another device beats an older offline edit', () => {
    const local = { settings: light, updatedAt: '2026-10-18T10:00:00.000Z', dirty: true };
    const remote = { settings: dark, updatedAt: '2026-10-18T11:00:00.000Z' };
    expect(reconcileSettings(local, remote)).toEqual({ snapshot: remote, push: false });
  });

  it('a clean local cache always defers to the cloud', () => {
    const local = { settings: light, updatedAt: '2026-10-18T12:00:00.000Z', dirty: false };
    const remote = { settings: dark, updatedAt: '2026-10-18T11:00:00.000Z' };
    expect(reconcileSettings(local, remote)).toEqual({ snapshot: remote, push: false });
  });
});
