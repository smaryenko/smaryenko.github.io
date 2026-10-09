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
