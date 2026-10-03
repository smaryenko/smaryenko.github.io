// TODO:
// There is absolutely nothing interesting
// at /assets/secret-test.json

(() => {
	// Shared state and helpers used by the other scripts (window.site).
	// Scripts also hang cross-module hooks on `site` (testStats, openTerminal, runTerminal).

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
			// Let the browser Back button close the overlay too.
			history.pushState({ notFound: true }, '', '#404');
		}
	};

	// "test_007" style ids for grid cells.
	site.testId = (i) => 'test_' + String(i + 1).padStart(3, '0');

	window.site = site;
})();
