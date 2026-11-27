import { useState, useEffect } from 'react';

const STORAGE_KEY = 'vms_brand_version';
const DEFAULT_VERSION = '2026112701';
const BRAND_EVENT = 'vms-brand-updated';

let currentVersion: string = (() => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_VERSION;
    }
  } catch {}
  return DEFAULT_VERSION;
})();

let initialized = false;

export function getCurrentBrandVersion(): string {
  return currentVersion;
}

export function getBrandLogoUrl(version: string = currentVersion): string {
  return `/logo.png?v=${encodeURIComponent(version)}`;
}

export function getBrandMaskableUrl(version: string = currentVersion): string {
  return `/pwa-maskable-512x512.png?v=${encodeURIComponent(version)}`;
}

export function applyBrandVersionToDocument(version: string | number): void {
  const next = String(version || DEFAULT_VERSION);
  const changed = next !== currentVersion;
  currentVersion = next;

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}

  if (typeof document !== 'undefined') {
    const v = encodeURIComponent(next);
    const updateHref = (selector: string, base: string) => {
      document.querySelectorAll<HTMLLinkElement>(selector).forEach((el) => {
        el.href = `${base}?v=${v}`;
      });
    };

    updateHref('link[rel="icon"][type="image/x-icon"], link[rel="shortcut icon"]', '/favicon.ico');
    updateHref('link[rel="icon"][type="image/png"]', '/favicon.png');
    updateHref('link[rel="apple-touch-icon"]', '/apple-touch-icon.png');

    const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImg) {
      ogImg.content = `/logo.png?v=${v}`;
    }

    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifestLink && changed) {
      manifestLink.href = `/manifest.json?v=${v}`;
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BRAND_EVENT, { detail: { version: next } }));
  }
}

async function purgeStaleIconCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        await Promise.all(
          requests
            .filter((req) => {
              const p = new URL(req.url).pathname;
              return (
                p === '/manifest.json' ||
                p === '/manifest.webmanifest' ||
                p === '/favicon.ico' ||
                p === '/favicon.png' ||
                p === '/logo.png' ||
                p === '/logo.jpg' ||
                p === '/apple-touch-icon.png' ||
                p.startsWith('/pwa-')
              );
            })
            .map((req) => cache.delete(req))
        );
      })
    );
  } catch {
    // ignore cache purge errors
  }
}

export async function triggerServiceWorkerUpdate(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (reg) {
      await reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  } catch {
    // ignore sw update errors
  }
}

export async function syncBrandAssetsFromServer(forceSwUpdate: boolean = false): Promise<string> {
  try {
    const res = await fetch(`/api/brand/meta?_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return currentVersion;
    const data = await res.json();
    if (data?.version) {
      const next = String(data.version);
      const changed = next !== currentVersion;
      applyBrandVersionToDocument(next);
      if (changed || forceSwUpdate) {
        await purgeStaleIconCaches();
        await triggerServiceWorkerUpdate();
      }
      return next;
    }
  } catch {
    // Offline fallback keeps cached version
  }
  return currentVersion;
}

export function initBrandAssetSync(): void {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  applyBrandVersionToDocument(currentVersion);
  syncBrandAssetsFromServer(false).catch(() => {});

  const onResume = () => {
    if (document.visibilityState === 'visible') {
      syncBrandAssetsFromServer(false).catch(() => {});
    }
  };

  window.addEventListener('focus', onResume);
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('online', () => {
    syncBrandAssetsFromServer(true).catch(() => {});
  });

  // Periodic background check so connected mobile devices pick up newly uploaded icons together
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      syncBrandAssetsFromServer(false).catch(() => {});
    }
  }, 60000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'VMS_SW_ACTIVATED' && event.data?.version) {
        applyBrandVersionToDocument(String(event.data.version));
      }
    });
  }
}

export function useBrandLogoUrl(): string {
  const [version, setVersion] = useState<string>(currentVersion);

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<{ version?: string }>).detail?.version || currentVersion;
      setVersion(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        applyBrandVersionToDocument(e.newValue);
      }
    };
    window.addEventListener(BRAND_EVENT, handler);
    window.addEventListener('storage', onStorage);
    setVersion(currentVersion);
    return () => {
      window.removeEventListener(BRAND_EVENT, handler);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return getBrandLogoUrl(version);
}
