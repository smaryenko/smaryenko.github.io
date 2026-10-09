// Register the service worker (sw.js) so the site works offline and the offline
// status runs on a live page. Guarded: no SW support (or file://) is a no-op.
// When a new worker takes control, reload once so the freshly deployed assets
// are the ones running (prevents a half-old/half-new page after a deploy).
(() => {
	if (!('serviceWorker' in navigator)) return;
	if (location.protocol === 'file:') return; // SWs need http(s)

	// Skip the service worker during local development so cached assets never mask
	// edits (localhost/127.0.0.1). Also proactively unregister any worker left over
	// from an earlier local session, so a stale cache can't keep serving old code.
	if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
		navigator.serviceWorker.getRegistrations?.().then((regs) => {
			regs.forEach((r) => r.unregister());
		}).catch(() => {});
		return;
	}

	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').then((reg) => {
			// If an updated worker is found, let it activate right away.
			reg.addEventListener('updatefound', () => {
				const sw = reg.installing;
				if (!sw) return;
				sw.addEventListener('statechange', () => {
					// Only ask it to skip waiting when there's already a controller,
					// i.e. this is an update, not the very first install.
					if (sw.state === 'installed' && navigator.serviceWorker.controller) {
						sw.postMessage('skipWaiting');
					}
				});
			});
		}).catch(() => { /* registration failed; the site still works online */ });

		// When control passes to a new worker (after skipWaiting), reload once.
		let reloaded = false;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (reloaded) return;
			reloaded = true;
			location.reload();
		});
	});
})();
