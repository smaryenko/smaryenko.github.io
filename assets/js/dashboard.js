// Status island: a top-centre "notch" pill, like the Dynamic Island. Collapsed
// it shows a compact status; tap/click expands it in place into a mini CI-style
// report with a live test run (mirroring the hero grid) and an issue tally.
//
// This module owns the only mapping between the opaque issue ids used across the
// public scripts (report('i5')) and what they mean here. The public files never
// name an egg; all the egg-specific knowledge lives in this file (and the
// private notes in .kiro). Everything below reads neutral ids only.
(() => {
	const host = document.querySelector('.hero');
	if (!host) return;

	// --- Issue model ---------------------------------------------------------
	// Every tracked id. "known" issues can be closed by finding the feature;
	// "ignored" (muted) ones never close. Some desktop-only interactions move to
	// ignored on touch, where they can't be performed. All resolved state lives
	// in the persistent log (site.isResolved), so counts survive across tabs.
	const ALL = [
		'i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'i10', 'i11',
		'i12', 'i13', 'i14', 'i15', 'i16', 'i17', 'i18', 'i19', 'i20', 'i21',
		'i22', 'i23', 'i24', 'i25', 'i26'
	];

	// Muted on every device (features with no closeable in-page moment).
	const IGNORED_ALWAYS = ['i8', 'i12', 'i13', 'i15'];
	// Additionally muted on touch (desktop-only interactions).
	const IGNORED_TOUCH = ['i10', 'i11', 'i21'];

	const desktopMq = site.media('(hover: hover) and (pointer: fine)');

	// The muted set for the current device.
	function ignoredSet() {
		const set = new Set(IGNORED_ALWAYS);
		if (!desktopMq.matches) IGNORED_TOUCH.forEach((id) => set.add(id));
		return set;
	}

	// A desktop-only egg found on a hybrid device still counts as resolved
	// (bonus), since resolution is stored device-agnostically in the log.
	const isClosed = (id) => site.isResolved(id);

	// Tally known/ignored issues for the current device.
	function tally() {
		const ignored = ignoredSet();
		let known = 0, closed = 0, muted = 0;
		ALL.forEach((id) => {
			if (ignored.has(id)) { muted++; return; }
			known++;
			if (isClosed(id)) closed++;
		});
		return { known, closed, open: known - closed, muted, total: known + muted };
	}

	const label = (id) => 'ISSUE-' + id.slice(1);

	// One-word tag shown in brackets next to a resolved id, e.g. "ISSUE-19 (typo)".
	// Only rendered under Resolved (ids the visitor has already found), so it never
	// spoils an issue that is still open; the Muted list stays plain. Keyed by the
	// opaque id; this mapping lives only here, like the rest of the egg knowledge.
	const TAGS = {
		i1: 'terminal', i2: 'calendar', i3: '42bugs', i4: 'test404', i5: 'T-E-S-T',
		i6: 'pixel', i7: 'theme', i8: 'tabtitle', i9: 'responsive',
		i10: 'selector', i11: 'konami', i12: 'console', i13: 'breadcrumb',
		i14: 'offline', i15: 'favicon', i16: 'findbug', i17: 'timeline',
		i18: 'moth', i19: 'typo', i20: 'refresh', i21: 'zoom', i22: 'godeeper',
		i23: 'incident', i24: 'sudo', i25: 'notch', i26: 'scratch'
	};
	const tagFor = (id) => TAGS[id] || '';

	// Found (resolved) known ids, as neutral display labels — shown under Known.
	// Never lists ids that are still open.
	function resolvedLabels() {
		const ignored = ignoredSet();
		return ALL
			.filter((id) => !ignored.has(id) && isClosed(id))
			.map((id) => ({ text: label(id), tag: tagFor(id) }));
	}

	// Muted ids for the current device, as display labels — shown under Muted.
	// These never close, so the list is effectively a fixed set.
	function mutedLabels() {
		return [...ignoredSet()].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).map(label);
	}

	// --- UI ------------------------------------------------------------------
	let island, collapsed, expanded, liveRegion, stretch, stretchBand, stretchDot;
	let open = false;
	let konamiBroken = false;

	// Last grid snapshot (scheduled/passed/fixed/failing); refreshed on the grid
	// event and used to render the live test-run block.
	let grid = site.gridCounts ? site.gridCounts() : { scheduled: 0, passed: 0, fixed: 0, failing: 0, total: 0 };

	function build() {
		island = document.createElement('div');
		island.className = 'status-island';

		collapsed = document.createElement('button');
		collapsed.type = 'button';
		collapsed.className = 'si-collapsed';
		collapsed.setAttribute('aria-expanded', 'false');
		collapsed.setAttribute('aria-label', 'Test report');
		// Icon-only indicator: a single colour dot (amber = issues open, green =
		// all clear). The textual status lives in the aria-label / live region.
		collapsed.innerHTML = '<span class="si-dot" aria-hidden="true"></span>';
		collapsed.addEventListener('click', toggle);

		// Overlay used only while the pill is being pulled: the pill's glass body
		// extruded toward the pointer. Built from HTML (not SVG) so it carries the
		// exact same glass surface as the notch — gradient background, backdrop
		// blur and highlight — which an SVG <path> can't (its fill ignores CSS
		// gradients and backdrop-filter). The shape is a clip-path recomputed per
		// frame; a fixed-size dot rides the tip.
		stretch = document.createElement('div');
		stretch.className = 'si-stretch';
		stretch.setAttribute('aria-hidden', 'true');
		stretchBand = document.createElement('div');
		stretchBand.className = 'si-stretch-band';
		stretchDot = document.createElement('span');
		stretchDot.className = 'si-stretch-dot';
		stretch.appendChild(stretchBand);
		stretch.appendChild(stretchDot);

		expanded = document.createElement('div');
		expanded.className = 'si-expanded';
		expanded.hidden = true;
		expanded.innerHTML =
			'<header class="si-head">' +
				'<span class="si-title">Test report</span>' +
				'<button type="button" class="si-close" aria-label="Collapse">\u00d7</button>' +
			'</header>' +
			'<div class="si-run" aria-label="Test run">' +
				'<div class="si-stat"><span class="si-n si-scheduled" data-k="scheduled">0</span><span class="si-l">Scheduled</span></div>' +
				'<div class="si-stat"><span class="si-n si-passed" data-k="passed">0</span><span class="si-l">Passed</span></div>' +
				'<div class="si-stat"><span class="si-n si-known-stat" data-k="known">0</span><span class="si-l">Known</span></div>' +
				'<div class="si-stat"><span class="si-n si-failing" data-k="failing">0</span><span class="si-l">Failing</span></div>' +
			'</div>' +
			'<div class="si-issues">' +
				'<div class="si-group si-group-known">' +
					'<p class="si-issue-row"><span class="si-issue-k">Resolved</span> <span class="si-closed">0</span></p>' +
					'<p class="si-id-list si-known-list report-dim"></p>' +
				'</div>' +
				'<div class="si-group si-group-muted">' +
					'<p class="si-issue-row"><span class="si-issue-k">Muted</span> <span class="si-muted">0</span></p>' +
					'<p class="si-id-list si-muted-list report-dim"></p>' +
				'</div>' +
			'</div>';

		expanded.querySelector('.si-close').addEventListener('click', toggle);

		// Live region announces the compact status; kept out of the visual flow.
		liveRegion = document.createElement('span');
		liveRegion.className = 'sr-only';
		liveRegion.setAttribute('aria-live', 'polite');

		island.appendChild(collapsed);
		island.appendChild(expanded);
		island.appendChild(stretch);
		island.appendChild(liveRegion);
		document.body.appendChild(island);
	}

	function toggle() {
		open ? collapse() : expand();
	}

	function expand() {
		if (open) return;
		open = true;
		island.classList.add('is-open');
		expanded.hidden = false;
		collapsed.setAttribute('aria-expanded', 'true');
		render();
		// Close on Esc or a click/tap outside.
		document.addEventListener('keydown', onKeydown, true);
		document.addEventListener('pointerdown', onOutside, true);
	}

	function collapse() {
		if (!open) return;
		open = false;
		island.classList.remove('is-open');
		expanded.hidden = true;
		collapsed.setAttribute('aria-expanded', 'false');
		document.removeEventListener('keydown', onKeydown, true);
		document.removeEventListener('pointerdown', onOutside, true);
	}

	function onKeydown(e) {
		if (e.key === 'Escape') { collapse(); collapsed.focus(); }
	}

	function onOutside(e) {
		if (!island.contains(e.target)) collapse();
	}

	// Throttle live announcements so the aria-live region and number updates
	// don't fire on every single grid tick.
	let announceTimer = 0;
	let lastAnnounce = '';

	// Human-readable summary of open known issues (shared by the pill and the
	// screen-reader announcement).
	const openSummary = (open) => open === 0
		? 'All known issues fixed'
		: open + ' open ' + (open === 1 ? 'issue' : 'issues');

	function render() {
		if (!island) return;
		const t = tally();

		// Icon-only pill: no visible text. Keep the accessible name in sync so
		// the status is still announced to assistive tech.
		if (collapsed) collapsed.setAttribute('aria-label', 'Test report: ' + openSummary(t.open));

		// Collapsed dot reflects issues: amber (default) while any known issue is
		// still open, green once all are resolved.
		island.classList.toggle('is-all-clear', t.open === 0);
		const broken = grid.failing > 0 || konamiBroken;
		island.classList.toggle('is-failing', broken);

		// Expanded figures (only worth touching while open).
		if (open) {
			setNum('.si-scheduled', grid.scheduled);
			setNum('.si-passed', grid.passed);
			// "Known" shows the current open known-issue count (live), replacing
			// the former hand-fixed total.
			setNum('.si-known-stat', t.open);
			setNum('.si-failing', grid.failing);
			// Known total now lives only in the run grid (open count); the issues
			// section just lists how many are resolved, plus the Muted group.
			setNum('.si-closed', t.closed);
			setNum('.si-muted', t.muted);
			// Found issues, listed under Known.
			const knownList = island.querySelector('.si-known-list');
			if (knownList) {
				const items = resolvedLabels();
				fillChips(knownList, items, ' \u2713');
				knownList.hidden = items.length === 0;
			}
			// Muted ids, listed under Muted (fixed set for the device).
			const mutedList = island.querySelector('.si-muted-list');
			if (mutedList) {
				const labels = mutedLabels();
				fillChips(mutedList, labels, '');
				mutedList.hidden = labels.length === 0;
			}
		}

		// Announce the compact status, throttled.
		const msg = openSummary(t.open);
		if (msg !== lastAnnounce) {
			lastAnnounce = msg;
			clearTimeout(announceTimer);
			announceTimer = setTimeout(() => { if (liveRegion) liveRegion.textContent = msg; }, 500);
		}
	}

	// Render a list of ids as individual chips (so CSS can grid them into fixed
	// columns). `suffix` is appended to each (e.g. a resolved tick). Items may be
	// plain strings (Muted) or `{ text, tag }` (Resolved); when a tag is present
	// it is shown as a small bracketed word after the id, e.g. "ISSUE-19 (typo)".
	function fillChips(container, items, suffix) {
		container.textContent = '';
		items.forEach((item) => {
			const text = typeof item === 'string' ? item : item.text;
			const tag = typeof item === 'string' ? '' : item.tag;
			const chip = document.createElement('span');
			chip.className = 'si-chip';
			chip.textContent = text + suffix;
			if (tag) {
				const t = document.createElement('span');
				t.className = 'si-chip-tag';
				t.textContent = ' (' + tag + ')';
				chip.appendChild(t);
			}
			container.appendChild(chip);
		});
	}

	function setNum(sel, n) {
		const el = island.querySelector(sel);
		if (el) el.textContent = String(n);
	}

	// --- Wiring --------------------------------------------------------------
	build();
	render();

	// Live grid state.
	document.addEventListener('site:grid', (e) => {
		if (e.detail) grid = e.detail;
		render();
	});

	// An issue closed (report()): refresh the tally and flash the notch dot green
	// to acknowledge the resolve, then it falls back to amber (unless every issue
	// is now resolved, where .is-all-clear keeps it green). A fixed hold keeps the
	// behaviour consistent whether or not the egg also shows a toast; 4s matches
	// the length of the resolve toasts most eggs use so the two clear together.
	const BLINK_MS = 4000;
	let blinkTimer = 0;
	document.addEventListener('site:issue', () => {
		render();
		island.classList.add('is-blink');
		clearTimeout(blinkTimer);
		blinkTimer = setTimeout(() => island.classList.remove('is-blink'), BLINK_MS);
	});

	// Device class changed (DevTools device mode, tablet docked): the muted set
	// may flip, so recompute.
	site.onMediaChange(desktopMq, render);

	// Konami: pulse red during the all-fail phase (no auto-expand); relax when the
	// wave has recovered.
	document.addEventListener('site:konami', (e) => {
		const phase = e.detail && e.detail.phase;
		if (phase === 'broken') {
			konamiBroken = true;
			island.classList.add('is-alarm');
		} else if (phase === 'recovered') {
			konamiBroken = false;
			island.classList.remove('is-alarm');
		}
		render();
	});

	// --- Collapsed-pill pointer drag ----------------------------------------
	// The collapsed pill can be grabbed and pulled: the pill's glass body extrudes
	// toward the pointer as an elastic band (SVG overlay) anchored at the notch
	// and pinched at the waist, so the container itself stretches. The status dot
	// keeps its size and rides the centre of the stretched tip. On release the
	// band retracts and clears. A plain press-and-release that never moves past
	// START_PX stays a click, so tap-to-open is untouched; only a press that drags
	// is a drag, and the trailing click is swallowed.
	const START_PX = 6;      // movement before a press becomes a drag
	const PULL_PX = 100;     // distance the travelling blob must reach to "stick"
	const MAX_PX = 220;      // how far the blob can be pulled from the anchor
	const BLOB_R = 9;        // radius of the travelling blob (matches the dot)
	const reduceMotion = site.media('(prefers-reduced-motion: reduce)');

	let drag = null;         // active gesture state, or null
	let swallowClick = false; // suppress the click that follows a real drag

	// Soft, capped radial displacement: the blob follows the pointer along the
	// whole path, but can't be dragged past MAX_PX from the anchor. The top of the
	// pill stays put — only the blob and the band it trails move.
	function pull(delta) {
		const dist = Math.hypot(delta.x, delta.y);
		if (dist <= MAX_PX) return { x: delta.x, y: delta.y, dist };
		const k = MAX_PX / dist;
		return { x: delta.x * k, y: delta.y * k, dist: MAX_PX };
	}

	// Stretch the pill's own body toward the pointer: the notch is the anchor and
	// the glass band is an extrusion of the pill, pinched at the waist like pulled
	// slime, ending in a rounded tip. The status dot (fixed size) rides at the
	// centre of that tip, so only the container stretches — the dot never grows.
	// The band div is a generous box centred on the notch underside; the shape
	// is a clip-path in that box's local coordinates (origin = box top-left).
	const BAND_BOX = 640; // box side; must comfortably exceed 2*(MAX_PX+blob+cap)
	const GRID = 3;       // contour sampling step, px

	// Shape model: the notch and the stretched band are signed-distance fields
	// (negative inside) blended with a smooth minimum, so wherever they meet the
	// join is a rounded fillet instead of a seam — the whole thing behaves like
	// one piece of goo. The top of the screen is a ceiling: the goo blends into
	// it (the notch's flared shoulders) and nothing is drawn above it. The
	// outline of the result is traced with marching squares.
	const smin = (a, b, k) => {
		const h = Math.max(k - Math.abs(a - b), 0) / k;
		return Math.min(a, b) - h * h * k * 0.25;
	};

	function paint(off) {
		if (!off) {
			stretch.classList.remove('is-active');
			return;
		}
		const cx = BAND_BOX / 2, cy = BAND_BOX / 2; // notch underside centre
		const pillW = collapsed.offsetWidth;
		const ceil = cy - collapsed.offsetHeight;   // screen top
		const notchBottom = ceil + 28;              // visual notch height (px)
		const endW = Math.max(12, pillW / 2 - 10);  // tip blob radius
		const ax = cx, sy = notchBottom - 12;       // spine starts inside the notch
		const bx = cx + off.x, by = cy + off.y;     // tip centre (follows pointer)

		// Spine: leaves the notch heading down, straightening as the pull gets
		// more sideways (a tight bend on a wide band would fold).
		const dropY = Math.max(18, (by - sy) * 0.5);
		const side = Math.min(1, Math.abs(bx - ax) / (Math.hypot(bx - ax, by - sy) || 1) * 1.15);
		const C = {
			x: ax + (bx - ax) * 0.5 * side,
			y: (sy + dropY) * (1 - side) + ((sy + by) / 2) * side
		};
		const spine = (t) => {
			const m = 1 - t;
			return {
				x: m * m * ax + 2 * m * t * C.x + t * t * bx,
				y: m * m * sy + 2 * m * t * C.y + t * t * by
			};
		};

		// Width along the band: full at both ends, thinning in the middle with
		// pull length, never below ~40% of the ends.
		const len = Math.hypot(bx - ax, by - sy);
		const pinch = Math.min(endW * 0.6, len * 0.09);
		const width = (t) => Math.max(endW * 0.4, endW - pinch * Math.sin(Math.PI * t));

		// Band as a chain of overlapping discs along the spine.
		const steps = Math.max(8, Math.ceil(len / 6));
		const discs = [];
		for (let i = 0; i <= steps; i++) {
			const t = i / steps, p = spine(t);
			discs.push([p.x, p.y, width(t)]);
		}
		const bandD = (x, y) => {
			let d = Infinity;
			for (let i = 0; i < discs.length; i++) {
				const q = discs[i];
				const v = Math.hypot(x - q[0], y - q[1]) - q[2];
				if (v < d) d = v;
			}
			return d;
		};

		// Notch: a box with rounded bottom corners, running up past the ceiling.
		const nHalf = pillW / 2 - 8, nR = 14;
		const nTop = ceil - 60, nCy = (nTop + notchBottom) / 2, nHalfH = (notchBottom - nTop) / 2;
		const notchD = (x, y) => {
			const qx = Math.abs(x - cx) - nHalf + nR, qy = Math.abs(y - nCy) - nHalfH + nR;
			return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - nR;
		};

		const field = (x, y) => {
			let d = smin(notchD(x, y), bandD(x, y), 16); // notch ↔ band fillet
			d = smin(d, y - ceil, 9);                    // flare into the screen top
			return Math.max(d, ceil - y);                // nothing above the ceiling
		};

		// Sample over the shape's bounds (plus margin so the border is outside).
		let minX = cx - pillW / 2, maxX = cx + pillW / 2, maxY = notchBottom;
		discs.forEach((q) => {
			minX = Math.min(minX, q[0] - q[2]);
			maxX = Math.max(maxX, q[0] + q[2]);
			maxY = Math.max(maxY, q[1] + q[2]);
		});
		const x0 = Math.floor(minX - 24), y0 = ceil - GRID;
		const cols = Math.ceil((maxX + 24 - x0) / GRID), rows = Math.ceil((maxY + 24 - y0) / GRID);
		const v = new Float32Array((cols + 1) * (rows + 1));
		for (let j = 0; j <= rows; j++) {
			for (let i = 0; i <= cols; i++) v[j * (cols + 1) + i] = field(x0 + i * GRID, y0 + j * GRID);
		}

		const d = traceContours(v, cols, rows, x0, y0);
		const clip = 'path(evenodd, "' + d + '")';
		stretchBand.style.webkitClipPath = clip;
		stretchBand.style.clipPath = clip;

		// Fixed-size dot centred in the tip blob. Positioned relative to the
		// .si-stretch origin (notch-underside centre), so it uses the raw offset.
		stretchDot.style.left = off.x.toFixed(1) + 'px';
		stretchDot.style.top = off.y.toFixed(1) + 'px';
		stretch.classList.add('is-active');
	}

	// Marching squares: turn the sampled field into closed outline loops (an SVG
	// path string). Each crossing on a grid edge becomes a vertex; segments are
	// chained edge-to-edge into loops.
	function traceContours(v, cols, rows, x0, y0) {
		const W = cols + 1;
		const at = (i, j) => v[j * W + i];
		const pts = new Map();   // edge key -> [x, y]
		const next = new Map();  // edge key -> list of linked edge keys
		const edgePoint = (key, i1, j1, i2, j2) => {
			if (pts.has(key)) return;
			const a = at(i1, j1), b = at(i2, j2), t = a / (a - b);
			pts.set(key, [x0 + (i1 + (i2 - i1) * t) * GRID, y0 + (j1 + (j2 - j1) * t) * GRID]);
		};
		const link = (a, b) => {
			(next.get(a) || next.set(a, []).get(a)).push(b);
			(next.get(b) || next.set(b, []).get(b)).push(a);
		};
		for (let j = 0; j < rows; j++) {
			for (let i = 0; i < cols; i++) {
				const tl = at(i, j) < 0, tr = at(i + 1, j) < 0, br = at(i + 1, j + 1) < 0, bl = at(i, j + 1) < 0;
				const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
				if (c === 0 || c === 15) continue;
				const T = 'h' + i + ',' + j, B = 'h' + i + ',' + (j + 1);
				const L = 'v' + i + ',' + j, R = 'v' + (i + 1) + ',' + j;
				const need = (k) => {
					if (k === T) edgePoint(T, i, j, i + 1, j);
					else if (k === B) edgePoint(B, i, j + 1, i + 1, j + 1);
					else if (k === L) edgePoint(L, i, j, i, j + 1);
					else edgePoint(R, i + 1, j, i + 1, j + 1);
				};
				const seg = (a, b) => { need(a); need(b); link(a, b); };
				switch (c) {
					case 1: case 14: seg(L, B); break;
					case 2: case 13: seg(B, R); break;
					case 3: case 12: seg(L, R); break;
					case 4: case 11: seg(T, R); break;
					case 6: case 9: seg(T, B); break;
					case 7: case 8: seg(L, T); break;
					case 5: case 10: {
						const mid = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4 < 0;
						if ((c === 5) === mid) { seg(L, T); seg(B, R); } else { seg(L, B); seg(T, R); }
						break;
					}
				}
			}
		}
		const seen = new Set();
		const f = (n) => n.toFixed(1);
		let d = '';
		next.forEach((_, start) => {
			if (seen.has(start)) return;
			let prev = null, cur = start;
			const loop = [];
			while (cur && !seen.has(cur)) {
				seen.add(cur);
				loop.push(pts.get(cur));
				const n = next.get(cur);
				const nxt = n[0] !== prev ? n[0] : n[1];
				prev = cur;
				cur = nxt;
			}
			if (loop.length > 2) d += 'M ' + loop.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L ') + ' Z ';
		});
		return d;
	}

	let springRAF = 0;

	// Snap the band back to the anchor. The blob retracts along its current
	// direction with a touch of elastic overshoot, then the overlay clears and the
	// pill's own dot returns.
	function springBack(from, reached) {
		cancelAnimationFrame(springRAF);
		const finish = () => {
			paint(null);
			collapsed.classList.remove('is-dragging');
			collapsed.querySelector('.si-dot').style.visibility = '';
			if (reached) {
				site.toast('The notch stays in the notch.');
				site.report('i25');
			}
		};
		if (reduceMotion.matches || !from) { finish(); return; }

		const start = performance.now();
		const DUR = 480;
		// Ease back past zero and settle (elastic-ish overshoot).
		const ease = (t) => {
			const c = 1.70158 * 1.2;
			const u = t - 1;
			return u * u * ((c + 1) * u + c) + 1;
		};
		const step = (now) => {
			const t = Math.min(1, (now - start) / DUR);
			const k = 1 - ease(t); // 1 → 0 (with a small negative dip)
			paint({ x: from.x * k, y: from.y * k, dist: from.dist * Math.abs(k) });
			if (t < 1) { springRAF = requestAnimationFrame(step); }
			else finish();
		};
		springRAF = requestAnimationFrame(step);
	}

	collapsed.addEventListener('pointerdown', (e) => {
		// A fresh press always starts clean, so a previous gesture that never
		// emitted a trailing click can't swallow this one's tap.
		swallowClick = false;
		// Once resolved, the pill is tap-to-open only — no more dragging.
		if (open || site.isResolved('i25')) return;
		if (e.button != null && e.button !== 0) return;
		drag = {
			id: e.pointerId,
			x0: e.clientX,
			y0: e.clientY,
			active: false,
			reached: false
		};
	});

	collapsed.addEventListener('pointermove', (e) => {
		if (!drag || e.pointerId !== drag.id) return;
		const delta = { x: e.clientX - drag.x0, y: e.clientY - drag.y0 };
		const dist = Math.hypot(delta.x, delta.y);
		if (!drag.active) {
			if (dist < START_PX) return; // still just a press
			drag.active = true;
			swallowClick = true;
			try { collapsed.setPointerCapture(drag.id); } catch (err) {}
			collapsed.classList.add('is-dragging');
			// Hide the pill's resting dot so only the travelling tip dot shows.
			collapsed.querySelector('.si-dot').style.visibility = 'hidden';
			cancelAnimationFrame(springRAF);
		}
		// Keep the browser from scrolling/selecting mid-drag.
		e.preventDefault();
		// The blob follows the pointer along the whole path (capped by pull()).
		const off = pull(delta);
		drag.off = off;
		if (off.dist >= PULL_PX) drag.reached = true;
		paint(off);
	});

	function endDrag(e) {
		if (!drag || (e && e.pointerId !== drag.id)) return;
		const wasActive = drag.active;
		const reached = drag.reached;
		const off = drag.off;
		try { collapsed.releasePointerCapture(drag.id); } catch (err) {}
		drag = null;
		if (wasActive) springBack(off, reached);
		else collapsed.classList.remove('is-dragging');
	}

	collapsed.addEventListener('pointerup', endDrag);
	collapsed.addEventListener('pointercancel', endDrag);

	// A completed drag emits a trailing click; drop it so the report doesn't open.
	collapsed.addEventListener('click', (e) => {
		if (swallowClick) {
			swallowClick = false;
			e.stopImmediatePropagation();
			e.preventDefault();
		}
	}, true);
})();
