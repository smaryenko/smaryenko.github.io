// Show the back-to-top button after scrolling past 100px.
(function () {
	var button = document.getElementById('scroll');
	if (!button) return;

	function update() {
		button.classList.toggle('is-visible', window.scrollY > 100);
	}

	window.addEventListener('scroll', update, { passive: true });
	update();
})();

// Shared helpers.
var site = (function () {
	var root = document.documentElement;
	var systemDark = window.matchMedia('(prefers-color-scheme: dark)');
	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	var toastEl, toastTimer;

	return {
		reduceMotion: reduceMotion,
		systemDark: systemDark,
		isDark: function () {
			var t = root.dataset.theme;
			return t ? t === 'dark' : systemDark.matches;
		},
		// Small status message at the bottom of the screen.
		toast: function (text, duration) {
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
			toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, duration || 2600);
		}
	};
})();

// Light/dark theme toggle (remembers the choice; defaults to system setting).
(function () {
	var root = document.documentElement;
	var button = document.querySelector('.theme-toggle');

	function apply() {
		var dark = site.isDark();
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
		button.addEventListener('click', function () {
			var next = site.isDark() ? 'light' : 'dark';
			if (document.startViewTransition && !site.reduceMotion.matches) {
				document.startViewTransition(function () { setTheme(next); });
			} else {
				setTheme(next);
			}
		});
	}

	site.systemDark.addEventListener('change', apply);
	apply();
})();

