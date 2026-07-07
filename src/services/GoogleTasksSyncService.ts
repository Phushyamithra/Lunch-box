import { NUTRIENT_META, getCategoryMeta } from '../constants';
import type {
  Meal,
  MealLog,
  SyncSettings,
  SyncStatus,
  TaskListInfo,
} from '../models';
import {
  storageService,
  type LogsByDate,
  type StorageService,
  type StoredSyncToken,
} from './StorageService';

const TASKS_API = 'https://tasks.googleapis.com/tasks/v1';
const USERINFO_API = 'https://www.googleapis.com/oauth2/v3/userinfo';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const REVOKE_ENDPOINT = 'https://accounts.google.com/o/oauth2/revoke';
/** Minimum scopes: manage tasks + read the account email for the UI. */
const SCOPES = 'https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/userinfo.email';
const MEAL_TRACKER_LIST_TITLE = 'Meal Tracker';
const MAX_RETRIES = 2;
/** Refresh the access token this long before it actually expires. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const RECONNECT_HINT =
  'Google session expired — open Settings → Google Tasks Sync and press "Sync now" to reconnect.';

/** Development-only diagnostics (silent in production builds). */
function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) console.debug('[GoogleTasksSync]', ...args);
}

const DEFAULT_SETTINGS: SyncSettings = {
  connected: false,
  accountEmail: null,
  enabled: false,
  taskListId: null,
  taskListTitle: null,
  lastSyncAt: null,
  historyChoiceMade: false,
};

interface GoogleTask {
  id: string;
  title?: string;
}

/**
 * One-way synchronization: extension → Google Tasks → Android devices.
 * The extension is the source of truth; changes made in Google Tasks are
 * never read back into meal data.
 *
 * AUTH DESIGN (see OPERATING_MANUAL.md):
 * - chrome.identity.launchWebAuthFlow, implicit grant, "Web application"
 *   OAuth client. Redirect URI = chrome.identity.getRedirectURL(), never
 *   hardcoded. The manifest "key" pins the extension ID so the redirect
 *   URI can never drift (root cause of redirect_uri_mismatch).
 * - Tokens cached in memory AND storage (popup/window restarts often).
 * - Silent refresh (prompt=none) first; interactive escalation only for
 *   user-initiated actions. Background log syncing fails softly.
 * - Raw Google/Chrome errors are mapped to friendly, actionable messages.
 */
export class GoogleTasksSyncService {
  private status: SyncStatus = 'disconnected';
  private statusMessage = '';
  private settingsCache: SyncSettings | null = null;
  private cachedToken: StoredSyncToken | null = null;

  constructor(private readonly storage: StorageService) {}

  // ---------- Status ----------

  getStatus(): { status: SyncStatus; message: string } {
    return { status: this.status, message: this.statusMessage };
  }

  private setStatus(status: SyncStatus, message = ''): void {
    this.status = status;
    this.statusMessage = message;
  }

  /** Number of meal logs that have a linked Google Task. */
  async getSyncedCount(email: string): Promise<number> {
    return Object.keys(await this.storage.getSyncTaskMap(email)).length;
  }

  // ---------- Settings ----------

  async getSettings(): Promise<SyncSettings> {
    if (!this.settingsCache) {
      this.settingsCache = {
        ...DEFAULT_SETTINGS,
        ...(await this.storage.getSyncSettings()),
      };
      this.status = this.settingsCache.connected ? 'idle' : 'disconnected';
    }
    return this.settingsCache;
  }

  private async saveSettings(patch: Partial<SyncSettings>): Promise<SyncSettings> {
    const next = { ...(await this.getSettings()), ...patch };
    this.settingsCache = next;
    await this.storage.saveSyncSettings(next);
    return next;
  }

  // ---------- Friendly error mapping ----------

