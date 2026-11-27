import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Capture beforeinstallprompt globally before React mounts (e.g. on LoginPage)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).__deferredPwaPrompt = e;
    window.dispatchEvent(new CustomEvent('vms-pwa-prompt-ready'));
  });

  window.addEventListener('appinstalled', () => {
    (window as any).__deferredPwaPrompt = null;
  });

  // Register Service Worker for PWA installability across Chrome/Android/Desktop
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('PWA registration:', err);
        });
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
