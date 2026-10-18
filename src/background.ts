/**
 * MV3 service worker. The extension opens as a centered, app-style window
 * instead of a toolbar popup (a browser-action popup cannot be moved or
 * centered — Chrome always anchors it to the toolbar icon, so we use
 * chrome.windows.create for a standalone-utility feel).
 *
 * Clicking the toolbar icon focuses the existing window when one is open;
 * otherwise a new window opens centered over the current browser window.
 */

const APP_WINDOW_WIDTH = 560;
const APP_WINDOW_HEIGHT = 800;
const WINDOW_ID_KEY = 'lunchbox.appWindowId';

async function getStoredWindowId(): Promise<number | undefined> {
  const stored = await chrome.storage.session.get(WINDOW_ID_KEY);
  return stored[WINDOW_ID_KEY] as number | undefined;
}

async function focusExisting(windowId: number): Promise<boolean> {
  try {
    await chrome.windows.update(windowId, { focused: true, drawAttention: true });
    return true;
  } catch {
    return false; // window was closed
  }
}

/** Center over the currently focused browser window (fallback: default). */
async function computePosition(): Promise<{ left?: number; top?: number }> {
  try {
    const current = await chrome.windows.getLastFocused();
    if (
      current.left !== undefined &&
      current.top !== undefined &&
      current.width &&
      current.height
    ) {
      return {
        left: Math.max(0, Math.round(current.left + (current.width - APP_WINDOW_WIDTH) / 2)),
        top: Math.max(0, Math.round(current.top + (current.height - APP_WINDOW_HEIGHT) / 2)),
      };
    }
  } catch {
    /* no focused window — let Chrome pick */
  }
  return {};
}

async function createAppWindow(position: { left?: number; top?: number }) {
  const options: chrome.windows.CreateData = {
    url: chrome.runtime.getURL('index.html'),
    type: 'popup',
    width: APP_WINDOW_WIDTH,
    height: APP_WINDOW_HEIGHT,
    focused: true,
  };
  try {
    // Centered over the current browser window — but that window may sit on
    // a monitor that no longer exists (laptop undocked), making the computed
    // bounds invalid ("Bounds must be at least 50% within visible screen
    // space"). If Chrome rejects the position, retry and let it auto-place.
    return await chrome.windows.create({ ...options, ...position });
  } catch {
    return chrome.windows.create(options);
  }
}

chrome.action.onClicked.addListener(() => {
  void (async () => {
    const existingId = await getStoredWindowId();
    if (existingId !== undefined && (await focusExisting(existingId))) return;

    const position = await computePosition();
    const appWindow = await createAppWindow(position);
    if (appWindow.id !== undefined) {
      await chrome.storage.session.set({ [WINDOW_ID_KEY]: appWindow.id });
    }
  })();
});

chrome.windows.onRemoved.addListener((windowId) => {
  void (async () => {
    if ((await getStoredWindowId()) === windowId) {
      await chrome.storage.session.remove(WINDOW_ID_KEY);
    }
  })();
});
