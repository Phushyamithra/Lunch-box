import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';

// Service worker: precaches the app shell for offline launch and
// auto-updates on the next visit after a deploy.
registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
