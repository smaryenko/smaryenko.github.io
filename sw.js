/*
 * Service worker: makes the site load fully offline, so the offline easter egg
 * (assets/js/offline.js) runs on a live page instead of the browser's dino.
 *
 * Strategy:
 *   - Precache the known static assets on install (the exact set the page loads).
 *   - Navigations: network-first, falling back to the cached shell (then 404.html)
 *     when offline, so online visitors always get fresh HTML.
 *   - Static assets (same-origin GET): stale-while-revalidate — serve from cache
 *     instantly, refresh the cache in the background.
 *   - Old caches are dropped on activate, so bumping CACHE_VERSION ships an update
 *     cleanly and can't trap visitors on a stale build.
 *
 * To release an update, bump CACHE_VERSION. During development, enable
 * "Update on reload" in DevTools > Application > Service Workers.
 * (sw-register.js never registers this worker on localhost.)
 */

const CACHE_VERSION = 'v8';
const CACHE_NAME = 'site-' + CACHE_VERSION;

// Everything the page actually references (see index.html). Fonts live in CSS,
// so they're listed by hand. Paths are absolute so scope is the whole site.
const PRECACHE_URLS = [
	'/',
	'/index.html',
	'/404.html',
	'/assets/css/style.css',
	'/assets/js/site.js',
	'/assets/js/theme.js',
	'/assets/js/grid.js',
	'/assets/js/terminal.js',
	'/assets/js/timeline.js',
	'/assets/js/utils.js',
	'/assets/js/offline.js',
	'/assets/js/sw-register.js',
	'/assets/fonts/inter-latin.woff2',
	'/assets/fonts/fraunces-latin.woff2',
	'/images/favicon.png'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			// addAll is atomic: if one asset 404s the whole install fails, so we
			// add individually and ignore misses (a renamed image shouldn't break
			// the whole worker).
			.then((cache) => Promise.all(
				PRECACHE_URLS.map((url) =>
					cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
				)
			))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(
				keys.filter((k) => k.startsWith('site-') && k !== CACHE_NAME)
					.map((k) => caches.delete(k))
			))
			.then(() => self.clients.claim())
	);
});

// Let the page tell a waiting worker to take over immediately.
self.addEventListener('message', (event) => {
	if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return; // leave cross-origin alone

	// Navigations (page loads): network-first so online visitors get fresh HTML,
	// cached shell when offline.
	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req)
				.then((res) => {
					const copy = res.clone();
					caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
					return res;
				})
				.catch(() =>
					caches.match(req)
						.then((hit) => hit || caches.match('/index.html'))
						.then((hit) => hit || caches.match('/404.html'))
				)
		);
		return;
	}

	// Static assets: stale-while-revalidate.
	event.respondWith(
		caches.match(req).then((cached) => {
			const network = fetch(req)
				.then((res) => {
					if (res && res.ok) {
						const copy = res.clone();
						caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
					}
					return res;
				})
				.catch(() => cached);
			return cached || network;
		})
	);
});