  private mapAuthError(raw: string): Error {
    const text = raw.toLowerCase();
    if (text.includes('redirect_uri_mismatch') || text.includes('invalid_request')) {
      return new Error(
        `OAuth configuration error: the redirect URI registered in Google Cloud Console must be exactly ${this.getRedirectUri()} — copy it from Settings → Google Tasks Sync.`,
      );
    }
    if (text.includes('invalid_client')) {
      return new Error(
        'OAuth configuration error: the client ID in manifest.json does not match any OAuth client in Google Cloud Console.',
      );
    }
    if (text.includes('access_denied')) {
      return new Error(
        'Permission denied. If the consent screen is in Testing mode, add your Google account under "Test users" in Google Cloud Console, then try again.',
      );
    }
    if (text.includes('canceled') || text.includes('cancelled') || text.includes('closed by the user')) {
      return new Error('Google sign-in was cancelled.');
    }
    if (text.includes('user interaction required') || text.includes('interaction_required') || text.includes('login_required') || text.includes('consent_required')) {
      return new Error(RECONNECT_HINT);
    }
    if (text.includes('failed to fetch') || text.includes('network')) {
      return new Error('Network unavailable — check your internet connection and try again.');
    }
    return new Error(`Google sign-in failed: ${raw}`);
  }

  private mapApiError(status: number, detail: string): Error {
    if (status === 403 && /has not been used|is disabled/i.test(detail)) {
      return new Error(
        'The Google Tasks API is not enabled for your Cloud project. Enable it at console.cloud.google.com → APIs & Services → Library → "Google Tasks API".',
      );
    }
    if (status === 401) return new Error(RECONNECT_HINT);
    if (status === 403) return new Error('Google denied access to Tasks. Try disconnecting and connecting again.');
    return new Error(`Google Tasks request failed (${status})${detail ? `: ${detail}` : '.'}`);
  }

  // ---------- Authentication ----------

  private get identityAvailable(): boolean {
    return typeof chrome !== 'undefined' && Boolean(chrome.identity?.launchWebAuthFlow);
  }

  /**
   * The exact redirect URI that must be registered in Cloud Console —
   * always generated, never hardcoded.
   */
  getRedirectUri(): string {
    return this.identityAvailable ? chrome.identity.getRedirectURL() : '';
  }

  /** Fails fast with setup guidance when the OAuth client ID is missing. */
  private getClientId(): string {
    const manifest = chrome.runtime.getManifest() as { oauth2?: { client_id?: string } };
    const clientId = manifest.oauth2?.client_id ?? '';
    if (!clientId || clientId.startsWith('YOUR_')) {
      throw new Error(
        'Google Tasks sync needs a one-time setup: create a "Web application" OAuth client in Google Cloud Console with the redirect URI ' +
          `${this.getRedirectUri()} and put its client ID in manifest.json → oauth2.client_id. See OPERATING_MANUAL.md.`,
      );
    }
    return clientId;
  }

