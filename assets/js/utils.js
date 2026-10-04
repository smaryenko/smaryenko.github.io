// Small page behaviours: back-to-top, card reveal, 404 overlay, tab title,
// the Konami code, the DevTools greeting, the name easter egg, the dead pixel
// and the seasonal decorations on the "S".
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
	// Printed from `pageshow`, which fires on EVERY display of the page: a fresh
	// load AND a back/forward-cache (bfcache) restore. The earlier alternating
	// behaviour was bfcache — on a restored page the scripts don't re-run, so a
	// one-shot console.log/`load` greeting is skipped, making it blink in and out
	// every other refresh. `pageshow` runs in both cases, so it's consistent.
	// The `help` DevTools getter is installed in site.js (first script) so the
	// global exists before anyone can type it during load.
	if (window.console) {
		window.addEventListener('pageshow', () => {
			console.log(
				'%cHi there 👋%c\n\nFound a bug? You\'re my kind of person.\nSay hello: gotheg@gmail.com\n\nPsst: type help to open the console.',
				'font: 700 20px Georgia, serif; color: #4f46e5;',
				'font: 13px ui-monospace, Menlo, monospace; color: inherit;'
			);
		});
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

	// Dead pixel: a single pixel fixed on the screen. Clicking/tapping within ±4px shows a toast.
	{
		// Mouse: ±4px around the pixel. Finger taps are far less precise, so allow more.
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
		// Measure the real on-screen position each time (avoids stale coords
		// after mobile toolbar resizes, zoom, etc.).
		const isHit = (e) => {
			const r = px.getBoundingClientRect();
			const tol = coarse.matches ? TOUCH_TOLERANCE : TOLERANCE;
			const dx = e.clientX - (r.left + r.width / 2);
			const dy = e.clientY - (r.top + r.height / 2);
			return Math.abs(dx) <= 0.5 + tol && Math.abs(dy) <= 0.5 + tol;
		};

		// Pointer (hand) cursor over the hit area, so it reads as clickable.
		const root = document.documentElement;
		const onMove = (e) => root.classList.toggle('on-dead-pixel', isHit(e));

		const onClick = (e) => {
			if (!isHit(e)) return;
			px.remove();
			root.classList.remove('on-dead-pixel');
			window.removeEventListener('resize', place);
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('click', onClick, true);
			site.toast('Dead pixel fixed ✓\nNo need to replace your screen yet', 4000);
		};
		document.addEventListener('mousemove', onMove, { passive: true });
		document.addEventListener('click', onClick, true);
	}

	// Seasonal easter eggs:
	// By default the real date decides. The terminal "jump" command can set a
	// simulated date (see site.setSimulatedDate) so you can preview either egg on
	// any day. The simulation lives only in memory for this page view.
	{
		let simulated = null; // a Date, or null to use the real clock.
		let host;             // the ".letter" span holding the first "S".
		let deco;             // the decoration element mounted on that letter.

		// What date should the page behave as? Real now, unless simulated.
		const effectiveDate = () => (simulated ? new Date(simulated) : new Date());

		// Which egg (if any) applies to a given date. Keyed by month/day only.
		function eggFor(date) {
			const m = date.getMonth() + 1, d = date.getDate();
			if (m === 12 && d === 18) return 'birthday';
			if (m === 12 && d === 25) return 'xmas';
			return null;
		}

		// The "S" is the very first letter span the name easter egg created.
		function findHost() {
			if (host && host.isConnected) return host;
			host = document.querySelector('.hero h1 .letter');
			return host;
		}

		// Decoration markup. Both hats share one visual language so they read as a
		// matched set: same 48x48 box, flat fills (no gradients), a white brim/band,
		// and an identical white pom-pom (r=7) with the same highlight dot. Pure SVG
		// so they scale with the letter and theme cleanly.
		function decoSvg(kind) {
			if (kind === 'birthday') {
				// Party hat: red cone with diagonal stripes, a white brim, pom-pom on top.
				return '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
					'<defs><clipPath id="deco-cone"><path d="M24 9 L36 40 H12 Z"/></clipPath></defs>' +
					// cone body
					'<path d="M24 9 L36 40 H12 Z" fill="#dc2626"/>' +
					// diagonal stripes clipped to the cone
					'<g clip-path="url(#deco-cone)" stroke="#fcd34d" stroke-width="4" stroke-linecap="round">' +
					'<path d="M6 38 L26 6"/><path d="M14 42 L34 10"/><path d="M-2 34 L18 2"/>' +
					'</g>' +
					// white brim across the base
					'<rect x="9" y="37" width="30" height="7" rx="3.5" fill="#f8fafc"/>' +
					// pom-pom on top
					'<circle cx="24" cy="8" r="7" fill="#f8fafc"/>' +
					'<circle cx="21.6" cy="5.6" r="2" fill="#fff"/>' +
					'</svg>';
			}
			// Santa hat: same red fill, same white band + pom-pom, drawn as a cap that
			// droops to the side so it clearly differs from the upright party hat.
			return '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
				// cap: rises from the band then curls down to the drooped tip
				'<path d="M10 37 C11 17 28 7 39 10 C45 12 45 19 41 22 C37 25 34 29 33 37 Z" fill="#dc2626"/>' +
				// white fur band across the base
				'<rect x="7" y="34" width="30" height="7" rx="3.5" fill="#f8fafc"/>' +
				// pom-pom at the drooped tip
				'<circle cx="42" cy="22" r="7" fill="#f8fafc"/>' +
				'<circle cx="39.6" cy="19.6" r="2" fill="#fff"/>' +
				'</svg>';
		}

		// Mount or update the decoration on the "S"; or remove it if no egg applies.
		function applySeasonal() {
			const letter = findHost();
			if (!letter) return null;
			const kind = eggFor(effectiveDate());

			if (!kind) {
				if (deco) { deco.remove(); deco = null; }
				letter.classList.remove('has-deco');
				return null;
			}

			if (!deco) {
				deco = document.createElement('span');
				deco.className = 'letter-deco';
				deco.setAttribute('aria-hidden', 'true');
				letter.appendChild(deco);
			}
			// The letter span is inline-block (set in CSS) so the absolutely
			// positioned decoration anchors to it.
			letter.classList.add('has-deco');
			deco.dataset.kind = kind;
			deco.innerHTML = decoSvg(kind);
			return kind;
		}

		// Public API used by the terminal "jump" command.
		// Returns the egg kind now in effect ('birthday' | 'xmas' | null).
		site.setSimulatedDate = (date) => {
			simulated = date instanceof Date && !isNaN(date) ? date : null;
			return applySeasonal();
		};
		site.clearSimulatedDate = () => {
			simulated = null;
			return applySeasonal();
		};
		site.getSimulatedDate = () => (simulated ? new Date(simulated) : null);
		site.applySeasonal = applySeasonal;

		// The name easter egg above already split the h1 into ".letter" spans, so
		// the "S" host exists now and we can decorate it immediately.
		applySeasonal();

		// Keep the decoration glued to the "S" across resizes/orientation changes
		// (position is pure CSS, but re-apply if the name was re-rendered).
		window.addEventListener('resize', () => { if (!host || !host.isConnected) applySeasonal(); }, { passive: true });
	}
})();
