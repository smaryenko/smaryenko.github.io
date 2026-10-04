// Hero decoration: a dot matrix of "test results" that glow and fade, with a
// periodic wave sweeping across like a test run. Hover a dot to inspect it,
// click a pink (failing) dot to fix it. Dots near the cursor light up.
(() => {
	const canvas = document.querySelector('.test-grid');
	const hero = document.querySelector('.hero');
	const tip = document.querySelector('.grid-tip');

	if (canvas && canvas.getContext && hero) init();

	function init() {
		const ctx = canvas.getContext('2d');
		const COLS = 22;
		const TOTAL = COLS * COLS;
		const NOT_FOUND = 403; // index of test_404
		const MAX_DPR = 2;     // backing-store pixel ratio cap
		const MAX_PX = 2048;   // backing-store edge cap, in device pixels
		const FRAME_MS = 1000 / 30; // decorative: 30 FPS is plenty
		const cells = [];
		const geo = [];        // per-dot { x, y, d }, rebuilt on resize
		let points = [];
		let size, step, raf, last = 0, waveStart = 0;
		let pointer = null, hovered = -1, fixedCount = 0, konamiStart = -1;
		let onScreen = true;

		// RGB palettes. Grey base = no status, indigo = queued, green = passed, red = failed.
		function palette() {
			return site.isDark()
				? { base: [168, 162, 158], queued: [129, 140, 248], pass: [74, 222, 128], fail: [248, 113, 113], baseA: 0.12 }
				: { base: [120, 113, 108], queued: [79, 70, 229], pass: [22, 163, 74], fail: [220, 38, 38], baseA: 0.14 };
		}
		let pal = palette();

		// Test lifecycle: none -> queued -> pass (80%) | fail (20%) -> none.
		// How long each state lasts, in ms [min, max]. Failures stay longer so they can be clicked.
		const HOLD = { none: [1500, 9000], queued: [1000, 3000], pass: [2000, 5000], fail: [5000, 10000] };
		const BRIGHT = { none: 0, queued: 0.6, pass: 0.85, fail: 0.9 };
		const BLEND = 450; // colour crossfade between states, ms

		const rand = (range) => range[0] + Math.random() * (range[1] - range[0]);

		function setKind(c, kind, now, hold) {
			// Remember the colour we're coming from so we can crossfade.
			c.prev = c.kind === 'none' ? kind : c.kind;
			if (kind === 'none') c.prev = c.kind === 'none' ? c.prev : c.kind;
			c.kind = kind;
			c.changed = now;
			c.until = now + (hold || rand(HOLD[kind]));
			if (kind === 'pass') c.ms = 5 + ((Math.random() * 400) | 0);
		}

		function advance(c, now) {
			if (c.kind === 'none') setKind(c, 'queued', now);
			else if (c.kind === 'queued') setKind(c, Math.random() < 0.8 ? 'pass' : 'fail', now);
			else setKind(c, 'none', now);
		}

		const start0 = performance.now();
		for (let i = 0; i < TOTAL; i++) {
			// Stagger the start so dots don't all move in lockstep.
			cells.push({ kind: 'none', prev: 'queued', v: 0, changed: start0, until: start0 + Math.random() * 6000, ms: 0 });
		}

		// Current colour of a dot, crossfading from its previous state.
		function colorOf(c, t) {
			if (c.kind === 'none') return pal[c.prev];
			const m = Math.min(1, Math.max(0, (t - c.changed) / BLEND));
			const a = pal[c.prev], b = pal[c.kind];
			return [
				Math.round(a[0] + (b[0] - a[0]) * m),
				Math.round(a[1] + (b[1] - a[1]) * m),
				Math.round(a[2] + (b[2] - a[2]) * m)
			];
		}

		// Work out where each dot lands on screen (relative to the hero), taking
		// the CSS 3D tilt into account, so hover and click hit the right dot.
		function project() {
			const tr = getComputedStyle(canvas).transform;
			// Without DOMMatrix (old browsers) fall back to the untilted layout:
			// hit-testing is slightly off under the 3D tilt, but nothing throws.
			const m = typeof DOMMatrix === 'function' && typeof DOMPoint === 'function'
				? (!tr || tr === 'none' ? new DOMMatrix() : new DOMMatrix(tr))
				: null;
			const o = size / 2;
			points = [];
			for (let i = 0; i < TOTAL; i++) {
				const x = geo[i].x - o;
				const y = geo[i].y - o;
				const p = m ? m.transformPoint(new DOMPoint(x, y, 0, 1)) : { x, y, w: 1 };
				points.push({
					x: p.x / p.w + o + canvas.offsetLeft,
					y: p.y / p.w + o + canvas.offsetTop,
					// Only dots near the centre are visible through the fade mask.
					visible: Math.hypot(x, y) < size * 0.46
				});
			}
		}

		function resize() {
			size = canvas.clientWidth;
			if (!size) return; // not laid out yet (e.g. hidden)
			// Cap the backing store: past ~2x the dots look the same, but a 3x/4x
			// phone screen would otherwise allocate a much larger bitmap.
			const px = Math.min(Math.round(size * Math.min(window.devicePixelRatio || 1, MAX_DPR)), MAX_PX);
			canvas.width = canvas.height = px;
			const scale = px / size;
			ctx.setTransform(scale, 0, 0, scale, 0, 0);
			step = size / COLS;
			// Per-dot geometry only changes on resize, so work it out once here
			// instead of on every frame.
			for (let i = 0; i < TOTAL; i++) {
				const col = i % COLS, row = (i / COLS) | 0;
				geo[i] = { x: col * step + step / 2, y: row * step + step / 2, d: (col + row) / (COLS * 2) };
			}
			project();
			draw(performance.now());
		}

		function draw(t) {
			if (!size) return;
			ctx.clearRect(0, 0, size, size);
			const r = step * 0.22;
			const wave = ((t - waveStart) / 2600) * 2.4 - 0.2;

			for (let i = 0; i < TOTAL; i++) {
				const c = cells[i];
				const { x, y, d } = geo[i];
				// The sweeping wave and cursor glow only brighten the grey base dot,
				// so they never fake a test state.
				const boost = Math.max(0, 1 - Math.abs(d - wave) * 9) * 0.7;
				let glow = 0;
				if (pointer && points[i]) {
					const dist = Math.hypot(points[i].x - pointer.x, points[i].y - pointer.y);
					glow = Math.max(0, 1 - dist / 90);
				}
				const rgb = colorOf(c, t);

				ctx.fillStyle = 'rgba(' + pal.base + ',' + (pal.baseA + glow * 0.35 + boost * 0.15) + ')';
				ctx.beginPath();
				ctx.arc(x, y, r * (1 + glow * 0.3), 0, 6.283);
				ctx.fill();

				// Hovered dot: ring in its state colour (grey if no status).
				if (i === hovered) {
					ctx.strokeStyle = 'rgba(' + (c.kind === 'none' ? pal.base : rgb) + ',0.9)';
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.arc(x, y, r * 2.2, 0, 6.283);
					ctx.stroke();
				}

				const a = c.v;
				if (a > 0.02) {
					ctx.fillStyle = 'rgba(' + rgb + ',' + (a * 0.18) + ')';
					ctx.beginPath();
					ctx.arc(x, y, r * 2.6, 0, 6.283);
					ctx.fill();
					ctx.fillStyle = 'rgba(' + rgb + ',' + a + ')';
					ctx.beginPath();
					ctx.arc(x, y, r * (1 + a * 0.35), 0, 6.283);
					ctx.fill();
				}
			}
		}

		function frame(t) {
			raf = requestAnimationFrame(frame);
			// Throttle to ~30 FPS (the 1ms slack keeps 60Hz screens on every 2nd frame).
			if (t - last < FRAME_MS - 1) return;
			const dt = Math.min(64, t - last);
			last = t;

			if (konamiStart >= 0) konamiFrame(t, t - konamiStart);

			// Move each dot through its lifecycle and ease its brightness.
			const k = 1 - Math.pow(0.02, dt / 1000);
			for (let i = 0; i < TOTAL; i++) {
				const c = cells[i];
				if (konamiStart < 0 && t >= c.until) advance(c, t);
				c.v += (BRIGHT[c.kind] - c.v) * k;
			}

			if (t - waveStart > 7000) waveStart = t;
			draw(t);
			// Keep the tooltip in sync with the hovered dot's live state.
			if (hovered >= 0) {
				updateTip();
				hero.classList.toggle('is-fixable', isClickable(hovered));
			}
		}

		// Konami code: everything fails, then a wave fixes all tests.
		function konamiFrame(t, e) {
			const progress = (e - 1200) / 1600;
			for (let i = 0; i < TOTAL; i++) {
				const c = cells[i];
				const d = ((i % COLS) + ((i / COLS) | 0)) / (COLS * 2);
				const want = e < 1200 ? 'fail' : progress > d ? 'pass' : 'fail';
				if (c.kind !== want) setKind(c, want, t);
			}
			if (e > 3400) {
				konamiStart = -1;
				// Let everything finish its run, then fade back out at staggered times.
				cells.forEach((c) => { c.until = t + 800 + Math.random() * 2500; });
				site.toast('All ' + TOTAL + ' tests fixed ✓');
			}
		}

		// Is the grid currently animating (not reduced motion, tab visible, hero on screen)?
		function animating() {
			return !site.reduceMotion.matches && !document.hidden && onScreen;
		}

		// Static snapshot for reduced motion: a random mix of states, no animation.
		function snapshot() {
			const now = performance.now();
			cells.forEach((c) => {
				const r = Math.random();
				const kind = r < 0.6 ? 'none' : r < 0.72 ? 'queued' : r < 0.92 ? 'pass' : 'fail';
				setKind(c, kind, now - BLEND);
				c.prev = kind === 'none' ? 'queued' : kind;
				c.v = BRIGHT[kind];
			});
			draw(now);
		}

		function start() {
			cancelAnimationFrame(raf);
			if (site.reduceMotion.matches) {
				snapshot();
				return;
			}
			// Hidden tab or hero scrolled away: stay paused until it's back.
			if (!animating()) return;
			const now = performance.now();
			// Coming back: shift timers so dots don't all jump at once.
			cells.forEach((c) => { if (c.until < now) c.until = now + Math.random() * 3000; });
			last = now;
			waveStart = now;
			raf = requestAnimationFrame(frame);
		}

		// Find the nearest visible dot to a point. With `onlyFailing`, only
		// failing dots count (used for taps, so a finger can hit them easily).
		function nearest(px, py, radius, onlyFailing) {
			let best = -1, bestD = radius || Math.max(10, step * 0.6);
			for (let i = 0; i < TOTAL; i++) {
				const p = points[i];
				if (!p || !p.visible) continue;
				if (onlyFailing && !isFailing(i)) continue;
				const d = Math.hypot(p.x - px, p.y - py);
				if (d < bestD) { bestD = d; best = i; }
			}
			return best;
		}

		function label(i) {
			const c = cells[i];
			const id = site.testId(i);
			if (c.kind === 'fail') return '<span class="fail">✗ ' + id + '</span> · failed · click to fix';
			if (c.kind === 'pass') return '<span class="pass">✓ ' + id + '</span> · passed · ' + c.ms + 'ms';
			if (c.kind === 'queued') return '<span class="queued">◷ ' + id + '</span> · queued';
			return '○ ' + id + ' · no status';
		}

		const isFailing = (i) => i >= 0 && cells[i].kind === 'fail';

		// Clickable dots: failing ones, plus test_404 (opens the not-found report).
		const isClickable = (i) => i === NOT_FOUND || isFailing(i);

		// The canvas element, so other scripts (e.g. the selector inspector) can
		// tell whether a pointer is over the grid.
		site.gridCanvas = canvas;

		// Which test is under a viewport (client) point, as a "test_###" id, or
		// null if the point isn't over a visible dot. Used by the Alt/Option
		// selector inspector to report per-cell locators instead of just the
		// whole canvas. Reuses the same nearest()/points geometry as hovering.
		site.gridTestAt = (clientX, clientY) => {
			const rect = hero.getBoundingClientRect();
			const i = nearest(clientX - rect.left, clientY - rect.top);
			return i >= 0 ? site.testId(i) : null;
		};

		// Live grid results, exposed on the site API for anyone poking at the console.
		site.testStats = () => {
			const s = { total: TOTAL, pass: 0, fail: 0, queued: 0, none: 0, failed: [] };
			cells.forEach((c, i) => {
				s[c.kind]++;
				if (c.kind === 'fail') s.failed.push(site.testId(i));
			});
			return s;
		};

		function updateTip() {
			if (!tip) return;
			if (hovered < 0) {
				tip.classList.remove('is-visible');
				return;
			}
			// label() only contains our own fixed strings and numbers.
			tip.innerHTML = label(hovered);
			tip.style.left = points[hovered].x + 'px';
			tip.style.top = points[hovered].y + 'px';
			tip.classList.add('is-visible');
		}

		// Ignore pointers over the text, links and buttons.
		const overContent = (target) => target.closest && target.closest('a, button, h1, p, .icons');

		hero.addEventListener('pointermove', (e) => {
			if (e.pointerType === 'touch') return;
			const rect = hero.getBoundingClientRect();
			pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
			hovered = overContent(e.target) ? -1 : nearest(pointer.x, pointer.y);
			hero.classList.toggle('is-fixable', isClickable(hovered));
			updateTip();
			if (!animating()) draw(performance.now());
		});

		hero.addEventListener('pointerleave', () => {
			pointer = null;
			hovered = -1;
			hero.classList.remove('is-fixable');
			updateTip();
			if (!animating()) draw(performance.now());
		});

		hero.addEventListener('click', (e) => {
			// Only real controls block a click; text can be tapped through
			// (on mobile the grid sits behind the heading).
			if (e.target.closest && e.target.closest('a, button, .letter')) return;
			const rect = hero.getBoundingClientRect();
			// Pick the dot actually under the pointer (any status), then only fix it
			// if it's failing, so clicking a queued/passed dot never fixes a neighbour.
			// Touch gets a slightly larger radius for fingertips.
			const radius = e.pointerType === 'touch' ? Math.max(18, step * 0.9) : undefined;
			const i = nearest(e.clientX - rect.left, e.clientY - rect.top, radius);
			// Easter egg: test_404 opens the "page not found" report, whatever its status.
			if (i === NOT_FOUND) {
				site.openNotFound();
				return;
			}
			if (!isFailing(i)) return;
			// Fixed: turn green, hold a little longer, then back to no status.
			setKind(cells[i], 'pass', performance.now(), 3500);
			cells[i].ms = 12 + ((Math.random() * 60) | 0);
			if (!animating()) cells[i].v = BRIGHT.pass;
			fixedCount++;
			hero.classList.remove('is-fixable');
			updateTip();
			if (fixedCount === 1) site.toast('Bug fixed.\nNice catch ✓');
			// 42: the Answer to the Ultimate Question (and a nudge towards automation).
			else if (fixedCount === 42) site.toast('42 bugs fixed by hand.\nThe answer is clear: automate it 🤖', 6000);
			else site.toast(fixedCount + ' bugs fixed ✓');
			if (!animating()) draw(performance.now());
		});

		document.addEventListener('konami', () => {
			if (site.reduceMotion.matches) {
				const now = performance.now();
				cells.forEach((c) => { setKind(c, 'pass', now - BLEND); c.prev = 'pass'; c.v = BRIGHT.pass; });
				draw(now);
				site.toast('All ' + TOTAL + ' tests fixed ✓');
				return;
			}
			konamiStart = performance.now();
		});

		resize();
		start();

		// Recompute dot positions at most once per frame while resizing.
		let resizeQueued = false;
		window.addEventListener('resize', () => {
			if (resizeQueued) return;
			resizeQueued = true;
			requestAnimationFrame(() => {
				resizeQueued = false;
				resize();
			});
		});

		// Pause the animation while the hero is off screen or the tab is hidden.
		if ('IntersectionObserver' in window) {
			new IntersectionObserver((entries) => {
				const visible = entries[entries.length - 1].isIntersecting;
				if (visible === onScreen) return;
				onScreen = visible;
				start();
			}).observe(hero);
		}
		document.addEventListener('visibilitychange', start);
		site.onMediaChange(site.reduceMotion, start);
		document.addEventListener('themechange', () => {
			pal = palette();
			draw(performance.now());
		});
	}
})();
