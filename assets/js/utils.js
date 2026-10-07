// Small page behaviours: back-to-top, card reveal, 404 overlay, tab title,
// the Konami code, the DevTools greeting, the name easter egg, the dead pixel,
// the seasonal decorations on the "S", the responsive-breakpoint test and the
// Alt/Option selector inspector.
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
			// A plain modal <dialog>, closed like the terminal: the native Esc
			// cancel, the "Go back" button (method="dialog"), or a click on the
			// dimmed backdrop (outside the report).
			dialog.addEventListener('click', (e) => {
				if (e.target === dialog) dialog.close();
			});

			// Opening the page directly at #404 (e.g. a shared link) shows the
			// report; strip the hash so closing leaves a clean URL.
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
				'%cHi there 👋%c\n\nThere\'s a bug hiding on this page. Think like a tester and go find it.\n\nPsst: type help to open the console.',
				'font: 700 20px Georgia, serif; color: #4f46e5;',
				'font: 13px ui-monospace, Menlo, monospace; color: inherit;'
			);
		});
	}

	// Find-in-page egg: a footer line (#find-egg) carries the page's only "bug",
	// marked hidden="until-found". The browser keeps it invisible and out of
	// layout but still searchable by native Find — on desktop AND mobile — so
	// scrolling never reveals it, only a search does. When Find matches inside
	// it, the browser reveals it and fires `beforematch`; we use that to pop a
	// toast and flash the word red. No getSelection polling, no shortcut
	// hijacking. In browsers without hidden=until-found support the line is just
	// plainly hidden and the egg quietly doesn't exist.
	{
		const egg = document.getElementById('find-egg');
		const word = egg && egg.querySelector('.find-egg-word');
		if (egg && 'onbeforematch' in document.body) {
			let rehideTimer;

			// `beforematch` fires just before the UA reveals the element. The toast
			// and the red flash celebrate the find; after a beat we re-hide the line
			// (restoring hidden="until-found") so it's invisible again and can be
			// re-found later.
			egg.addEventListener('beforematch', () => {
				if (word) word.classList.add('found');
				site.toast('🐛 You searched for a bug — and found one.\nStatus: won\'t fix (it\'s a feature).', 4000);
				clearTimeout(rehideTimer);
				rehideTimer = setTimeout(() => {
					if (word) word.classList.remove('found');
					// Re-arm: put it back into the hidden-until-found state.
					egg.setAttribute('hidden', 'until-found');
				}, 3200);
			});
		}
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
		const coarse = site.media('(pointer: coarse)');
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
				// Party hat: tall, narrow pink cone with confetti dots, a zigzag
				// ruffle at the base and a burst of streamers on top. Deliberately
				// colourful and pointy so it can't be mistaken for the Santa hat.
				// No ids/clipPaths, so the markup is safe to repeat.
				return '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
					// streamers bursting from the tip
					'<g fill="none" stroke-width="2.4" stroke-linecap="round">' +
					'<path d="M24 8 L18.5 2.5" stroke="#14b8a6"/>' +
					'<path d="M24 8 L24 1" stroke="#facc15"/>' +
					'<path d="M24 8 L29.5 2.5" stroke="#3b82f6"/>' +
					'</g>' +
					// cone body, with a darker right side for a bit of depth
					'<path d="M24 8 L35 42 H13 Z" fill="#ec4899"/>' +
					'<path d="M24 8 L35 42 H26.5 Z" fill="#be185d" opacity="0.45"/>' +
					// confetti dots (all inside the cone)
					'<circle cx="24.6" cy="17" r="1.6" fill="#fff"/>' +
					'<circle cx="21" cy="24" r="2.1" fill="#facc15"/>' +
					'<circle cx="27.4" cy="29" r="2.1" fill="#22d3ee"/>' +
					'<circle cx="19" cy="35.5" r="2.1" fill="#22d3ee"/>' +
					'<circle cx="25.5" cy="37.5" r="1.8" fill="#fff"/>' +
					'<circle cx="30.5" cy="36" r="1.6" fill="#facc15"/>' +
					// zigzag ruffle along the base
					'<path d="M11.5 40 H36.5 V42 L34 45 L31.5 42 L29 45 L26.5 42 L24 45 L21.5 42 L19 45 L16.5 42 L14 45 L11.5 42 Z" fill="#facc15"/>' +
					// pom on the tip
					'<circle cx="24" cy="8" r="2.6" fill="#facc15"/>' +
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

	// Resize-as-input egg: squeeze the window below the minimum width OR height
	// and a responsive test "fails", taking over the whole screen with a failure
	// report; grow it back and the page comes back. The browser window edge
	// (or a docked DevTools panel squeezing the page) is the controller.
	//
	// On touch devices (and DevTools device mode, which emulates touch) only
	// the width counts, so keyboards, toolbars and landscape never trigger it;
	// real phones are always at least 320px wide. We measure the painted size
	// (visualViewport first) and only react once the page has been seen at a
	// comfortable size, so a small window on load doesn't fail on arrival.
	{
		const MIN_W = 320;
		const MIN_H = 480;
		let failing = false;
		let everOk = false;      // seen a size that passes both thresholds
		let lastW = -1, lastH = -1;

		const vv = window.visualViewport;
		// Multiply by scale so pinch-zoom (which shrinks the visual viewport but
		// not the layout) isn't mistaken for a small screen. Ctrl/Cmd +/- zoom
		// still counts, since that genuinely reflows the page.
		const scale = () => (vv && vv.scale) || 1;
		const width = () => Math.round(vv ? vv.width * scale() : window.innerWidth);
		const height = () => Math.round(vv ? vv.height * scale() : window.innerHeight);

		let overlay = null;

		// Full-screen "failed test report" that covers the whole page while the
		// viewport is too small. It's an overlay (fixed, inset:0) rather than a
		// real replacement of document.body, so the rest of the page — and every
		// other egg — survives untouched and comes right back on resize.
		const show = (w, h, heightCounts) => {
			if (!overlay) {
				overlay = document.createElement('div');
				overlay.className = 'responsive-fail';
				overlay.setAttribute('role', 'alertdialog');
				overlay.setAttribute('aria-live', 'assertive');
				overlay.setAttribute('aria-label', 'test_responsive failed');
				document.body.appendChild(overlay);
			}
			// Mark whichever axis (or both) is under its threshold.
			const wBad = w < MIN_W, hBad = heightCounts && h < MIN_H;
			const wCls = wBad ? 'report-fail' : 'report-pass';
			const hCls = hBad ? 'report-fail' : 'report-pass';
			const axis = wBad && hBad ? 'width and height' : wBad ? 'width' : 'height';
			const grow = wBad && hBad ? 'Grow the window past ' + MIN_W + '×' + MIN_H
				: wBad ? 'Widen the window past ' + MIN_W + 'px'
				: 'Heighten the window past ' + MIN_H + 'px';
			overlay.innerHTML =
				'<div class="report responsive-report">' +
					'<header class="report-head">' +
						'<span class="report-badge">FAILED</span>' +
						'<h2>test_responsive · layout_should_hold</h2>' +
					'</header>' +
					'<pre class="report-body">' +
						'<span class="report-error">AssertionError: viewport ' + axis + ' below minimum</span>\n\n' +
						'  <span class="report-dim">min size:    </span> <span class="report-pass">' + MIN_W + '×' + MIN_H + 'px</span>\n' +
						'  <span class="report-dim">actual width: </span> <span class="' + wCls + '">' + w + 'px</span>\n' +
						'  <span class="report-dim">actual height:</span> <span class="' + hCls + '">' + h + 'px</span>\n\n' +
						'  <span class="report-dim">at</span> Layout.reflow (<span class="report-path">viewport:' + w + 'x' + h + '</span>)\n' +
						'  <span class="report-dim">at</span> Visitor.resize (<span class="report-path">browser/chrome</span>)\n\n' +
						'<span class="report-dim">' + grow + ' to re-run.</span>' +
					'</pre>' +
				'</div>';
		};

		const hide = () => {
			if (overlay) { overlay.remove(); overlay = null; }
		};

		// Desktop (mouse/trackpad) checks width AND height. Touch devices check
		// width only: on a real phone the height shrinks all the time (on-screen
		// keyboard, browser toolbars, landscape), but the width never drops below
		// 320px. DevTools device mode also reports touch, so there the egg is
		// triggered by dragging the width below 320px.
		const desktop = site.media('(hover: hover) and (pointer: fine)');

		const check = () => {
			const w = width();
			// On touch, report the real height but never fail on it.
			const h = height();
			if (w === lastW && h === lastH) return; // nothing changed
			const changed = lastW !== -1; // -1 means this is the very first measure
			lastW = w; lastH = h;

			const heightCounts = desktop.matches;
			const ok = w >= MIN_W && (!heightCounts || h >= MIN_H);
			if (ok) everOk = true;
			// React once we've either seen a comfortable size OR observed the size
			// actively change (someone is dragging the edge / the device toolbar).
			// Only the first measurement on a device that simply loaded small is
			// suppressed, so it won't false-fire on arrival.
			if (!everOk && !changed) return;

			if (!ok) {
				failing = true;
				show(w, h, heightCounts); // keep the numbers current as it shrinks further
			} else if (failing) {
				failing = false;
				hide();
			}
		};

		// Coalesce bursts of resize/scroll events into one check per frame.
		let queued = false;
		const schedule = () => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => { queued = false; check(); });
		};

		window.addEventListener('resize', schedule, { passive: true });
		if (vv) {
			vv.addEventListener('resize', schedule, { passive: true });
			vv.addEventListener('scroll', schedule, { passive: true });
		}
		// Input type can change (DevTools device mode toggled, tablet docked).
		site.onMediaChange(desktop, () => { lastW = lastH = -1; schedule(); });
		check();
	}

	// Selector inspector egg: hold Alt (Option on Mac) and hover any element to
	// see the kind of locator a Selenium test would use for it — an outline on
	// the target plus a floating "By.cssSelector(...)" label by the cursor.
	// Pure read-only; it never changes the page. Pointer only (needs a hover).
	{
		const coarse = site.media('(pointer: coarse)');
		if (!coarse.matches) {
			const root = document.documentElement;
			let armed = false;      // Alt is currently held
			let labelEl = null;     // the floating locator chip
			let outlined = null;    // the element currently outlined
			let lastX = 0, lastY = 0;

			// A simple one-element CSS selector, Selenium-style, most stable first:
			//   #id                 when it has an id
			//   tag[name='…']       for named form controls
			//   tag.class.class     when it has classes
			//   tag:nth-of-type(n)  position among same-tag siblings
			//   tag                 bare fallback
			function simpleSelector(el) {
				if (el.id) return '#' + CSS.escape(el.id);
				const tag = el.tagName.toLowerCase();
				const name = el.getAttribute('name');
				if (name) return tag + '[name=\'' + name + '\']';

				let base = tag;
				// Ignore the inspector's own marker class so it never leaks into the
				// generated selector (otherwise everything reads as "tag.sel-target").
				const cls = (el.getAttribute('class') || '').trim().split(/\s+/)
					.filter(Boolean).filter((c) => c !== 'sel-target');
				if (cls.length) base = tag + '.' + cls.slice(0, 3).map((c) => CSS.escape(c)).join('.');

				// Disambiguate by position whenever there are same-tag siblings, so
				// repeated siblings (e.g. several <article class="project">, or an
				// <img>/<h3>/<p> that looks identical in every card) stay distinct
				// instead of collapsing to one shared, ambiguous selector.
				const parent = el.parentElement;
				if (parent) {
					const sibs = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
					if (sibs.length > 1) base += ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')';
				}
				return base;
			}

			// How many nodes a selector matches; 0 if the selector is invalid, so a
			// bad selector never throws out of the locator builder (which would
			// leave the chip stuck on the previous element).
			function countMatches(selector) {
				try { return document.querySelectorAll(selector).length; }
				catch (e) { return 0; }
			}

			// Try to build a CSS selector that matches EXACTLY this element. We walk
			// up the tree joining each step with the child combinator ">", so
			// :nth-of-type stays accurate. The climb short-circuits as soon as it
			// reaches an ancestor with a unique id (e.g. #project-wine), anchoring
			// there — that's what keeps every card's .project-body / .project-image
			// distinct, since each card <article> has its own id. Returns the unique
			// selector, or null if CSS alone can't pin it down.
			function uniqueCss(el) {
				let selector = simpleSelector(el);
				if (countMatches(selector) === 1) return selector;

				let node = el;
				let guard = 0;
				while (node.parentElement && node.parentElement !== document.documentElement && guard++ < 40) {
					const parent = node.parentElement;
					// Anchor on an ancestor id when it's unique: stop climbing here.
					if (parent.id && countMatches('#' + CSS.escape(parent.id)) === 1) {
						selector = '#' + CSS.escape(parent.id) + ' > ' + selector;
						return countMatches(selector) === 1 ? selector : null;
					}
					if (parent === document.body) break;
					selector = simpleSelector(parent) + ' > ' + selector;
					node = parent;
					if (countMatches(selector) === 1) return selector;
				}
				return countMatches(selector) === 1 ? selector : null;
			}

			// Absolute positional XPath, e.g. /html/body/main/section[2]/article[1]/div[2]/h3[1].
			// Always unique by construction, used only when CSS can't disambiguate.
			function absoluteXPath(el) {
				const parts = [];
				for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
					const tag = node.tagName.toLowerCase();
					let n = 1;
					for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
						if (sib.tagName === node.tagName) n++;
					}
					parts.unshift(tag + '[' + n + ']');
				}
				return '/' + parts.join('/');
			}

			// Pick the most robust locator, in priority order:
			//   1. By.id          — when the element has a unique id
			//   2. By.cssSelector — a CSS selector that resolves to exactly one node
			//   3. By.xpath       — absolute positional path, when CSS can't be unique
			function locatorFor(el) {
				// 1. id (ids should be unique; verify it really is on this page).
				if (el.id && countMatches('#' + CSS.escape(el.id)) === 1) {
					return 'By.id("' + el.id + '")';
				}
				// 2. unique CSS.
				const css = uniqueCss(el);
				if (css) return 'By.cssSelector("' + css + '")';
				// 3. XPath fallback.
				return 'By.xpath("' + absoluteXPath(el) + '")';
			}

			function ensureLabel() {
				if (labelEl) return labelEl;
				labelEl = document.createElement('div');
				labelEl.className = 'sel-inspector';
				labelEl.setAttribute('aria-hidden', 'true');
				document.body.appendChild(labelEl);
				return labelEl;
			}

			function clearOutline() {
				if (outlined) { outlined.classList.remove('sel-target'); outlined = null; }
			}

			function teardown() {
				armed = false;
				root.classList.remove('sel-inspecting');
				clearOutline();
				if (labelEl) { labelEl.remove(); labelEl = null; }
			}

			// Place the chip near the cursor, flipping it so it stays on screen.
			function positionLabel() {
				if (!labelEl) return;
				const pad = 14;
				const rect = labelEl.getBoundingClientRect();
				let lx = lastX + pad;
				let ly = lastY + pad;
				if (lx + rect.width > window.innerWidth) lx = lastX - rect.width - pad;
				if (ly + rect.height > window.innerHeight) ly = lastY - rect.height - pad;
				labelEl.style.left = Math.max(4, lx) + 'px';
				labelEl.style.top = Math.max(4, ly) + 'px';
			}

			// Each project card uses a "stretched link": the button's ::after is
			// absolutely positioned over the WHOLE card, so the browser reports the
			// button as the hover target everywhere on the card — the image, title
			// and text never become e.target. To inspect what's really under the
			// cursor, peek past that overlay with elementsFromPoint and pick the
			// first element that ISN'T the stretched button (or its wrapper).
			function resolveTarget(el) {
				const stretched = el.closest && el.closest('.project .button');
				if (!stretched) return el;

				// If the cursor is within the button's own painted box, it really is
				// on the button — report it as-is.
				const r = stretched.getBoundingClientRect();
				if (lastX >= r.left && lastX <= r.right && lastY >= r.top && lastY <= r.bottom) {
					return stretched;
				}

				// Otherwise the cursor is over the invisible ::after overlay that
				// covers the rest of the card. Look past it for the real element.
				const card = stretched.closest('.project');
				const stack = document.elementsFromPoint(lastX, lastY);
				for (const node of stack) {
					if (node === stretched || node === labelEl) continue;
					if (stretched.contains(node)) continue;      // the button's own text
					if (card && card.contains(node)) return node; // real card part under cursor
				}
				return stretched; // nothing behind it: keep the button
			}

			function update(el) {
				if (!el || el === labelEl) return;
				el = resolveTarget(el);

				// The hero test grid is a single <canvas> with pointer-events:none,
				// so a dot is never the literal event target — the hero behind it
				// is. Hit-test the grid by cursor position: if a dot is under the
				// cursor, outline the whole canvas and report that cell's locator,
				// e.g. By.cssSelector("[data-test='test_404']"). This gives both
				// "the grid is selectable" and "each test is selectable".
				let locator;
				if (site.gridTestAt && site.gridCanvas) {
					const id = site.gridTestAt(lastX, lastY);
					if (id) {
						el = site.gridCanvas; // outline the grid, not the backdrop
						locator = 'By.cssSelector("[data-test=\'' + id + '\']")';
					}
				}

				// Compute the locator BEFORE marking the element, so the marker
				// class can't affect the DOM the selector is built from.
				const text = locator || locatorFor(el);

				if (el !== outlined) {
					clearOutline();
					outlined = el;
					el.classList.add('sel-target');
				}
				const chip = ensureLabel();
				chip.textContent = text;
				positionLabel();
			}

			document.addEventListener('keydown', (e) => {
				// Alt by itself arms the inspector (ignore Alt+Tab style combos).
				if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !armed) {
					armed = true;
					root.classList.add('sel-inspecting');
					const el = document.elementFromPoint(lastX, lastY);
					if (el) update(el);
				}
			});
			// Releasing Alt, leaving the window, or losing focus tears it all down.
			document.addEventListener('keyup', (e) => { if (e.key === 'Alt') teardown(); });
			window.addEventListener('blur', teardown);

			document.addEventListener('mousemove', (e) => {
				lastX = e.clientX;
				lastY = e.clientY;
				if (armed) update(e.target);
			}, { passive: true });
		}
	}

	// Typo hunt: the scroll hint label reads "Scrol". One click fixes it. It sits
	// outside the scroll link, so the link (the band below it) keeps working.
	{
		const label = document.getElementById('scroll-hint-label');
		if (label && label.classList.contains('is-typo')) {
			label.addEventListener('click', () => {
				// Once fixed, the label behaves like the scroll link below it.
				if (!label.classList.contains('is-typo')) {
					const link = document.getElementById('scroll-hint');
					if (link) link.click();
					return;
				}
				label.classList.remove('is-typo');
				label.classList.add('is-link');
				label.textContent = 'Scroll';
				label.classList.add('is-fixed');
				setTimeout(() => label.classList.remove('is-fixed'), 1200);
				site.toast('Spellcheck test passed ✓\nOne of many discoveries hidden on this site. Keep exploring.', 4000);
			});
		}
	}

	// Idle moth: after 15s with no input (tab visible), a moth (a nod to the 1947
	// Harvard Mark II bug) flutters around the screen. Click/tap it to catch it.
	// rearmMoth() lets it appear once more (used by "Restore environment").
	let rearmMoth = () => {};
	{
		const IDLE_MS = 15000;
		let idleTimer;
		let moth = null;
		// Once it has appeared, it stays gone for the whole session (reloads
		// included) until "Restore environment" re-arms it.
		const SEEN_KEY = 'moth-seen';
		const seen = {
			get() { try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } },
			set() { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {} },
			clear() { try { sessionStorage.removeItem(SEEN_KEY); } catch (e) {} }
		};
		let spawned = seen.get();
		let raf = 0;

		const SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor">' +
			'<path d="M24 16c-6-9-20-12-21-4-1 7 9 12 19 12z" opacity=".85"/>' +
			'<path d="M24 16c6-9 20-12 21-4 1 7-9 12-19 12z" opacity=".85"/>' +
			'<path d="M23 24c-5 1-15 6-12 12 3 5 10-2 12-8z" opacity=".7"/>' +
			'<path d="M25 24c5 1 15 6 12 12-3 5-10-2-12-8z" opacity=".7"/>' +
			'<ellipse cx="24" cy="25" rx="2.2" ry="9"/></g>' +
			'<path d="M23 16q-3-6-7-8M25 16q3-6 7-8" stroke="currentColor" fill="none" stroke-width="1.2"/></svg>';

		let announced = false;
		function announce() {
			if (announced || !moth) return;
			announced = true;
			site.toast('Bored? Catch the bug 🦋', 4000);
		}
		window.addEventListener('focus', announce);

		function release() {
			if (!moth) return;
			cancelAnimationFrame(raf);
			moth.classList.add('is-gone');
			const el = moth;
			moth = null;
			setTimeout(() => el.remove(), 400);
		}

		function spawn() {
			// Not while the page is washed out: it would fly unseen under the overlay.
			if (spawned || document.hidden || document.documentElement.classList.contains('is-washed')) return;
			spawned = true;
			seen.set();
			ACTIVITY.forEach((t) => window.removeEventListener(t, reset));
			moth = document.createElement('button');
			moth.type = 'button';
			moth.className = 'idle-moth';
			moth.setAttribute('aria-label', 'Catch the moth');
			moth.innerHTML = SVG;
			document.body.appendChild(moth);
			// If the moth appears while another app has focus, the toast would go
			// unseen; hold it until the visitor comes back (see the focus listener).
			if (document.hasFocus()) announce();

			const w = () => window.innerWidth - 48;
			const h = () => window.innerHeight - 48;
			let x = Math.random() < 0.5 ? -48 : window.innerWidth;
			let y = Math.random() * h();
			let angle = Math.random() * Math.PI * 2;
			// Pixels per second (time-based, so 120Hz screens aren't twice as fast).
			const speed = site.reduceMotion.matches ? 25 : 70;
			let hovered = false;
			let rest = 0; // ms left of a pause on the spot
			let last = performance.now();

			const el = moth;
			// pointerdown, not click: the moth moves between press and release, so a
			// click (down + up on the same element) often never fires. click stays
			// for keyboard (Enter/Space) users.
			const catchIt = () => {
				if (moth !== el) return;
				el.classList.add('is-caught');
				cancelAnimationFrame(raf);
				moth = null;
				site.toast('Bug caught 🪲 Logged in the 1947 report: "First actual case of bug being found."', 4000);
				setTimeout(() => el.remove(), 600);
			};
			el.addEventListener('pointerdown', catchIt);
			el.addEventListener('click', catchIt);
			// Hovering slows it right down so it can actually be caught.
			el.addEventListener('pointerenter', () => { hovered = true; });
			el.addEventListener('pointerleave', () => { hovered = false; });

			const step = (now) => {
				const dt = Math.min(now - last, 50);
				last = now;
				raf = requestAnimationFrame(step);
				// Now and then it lands and rests, like a real moth.
				if (rest > 0) { rest -= dt; return; }
				if (Math.random() < 0.004) rest = 600 + Math.random() * 900;
				// Gentle random wander, steered back toward the screen near an edge.
				angle += (Math.random() - 0.5) * 0.25;
				const cx = w() / 2, cy = h() / 2;
				if (x < 0 || x > w() || y < 0 || y > h()) {
					angle += (Math.atan2(cy - y, cx - x) - angle) * 0.15;
				}
				const d = (speed * (hovered ? 0.25 : 1) * dt) / 1000;
				x += Math.cos(angle) * d;
				y += Math.sin(angle) * d;
				el.style.transform = `translate(${x}px, ${y}px) rotate(${angle + Math.PI / 2}rad)`;
			};
			raf = requestAnimationFrame(step);
		}

		function reset() {
			clearTimeout(idleTimer);
			if (!spawned && !document.hidden) idleTimer = setTimeout(spawn, IDLE_MS);
		}

		// Activity resets the timer. The moth appears once per session and stays
		// until caught or the tab is left; after that the egg is done until the
		// environment is restored.
		const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'];
		if (!spawned) ACTIVITY.forEach((t) => window.addEventListener(t, reset, { passive: true }));
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) release();
			reset();
		});
		reset();

		rearmMoth = () => {
			if (moth) return; // still flying: nothing to do
			seen.clear();
			spawned = false;
			announced = false;
			// Back to the normal rule: appear after 15s with no input.
			ACTIVITY.forEach((t) => window.addEventListener(t, reset, { passive: true }));
			reset();
		};
	}

	// Reload wash-out: the inline <head> script counts reloads and sets --fade.
	// Here: nudge toasts on the way, and the "cleared" screen at 100%.
	{
		const root = document.documentElement;
		const n = +root.dataset.reloads || 0;
		const fade = parseFloat(root.style.getPropertyValue('--fade')) || 0;

		// One nudge at the end of each 5-reload stage; reload 21 is the final screen.
		const NUDGES = {
			5: 'Rerun #5. Same result.',
			10: 'Is it just me…?',
			15: 'Still refreshing…',
			20: 'One more and the environment is gone.',
		};
		if (NUDGES[n]) {
			site.toast(NUDGES[n], 3000);
			// Lift the toast out of <body> so the white overlay can't wash it out.
			const t = document.querySelector('.toast');
			if (t) {
				t.classList.add('is-above-fade');
				// Mostly white by now: dark-theme light text would vanish.
				t.classList.toggle('is-on-white', fade >= 0.5);
				root.appendChild(t);
			}
		}

		if (fade >= 1) {
			root.classList.add('is-washed');
			const box = document.createElement('div');
			box.className = 'washed';
			box.setAttribute('role', 'alertdialog');
			box.setAttribute('aria-label', 'Environment cleared');
			box.innerHTML = '<p>✓ Cache cleared. Page cleared. Have you tried turning it off and on again?</p>' +
				'<button type="button">Restore environment</button>';
			// On <html>, not <body>: body is its own stacking context, so anything
			// inside it can't rise above the html::after overlay.
			root.appendChild(box);
			const button = box.querySelector('button');
			button.focus();

			button.addEventListener('click', () => {
				try { sessionStorage.removeItem('reloads'); } catch (e) {}
				box.classList.add('is-leaving');
				root.classList.remove('is-washed');
				root.classList.add('is-restoring');
				// Next frame, so the transition runs from the current value.
				requestAnimationFrame(() => root.style.setProperty('--fade', '0'));
				const done = site.reduceMotion.matches ? 0 : 1600;
				setTimeout(() => {
					box.remove();
					root.classList.remove('is-restoring');
					root.style.removeProperty('--fade');
					delete root.dataset.reloads;
					// Fresh environment, fresh bugs.
					rearmMoth();
				}, done);
			}, { once: true });
		}
	}
})();