// Hero decoration: a dot matrix of "test results" that glow and fade, with a
// periodic wave sweeping across like a test run. Hover a dot to inspect it,
// click a pink (failing) dot to fix it. Dots near the cursor light up.
(function () {
	var canvas = document.querySelector('.test-grid');
	var hero = document.querySelector('.hero');
	var tip = document.querySelector('.grid-tip');
	if (!canvas || !canvas.getContext || !hero) return;

	var ctx = canvas.getContext('2d');
	var COLS = 22, TOTAL = COLS * COLS;
	var cells = [], points = [], size, step, raf, last = 0, waveStart = 0;
	var pointer = null, hovered = -1, fixedCount = 0, konamiStart = -1;

	// RGB palettes. Grey base = no status, indigo = queued, green = passed, red = failed.
	function palette() {
		return site.isDark()
			? { base: [168, 162, 158], queued: [129, 140, 248], pass: [74, 222, 128], fail: [248, 113, 113], baseA: 0.12 }
			: { base: [120, 113, 108], queued: [79, 70, 229], pass: [22, 163, 74], fail: [220, 38, 38], baseA: 0.14 };
	}
	var pal = palette();

	// Test lifecycle: none -> queued -> pass (80%) | fail (20%) -> none.
	// How long each state lasts, in ms [min, max]. Failures stay longer so they can be clicked.
	var HOLD = { none: [1500, 9000], queued: [1000, 3000], pass: [2000, 5000], fail: [5000, 10000] };
	var BRIGHT = { none: 0, queued: 0.6, pass: 0.85, fail: 0.9 };
	var BLEND = 450; // colour crossfade between states, ms

	function rand(range) {
		return range[0] + Math.random() * (range[1] - range[0]);
	}

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

	var start0 = performance.now();
	for (var i = 0; i < TOTAL; i++) {
		var c0 = { kind: 'none', prev: 'queued', v: 0, changed: start0, until: 0, ms: 0 };
		// Stagger the start so dots don't all move in lockstep.
		c0.until = start0 + Math.random() * 6000;
		cells.push(c0);
	}

	// Current colour of a dot, crossfading from its previous state.
	function colorOf(c, t) {
		if (c.kind === 'none') return pal[c.prev];
		var m = Math.min(1, Math.max(0, (t - c.changed) / BLEND));
		var a = pal[c.prev], b = pal[c.kind];
		return [
			Math.round(a[0] + (b[0] - a[0]) * m),
			Math.round(a[1] + (b[1] - a[1]) * m),
			Math.round(a[2] + (b[2] - a[2]) * m)
		];
	}

	// Work out where each dot lands on screen (relative to the hero), taking
	// the CSS 3D tilt into account, so hover and click hit the right dot.
	function project() {
		var tr = getComputedStyle(canvas).transform;
		var m = !tr || tr === 'none' ? new DOMMatrix() : new DOMMatrix(tr);
		var o = size / 2;
		points = [];
		for (var i = 0; i < TOTAL; i++) {
			var x = (i % COLS) * step + step / 2 - o;
			var y = ((i / COLS) | 0) * step + step / 2 - o;
			var p = m.transformPoint(new DOMPoint(x, y, 0, 1));
			points.push({
				x: p.x / p.w + o + canvas.offsetLeft,
				y: p.y / p.w + o + canvas.offsetTop,
				// Only dots near the centre are visible through the fade mask.
				visible: Math.hypot(x, y) < size * 0.46
			});
		}
	}

	function resize() {
		var dpr = window.devicePixelRatio || 1;
		size = canvas.clientWidth;
		canvas.width = canvas.height = Math.round(size * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		step = size / COLS;
		project();
		draw(performance.now());
	}

	function draw(t) {
		ctx.clearRect(0, 0, size, size);
		var r = step * 0.22;
		var wave = ((t - waveStart) / 2600) * 2.4 - 0.2;

		for (var i = 0; i < TOTAL; i++) {
			var c = cells[i];
			var col = i % COLS, row = (i / COLS) | 0;
			var d = (col + row) / (COLS * 2);
			// The sweeping wave and cursor glow only brighten the grey base dot,
			// so they never fake a test state.
			var boost = Math.max(0, 1 - Math.abs(d - wave) * 9) * 0.7;
			var glow = 0;
			if (pointer && points[i]) {
				var dist = Math.hypot(points[i].x - pointer.x, points[i].y - pointer.y);
				glow = Math.max(0, 1 - dist / 90);
			}
			var x = col * step + step / 2, y = row * step + step / 2;
			var rgb = colorOf(c, t);

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

			var a = c.v;
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
		var dt = Math.min(64, t - last);
		last = t;

		if (konamiStart >= 0) konamiFrame(t, t - konamiStart);

		// Move each dot through its lifecycle and ease its brightness.
		var k = 1 - Math.pow(0.02, dt / 1000);
		for (var i = 0; i < TOTAL; i++) {
			var c = cells[i];
			if (konamiStart < 0 && t >= c.until) advance(c, t);
			c.v += (BRIGHT[c.kind] - c.v) * k;
		}

		if (t - waveStart > 7000) waveStart = t;
		draw(t);
		// Keep the tooltip in sync with the hovered dot's live state.
		if (hovered >= 0) {
			updateTip();
			hero.classList.toggle('is-fixable', isFailing(hovered));
		}
		raf = requestAnimationFrame(frame);
	}

	// Konami code: everything fails, then a wave fixes all tests.
	function konamiFrame(t, e) {
		var progress = (e - 1200) / 1600;
		for (var i = 0; i < TOTAL; i++) {
			var c = cells[i];
			var d = ((i % COLS) + ((i / COLS) | 0)) / (COLS * 2);
			var want = e < 1200 ? 'fail' : progress > d ? 'pass' : 'fail';
			if (c.kind !== want) setKind(c, want, t);
		}
		if (e > 3400) {
			konamiStart = -1;
			// Let everything finish its run, then fade back out at staggered times.
			cells.forEach(function (c) { c.until = t + 800 + Math.random() * 2500; });
			site.toast('All ' + TOTAL + ' tests fixed ✓');
		}
	}

	function animating() {
		return !site.reduceMotion.matches && !document.hidden;
	}

	// Static snapshot for reduced motion: a random mix of states, no animation.
	function snapshot() {
		var now = performance.now();
		cells.forEach(function (c) {
			var r = Math.random();
			var kind = r < 0.6 ? 'none' : r < 0.72 ? 'queued' : r < 0.92 ? 'pass' : 'fail';
			setKind(c, kind, now - BLEND);
			c.prev = kind === 'none' ? 'queued' : kind;
			c.v = BRIGHT[kind];
		});
		draw(now);
	}

	function start() {
		cancelAnimationFrame(raf);
		if (!animating()) {
			snapshot();
			return;
		}
		var now = performance.now();
		// Coming back from a hidden tab: shift timers so dots don't all jump at once.
		cells.forEach(function (c) { if (c.until < now) c.until = now + Math.random() * 3000; });
		last = now;
		waveStart = now;
		raf = requestAnimationFrame(frame);
	}

	// Find the nearest visible dot to a point. With `onlyFailing`, only
	// failing dots count (used for taps, so a finger can hit them easily).
	function nearest(px, py, radius, onlyFailing) {
		var best = -1, bestD = radius || Math.max(10, step * 0.6);
		for (var i = 0; i < TOTAL; i++) {
			var p = points[i];
			if (!p || !p.visible) continue;
			if (onlyFailing && !isFailing(i)) continue;
			var d = Math.hypot(p.x - px, p.y - py);
			if (d < bestD) { bestD = d; best = i; }
		}
		return best;
	}

	function label(i) {
		var c = cells[i];
		var id = 'test_' + String(i + 1).padStart(3, '0');
		if (c.kind === 'fail') return '<span class="fail">✗ ' + id + '</span> · failed · click to fix';
		if (c.kind === 'pass') return '<span class="pass">✓ ' + id + '</span> · passed · ' + c.ms + 'ms';
		if (c.kind === 'queued') return '<span class="queued">◷ ' + id + '</span> · queued';
		return '○ ' + id + ' · no status';
	}

	function isFailing(i) {
		return i >= 0 && cells[i].kind === 'fail';
	}

	function updateTip() {
		if (!tip) return;
		if (hovered < 0) {
			tip.classList.remove('is-visible');
			return;
		}
		tip.innerHTML = label(hovered);
		tip.style.left = points[hovered].x + 'px';
		tip.style.top = points[hovered].y + 'px';
		tip.classList.add('is-visible');
	}

	// Ignore pointers over the text, links and buttons.
	function overContent(target) {
		return target.closest && target.closest('a, button, h1, p, .icons');
	}

	hero.addEventListener('pointermove', function (e) {
		if (e.pointerType === 'touch') return;
		var rect = hero.getBoundingClientRect();
		pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		hovered = overContent(e.target) ? -1 : nearest(pointer.x, pointer.y);
		hero.classList.toggle('is-fixable', isFailing(hovered));
		updateTip();
		if (!animating()) draw(performance.now());
	});

	hero.addEventListener('pointerleave', function () {
		pointer = null;
		hovered = -1;
		hero.classList.remove('is-fixable');
		updateTip();
		if (!animating()) draw(performance.now());
	});

	hero.addEventListener('click', function (e) {
		// Only real controls block a click; text can be tapped through
		// (on mobile the grid sits behind the heading).
		if (e.target.closest && e.target.closest('a, button, .letter')) return;
		var rect = hero.getBoundingClientRect();
		// Generous radius so a fingertip near a failing dot still hits it.
		var radius = Math.max(28, step * 1.6);
		var i = nearest(e.clientX - rect.left, e.clientY - rect.top, radius, true);
		if (i < 0) return;
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

	document.addEventListener('konami', function () {
		if (!animating()) {
			var now = performance.now();
			cells.forEach(function (c) { setKind(c, 'pass', now - BLEND); c.prev = 'pass'; c.v = BRIGHT.pass; });
			draw(now);
			site.toast('All ' + TOTAL + ' tests fixed ✓');
			return;
		}
		konamiStart = performance.now();
	});

	resize();
	start();

	window.addEventListener('resize', resize);
	document.addEventListener('visibilitychange', start);
	site.reduceMotion.addEventListener('change', start);
	document.addEventListener('themechange', function () {
		pal = palette();
		draw(performance.now());
	});
})();

// Reveal project cards once as they enter the viewport.
(function () {
	var cards = document.querySelectorAll('.project');
	if (!cards.length || !('IntersectionObserver' in window) || site.reduceMotion.matches) return;

	var observer = new IntersectionObserver(function (entries) {
		entries.forEach(function (entry) {
			if (!entry.isIntersecting) return;
			entry.target.classList.add('is-in');
			observer.unobserve(entry.target);
		});
	}, { rootMargin: '0px 0px -10% 0px' });

	// Cards already on screen at load show immediately.
	cards.forEach(function (card) {
		if (card.getBoundingClientRect().top < window.innerHeight) card.classList.add('is-in');
		else observer.observe(card);
	});
	document.documentElement.classList.add('reveal');
})();

// Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
(function () {
	// Physical key codes, so it works with Shift, Caps Lock and non-Latin layouts.
	var code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
	var modifiers = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];
	var pos = 0;

	document.addEventListener('keydown', function (e) {
		// Pressing a modifier on its own shouldn't break the sequence.
		if (modifiers.indexOf(e.key) !== -1) return;
		var key = e.code;
		if (key === code[pos]) pos++;
		else if (key === 'ArrowUp') pos = pos === 2 ? 2 : 1; // extra ↑ presses are forgiven
		else pos = 0;
		if (pos === code.length) {
			pos = 0;
			document.dispatchEvent(new Event('konami'));
		}
	});
})();

// A hello for anyone who opens DevTools.
(function () {
	if (!window.console) return;
	console.log(
		'%cHi there 👋%c\n\nFound a bug? You\'re my kind of person.\nSay hello: gotheg@gmail.com\n\nPsst: try ↑ ↑ ↓ ↓ ← → ← → B A on the page.',
		'font: 700 20px Georgia, serif; color: #4f46e5;',
		'font: 13px ui-monospace, Menlo, monospace; color: inherit;'
	);
})();

// Name easter egg: click the letters T, E, S, T in the name (any S works).
// A wrong letter resets the sequence. Success runs a little "test" over the name.
(function () {
	var h1 = document.querySelector('.hero h1');
	if (!h1) return;

	var name = h1.textContent.trim();
	var target = ['t', 'e', 's', 't'];
	var pos = 0, running = false, index = 0;

	// Split the name into letter spans (words kept together so they don't break).
	// Screen readers still get the plain name from aria-label.
	h1.setAttribute('aria-label', name);
	h1.textContent = '';
	name.split(' ').forEach(function (word, w) {
		if (w) h1.appendChild(document.createTextNode(' '));
		var wordEl = document.createElement('span');
		wordEl.className = 'word';
		wordEl.setAttribute('aria-hidden', 'true');
		word.split('').forEach(function (ch) {
			var l = document.createElement('span');
			l.className = 'letter';
			l.textContent = ch;
			l.style.setProperty('--i', index++);
			wordEl.appendChild(l);
		});
		h1.appendChild(wordEl);
	});

	function clearHits() {
		h1.querySelectorAll('.is-hit').forEach(function (l) { l.classList.remove('is-hit'); });
	}

	function miss(letter) {
		pos = 0;
		clearHits();
		letter.classList.remove('is-miss');
		void letter.offsetWidth; // restart the shake animation
		letter.classList.add('is-miss');
		clearTimeout(letter._missTimer);
		letter._missTimer = setTimeout(function () { letter.classList.remove('is-miss'); }, 450);
	}

	h1.addEventListener('click', function (e) {
		var letter = e.target.closest('.letter');
		if (!letter || running) return;
		var ch = letter.textContent.toLowerCase();

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
		setTimeout(function () {
			clearHits();
			h1.classList.add('name-run');
		}, 250);
		setTimeout(function () {
			h1.classList.remove('name-run');
			running = false;
		}, 250 + 1400 + index * 55);
	});

})();
