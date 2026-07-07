import { NUTRIENT_META, getCategoryMeta } from '../constants';
import type {
  Meal,
  MealLog,
  SyncSettings,
  SyncStatus,
  TaskListInfo,
} from '../models';
import { storageService, type LogsByDate, type StorageService } from './StorageService';

const TASKS_API = 'https://tasks.googleapis.com/tasks/v1';
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const MEAL_TRACKER_LIST_TITLE = 'Meal Tracker';
const MAX_RETRIES = 2;
/** Refresh the access token this long before it actually expires. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

const DEFAULT_SETTINGS: SyncSettings = {
  connected: false,
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

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

/**
 * One-way synchronization: extension → Google Tasks → Android devices.
 * The extension is the source of truth; changes made in Google Tasks are
 * never read back into meal data.
 *
 * Authentication uses chrome.identity.launchWebAuthFlow with a standard
 * "Web application" OAuth client (implicit grant). This is deliberately
 * NOT chrome.identity.getAuthToken — that API requires a Chrome-Extension
 * typed client and fails with "Custom URI scheme is not supported" in many
 * configurations. Required Cloud Console setup:
 *   OAuth client type: Web application
 *   Authorized redirect URI: https://<extension-id>.chromiumapp.org/
 *
 * Owns token caching/refresh, task-list management, completed-task CRUD,
 * historical sync, retry logic and status. The UI talks only to this
 * service — never to the Google Tasks API directly.
 */
export class GoogleTasksSyncService {
  private status: SyncStatus = 'disconnected';
  private statusMessage = '';
  private settingsCache: SyncSettings | null = null;
  private cachedToken: CachedToken | null = null;

  constructor(private readonly storage: StorageService) {}

  // ---------- Status ----------

  getStatus(): { status: SyncStatus; message: string } {
    return { status: this.status, message: this.statusMessage };
  }

