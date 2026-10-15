// Light/dark theme toggle (remembers the choice; defaults to system setting).
// The inline <head> script applies the saved theme before first paint.
(() => {
	const root = document.documentElement;
	const button = document.querySelector('.theme-toggle');

	function apply() {
		const dark = site.isDark();
		root.classList.toggle('is-dark', dark);
		if (button) {
			button.setAttribute('aria-pressed', String(dark));
			button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
		}
		document.dispatchEvent(new Event('themechange'));
	}

	function setTheme(theme) {
		root.dataset.theme = theme;
		try { localStorage.setItem('theme', theme); } catch (e) {}
		apply();
	}

	if (button) {
		button.hidden = false;
		let clicks = [];
		button.addEventListener('click', () => {
			const now = Date.now();
			clicks = clicks.filter((t) => now - t < 5000);
			clicks.push(now);
			if (clicks.length >= 10) {
				clicks = [];
				freeze();
				return;
			}
			const next = site.isDark() ? 'light' : 'dark';
			if (document.startViewTransition && !site.reduceMotion.matches) {
				// Rapid toggles skip the previous transition, which rejects `ready`; that's fine.
				document.startViewTransition(() => setTheme(next)).ready.catch(() => {});
			} else {
				setTheme(next);
			}
		});
	}

	function freeze() {
		let seconds = 5;
		const template = document.getElementById('freeze-template');
		const overlay = template.content.firstElementChild.cloneNode(true);
		const count = overlay.querySelector('.win-count');
		const bar = overlay.querySelector('.win-progress span');
		const win = overlay.querySelector('.win');
		count.textContent = seconds;
		// Restart the progress animation so it lasts exactly 5s.
		bar.style.animationDuration = seconds + 's';
		document.body.appendChild(overlay);
		root.classList.add('is-frozen');
		if (site.report) site.report('i7');

		// Swallow every key until the timer runs out.
		const block = (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
		};
		const keyEvents = ['keydown', 'keyup', 'keypress'];
		keyEvents.forEach((type) => window.addEventListener(type, block, true));
		// Move focus into the dialog so screen readers announce it.
		win.focus();

		// Finish off wall-clock time, not just interval ticks: a backgrounded tab
		// throttles setInterval, which would otherwise leave the key blockers
		// attached (keys stay swallowed) until the tab is focused again. The
		// deadline and a visibility check guarantee the freeze always ends and the
		// listeners are removed. end() is idempotent.
		const deadline = Date.now() + seconds * 1000;
		let timer;
		let done = false;

		const end = () => {
			if (done) return;
			done = true;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
			keyEvents.forEach((type) => window.removeEventListener(type, block, true));
			overlay.remove();
			root.classList.remove('is-frozen');
			if (button) button.focus();
			site.toast('Theme Switcher has recovered.\nPlease toggle responsibly.', 4000);
		};

		const onVisible = () => { if (!document.hidden && Date.now() >= deadline) end(); };
		document.addEventListener('visibilitychange', onVisible);

		timer = setInterval(() => {
			const left = Math.ceil((deadline - Date.now()) / 1000);
			count.textContent = Math.max(0, left);
			if (left <= 0) end();
		}, 1000);
	}

	site.onMediaChange(site.systemDark, apply);
	apply();
})();
