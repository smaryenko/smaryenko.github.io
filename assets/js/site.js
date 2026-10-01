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
		toast: function (text) {
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
			toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 2600);
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

	// RGB palettes: base dot, two "pass" colours and "fail".
	function palette() {
		return site.isDark()
			? { base: [168, 162, 158], pass: [129, 140, 248], alt: [45, 212, 191], fail: [244, 114, 182], baseA: 0.12 }
			: { base: [120, 113, 108], pass: [79, 70, 229], alt: [20, 184, 166], fail: [236, 72, 153], baseA: 0.14 };
	}
	var pal = palette();

	function pick() {
		var r = Math.random();
		return r < 0.04 ? 'fail' : r < 0.35 ? 'alt' : 'pass';
	}

	for (var i = 0; i < TOTAL; i++) {
		cells.push({ v: Math.random() * 0.3, target: 0, kind: pick(), ms: 0 });
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
		draw(last);
	}

	function draw(t) {
		ctx.clearRect(0, 0, size, size);
		var r = step * 0.22;
		var wave = ((t - waveStart) / 2600) * 2.4 - 0.2;

		for (var i = 0; i < TOTAL; i++) {
			var c = cells[i];
			var col = i % COLS, row = (i / COLS) | 0;
			var d = (col + row) / (COLS * 2);
			var boost = Math.max(0, 1 - Math.abs(d - wave) * 9) * 0.7;

			// Cursor glow: dots near the pointer light up.
			if (pointer && points[i]) {
				var dist = Math.hypot(points[i].x - pointer.x, points[i].y - pointer.y);
				boost = Math.max(boost, (1 - dist / 90) * 0.8);
			}
			if (i === hovered) boost = 1;

			var a = Math.min(1, c.v + Math.max(0, boost));
			var x = col * step + step / 2, y = row * step + step / 2;

			ctx.fillStyle = 'rgba(' + pal.base + ',' + pal.baseA + ')';
			ctx.beginPath();
			ctx.arc(x, y, r, 0, 6.283);
			ctx.fill();

			if (a > 0.02) {
				var rgb = pal[c.kind];
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

		if (konamiStart >= 0) {
			konamiFrame(t - konamiStart);
		} else {
			// Light up a few random dots.
			for (var n = 0; n < 3; n++) {
				var j = (Math.random() * TOTAL) | 0;
				if (j === hovered) continue;
				var c = cells[j];
				c.target = Math.random() < 0.5 ? 0.5 + Math.random() * 0.5 : 0;
				c.kind = pick();
				c.ms = 5 + ((Math.random() * 400) | 0);
			}
		}

		// Ease every dot toward its target. Failures linger longer so they can be clicked.
		var k = 1 - Math.pow(0.04, dt / 1000);
		for (var i = 0; i < TOTAL; i++) {
			var cell = cells[i];
			cell.v += (cell.target - cell.v) * k;
			var fade = cell.kind === 'fail' ? 0.0015 : 0.004;
			if (konamiStart < 0 && i !== hovered && cell.target > 0 && Math.random() < fade) cell.target = 0;
		}

		if (t - waveStart > 7000) waveStart = t;
		draw(t);
		raf = requestAnimationFrame(frame);
	}

	// Konami code: everything fails, then a wave fixes all tests.
	function konamiFrame(e) {
		var progress = (e - 1200) / 1600;
		for (var i = 0; i < TOTAL; i++) {
			var c = cells[i];
			var d = ((i % COLS) + ((i / COLS) | 0)) / (COLS * 2);
			c.target = 0.85;
			c.kind = progress > d ? (i % 3 ? 'pass' : 'alt') : 'fail';
		}
		if (e > 3400) {
			konamiStart = -1;
			cells.forEach(function (c) { c.target = 0; });
			site.toast('All ' + TOTAL + ' tests fixed ✓');
		}
	}

	function animating() {
		return !site.reduceMotion.matches && !document.hidden;
	}

	function start() {
		cancelAnimationFrame(raf);
		if (!animating()) {
			cells.forEach(function (c) { c.v = c.target = Math.random() < 0.3 ? 0.6 : 0; });
			draw(-1e9);
			return;
		}
		last = performance.now();
		waveStart = last;
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
		if (c.kind === 'fail' && c.v > 0.25) {
			return '<span class="fail">✗ ' + id + '</span> · failed · click to fix';
		}
		if (c.v > 0.25) {
			return '<span class="pass">✓ ' + id + '</span> · passed · ' + (c.ms || 42) + 'ms';
		}
		return '○ ' + id + ' · queued';
	}

	function isFailing(i) {
		return i >= 0 && cells[i].kind === 'fail' && cells[i].v > 0.25;
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
		if (!animating()) draw(-1e9);
	});

	hero.addEventListener('pointerleave', function () {
		pointer = null;
		hovered = -1;
		hero.classList.remove('is-fixable');
		updateTip();
		if (!animating()) draw(-1e9);
	});

	hero.addEventListener('click', function (e) {
		// Only real controls block a click; text can be tapped through
		// (on mobile the grid sits behind the heading).
		if (e.target.closest && e.target.closest('a, button')) return;
		var rect = hero.getBoundingClientRect();
		// Generous radius so a fingertip near a failing dot still hits it.
		var radius = Math.max(28, step * 1.6);
		var i = nearest(e.clientX - rect.left, e.clientY - rect.top, radius, true);
		if (i < 0) return;
		cells[i].kind = 'pass';
		cells[i].v = cells[i].target = 1;
		cells[i].ms = 12 + ((Math.random() * 60) | 0);
		fixedCount++;
		hero.classList.remove('is-fixable');
		updateTip();
		site.toast(fixedCount === 1 ? 'Bug fixed.\nNice catch ✓' : fixedCount + ' bugs fixed ✓');
		if (!animating()) draw(-1e9);
	});

	document.addEventListener('konami', function () {
		if (!animating()) {
			cells.forEach(function (c) { c.kind = 'pass'; c.v = c.target = 0.7; });
			draw(-1e9);
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
		draw(animating() ? last : -1e9);
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
