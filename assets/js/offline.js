// Network status indicator: a small pill shown while the connection is down,
// briefly confirming when it comes back.
(() => {
	const root = document.documentElement;
	let pill, clearTimer;

	// Build the DOM once, lazily (nothing is added while the page is online).
	// A single persistent pill in the top-left corner — no top bar.
	function ensureUi() {
		if (pill) return;

		pill = document.createElement('div');
		pill.className = 'net-pill';
		pill.setAttribute('role', 'status');
		pill.setAttribute('aria-live', 'polite');
		pill.innerHTML =
			'<span class="net-dot" aria-hidden="true"></span>' +
			'<span class="net-pill-text"></span>';
		document.body.appendChild(pill);
	}

	function setText(sel, text) {
		const el = document.querySelector(sel);
		if (el) el.textContent = text;
	}

	function goOffline() {
		ensureUi();
		clearTimeout(clearTimer);

		root.classList.remove('is-online');
		root.classList.add('is-offline');

		setText('.net-pill-text', 'offline · cached');
		if (window.site && site.report) site.report('i14');
	}

	function goOnline() {
		// Nothing to clear if we were never shown offline (initial online load).
		if (!pill) return;

		root.classList.remove('is-offline');
		root.classList.add('is-online');

		setText('.net-pill-text', 'online');

		// Leave the "back online" state up briefly, then remove the UI entirely so
		// an online page carries no indicator at all.
		clearTimeout(clearTimer);
		clearTimer = setTimeout(() => {
			root.classList.remove('is-online');
			if (pill) { pill.remove(); pill = null; }
		}, 2600);
	}

	window.addEventListener('offline', goOffline);
	window.addEventListener('online', goOnline);

	// If the page is restored from bfcache (or loaded) while already offline,
	// reflect that immediately.
	window.addEventListener('pageshow', () => {
		if (!navigator.onLine) goOffline();
	});
	if (!navigator.onLine) goOffline();
})();

// Register the service worker (sw.js) so the site works offline and the offline
// status above runs on a live page. Guarded: no SW support (or file://) is a no-op.
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
