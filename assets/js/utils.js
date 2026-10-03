// Small page behaviours: back-to-top, card reveal, 404 overlay, tab title,
// the Konami code, the DevTools greeting, the name easter egg and the dead pixel.
(() => {
	// Show the back-to-top button after scrolling past 100px.
	{
		const button = document.getElementById('scroll');
		if (button) {
			const update = () => button.classList.toggle('is-visible', window.scrollY > 100);
			window.addEventListener('scroll', update, { passive: true });
			update();
		}
	}

	// Reveal project cards once as they enter the viewport.
	{
		const cards = document.querySelectorAll('.project');
		if (cards.length && 'IntersectionObserver' in window && !site.reduceMotion.matches) {
			const observer = new IntersectionObserver((entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;
					entry.target.classList.add('is-in');
					observer.unobserve(entry.target);
				});
			}, { rootMargin: '0px 0px -10% 0px' });

			// Cards already on screen at load show immediately.
			cards.forEach((card) => {
				if (card.getBoundingClientRect().top < window.innerHeight) card.classList.add('is-in');
				else observer.observe(card);
			});
			document.documentElement.classList.add('reveal');
		}
	}

	// 404 overlay: close via button, Esc, backdrop click or browser Back.
	{
		const dialog = document.getElementById('not-found');
		if (dialog) {
			// Clicking the dimmed backdrop (outside the report) closes it.
			dialog.addEventListener('click', (e) => {
				if (e.target === dialog) dialog.close();
			});

			// Closed by button/Esc/backdrop: drop the #404 history entry we pushed.
			dialog.addEventListener('close', () => {
				if (history.state && history.state.notFound) history.back();
			});

			// Closed by browser Back: the entry is already gone, just hide the dialog.
			window.addEventListener('popstate', () => {
				if (dialog.open) dialog.close();
			});

			// Opening the page directly at #404 (e.g. a shared link) shows the report.
			if (location.hash === '#404') {
				history.replaceState(null, '', location.pathname + location.search);
				site.openNotFound();
			}
		}
	}

	// Tab title while the visitor is away.
	{
		const title = document.title;
		document.addEventListener('visibilitychange', () => {
			document.title = document.hidden ? '🧪 Tests still running…' : title;
		});
	}

	// Konami code: ↑ ↑ ↓ ↓ ← → ← → B A (dispatches a "konami" event for the grid).
	{
		// Physical key codes, so it works with Shift, Caps Lock and non-Latin layouts.
		const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
		const modifiers = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];
		let pos = 0;

		document.addEventListener('keydown', (e) => {
			// Pressing a modifier on its own shouldn't break the sequence.
			if (modifiers.includes(e.key)) return;
			const key = e.code;
			if (key === code[pos]) pos++;
			else if (key === 'ArrowUp') pos = pos === 2 ? 2 : 1; // extra ↑ presses are forgiven
			else pos = 0;
			if (pos === code.length) {
				pos = 0;
				document.dispatchEvent(new Event('konami'));
			}
		});
	}

	// A hello for anyone who opens DevTools.
	if (window.console) {
		console.log(
			'%cHi there 👋%c\n\nFound a bug? You\'re my kind of person.\nSay hello: gotheg@gmail.com\n\nPsst: type help to open the console.',
			'font: 700 20px Georgia, serif; color: #4f46e5;',
			'font: 13px ui-monospace, Menlo, monospace; color: inherit;'
		);

		// Typing `help` in DevTools reads this getter, which opens the hidden terminal.
		try {
			Object.defineProperty(window, 'help', {
				configurable: true,
				get() {
					if (!site.openTerminal) return 'Console not ready yet.';
					site.openTerminal();
					site.runTerminal('help');
					return 'Opened the console on the page ↓';
				}
			});
		} catch (e) {}
	}

	// Name easter egg: click the letters T, E, S, T in the name (any S works).
	// A wrong letter resets the sequence. Success runs a little "test" over the name.
	{
		const h1 = document.querySelector('.hero h1');
		if (h1) {
			const name = h1.textContent.trim();
			const target = ['t', 'e', 's', 't'];
			let pos = 0, running = false, index = 0;

			// Split the name into letter spans (words kept together so they don't break).
			// Screen readers still get the plain name from aria-label.
			h1.setAttribute('aria-label', name);
			h1.textContent = '';
			name.split(' ').forEach((word, w) => {
				if (w) h1.appendChild(document.createTextNode(' '));
				const wordEl = document.createElement('span');
				wordEl.className = 'word';
				wordEl.setAttribute('aria-hidden', 'true');
				for (const ch of word) {
					const l = document.createElement('span');
					l.className = 'letter';
					l.textContent = ch;
					l.style.setProperty('--i', index++);
					wordEl.appendChild(l);
				}
				h1.appendChild(wordEl);
			});

			const clearHits = () => h1.querySelectorAll('.is-hit').forEach((l) => l.classList.remove('is-hit'));
			const missTimers = new WeakMap();

			const miss = (letter) => {
				pos = 0;
				clearHits();
				letter.classList.remove('is-miss');
				void letter.offsetWidth; // restart the shake animation
				letter.classList.add('is-miss');
				clearTimeout(missTimers.get(letter));
				missTimers.set(letter, setTimeout(() => letter.classList.remove('is-miss'), 450));
			};

			h1.addEventListener('click', (e) => {
				const letter = e.target.closest('.letter');
				if (!letter || running) return;
				const ch = letter.textContent.toLowerCase();

				if (ch !== target[pos]) {
					// A "t" can always start a fresh attempt.
					if (ch === 't') {
						clearHits();
						pos = 1;
						letter.classList.add('is-hit');
					} else {
						miss(letter);
					}
					return;
				}

				letter.classList.add('is-hit');
				pos++;
				if (pos < target.length) return;

				// All four found: run the name like a test suite.
				pos = 0;
				running = true;
				setTimeout(() => {
					clearHits();
					h1.classList.add('name-run');
				}, 250);
				setTimeout(() => {
					h1.classList.remove('name-run');
					running = false;
				}, 250 + 1400 + index * 55);
			});
		}
	}

	// Dead pixel: a single pixel fixed on the screen. Clicking/tapping within ±1px shows a toast.
	{
		// Mouse: ±3px around the pixel. Finger taps are far less precise, so allow more.
		const TOLERANCE = 4;
		const TOUCH_TOLERANCE = 12;
		const coarse = window.matchMedia('(pointer: coarse)');
		let x = 0, y = 0;

		const px = document.createElement('div');
		px.className = 'dead-pixel';
		px.setAttribute('aria-hidden', 'true');
		document.body.appendChild(px);

		// Fraction of the viewport, rounded to whole pixels so it stays crisp.
		const place = () => {
			x = Math.round(window.innerWidth * 0.53);
			y = Math.round(window.innerHeight * 0.25);
			px.style.left = x + 'px';
			px.style.top = y + 'px';
		};
		place();
		window.addEventListener('resize', place);

		// Hit-tested on the document (capture), so it works even if something sits on top.
		// Once found, the pixel is "fixed" until the next page load.
		const onClick = (e) => {
			// Measure the real on-screen position at click time (avoids stale coords
			// after mobile toolbar resizes, zoom, etc.).
			const r = px.getBoundingClientRect();
			const tol = coarse.matches ? TOUCH_TOLERANCE : TOLERANCE;
			const dx = e.clientX - (r.left + r.width / 2);
			const dy = e.clientY - (r.top + r.height / 2);
			if (Math.abs(dx) > 0.5 + tol || Math.abs(dy) > 0.5 + tol) return;
			px.remove();
			window.removeEventListener('resize', place);
			document.removeEventListener('click', onClick, true);
			site.toast('Dead pixel fixed ✓\nNo need to replace your screen yet', 4000);
		};
		document.addEventListener('click', onClick, true);
	}
})();
