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

	// All distinct resolved ids from the log, as an array (order not guaranteed).
	site.resolvedIds = () => [...readResolved()];

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

(() => {
	// Info panel next to the name: hover preview on mouse, tap/click/Enter to toggle,
	// closes on Escape or a tap outside.
	const btn = document.getElementById('about-toggle');
	const panel = document.getElementById('about-panel');
	if (!btn || !panel) return;

	const wrap = btn.parentElement;
	const canHover = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
	let pinned = false;
	let hideTimer;

	const isOpen = () => !panel.hidden;

	function show() {
		clearTimeout(hideTimer);
		panel.hidden = false;
		btn.setAttribute('aria-expanded', 'true');
	}

	function hide() {
		clearTimeout(hideTimer);
		pinned = false;
		panel.hidden = true;
		btn.setAttribute('aria-expanded', 'false');
	}

	btn.addEventListener('click', () => {
		if (isOpen() && pinned) hide();
		else { show(); pinned = true; }
	});

	const close = panel.querySelector('.about-close');
	if (close) {
		close.addEventListener('click', () => {
			hide();
			btn.focus();
		});
	}

	if (canHover) {
		// Small delay so the pointer can travel from the icon into the panel.
		wrap.addEventListener('mouseover', (e) => {
			if (btn.contains(e.target) || panel.contains(e.target)) show();
		});
		wrap.addEventListener('mouseleave', () => {
			if (!pinned) hideTimer = setTimeout(hide, 150);
		});
	}

	document.addEventListener('pointerdown', (e) => {
		if (isOpen() && !btn.contains(e.target) && !panel.contains(e.target)) hide();
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isOpen()) {
			hide();
			btn.focus();
		}
	});
})();

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
			// Keep a short rolling window of recent clicks for rate handling.
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

	// Brief modal "busy" overlay built from #freeze-template: shows a 5s
	// countdown, swallows keys while up, then restores on a wall-clock deadline.
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
		// deadline and a visibility check guarantee it always ends and the
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