  private buildAuthUrl(interactive: boolean): string {
    const params = new URLSearchParams({
      client_id: this.getClientId(),
      response_type: 'token',
      redirect_uri: this.getRedirectUri(),
      scope: SCOPES,
    });
    if (!interactive) params.set('prompt', 'none');
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  /** Runs one launchWebAuthFlow pass and caches the resulting token. */
  private async runAuthFlow(interactive: boolean): Promise<string> {
    devLog('auth start', { interactive, redirectUri: this.getRedirectUri() });
    const url = this.buildAuthUrl(interactive);
    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url, interactive }, (result) => {
        if (chrome.runtime.lastError || !result) {
          reject(this.mapAuthError(chrome.runtime.lastError?.message ?? 'cancelled'));
        } else {
          resolve(result);
        }
      });
    });

    // Access token arrives in the URL fragment (implicit grant).
    const fragment = new URLSearchParams(new URL(responseUrl).hash.replace(/^#/, ''));
    const token = fragment.get('access_token');
    const error = fragment.get('error');
    if (!token) throw this.mapAuthError(error ?? 'no token returned');

    const expiresIn = Number(fragment.get('expires_in') ?? 3600);
    const cached: StoredSyncToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
    this.cachedToken = cached;
    void this.storage.saveSyncToken(cached); // survives popup/window restarts
    devLog('token received', { expiresIn });
    return token;
  }

  /**
   * Returns a valid access token: memory cache → persisted cache → silent
   * flow → (only when the action is user-initiated) interactive flow.
   */
  private async getToken(allowInteractive: boolean): Promise<string> {
    if (!this.identityAvailable) {
      throw new Error('Google sign-in is only available inside the Chrome extension.');
    }
    const now = Date.now();
    if (this.cachedToken && now < this.cachedToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS) {
      return this.cachedToken.token;
    }
    const stored = await this.storage.getSyncToken();
    if (stored && now < stored.expiresAt - TOKEN_EXPIRY_MARGIN_MS) {
      this.cachedToken = stored;
      return stored.token;
    }

    try {
      devLog('token refresh (silent)');
      return await this.runAuthFlow(false);
    } catch (silentError) {
      devLog('silent refresh failed', silentError);
      if (!allowInteractive) throw new Error(RECONNECT_HINT);
      return this.runAuthFlow(true);
    }
  }

  private async clearTokenCaches(): Promise<void> {
    this.cachedToken = null;
    await this.storage.clearSyncToken();
  }

  /**
   * Connect: ALWAYS a fresh interactive authentication (stale tokens and
   * sessions are cleared first), then the account email is captured.
   */
  async connect(): Promise<SyncSettings> {
    await this.clearTokenCaches();
    const token = await this.runAuthFlow(true);

    let accountEmail: string | null = null;
    try {
      const response = await fetch(USERINFO_API, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        accountEmail = ((await response.json()) as { email?: string }).email ?? null;
      }
    } catch {
      /* email display is best-effort */
    }
    devLog('account selected', accountEmail);
    this.setStatus('idle', 'Connected to Google.');
    return this.saveSettings({ connected: true, accountEmail });
  }

  /**
   * Disconnect: revoke the grant, wipe tokens and cached session state,
   * and return settings to a clean "not connected" state.
   */
  async disconnect(): Promise<SyncSettings> {
    const token = this.cachedToken?.token ?? (await this.storage.getSyncToken())?.token;
    if (token) {
      try {
        await fetch(`${REVOKE_ENDPOINT}?token=${token}`);
      } catch {
        /* best-effort revoke */
      }
    }
    await this.clearTokenCaches();
    this.setStatus('disconnected');
    devLog('disconnected');
    return this.saveSettings({ connected: false, enabled: false, accountEmail: null });
  }

  // ---------- HTTP with retry + token refresh ----------

  private async request<T>(
    path: string,
    init: RequestInit = {},
    allowInteractive = false,
    attempt = 0,
  ): Promise<T> {
    const token = await this.getToken(allowInteractive);
    devLog('api call', init.method ?? 'GET', path);
    let response: Response;
    try {
      response = await fetch(`${TASKS_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    } catch {
      throw new Error('Network unavailable — check your internet connection and try again.');
    }

    if (response.status === 401 && attempt < MAX_RETRIES) {
      devLog('401 — clearing token, retrying');
      await this.clearTokenCaches();
      return this.request<T>(path, init, allowInteractive, attempt + 1);
    }
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      return this.request<T>(path, init, allowInteractive, attempt + 1);
    }
    if (!response.ok) {
      let detail = '';
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        detail = body.error?.message ?? '';
      } catch {
        /* non-JSON error body */
      }
      devLog('api error', response.status, detail);
      throw this.mapApiError(response.status, detail);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  // ---------- Task lists (user-initiated → interactive auth allowed) ----------

  async listTaskLists(): Promise<TaskListInfo[]> {
    const data = await this.request<{ items?: { id: string; title: string }[] }>(
      '/users/@me/lists?maxResults=100',
      {},
      true,
    );
    return (data.items ?? []).map(({ id, title }) => ({ id, title }));
  }

  async selectTaskList(list: TaskListInfo): Promise<SyncSettings> {
    return this.saveSettings({ taskListId: list.id, taskListTitle: list.title });
  }

  /** Finds or creates the "Meal Tracker" list and selects it. */
  async ensureMealTrackerList(): Promise<SyncSettings> {
    const lists = await this.listTaskLists();
    const existing = lists.find((l) => l.title === MEAL_TRACKER_LIST_TITLE);
    if (existing) return this.selectTaskList(existing);
    const created = await this.request<{ id: string; title: string }>(
      '/users/@me/lists',
      { method: 'POST', body: JSON.stringify({ title: MEAL_TRACKER_LIST_TITLE }) },
      true,
    );
    return this.selectTaskList({ id: created.id, title: created.title });
  }

  // ---------- Task payload ----------

  private buildTaskPayload(log: MealLog, meal: Meal): Record<string, string> {
    const icon = meal.icon ?? getCategoryMeta(meal.category).emoji;
    const nutritionLines = NUTRIENT_META.map(
      ({ key, label, unit }) => `${label}: ${meal.nutrition?.[key] ?? 0} ${unit}`,
    ).join('\n');
    return {
      title: `${icon} ${meal.name}`,
      notes:
        `Category: ${meal.category}\n${nutritionLines}\n\n` +
        `Logged using Meal Tracker Chrome Extension.\nDate Logged: ${log.date}`,
      status: 'completed',
      completed: `${log.date}T12:00:00.000Z`,
      due: `${log.date}T00:00:00.000Z`,
    };
  }

  // ---------- Log ↔ task synchronization (extension is source of truth) ----------

  /**
   * Creates or updates the completed task for a log. Task ids are stored
   * per log id, so edits update in place and duplicates are impossible.
   * Fire-and-forget safe; background calls never pop auth UI.
   */
  async upsertLogTask(log: MealLog, meal: Meal | undefined, allowInteractive = false): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.connected || !settings.taskListId || !meal) return;

    this.setStatus('syncing');
    try {
      const map = await this.storage.getSyncTaskMap(log.email);
      const payload = this.buildTaskPayload(log, meal);
      const existingId = map[log.id];

      if (existingId) {
        await this.request<GoogleTask>(
          `/lists/${settings.taskListId}/tasks/${existingId}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
          allowInteractive,
        ).catch(async (error: unknown) => {
          // Task deleted remotely (404) — recreate it.
          if (error instanceof Error && error.message.includes('404')) {
            const created = await this.request<GoogleTask>(
              `/lists/${settings.taskListId}/tasks`,
              { method: 'POST', body: JSON.stringify(payload) },
              allowInteractive,
            );
            map[log.id] = created.id;
            await this.storage.saveSyncTaskMap(log.email, map);
            return created;
          }
          throw error;
        });
      } else {
        const created = await this.request<GoogleTask>(
          `/lists/${settings.taskListId}/tasks`,
          { method: 'POST', body: JSON.stringify(payload) },
          allowInteractive,
        );
        map[log.id] = created.id;
        await this.storage.saveSyncTaskMap(log.email, map);
      }
      await this.saveSettings({ lastSyncAt: new Date().toISOString() });
      this.setStatus('idle');
      devLog('sync ok', log.id);
    } catch (error) {
      devLog('sync failed', log.id, error);
      this.setStatus('error', error instanceof Error ? error.message : 'Sync failed.');
    }
  }

  /** Removes the linked task when a meal log is deleted. */
  async deleteLogTask(email: string, logId: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.connected || !settings.taskListId) return;

    this.setStatus('syncing');
    try {
      const map = await this.storage.getSyncTaskMap(email);
      const taskId = map[logId];
      if (taskId) {
        await this.request<void>(`/lists/${settings.taskListId}/tasks/${taskId}`, {
          method: 'DELETE',
        }).catch(() => undefined); // already gone remotely — fine
        delete map[logId];
        await this.storage.saveSyncTaskMap(email, map);
      }
      await this.saveSettings({ lastSyncAt: new Date().toISOString() });
      this.setStatus('idle');
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : 'Sync failed.');
    }
  }

  /**
   * Pushes every given log to Google Tasks ("Sync existing history" /
   * "Sync now"). User-initiated, so it may pop an auth window if needed.
   * Returns the number of logs synced.
   */
  async syncAll(logs: LogsByDate, mealById: Map<string, Meal>): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.connected || !settings.taskListId) {
      throw new Error('Connect Google and choose a task list first.');
    }
    // Prime the token interactively ONCE, so the per-log calls below can
    // run silently even if the session had expired.
    await this.getToken(true);

    this.setStatus('syncing');
    let synced = 0;
    for (const log of Object.values(logs)
      .flat()
      .sort((a, b) => a.date.localeCompare(b.date))) {
      const meal = mealById.get(log.mealId);
      if (!meal) continue;
      await this.upsertLogTask(log, meal, true);
      if (this.status === 'error') throw new Error(this.statusMessage || 'Sync failed.');
      synced += 1;
    }
    await this.saveSettings({ lastSyncAt: new Date().toISOString() });
    this.setStatus('idle');
    devLog('syncAll complete', synced);
    return synced;
  }

  async setEnabled(enabled: boolean): Promise<SyncSettings> {
    return this.saveSettings({ enabled });
  }

  async markHistoryChoiceMade(): Promise<SyncSettings> {
    return this.saveSettings({ historyChoiceMade: true });
  }
}

export const googleTasksSyncService = new GoogleTasksSyncService(storageService);