  private setStatus(status: SyncStatus, message = ''): void {
    this.status = status;
    this.statusMessage = message;
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

  // ---------- Authentication (launchWebAuthFlow, implicit grant) ----------

  private get identityAvailable(): boolean {
    return typeof chrome !== 'undefined' && Boolean(chrome.identity?.launchWebAuthFlow);
  }

  /** The exact redirect URI that must be registered in Cloud Console. */
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
          `${this.getRedirectUri()} and put its client ID in manifest.json → oauth2.client_id. See README, "Google Tasks setup".`,
      );
    }
    return clientId;
  }

  private buildAuthUrl(interactive: boolean): string {
    const params = new URLSearchParams({
      client_id: this.getClientId(),
      response_type: 'token',
      redirect_uri: this.getRedirectUri(),
      scope: TASKS_SCOPE,
    });
    if (!interactive) params.set('prompt', 'none');
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  private async getToken(interactive: boolean): Promise<string> {
    if (!this.identityAvailable) {
      throw new Error('Google sign-in is only available inside the Chrome extension.');
    }
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS) {
      return this.cachedToken.token;
    }

    const url = this.buildAuthUrl(interactive);
    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url, interactive }, (result) => {
        if (chrome.runtime.lastError || !result) {
          reject(new Error(chrome.runtime.lastError?.message ?? 'Google sign-in was cancelled.'));
        } else {
          resolve(result);
        }
      });
    });

    // Access token arrives in the URL fragment (implicit grant).
    const fragment = new URLSearchParams(new URL(responseUrl).hash.replace(/^#/, ''));
    const token = fragment.get('access_token');
    const error = fragment.get('error');
    if (!token) {
      throw new Error(
        error === 'interaction_required' || error === 'login_required' || error === 'consent_required'
          ? 'Your Google session expired — please click Connect again.'
          : `Google sign-in failed${error ? ` (${error})` : ''}.`,
      );
    }
    const expiresIn = Number(fragment.get('expires_in') ?? 3600);
    this.cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
    return token;
  }

  async connect(): Promise<SyncSettings> {
    await this.getToken(true);
    this.setStatus('idle', 'Connected to Google.');
    return this.saveSettings({ connected: true });
  }

  async disconnect(): Promise<SyncSettings> {
    if (this.cachedToken) {
      // Best-effort revoke so "Disconnect" truly disconnects.
      void fetch(
        `https://accounts.google.com/o/oauth2/revoke?token=${this.cachedToken.token}`,
      ).catch(() => undefined);
      this.cachedToken = null;
    }
    this.setStatus('disconnected');
    return this.saveSettings({ connected: false, enabled: false });
  }

  // ---------- HTTP with retry + silent token refresh ----------

  private async request<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    const token = await this.getToken(false);
    const response = await fetch(`${TASKS_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    if (response.status === 401 && attempt < MAX_RETRIES) {
      // Token expired/revoked — drop it and retry with a silent re-auth.
      this.cachedToken = null;
      return this.request<T>(path, init, attempt + 1);
    }
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      return this.request<T>(path, init, attempt + 1);
    }
    if (!response.ok) {
      // Surface Google's own explanation (e.g. "API not enabled") when present.
      let detail = '';
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        detail = body.error?.message ?? '';
      } catch {
        /* non-JSON error body */
      }
      throw new Error(
        `Google Tasks request failed (${response.status})${detail ? `: ${detail}` : '.'}`,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  // ---------- Task lists ----------

  async listTaskLists(): Promise<TaskListInfo[]> {
    const data = await this.request<{ items?: { id: string; title: string }[] }>(
      '/users/@me/lists?maxResults=100',
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
    const created = await this.request<{ id: string; title: string }>('/users/@me/lists', {
      method: 'POST',
      body: JSON.stringify({ title: MEAL_TRACKER_LIST_TITLE }),
    });
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
   * Creates or updates the completed task for a log. Fire-and-forget safe:
   * returns silently when sync is disabled; records error status on failure.
   */
  async upsertLogTask(log: MealLog, meal: Meal | undefined): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.connected || !settings.taskListId || !meal) return;

    this.setStatus('syncing');
    try {
      const map = await this.storage.getSyncTaskMap(log.email);
      const payload = this.buildTaskPayload(log, meal);
      const existingId = map[log.date];

      if (existingId) {
        // Update in place — never create duplicates for the same day.
        await this.request<GoogleTask>(
          `/lists/${settings.taskListId}/tasks/${existingId}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
        ).catch(async (error: unknown) => {
          // Task deleted remotely (404) — recreate it.
          if (error instanceof Error && error.message.includes('404')) {
            const created = await this.request<GoogleTask>(
              `/lists/${settings.taskListId}/tasks`,
              { method: 'POST', body: JSON.stringify(payload) },
            );
            map[log.date] = created.id;
            await this.storage.saveSyncTaskMap(log.email, map);
            return created;
          }
          throw error;
        });
      } else {
        const created = await this.request<GoogleTask>(
          `/lists/${settings.taskListId}/tasks`,
          { method: 'POST', body: JSON.stringify(payload) },
        );
        map[log.date] = created.id;
        await this.storage.saveSyncTaskMap(log.email, map);
      }
      await this.saveSettings({ lastSyncAt: new Date().toISOString() });
      this.setStatus('idle');
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : 'Sync failed.');
    }
  }

  /** Removes the linked task when a meal log is deleted. */
  async deleteLogTask(email: string, date: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled || !settings.connected || !settings.taskListId) return;

    this.setStatus('syncing');
    try {
      const map = await this.storage.getSyncTaskMap(email);
      const taskId = map[date];
      if (taskId) {
        await this.request<void>(`/lists/${settings.taskListId}/tasks/${taskId}`, {
          method: 'DELETE',
        }).catch(() => undefined); // already gone remotely — fine
        delete map[date];
        await this.storage.saveSyncTaskMap(email, map);
      }
      await this.saveSettings({ lastSyncAt: new Date().toISOString() });
      this.setStatus('idle');
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : 'Sync failed.');
    }
  }

  /**
   * Pushes every given log to Google Tasks (used for "Sync existing
   * history" and "Sync now"). Returns the number of logs synced.
   */
  async syncAll(logs: LogsByDate, mealById: Map<string, Meal>): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.connected || !settings.taskListId) {
      throw new Error('Connect Google and choose a task list first.');
    }
    this.setStatus('syncing');
    let synced = 0;
    for (const log of Object.values(logs).sort((a, b) => a.date.localeCompare(b.date))) {
      const meal = mealById.get(log.mealId);
      if (!meal) continue;
      await this.upsertLogTask(log, meal);
      if (this.status === 'error') throw new Error(this.statusMessage || 'Sync failed.');
      synced += 1;
    }
    await this.saveSettings({ lastSyncAt: new Date().toISOString() });
    this.setStatus('idle');
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
