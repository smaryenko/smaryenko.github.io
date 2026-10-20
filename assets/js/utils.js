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
				if (site.report) site.report('i11');
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
				'%cHi there 👋%c\n\nThere\'s a bug hiding on this page. Think like a tester and go find it.\n\nPsst: type help to open the console.\nCurious how the tests are doing? Try site.testStats().',
				'font: 700 20px Georgia, serif; color: #4f46e5;',
				'font: 13px ui-monospace, Menlo, monospace; color: inherit;'
			);
		});
	}

	// Find-in-page egg: a hero line (#find-egg) carries the page's only "bug",
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
				if (site.report) site.report('i16');
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
				if (site.report) site.report('i5');
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

	// Dead pixel: a single pixel fixed on the screen. Clicking/tapping within ±4px
	// shows a toast. Once fixed it's recorded in the persistent log and stays gone
	// (even in new tabs) until `reset --hard`.
	{
		// Mouse: ±4px around the pixel. Finger taps are far less precise, so allow more.
		const TOLERANCE = 4;
		const TOUCH_TOLERANCE = 12;
		const coarse = site.media('(pointer: coarse)');
		let x = 0, y = 0;

		const px = document.createElement('div');
		px.className = 'dead-pixel';
		px.setAttribute('aria-hidden', 'true');
		let armed = false;

		// Fraction of the viewport, rounded to whole pixels so it stays crisp.
		const place = () => {
			x = Math.round(window.innerWidth * 0.53);
			y = Math.round(window.innerHeight * 0.25);
			px.style.left = x + 'px';
			px.style.top = y + 'px';
		};

		// Hit-tested on the document (capture), so it works even if something sits on top.
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

		const arm = () => {
			if (armed) return;
			armed = true;
			document.body.appendChild(px);
			place();
			window.addEventListener('resize', place);
			document.addEventListener('mousemove', onMove, { passive: true });
			document.addEventListener('click', onClick, true);
		};

		const onClick = (e) => {
			if (!isHit(e)) return;
			armed = false;
			// Resolved state lives in the persistent log, so a new tab counts it
			// fixed and the pixel never comes back until `reset --hard`.
			if (site.report) site.report('i6');
			px.remove();
			root.classList.remove('on-dead-pixel');
			window.removeEventListener('resize', place);
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('click', onClick, true);
			site.toast('Dead pixel fixed ✓\nNo need to replace your screen yet', 4000);
		};

		// Only arm it if it hasn't been fixed before (any tab, any session).
		if (!(site.isResolved && site.isResolved('i6'))) arm();
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
			if (site.report) site.report('i2');
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
		// not the layout) isn't mistaken for a small screen.
		const scale = () => (vv && vv.scale) || 1;
		const vpWidth = () => Math.round(vv ? vv.width * scale() : window.innerWidth);
		const vpHeight = () => Math.round(vv ? vv.height * scale() : window.innerHeight);

		// On desktop, measure the browser window itself: outer size is in screen
		// pixels and ignores Ctrl/Cmd +/- zoom, so zooming in for readability
		// never fails the test. outerHeight includes tabs/toolbar, so subtract a
		// rough allowance to approximate the content area.
		const CHROME_H = 100;
		const useOuter = () => desktop.matches && window.outerWidth > 0 && window.outerHeight > 0;
		const width = () => useOuter() ? window.outerWidth : vpWidth();
		const height = () => useOuter() ? Math.max(0, window.outerHeight - CHROME_H) : vpHeight();

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
				if (site.report) site.report('i9');
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
				if (site.report) site.report('i10');
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
	// Once fixed it stays fixed (persistent log) until `reset --hard`.
	{
		const label = document.getElementById('scroll-hint-label');
		if (label && label.classList.contains('is-typo')) {
			const setFixed = () => {
				label.classList.remove('is-typo');
				label.classList.add('is-link');
				label.textContent = 'Scroll';
			};
			// Fixed in any past visit: show it already fixed.
			if (site.isResolved && site.isResolved('i19')) setFixed();

			label.addEventListener('click', () => {
				// Once fixed, the label behaves like the scroll link below it.
				if (!label.classList.contains('is-typo')) {
					const link = document.getElementById('scroll-hint');
					if (link) link.click();
					return;
				}
				setFixed();
				// Record permanently so a new tab keeps it fixed until reset --hard.
				if (site.report) site.report('i19');
				label.classList.add('is-fixed');
				setTimeout(() => label.classList.remove('is-fixed'), 1200);
				site.toast('Spellcheck test passed ✓\nOne of many discoveries hidden on this site. Keep exploring.', 4000);
			});
		}
	}

	// Idle moth: after 15s with no input (tab visible), a moth (a nod to the 1947
	// Harvard Mark II bug) flutters around the screen. Click/tap it to catch it.
	{
		const IDLE_MS = 15000;
		let idleTimer;
		let moth = null;
		// "Caught" is tracked solely by the persistent issue log: catching the moth
		// calls site.report('i18'), so site.isResolved('i18') is true immediately
		// and stays true across idle periods, reloads and tabs — until reset --hard
		// clears localStorage. An uncaught moth records nothing, so it re-arms on a
		// refresh. No separate session flag is needed.
		const caughtBefore = () => site.isResolved && site.isResolved('i18');
		let spawned = caughtBefore();
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
			ACTIVITY.forEach((t) => window.removeEventListener(t, reset, true));
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
				// Record permanently (persistent log) so later idle periods, new tabs
				// and reloads all count it caught until reset --hard clears storage.
				if (site.report) site.report('i18');
				cancelAnimationFrame(raf);
				moth = null;
				site.toast('Bug caught 🪲 Just like the 1947 moth.\nA history of famous bugs hides somewhere on this page.', 5000);
				setTimeout(() => el.remove(), 600);
			};
			el.addEventListener('pointerdown', catchIt);
			el.addEventListener('click', catchIt);

			// While a modal <dialog> is open, the rest of the page is inert and the
			// moth gets no pointer events. Hit-test by position on the document
			// instead (capture phase), so it stays catchable and hoverable.
			const inside = (r, e) => e.clientX >= r.left && e.clientX <= r.right &&
				e.clientY >= r.top && e.clientY <= r.bottom;
			// Over the moth, but not where an open dialog covers it.
			const over = (e) => inside(el.getBoundingClientRect(), e) &&
				![...document.querySelectorAll('dialog[open]')]
					.some((d) => inside(d.getBoundingClientRect(), e));
			const onDocDown = (e) => {
				if (moth !== el) { document.removeEventListener('pointerdown', onDocDown, true); return; }
				if (!document.querySelector('dialog[open]') || !over(e)) return;
				// Don't let the same press also close the dialog (backdrop click).
				e.stopPropagation();
				document.removeEventListener('pointerdown', onDocDown, true);
				document.removeEventListener('pointermove', onDocMove, true);
				catchIt();
			};
			const onDocMove = (e) => {
				if (moth !== el) { document.removeEventListener('pointermove', onDocMove, true); return; }
				if (document.querySelector('dialog[open]')) hovered = over(e);
			};
			document.addEventListener('pointerdown', onDocDown, true);
			document.addEventListener('pointermove', onDocMove, true);
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
		// until caught or the tab is left. Catching it records the issue
		// permanently; `reset --hard` is the only thing that brings it back.
		const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'];
		// Capture phase, so handlers that stop propagation (e.g. text inputs)
		// still count as activity.
		const LISTEN = { passive: true, capture: true };
		if (!spawned) ACTIVITY.forEach((t) => window.addEventListener(t, reset, LISTEN));
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) release();
			reset();
		});
		reset();
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

		// Fade the page back from any wash level and clear the reload counter.
		// Shared by the 100% "cleared" screen and site.restoreEnvironment()
		// (callable even below 100%). Purely visual: it does not re-arm the
		// per-session eggs (dead pixel / moth / typo) or clear stored state, so a
		// plain restore leaves everything a visitor has already found alone. A
		// full wipe is the admin `reset --hard` (clears storage and reloads).
		const restore = (box) => {
			try { sessionStorage.removeItem('reloads'); } catch (e) {}
			// #20 resolves only on a full-wash restore (the 100% "cleared" screen),
			// and stays resolved for the session.
			if (box && site.report) site.report('i20');
			if (box) box.classList.add('is-leaving');
			root.classList.remove('is-washed');
			root.classList.add('is-restoring');
			// Next frame, so the transition runs from the current value.
			requestAnimationFrame(() => root.style.setProperty('--fade', '0'));
			const done = site.reduceMotion.matches ? 0 : 1600;
			setTimeout(() => {
				if (box) box.remove();
				root.classList.remove('is-restoring');
				root.style.removeProperty('--fade');
				delete root.dataset.reloads;
			}, done);
		};

		site.restoreEnvironment = () => {
			const box = document.querySelector('.washed');
			restore(box);
		};

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

			button.addEventListener('click', () => restore(box), { once: true });
		}
	}

	// Very low browser zoom: zooming out widens the CSS viewport, so the
	// inner/outer width ratio is ~4 at 25%. Desktop only.
	// --zoom-fix lets key UI counter-scale so it stays readable.
	{
		const desktop = site.media('(hover: hover) and (pointer: fine)');
		const root = document.documentElement;
		// outerWidth includes side panels/borders, which lowers the ratio a bit;
		// the next zoom step (33%) tops out at ~3.0.
		// Safari's minimum zoom is 50% (ratio ~2; next step up is ~1.6 or less).
		const isSafari = /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(navigator.userAgent);
		const MIN_ZOOM = isSafari ? 50 : 25;
		const THRESHOLD = isSafari ? 1.75 : 3.2;
		let on = false;
		let banner = null;

		const ratio = () => (window.outerWidth > 0 && window.innerWidth > 0)
			? window.innerWidth / window.outerWidth : 1;

		const enable = (z) => {
			on = true;
			if (site.report) site.report('i21');
			root.style.setProperty('--zoom-fix', z.toFixed(2));
			root.classList.add('is-overview');
			banner = document.createElement('div');
			banner.className = 'overview-banner';
			banner.setAttribute('aria-hidden', 'true');
			banner.innerHTML =
				'<span class="report-badge overview-badge">PASSED</span>' +
				'<span>coverage: 100% · zoom: ' + MIN_ZOOM + '%</span>';
			document.body.appendChild(banner);
			site.toast('Zoomed out far enough to see the whole picture 🔭\nEvery section covered.', 5000);
		};

		const disable = () => {
			on = false;
			root.classList.remove('is-overview');
			root.style.removeProperty('--zoom-fix');
			if (banner) { banner.remove(); banner = null; }
		};

		const check = () => {
			const z = ratio();
			const want = desktop.matches && z >= THRESHOLD;
			if (want && !on) enable(z);
			else if (!want && on) disable();
			else if (on) root.style.setProperty('--zoom-fix', z.toFixed(2));
		};

		let queued = false;
		window.addEventListener('resize', () => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => { queued = false; check(); });
		}, { passive: true });
		check();
	}

	// Footer section toggle.
	{
		const btn = document.getElementById('footer-stop');
		const deep = document.getElementById('deep');
		const top = document.getElementById('scroll');
		if (btn && deep) {
			let open = false;
			let armed = false; // checks start after the first scroll settles

			// Hide only once the area is fully below the viewport, so nothing jumps.
			const tryClose = () => {
				// Floating controls switch to dark styling once the dark area fills most of the screen.
				document.documentElement.classList.toggle('on-dark',
					open && deep.getBoundingClientRect().top < window.innerHeight / 2);
				if (!open || !armed) return;
				if (deep.getBoundingClientRect().top >= window.innerHeight) {
					open = armed = false;
					deep.hidden = true;
					document.documentElement.classList.remove('on-dark');
				}
			};

			// Adds extra decorative shapes once, spread over each tall zone.
			let filled = false;
			const populate = () => {
				if (filled) return;
				filled = true;
				const NS = 'http://www.w3.org/2000/svg';
				const rnd = (a, b) => a + Math.random() * (b - a);
				const shape = (cls, ref, style) => {
					const svg = document.createElementNS(NS, 'svg');
					svg.setAttribute('class', cls);
					svg.setAttribute('aria-hidden', 'true');
					svg.setAttribute('style', style);
					const use = document.createElementNS(NS, 'use');
					use.setAttribute('href', ref);
					svg.appendChild(use);
					return svg;
				};
				deep.querySelectorAll('.deep-zone').forEach((zone, z) => {
					const frag = document.createDocumentFragment();
					const kinds = ['', '2', '3', '4', '5'];
					const tints = ['rgba(2,20,34,.55)', 'rgba(2,20,34,.35)', 'rgba(170,200,210,.3)', 'rgba(40,110,120,.45)', 'rgba(90,70,50,.45)', 'rgba(120,150,190,.3)'];
					const pick = (a) => a[Math.floor(Math.random() * a.length)];
					for (let i = 0; i < 40; i++) {
						const back = Math.random() < 0.5 ? ' is-back' : '';
						// Small fish swim faster than big ones
						const size = rnd(0.4, 2.4);
						const speed = (10 + size * 9) * rnd(0.8, 1.3);
						frag.appendChild(shape('deep-fish' + back, '#d-fish' + pick(kinds),
							`--y:${rnd(1, 99).toFixed(1)}%;--t:${speed.toFixed(1)}s;--s:${size.toFixed(2)};--delay:-${rnd(0, 30).toFixed(1)}s;--wy:${rnd(-60, 60).toFixed(0)}px;--wt:${rnd(2, 6).toFixed(1)}s;color:${pick(tints)}`));
					}
					for (let i = 0; i < 12; i++) {
						const glow = z > 0 && Math.random() < 0.7 ? ' is-glow' : '';
						frag.appendChild(shape('deep-jelly' + glow, '#d-jelly',
							`--x:${rnd(3, 92).toFixed(1)}%;--y:${rnd(5, 99).toFixed(1)}%;--t:${rnd(8, 14).toFixed(1)}s;--delay:-${rnd(0, 50).toFixed(1)}s`));
					}
					zone.appendChild(frag);
				});
			};

			window.addEventListener('scroll', tryClose, { passive: true });
			if (top) top.addEventListener('click', () => { if (open) armed = true; });

			// A quick confirm step with a 5s auto-dismiss. Built in JS so it
			// stays out of the markup; styled like the other report dialogs.
			let confirmEl = null;
			let confirmTimer = 0;
			const askFirst = (proceed) => {
				// No modal <dialog> support: just go ahead.
				if (!site.canDialog) { proceed(); return; }
				if (confirmEl) return;
				const d = document.createElement('dialog');
				d.className = 'report confirm-warn';
				d.setAttribute('aria-labelledby', 'confirm-warn-title');
				d.innerHTML =
					'<header class="report-head">' +
						'<span class="report-badge is-warn">WARNING</span>' +
						'<h2 id="confirm-warn-title">entering a danger zone</h2>' +
					'</header>' +
					'<pre class="report-body">You are about to go somewhere there is no coming back from easily.<br>' +
						'<span class="report-dim">This prompt self-dismisses in <span class="confirm-count">5</span>s.</span></pre>' +
					'<div class="confirm-bar" aria-hidden="true"><span></span></div>' +
					'<div class="report-actions confirm-actions">' +
						'<button type="button" class="button confirm-no">Back to safety</button>' +
						'<button type="button" class="button confirm-yes">Go deeper anyway</button>' +
					'</div>';
				confirmEl = d;
				document.body.appendChild(d);

				const countEl = d.querySelector('.confirm-count');
				const DEADLINE = 5000;
				const startedAt = performance.now();
				const tick = () => {
					if (!confirmEl) return;
					const left = Math.ceil((DEADLINE - (performance.now() - startedAt)) / 1000);
					if (countEl) countEl.textContent = String(Math.max(0, left));
					if (left > 0) confirmTimer = window.setTimeout(tick, 250);
				};

				const cleanup = () => {
					window.clearTimeout(confirmTimer);
					confirmTimer = 0;
					if (confirmEl && confirmEl.open) confirmEl.close();
					if (confirmEl) confirmEl.remove();
					confirmEl = null;
				};
				const dismiss = () => cleanup();
				const accept = () => { cleanup(); proceed(); };

				d.querySelector('.confirm-yes').addEventListener('click', accept);
				d.querySelector('.confirm-no').addEventListener('click', dismiss);
				// Esc (native cancel) and backdrop clicks abort.
				d.addEventListener('cancel', (e) => { e.preventDefault(); dismiss(); });
				d.addEventListener('click', (e) => { if (e.target === d) dismiss(); });

				d.showModal();
				d.querySelector('.confirm-no').focus();
				tick();
				// Auto-dismiss after the countdown runs out.
				window.setTimeout(() => { if (confirmEl === d) dismiss(); }, DEADLINE);
			};

			// Resolve #22 only when the visitor actually reaches the bottom of the
			// dive (the "Here be dragons" line), not merely on confirming the warning.
			let bottomWatch = null;
			const watchBottom = () => {
				const end = deep.querySelector('.deep-end');
				if (!end || bottomWatch || !('IntersectionObserver' in window)) return;
				bottomWatch = new IntersectionObserver((entries) => {
					if (!entries.some((e) => e.isIntersecting)) return;
					if (site.report) site.report('i22');
					bottomWatch.disconnect();
					bottomWatch = null;
				});
				bottomWatch.observe(end);
			};

			const dive = () => {
				if (open) return;
				open = true;
				deep.hidden = false;
				populate();
				watchBottom();
				site.toast('Fine.\nBut if we\'re doing this, we need to go deeper.', 3500);
				const instant = site.reduceMotion.matches;
				const target = deep.querySelector('.deep-note');
				requestAnimationFrame(() => {
					const r = target.getBoundingClientRect();
					const from = window.scrollY;
					const to = from + r.top - (window.innerHeight - r.height) / 2;
					if (instant) {
						window.scrollTo({ top: to, behavior: 'instant' });
						armed = true;
						return;
					}
					// Slow eased scroll; any user input hands control back.
					const DURATION = 5000;
					const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
					let start = 0;
					let stopped = false;
					const stop = () => {
						stopped = true;
						armed = true;
						['wheel', 'touchstart', 'keydown'].forEach((e) => window.removeEventListener(e, stop));
					};
					['wheel', 'touchstart', 'keydown'].forEach((e) => window.addEventListener(e, stop, { passive: true }));
					const step = (now) => {
						if (stopped) return;
						if (!start) start = now;
						const t = Math.min(1, (now - start) / DURATION);
						window.scrollTo({ top: from + (to - from) * ease(t), behavior: 'instant' });
						if (t < 1) requestAnimationFrame(step);
						else stop();
					};
					requestAnimationFrame(step);
				});
			};

			btn.addEventListener('click', () => askFirst(dive));
		}
	}

	// Late-night state: once per night, at a per-night random minute between
	// 02:00 and 05:00 local time, the page flips into a "failing" state (red
	// section outlines + labels and a top-centre pill with a Fix button).
	// Checked on load and once a minute, so it appears on its own at the chosen
	// minute and clears itself at the 05:00 edge if left alone. Fixing it records
	// i23 permanently (never returns, any night). If it appears unresolved and is
	// dismissed or crosses 05:00, a per-night flag marks that night done so it
	// won't re-open until the next night.
	//
	// The effective clock is read through site.getClock(), which normally
	// returns the real time; site.setClock() can pin or release an override for
	// the current page view (used only for internal checks).
	{
		const START_H = 2;   // window opens at 02:00
		const END_H = 5;     // window closes at 05:00
		const root = document.documentElement;

		// Clock override, in-memory only for this page view.
		let override = null; // a Date, or null to use the real clock.
		site.getClock = () => (override ? new Date(override) : new Date());
		site.setClock = (date) => {
			override = date instanceof Date && !isNaN(date) ? date : null;
			check();
			return override ? 'ok.' : 'off.';
		};

		// A stable per-night key (the window sits inside one calendar day).
		const nightKey = (now) => now.getFullYear() + '-' +
			(now.getMonth() + 1) + '-' + now.getDate();

		// Per-night guard for the UNRESOLVED case only: if the incident appeared
		// tonight and was dismissed/expired without a fix, this stops it re-opening
		// on a reload later the same night. A fixed incident is covered by the
		// permanent issue log (isResolved('i23')) and never reaches here. The flag
		// stores the night key and is naturally stale once the key changes.
		const doneFlag = {
			get(key) { try { return sessionStorage.getItem('incident-done') === key; } catch (e) { return false; } },
			set(key) { try { sessionStorage.setItem('incident-done', key); } catch (e) {} }
		};

		// Deterministic hash of the night key, so every tab/reload that night
		// agrees on the same trigger minute and it varies from day to day.
		const hash = (str) => {
			let h = 2166136261;
			for (let i = 0; i < str.length; i++) {
				h ^= str.charCodeAt(i);
				h = Math.imul(h, 16777619);
			}
			return (h >>> 0);
		};

		// Minutes past midnight for this night's trigger (random within the
		// window, but fixed per night). Last minute is kept clear so there's
		// always room to notice it before the window closes.
		const triggerMinute = (now) => {
			const span = (END_H - START_H) * 60 - 1; // 02:00 .. 04:59
			return START_H * 60 + (hash(nightKey(now)) % span);
		};

		let pill = null;
		let active = false;
		let resolved = false;

		const pad = (n) => String(n).padStart(2, '0');

		const removePill = () => {
			if (!pill) return;
			const el = pill;
			pill = null;
			el.classList.add('is-leaving');
			const done = site.reduceMotion.matches ? 0 : 400;
			setTimeout(() => el.remove(), done);
		};

		const clearState = () => {
			active = false;
			resolved = false;
			root.classList.remove('is-incident', 'is-incident-resolved');
			removePill();
		};

		// Mark the current night finished so it doesn't re-open until tomorrow.
		const markDone = () => doneFlag.set(nightKey(site.getClock()));

		const resolve = () => {
			if (!active || resolved) return;
			resolved = true;
			// Resolving records i23 permanently; that alone keeps it from ever
			// returning, so no per-night flag is needed on this path.
			if (site.report) site.report('i23');
			root.classList.add('is-incident-resolved');
			if (pill) {
				pill.classList.add('is-resolved');
				const badge = pill.querySelector('.report-badge');
				if (badge) badge.textContent = 'PASSED';
				const btn = pill.querySelector('.incident-fix');
				if (btn) btn.remove();
			}
			site.toast('Hotfix deployed ✓ Now go to sleep.', 4000);
			// Hold the green beat, then clear everything.
			const beat = site.reduceMotion.matches ? 300 : 1200;
			setTimeout(clearState, beat);
		};

		const open = (now) => {
			if (active) return;
			active = true;
			resolved = false;
			// Mark the night done the moment it appears, so a same-night reload
			// (while still unfixed, still inside the window) does NOT re-open it.
			// It returns only the next night (new night key). A fix instead records
			// i23 permanently; dismissing just leaves this per-night flag set.
			markDone();
			root.classList.add('is-incident');

			pill = document.createElement('div');
			pill.className = 'incident-pill';
			pill.setAttribute('role', 'alert');
			const label = document.createElement('span');
			label.innerHTML = '<span class="report-badge">FAILED</span> prod incident · ' +
				pad(now.getHours()) + ':' + pad(now.getMinutes());
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'incident-fix';
			btn.textContent = 'Fix';
			btn.addEventListener('click', resolve);
			pill.appendChild(label);
			pill.appendChild(btn);
			document.body.appendChild(pill);

			site.toast('Go to sleep, the tests will still fail tomorrow.', 5000);
		};

		function check() {
			const now = site.getClock();
			const mins = now.getHours() * 60 + now.getMinutes();
			const inWindow = mins >= START_H * 60 && mins < END_H * 60;
			const key = nightKey(now);

			// An override forces the incident on regardless of clock or done flag.
			if (override) {
				if (!active) open(now);
				return;
			}

			// Resolved once (ever) means it never returns — the permanent issue
			// log is the source of truth, so no per-night flag is needed here.
			if (site.isResolved && site.isResolved('i23')) { if (!active) clearState(); return; }

			if (!inWindow || doneFlag.get(key)) {
				// Past the window, or already shown tonight: make sure nothing is
				// left on screen. The night flag was set when it first appeared.
				if (active) clearState();
				return;
			}

			// Inside the window and not yet handled: open once we reach the minute.
			if (!active && mins >= triggerMinute(now)) open(now);
		}

		check();
		setInterval(check, 60000);
	}

	// The hero role line reads as ordinary text, but the visible copy is drawn on
	// a canvas on top. Held-down scrubbing (a deliberate back-and-forth gesture,
	// not a stray swipe or a scroll) rubs those words away to a different line
	// underneath. Past ~65% erased the rest fades off on its own, the line below
	// shows, and the canvas retires for good (logged, so it stays plain
	// selectable text on later visits). An unfinished scratch just redraws so the
	// line is never left half-rubbed.
	{
		const target = document.getElementById('hero-role');
		const ID = 'i26';
		// No <canvas> / 2D context, or already found before: leave the line plain.
		const hasCanvas = (() => {
			try { return !!document.createElement('canvas').getContext('2d'); }
			catch (e) { return false; }
		})();

		if (target && hasCanvas && !(site.isResolved && site.isResolved(ID))) {
			const dpr = () => Math.min(window.devicePixelRatio || 1, 3);

			// The original line, drawn on the canvas so it looks like plain text.
			const ORIGINAL = (target.textContent || '').trim();
			// The line revealed underneath as the original is rubbed away. Light,
			// factual, CV-toned; must not repeat the original and hint at nothing.
			const PAYLOAD = 'Professional bug-finder & occasional bug-maker';

			let canvas = null;    // the top layer: the original text, drawn + erasable
			let ctx = null;
			let under = null;     // the payload text element, sitting underneath
			let boxes = [];       // per-line rects (relative to target box), for area
			let foilArea = 1;     // total painted area in CSS px² (sum of line boxes)
			let coatedBaseline = 0; // sampled painted-glyph pixel count after drawing
			let W = 0, H = 0;     // canvas CSS size
			let eraseR = 12;      // scratch radius, derived from line height
			let retired = false;  // reveal fired, canvas on its way out
			let revealing = false;

			// Make the role box a positioning context for the absolute overlays
			// without disturbing layout. It is restored on retire.
			const prevPos = target.style.position;
			target.style.position = target.style.position || 'relative';

			// Capture the real text colour BEFORE hiding the element's glyphs, so
			// the canvas copy is drawn in the right colour (not transparent).
			const realColor = window.getComputedStyle(target).color || '#888';

			// Hide the element's own glyphs (kept in the DOM for assistive tech) so
			// only the canvas copy shows; restored on retire.
			const prevColor = target.style.color;
			target.style.color = 'transparent';

			let font = '';        // CSS font shorthand captured from the element
			let textColor = realColor; // the real role text colour, drawn on the canvas
			let lineHeightPx = 0;

			// Measure the text's line boxes with a Range, so the coating can hug the
			// wrapped lines (ragged last line included) instead of one loose
			// rectangle. Falls back to the element box if Range rects aren't usable.
			function measure() {
				const host = target.getBoundingClientRect();
				W = Math.max(1, Math.ceil(host.width));
				H = Math.max(1, Math.ceil(host.height));

				// Capture the real font + colour so the canvas copy matches the line.
				const cs = window.getComputedStyle(target);
				const style = cs.fontStyle || 'normal';
				const weight = cs.fontWeight || '400';
				const size = cs.fontSize || '16px';
				const family = cs.fontFamily || 'serif';
				font = style + ' ' + weight + ' ' + size + ' ' + family;
				// cs.color is now transparent (we hid the real glyphs); use the
				// colour captured before hiding.
				textColor = realColor;
				lineHeightPx = parseFloat(cs.lineHeight) || (parseFloat(size) * 1.4);

				boxes = [];
				try {
					const range = document.createRange();
					range.selectNodeContents(target);
					const rects = range.getClientRects();
					for (const r of rects) {
						if (r.width < 1 || r.height < 1) continue;
						boxes.push({
							x: r.left - host.left,
							y: r.top - host.top,
							w: r.width,
							h: r.height
						});
					}
				} catch (e) { /* fall through */ }
				if (!boxes.length) boxes = [{ x: 0, y: 0, w: W, h: H }];

				// Line height drives the erase radius so scratching one line doesn't
				// bleed into its neighbour (lines sit close on a phone wrap).
				const lineH = boxes.reduce((m, b) => Math.min(m, b.h), Infinity);
				eraseR = Math.max(10, Math.min(24, lineH * 0.5));
				foilArea = boxes.reduce((s, b) => s + b.w * b.h, 0) || 1;
			}

			// Greedily wrap the original string into the measured line boxes, so the
			// drawn copy breaks at the same points as the real (now invisible) text.
			function wrapToBoxes() {
				const words = ORIGINAL.split(/\s+/).filter(Boolean);
				const lines = [];
				let wi = 0;
				for (let b = 0; b < boxes.length && wi < words.length; b++) {
					const max = boxes[b].w + 1;
					let line = '';
					while (wi < words.length) {
						const next = line ? line + ' ' + words[wi] : words[wi];
						if (ctx.measureText(next).width > max && line) break;
						line = next;
						wi++;
					}
					lines.push(line);
				}
				// Anything left (last box too tight) goes on the final line.
				if (wi < words.length) {
					lines[lines.length - 1] = (lines[lines.length - 1] + ' ' +
						words.slice(wi).join(' ')).trim();
				}
				return lines;
			}

			// Draw the original role line onto the canvas, matching the element's
			// font and colour so it reads as ordinary text (no foil, no cursor
			// hint). This copy is what gets rubbed away to reveal the payload.
			function paintText() {
				const scale = dpr();
				canvas.width = Math.max(1, Math.round(W * scale));
				canvas.height = Math.max(1, Math.round(H * scale));
				canvas.style.width = W + 'px';
				canvas.style.height = H + 'px';
				ctx.setTransform(scale, 0, 0, scale, 0, 0);
				ctx.clearRect(0, 0, W, H);

				ctx.font = font;
				ctx.fillStyle = textColor;
				ctx.textBaseline = 'middle';
				ctx.textAlign = 'left';

				const lines = wrapToBoxes();
				lines.forEach((text, i) => {
					const b = boxes[i] || boxes[boxes.length - 1];
					ctx.fillText(text, b.x, b.y + b.h / 2);
				});

				// Baseline of how many glyph pixels were painted, so the 65% target
				// is measured over the actual letters — not the box area.
				coatedBaseline = sampleCoated();
			}

			// Count sampled pixels that still carry drawn ink (alpha high). Blank
			// gaps between glyphs and rubbed-away pixels are both ~alpha 0, so the
			// drop from the baseline is how much of the text has been erased.
			function sampleCoated() {
				try {
					const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
					const d = img.data;
					let coated = 0;
					for (let i = 3; i < d.length; i += 16) { // alpha channel, every 4th px
						if (d[i] > 128) coated++;
					}
					return coated;
				} catch (e) { return coatedBaseline || 0; }
			}

			function build() {
				// Payload sits underneath, revealed as the top text is rubbed off.
				under = document.createElement('span');
				under.className = 'scratch-under';
				under.setAttribute('aria-hidden', 'true');
				under.textContent = PAYLOAD;

				// The erasable copy of the original line, on top.
				canvas = document.createElement('canvas');
				canvas.className = 'scratch-foil';
				canvas.setAttribute('aria-hidden', 'true');
				ctx = canvas.getContext('2d');

				target.appendChild(under);
				target.appendChild(canvas);
				measure();
				paintText();
			}

			// Carve a round-capped stroke along a path out of the coating.
			function eraseSegment(ax, ay, bx, by) {
				if (!ctx) return;
				ctx.save();
				ctx.globalCompositeOperation = 'destination-out';
				ctx.lineWidth = eraseR * 2;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				ctx.beginPath();
				ctx.moveTo(ax, ay);
				ctx.lineTo(bx, by);
				ctx.stroke();
				ctx.restore();
			}

			// Fraction of the ORIGINAL coating cleared, relative to the baseline
			// coated-pixel count (so it's measured over the glyph area, not the
			// bounding box). Throttled by the caller, not read every move.
			function clearedFraction() {
				if (!coatedBaseline) return 0;
				const stillCoated = sampleCoated();
				return Math.max(0, Math.min(1, 1 - stillCoated / coatedBaseline));
			}

			// --- Gesture detection ------------------------------------------------
			// A scratch only counts while the pointer is held down and moving over
			// the text AND the visitor has racked up >= 3 horizontal direction
			// reversals (a real back-and-forth scrub), after a short dwell. Hover, a
			// single tap, a straight flick or a vertical scroll never erase — the
			// line keeps touch-action: pan-y, so vertical scrolling over it stays
			// native and we only take over for a deliberate left-right scrub.
			const DWELL_MS = 60;
			const REVERSALS_NEEDED = 2;
			const REVEAL_AT = 0.65;
			const SAMPLE_MS = 150;

			let down = false;
			let armed = false;      // dwell satisfied
			let scrubbing = false;  // reversal threshold crossed: erasing is live
			let activeId = null;    // the single pointer we track (ignore multitouch)
			let pointerCount = 0;
			let dwellTimer = 0;
			let lastX = 0, lastY = 0;
			let lastDir = 0;        // sign of the last horizontal move
			let reversals = 0;
			let lastSample = 0;

			const localPoint = (e) => {
				const r = canvas.getBoundingClientRect();
				return { x: e.clientX - r.left, y: e.clientY - r.top };
			};

			// Is a point within the text line boxes (plus the erase radius)?
			function onFoil(x, y) {
				for (const b of boxes) {
					if (x >= b.x - eraseR && x <= b.x + b.w + eraseR &&
						y >= b.y - eraseR && y <= b.y + b.h + eraseR) return true;
				}
				return false;
			}

			function endGesture() {
				down = armed = scrubbing = false;
				activeId = null;
				lastDir = 0;
				reversals = 0;
				clearTimeout(dwellTimer);
			}

			function onDown(e) {
				if (retired || revealing) return;
				pointerCount++;
				// Any second pointer = pinch/scroll intent: abort the scratch.
				if (pointerCount > 1) { endGesture(); return; }
				if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return;
				const p = localPoint(e);
				if (!onFoil(p.x, p.y)) return;
				down = true;
				activeId = e.pointerId;
				lastX = p.x; lastY = p.y;
				lastDir = 0; reversals = 0; armed = false; scrubbing = false;
				// Short dwell arms the gesture, so a fast pass-through doesn't scratch.
				clearTimeout(dwellTimer);
				dwellTimer = setTimeout(() => { if (down) armed = true; }, DWELL_MS);
				// NB: no preventDefault / pointer capture here. touch-action stays
				// pan-y so a plain vertical drag still scrolls the page; we only take
				// over once a real horizontal scrub is detected (onMove).
			}

			function onMove(e) {
				if (!down || e.pointerId !== activeId || retired || revealing) return;
				if (pointerCount > 1) { endGesture(); return; }
				const p = localPoint(e);
				const dx = p.x - lastX;

				// Count horizontal direction reversals (the scrub signature).
				if (Math.abs(dx) > 1.5) {
					const dir = dx > 0 ? 1 : -1;
					if (lastDir && dir !== lastDir) reversals++;
					lastDir = dir;
				}
				if (!scrubbing && armed && reversals >= REVERSALS_NEEDED) {
					scrubbing = true;
					// Now it's clearly a scratch (not a scroll): grab the pointer so
					// the gesture stays with the line and the text isn't selected.
					try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
				}

				// Once scrubbing, suppress the default so the page doesn't also pan
				// and no text selection happens; until then, let the browser scroll.
				if (scrubbing) e.preventDefault();

				// Only actually remove the drawn text once the scrub is confirmed and
				// the pointer is over the glyph area.
				if (scrubbing && onFoil(p.x, p.y)) {
					eraseSegment(lastX, lastY, p.x, p.y);
					const now = performance.now();
					if (now - lastSample >= SAMPLE_MS) {
						lastSample = now;
						if (clearedFraction() >= REVEAL_AT) reveal();
					}
				}
				lastX = p.x; lastY = p.y;
			}

			function onUp(e) {
				if (pointerCount > 0) pointerCount--;
				if (e.pointerId === activeId) {
					try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
					endGesture();
				}
			}

			// Reaching 65%: rub the rest away on its own (fade), reveal the line,
			// log the issue, then retire the canvas to plain selectable text.
			function reveal() {
				if (revealing || retired) return;
				revealing = true;
				if (site.report) site.report(ID);
				site.toast('Scratch win 🎟\nYou rubbed the title away. Turns out it was hiding the real one.', 4500);

				const finish = () => {
					retired = true;
					if (canvas) canvas.remove();
					canvas = ctx = null;
					if (under) under.remove();
					under = null;
					// Hand the line back to normal flow: the element now shows the
					// revealed payload as plain, selectable, copyable text.
					target.textContent = PAYLOAD;
					target.style.color = prevColor;
					target.style.position = prevPos;
					detach();
				};

				// Bring the new line in as the old one's remnants clear.
				if (under) under.classList.add('is-shown');

				if (site.reduceMotion.matches) {
					// No fade: clear instantly, then remove after a short beat.
					if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
					setTimeout(finish, 3000);
					return;
				}
				// Fade the remaining old text out, then settle to plain text after ~3s.
				canvas.classList.add('is-revealing');
				setTimeout(finish, 3000);
			}

			// Keep the drawn copy sized to the text as the wrap point moves (resize,
			// orientation, font load). Skip once revealing/retired.
			let resizeQueued = false;
			function onResize() {
				if (retired || revealing || resizeQueued) return;
				resizeQueued = true;
				requestAnimationFrame(() => {
					resizeQueued = false;
					if (retired || revealing || !ctx) return;
					measure();
					paintText(); // redraw: a partial unfinished scratch resets to full text
					endGesture();
				});
			}

			function attach() {
				canvas.addEventListener('pointerdown', onDown);
				canvas.addEventListener('pointermove', onMove);
				canvas.addEventListener('pointerup', onUp);
				canvas.addEventListener('pointercancel', onUp);
				canvas.addEventListener('pointerleave', (e) => { if (e.pointerId === activeId) endGesture(); });
				window.addEventListener('resize', onResize, { passive: true });
				if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
			}

			function detach() {
				window.removeEventListener('resize', onResize);
			}

			build();
			attach();
		}
	}
})();
