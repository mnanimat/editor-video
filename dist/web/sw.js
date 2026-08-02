/**
 * CineForge Pro — Service Worker
 * Enables offline usage and caching for PWA
 */

const CACHE_NAME = 'cineforge-pro-v1.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/css/main.css',
  '/src/js/core/EventBus.js',
  '/src/js/core/Project.js',
  '/src/js/core/App.js',
  '/src/js/renderer/VideoRenderer.js',
  '/src/js/effects/ColorGrading.js',
  '/src/js/effects/EffectsEngine.js',
  '/src/js/effects/MotionDesigner.js',
  '/src/js/effects/Transitions.js',
  '/src/js/timeline/Timeline.js',
  '/src/js/audio/AudioEngine.js',
  '/src/js/ui/UIManager.js',
  '/src/js/ui/Inspector.js',
  '/src/js/export/Exporter.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
];

// ─── Install ───
self.addEventListener('install', (event) => {
  console.log('[SW] Installing CineForge Pro Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('http')));
    }).catch(err => {
      console.warn('[SW] Cache install partial failure:', err);
    })
  );
  self.skipWaiting();
});

// ─── Activate ───
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch Strategy: Cache-first for assets, Network-first for dynamic ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:') return;

  // Skip blob URLs (media files)
  if (url.protocol === 'blob:') return;

  // For JS/CSS/HTML: Cache first, then network
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/'
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // For Google Fonts: Cache first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // For everything else: Network first
  event.respondWith(networkFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline — recurso não disponível no cache', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

// ─── Background Sync (for export queue) ───
self.addEventListener('sync', (event) => {
  if (event.tag === 'export-queue') {
    console.log('[SW] Background sync: export-queue');
  }
});

// ─── Push Notifications ───
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'CineForge Pro', {
      body: data.body || 'Renderização concluída!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: 'cineforge-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
