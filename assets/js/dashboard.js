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
		'i22', 'i23', 'i24'
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

	// Found (resolved) known ids, as neutral display labels — shown under Known.
	// Never lists ids that are still open.
	function resolvedLabels() {
		const ignored = ignoredSet();
		return ALL
			.filter((id) => !ignored.has(id) && isClosed(id))
			.map(label);
	}

	// Muted ids for the current device, as display labels — shown under Muted.
	// These never close, so the list is effectively a fixed set.
	function mutedLabels() {
		return [...ignoredSet()].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))).map(label);
	}

	// --- UI ------------------------------------------------------------------
	let island, collapsed, expanded, liveRegion;
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
		collapsed.innerHTML =
			'<span class="si-dot" aria-hidden="true"></span>' +
			'<span class="si-compact"></span>';
		collapsed.addEventListener('click', toggle);

		expanded = document.createElement('div');
		expanded.className = 'si-expanded';
		expanded.hidden = true;
		expanded.innerHTML =
			'<header class="si-head">' +
				'<span class="report-badge si-badge">PASSED</span>' +
				'<span class="si-title">Test report</span>' +
				'<button type="button" class="si-close" aria-label="Collapse">\u00d7</button>' +
			'</header>' +
			'<div class="si-run" aria-label="Test run">' +
				'<div class="si-stat"><span class="si-n si-scheduled" data-k="scheduled">0</span><span class="si-l">Scheduled</span></div>' +
				'<div class="si-stat"><span class="si-n si-passed" data-k="passed">0</span><span class="si-l">Passed</span></div>' +
				'<div class="si-stat"><span class="si-n si-fixed" data-k="fixed">0</span><span class="si-l">Fixed</span></div>' +
				'<div class="si-stat"><span class="si-n si-failing" data-k="failing">0</span><span class="si-l">Failing</span></div>' +
			'</div>' +
			'<div class="si-issues">' +
				'<div class="si-group si-group-known">' +
					'<p class="si-issue-row"><span class="si-issue-k">Known</span> <span class="si-known">0</span> ' +
						'<span class="report-dim">(<span class="si-closed">0</span> resolved)</span></p>' +
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

		// Collapsed status: open known issues, or an all-clear message at 0.
		const compact = island.querySelector('.si-compact');
		if (compact) compact.textContent = openSummary(t.open);

		// Collapsed dot reflects issues: amber (default) while any known issue is
		// still open, green once all are resolved. The expanded badge reflects the
		// live run (grid failures / Konami), kept separate from the pill.
		island.classList.toggle('is-all-clear', t.open === 0);
		const broken = grid.failing > 0 || konamiBroken;
		island.classList.toggle('is-failing', broken);
		const badge = island.querySelector('.si-badge');
		if (badge) badge.textContent = broken ? 'FAILED' : 'PASSED';

		// Expanded figures (only worth touching while open).
		if (open) {
			setNum('.si-scheduled', grid.scheduled);
			setNum('.si-passed', grid.passed);
			setNum('.si-fixed', grid.fixed);
			setNum('.si-failing', grid.failing);
			setNum('.si-known', t.known);
			setNum('.si-closed', t.closed);
			setNum('.si-muted', t.muted);
			// Found issues, listed under Known.
			const knownList = island.querySelector('.si-known-list');
			if (knownList) {
				const labels = resolvedLabels();
				fillChips(knownList, labels, ' \u2713');
				knownList.hidden = labels.length === 0;
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

	// Render a list of id labels as individual chips (so CSS can grid them into
	// fixed columns). `suffix` is appended to each (e.g. a resolved tick).
	function fillChips(container, labels, suffix) {
		container.textContent = '';
		labels.forEach((l) => {
			const chip = document.createElement('span');
			chip.className = 'si-chip';
			chip.textContent = l + suffix;
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

	// An issue closed (report()): refresh the tally.
	document.addEventListener('site:issue', render);

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
})();
