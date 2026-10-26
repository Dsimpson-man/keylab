const CACHE_NAME = 'keylab-static-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles.css',
  './src/app.js',
  './src/audio/audio-engine.js',
  './src/audio/metronome.js',
  './src/core/event-bus.js',
  './src/core/lesson-engine.js',
  './src/core/music-theory.js',
  './src/core/quiz-engine.js',
  './src/core/rhythm-analyzer.js',
  './src/core/rhythm-session.js',
  './src/core/task-matcher.js',
  './src/data/lessons.js',
  './src/data/quizzes.js',
  './src/midi/device-profiles.js',
  './src/midi/midi-normalizer.js',
  './src/midi/midi-service.js',
  './src/midi/native-bridge-adapter.js',
  './src/midi/simulated-midi-adapter.js',
  './src/midi/web-midi-adapter.js',
  './src/storage/progress-store.js',
  './src/ui/format.js',
  './src/ui/keyboard.js',
  './src/ui/notify.js',
  './src/ui/staff.js',
  './src/ui/views.js',
  './assets/icon.svg',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
