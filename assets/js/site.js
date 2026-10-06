// TODO:
// There is absolutely nothing interesting
// at /assets/secret-test.json

(() => {
	// Shared state and helpers used by the other scripts (window.site).
	// Scripts also hang cross-module hooks on `site` (openTerminal, runTerminal, testStats).

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
		},

		// "Page not found" overlay styled as a failed test report (opened from test_404).
		// Closing behaviour is wired in utils.js.
		openNotFound() {
			const dialog = document.getElementById('not-found');
			if (!dialog || dialog.open || !canDialog) return;
			dialog.querySelector('.report-time').textContent = ((40 + Math.random() * 400) | 0) + 'ms';
			dialog.showModal();
			// Focus the "Go back" button once the dialog is open.
			const back = dialog.querySelector('.report-actions button');
			if (back) back.focus();
		}
	};

	// "test_007" style ids for grid cells.
	site.testId = (i) => 'test_' + String(i + 1).padStart(3, '0');

	window.site = site;

	// Typing `help` in DevTools reads this getter, which opens the hidden terminal.
	// Defined here (the first script) so the global exists as early as possible:
	// if it's only installed by the last script, typing `help` during load throws
	// "ReferenceError: help is not defined". The getter tolerates the terminal not
	// being ready yet (terminal.js sets site.openTerminal later).
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
