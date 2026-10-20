import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';

// Service worker: precaches the app shell for offline launch and
// auto-updates after a deploy. An installed app on a phone is rarely
// reloaded, so also look for a new version whenever it comes back to the
// front (at most every 10 minutes) and hourly while open.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    let last = Date.now();
    const check = () => {
      if (Date.now() - last < 10 * 60 * 1000 || !navigator.onLine) return;
      last = Date.now();
      void reg.update();
    };
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    window.setInterval(() => ((last = 0), check()), 60 * 60 * 1000);
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
