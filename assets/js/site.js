// TODO:
// There is absolutely nothing interesting
// at /assets/secret-test.json

(() => {
	// Shared state and helpers used by the other scripts (window.site).

	const root = document.documentElement;

	// matchMedia with a safe stand-in when it's missing (very old WebViews).
	const media = (query) => (window.matchMedia
		? window.matchMedia(query)
		: { matches: false, media: query, addEventListener() {}, addListener() {} });

	// MediaQueryList change listener; older Safari only has addListener().
	const onMediaChange = (mql, fn) => {
		if (mql.addEventListener) mql.addEventListener('change', fn);
		else if (mql.addListener) mql.addListener(fn);
	};

	const systemDark = media('(prefers-color-scheme: dark)');
	const reduceMotion = media('(prefers-reduced-motion: reduce)');
	const canDialog = typeof HTMLDialogElement === 'function' &&
		typeof HTMLDialogElement.prototype.showModal === 'function';
	let toastEl;
	let toastTimer;

	const site = {
		reduceMotion,
		systemDark,
		media,
		onMediaChange,
		canDialog,

		isDark() {
			const t = root.dataset.theme;
			return t ? t === 'dark' : systemDark.matches;
		},

		// Small status message at the bottom of the screen.
		toast(text, duration = 2600) {
			if (!toastEl) {
				toastEl = document.createElement('div');
				toastEl.className = 'toast';
				toastEl.setAttribute('role', 'status');
				toastEl.setAttribute('aria-live', 'polite');
				document.body.appendChild(toastEl);
			}
			toastEl.textContent = text;
			toastEl.classList.add('is-visible');
			clearTimeout(toastTimer);
			toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), duration);
		}
	};

	// "test_007" style ids for grid cells.
	site.testId = (i) => 'test_' + String(i + 1).padStart(3, '0');

	// Resolved-issue log. IDs are opaque strings ('i1', 'i5', …); their meaning
	// lives elsewhere. Resolved IDs persist in localStorage, so a found feature
	// stays resolved across reloads and tabs. report() also announces the ID on a
	// 'site:issue' event so listeners (the status island) can refresh.
	const RESOLVED_KEY = 'issues-resolved';

	const readResolved = () => {
		try {
			const raw = localStorage.getItem(RESOLVED_KEY);
			const list = raw ? JSON.parse(raw) : [];
			return new Set(Array.isArray(list) ? list : []);
		} catch (e) { return new Set(); }
	};

	const writeResolved = (set) => {
		try { localStorage.setItem(RESOLVED_KEY, JSON.stringify([...set])); } catch (e) {}
	};

	// Mark an issue resolved: persist the id and announce it. No-op if already
	// logged (so repeats don't re-announce a change).
	site.report = (id) => {
		if (!id) return;
		const set = readResolved();
		if (set.has(id)) return;
		set.add(id);
		writeResolved(set);
		document.dispatchEvent(new CustomEvent('site:issue', { detail: { id } }));
	};

	// Is an id in the persistent resolved log?
	site.isResolved = (id) => readResolved().has(id);

	window.site = site;

	try {
		Object.defineProperty(window, 'help', {
			configurable: true,
			get() {
				if (!site.openTerminal) return 'Console warming up — try help again in a second.';
				site.openTerminal();
				if (site.runTerminal) site.runTerminal('help');
				return 'Opened the console on the page ↓';
			}
		});
	} catch (e) {}
})();
