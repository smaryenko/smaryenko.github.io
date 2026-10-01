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


// Hero decoration: a dot matrix of "test results" that glow and fade,
// with a periodic wave sweeping across like a test run.
(function () {
	var canvas = document.querySelector('.test-grid');
	if (!canvas || !canvas.getContext) return;

	var ctx = canvas.getContext('2d');
	var COLS = 22;
	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	var dark = window.matchMedia('(prefers-color-scheme: dark)');
	var cells = [], size, step, raf, last = 0, waveStart = 0;

	// RGB palettes: base dot, pass (accent) and fail.
	function palette() {
		return dark.matches
			? { base: [168, 162, 158], pass: [129, 140, 248], alt: [45, 212, 191], fail: [244, 114, 182], baseA: 0.12 }
			: { base: [120, 113, 108], pass: [79, 70, 229], alt: [20, 184, 166], fail: [236, 72, 153], baseA: 0.14 };
	}
	var pal = palette();

	function pick() {
		var r = Math.random();
		return r < 0.04 ? 'fail' : r < 0.35 ? 'alt' : 'pass';
	}

	for (var i = 0; i < COLS * COLS; i++) {
		cells.push({ v: Math.random() * 0.3, target: 0, kind: pick() });
	}

	function resize() {
		var dpr = window.devicePixelRatio || 1;
		size = canvas.clientWidth;
		canvas.width = canvas.height = Math.round(size * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		step = size / COLS;
		draw(0);
	}

	function draw(t) {
		ctx.clearRect(0, 0, size, size);
		var r = step * 0.22;
		// Diagonal wave position, 0..2 across the grid.
		var wave = ((t - waveStart) / 2600) * 2.4 - 0.2;

		for (var i = 0; i < cells.length; i++) {
			var c = cells[i];
			var col = i % COLS, row = (i / COLS) | 0;
			var d = (col + row) / (COLS * 2);
			var boost = Math.max(0, 1 - Math.abs(d - wave) * 9);
			var a = Math.min(1, c.v + boost * 0.7);
			var x = col * step + step / 2, y = row * step + step / 2;

			// Base dot
			ctx.fillStyle = 'rgba(' + pal.base + ',' + pal.baseA + ')';
			ctx.beginPath();
			ctx.arc(x, y, r, 0, 6.283);
			ctx.fill();

			if (a > 0.02) {
				var rgb = pal[c.kind];
				// Soft glow + core
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

		// Light up a few random dots; everything eases toward its target.
		for (var n = 0; n < 3; n++) {
			var c = cells[(Math.random() * cells.length) | 0];
			c.target = Math.random() < 0.5 ? 0.5 + Math.random() * 0.5 : 0;
			c.kind = pick();
		}
		var k = 1 - Math.pow(0.04, dt / 1000);
		for (var i = 0; i < cells.length; i++) {
			var cell = cells[i];
			cell.v += (cell.target - cell.v) * k;
			if (cell.target > 0 && Math.random() < 0.004) cell.target = 0;
		}

		if (t - waveStart > 7000) waveStart = t;
		draw(t);
		raf = requestAnimationFrame(frame);
	}

	function start() {
		cancelAnimationFrame(raf);
		if (reduceMotion.matches || document.hidden) {
			cells.forEach(function (c) { c.v = c.target = Math.random() < 0.3 ? 0.6 : 0; });
			draw(-1e9);
			return;
		}
		last = performance.now();
		waveStart = last;
		raf = requestAnimationFrame(frame);
	}

	resize();
	start();

	window.addEventListener('resize', resize);
	document.addEventListener('visibilitychange', start);
	reduceMotion.addEventListener('change', start);
	dark.addEventListener('change', function () { pal = palette(); draw(last); });
})();
