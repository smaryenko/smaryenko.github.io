// TODO:
// There is absolutely nothing interesting
// at /assets/secret-test.json

(() => {
	// Shared state and helpers used by the other scripts (window.site).
	// Scripts also hang cross-module hooks on `site` (openTerminal, runTerminal, testStats).

	const root = document.documentElement;
	const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	let toastEl;
	let toastTimer;

	const site = {
		reduceMotion,
		systemDark,

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
		openNotFound() {
			const dialog = document.getElementById('not-found');
			if (!dialog || dialog.open) return;
			dialog.querySelector('.report-time').textContent = ((40 + Math.random() * 400) | 0) + 'ms';
			dialog.showModal();
			// Focus the "Go back" button once the dialog is actually open. Done here
			// rather than with a static `autofocus` attribute, which the browser
			// refuses (and warns about) when the page loads with a URL fragment.
			const back = dialog.querySelector('.report-actions button');
			if (back) back.focus();
			// Let the browser Back button close the overlay too.
			history.pushState({ notFound: true }, '', '#404');
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
