// Timeline of notable software bugs, shown inline in the hero — a horizontal
// strip on desktop, a vertical list on mobile. Each entry shows year + icon +
// name; the description appears on hover, and on tap for touch devices.
// Built lazily the first time it is shown.
(() => {
	// Each row: year label, emoji icon, short name, what went wrong, QA lesson.
	// Wording is deliberately measured — several of these incidents have
	// oversimplified pop-culture versions; these stick to the uncontroversial core.
	const EVENTS = [
		{ year: '1947', icon: '🦋', name: 'Harvard Mark II — the first "bug"',
			what: 'A moth was found trapped in a relay and taped into the log.',
			lesson: 'Inspect the actual system.' },
		{ year: '1962', icon: '🚀', name: 'Mariner 1',
			what: 'A missing/incorrect mathematical notation sent the guidance program — and the spacecraft — off course.',
			lesson: 'Requirements and code must match.' },
		{ year: '1969', icon: '🌕', name: 'Apollo 11 — 1202 alarm',
			what: 'The guidance computer was overloaded during the lunar landing, but shed low-priority work and recovered.',
			lesson: 'Graceful degradation matters.' },
		{ year: '1985–87', icon: '☢️', name: 'Therac-25',
			what: 'Race conditions and inadequate safety design caused massive radiation overdoses.',
			lesson: 'Software can be a safety boundary.' },
		{ year: '1990', icon: '☎️', name: 'AT&T network crash',
			what: 'A software update triggered a cascading failure across the long-distance network.',
			lesson: 'Test failure recovery, not just success.' },
		{ year: '1991', icon: '🚀', name: 'Patriot missile',
			what: 'Small timing/rounding errors accumulated until the system missed its target.',
			lesson: 'Tiny numerical errors can become huge.' },
		{ year: '1993', icon: '🧮', name: 'Intel Pentium FDIV',
			what: 'A flaw in the floating-point division hardware produced incorrect results.',
			lesson: 'Test the edge cases.' },
		{ year: '1994', icon: '💾', name: 'Windows 95 — long-term date limits',
			what: 'Date/time representation limits exposed long-term compatibility problems.',
			lesson: 'Test beyond the expected lifetime.' },
		{ year: '1996', icon: '🚀', name: 'Ariane 5 Flight 501',
			what: 'A numeric conversion overflow shut down both inertial reference systems.',
			lesson: 'Revalidate reused code.' },
		{ year: '1998–99', icon: '🛰️', name: 'Mars Climate Orbiter',
			what: 'One component used imperial units while another expected metric.',
			lesson: 'Interfaces need explicit contracts.' },
		{ year: '1999', icon: '📅', name: 'Y2K',
			what: 'Two-digit years created ambiguity when the calendar reached 2000.',
			lesson: 'Never assume today\'s constraints last forever.' },
		{ year: '2000', icon: '💻', name: 'Excel leap-year quirk',
			what: 'Excel treats 1900 as a leap year for Lotus 1-2-3 compatibility.',
			lesson: 'Legacy compatibility creates strange requirements.' },
		{ year: '2003', icon: '🛰️', name: 'Mars Rover Spirit',
			what: 'A full flash file system left the rover stuck in a reboot loop.',
			lesson: 'Resource limits are test cases.' },
		{ year: '2010', icon: '🌍', name: 'Stuxnet',
			what: 'Sophisticated malware exploited industrial-control systems.',
			lesson: 'Security is part of software quality.' },
		{ year: '2012', icon: '💰', name: 'Knight Capital',
			what: 'A deployment left old code active on one server; losses reached ~$460M in 45 minutes.',
			lesson: 'Deployment is part of testing.' },
		{ year: '2013', icon: '🏥', name: 'Healthcare.gov launch',
			what: 'Integration, performance and capacity problems overwhelmed the initial service.',
			lesson: 'Load-test with realistic conditions.' },
		{ year: '2014', icon: '🔐', name: 'Heartbleed',
			what: 'A bounds-checking failure in OpenSSL exposed sensitive memory.',
			lesson: 'Small defects can become security disasters.' },
		{ year: '2018–19', icon: '✈️', name: 'Boeing 737 MAX / MCAS',
			what: 'Software relying on erroneous sensor data contributed to two fatal crashes.',
			lesson: 'Test assumptions and failure modes.' },
		{ year: '2021', icon: '📈', name: 'Robinhood outage',
			what: 'Infrastructure/software failures caused prolonged disruption during peak demand.',
			lesson: 'Availability is a feature.' },
		{ year: '2024', icon: '🖥️', name: 'CrowdStrike outage',
			what: 'A faulty security-content update crashed millions of Windows systems.',
			lesson: 'Test production updates before global rollout.' }
	];

	const section = document.getElementById('hero-timeline');
	const track = section && section.querySelector('.hero-timeline-track');
	let built = false;

	// The story popover floats ABOVE the strip (outside the scrolling track, so it
	// is never clipped) and never changes the strip's size.
	const detail = section && section.querySelector('.tl-detail');

	// How the visitor last interacted: 'mouse', 'touch'/'pen', or 'key'. A tap
	// fires emulated mouseenter + focus before click, so hover/focus handlers
	// must ignore touch, or the tap would open and instantly close the story.
	let lastInput = 'mouse';
	document.addEventListener('pointerdown', (e) => { lastInput = e.pointerType || 'mouse'; }, true);
	document.addEventListener('keydown', () => { lastInput = 'key'; }, true);
	const isTouch = () => lastInput === 'touch' || lastInput === 'pen';

	// Build the timeline once, into the existing track.
	function build() {
		if (built || !track) return;
		built = true;
		EVENTS.forEach((ev) => track.appendChild(renderEntry(ev)));
		// Leaving the strip with the mouse closes the popover.
		section.addEventListener('mouseleave', () => { if (!isTouch()) clearSelection(); });
		// On touch, tapping anywhere outside the strip closes it.
		document.addEventListener('click', (e) => {
			if (isTouch() && !section.contains(e.target)) clearSelection();
		});
	}

	// Highlight one marker and show its story in the popover.
	function select(li, ev) {
		track.querySelectorAll('.tl-item.is-active').forEach((el) => {
			if (el !== li) {
				el.classList.remove('is-active');
				el.querySelector('.tl-node').setAttribute('aria-expanded', 'false');
			}
		});
		li.classList.add('is-active');
		li.querySelector('.tl-node').setAttribute('aria-expanded', 'true');
		if (!detail) return;
		detail.innerHTML =
			'<p class="tl-detail-title"><span>' + escapeHtml(ev.year) + '</span> ' + escapeHtml(ev.name) + '</p>' +
			'<p class="tl-what">' + escapeHtml(ev.what) + '</p>' +
			'<p class="tl-lesson"><span class="tl-lesson-tag">QA lesson</span> ' + escapeHtml(ev.lesson) + '</p>';
		detail.classList.add('is-shown');
	}

	function clearSelection() {
		track.querySelectorAll('.tl-item.is-active').forEach((el) => {
			el.classList.remove('is-active');
			el.querySelector('.tl-node').setAttribute('aria-expanded', 'false');
		});
		if (detail) detail.classList.remove('is-shown');
	}

	// One marker on the line: a <button> (keyboard- and screen-reader-friendly,
	// and a tap target on touch) with icon dot, year and name. Hover/focus shows
	// the story; a tap toggles it (touch has no hover).
	function renderEntry(ev) {
		const li = document.createElement('li');
		li.className = 'tl-item';

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'tl-node';
		btn.setAttribute('aria-expanded', 'false');
		if (detail) btn.setAttribute('aria-controls', 'tl-detail');
		btn.innerHTML =
			'<span class="tl-dot" aria-hidden="true">' + ev.icon + '</span>' +
			'<span class="tl-year">' + escapeHtml(ev.year) + '</span>' +
			'<span class="tl-name">' + escapeHtml(ev.name) + '</span>';

		// Mouse hover and keyboard focus open the story; touch ignores both.
		btn.addEventListener('mouseenter', () => { if (!isTouch()) select(li, ev); });
		btn.addEventListener('focus', () => { if (!isTouch()) select(li, ev); });
		btn.addEventListener('click', () => {
			// Touch: tap toggles. Mouse/keyboard: click just keeps it open.
			const open = li.classList.contains('is-active') && detail && detail.classList.contains('is-shown');
			if (isTouch() && open) clearSelection();
			else select(li, ev);
		});

		li.appendChild(btn);
		return li;
	}

	function escapeHtml(s) {
		return s.replace(/[&<>"']/g, (c) => ({
			'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
		}[c]));
	}

	function isRevealed() {
		return Boolean(section && !section.hidden);
	}

	function reveal() {
		if (!section || isRevealed()) return;
		build();
		section.hidden = false;
		requestAnimationFrame(() => {
			section.classList.add('is-in');
			// The intro line is hidden on small screens to keep the strip compact;
			// show it as a toast there instead.
			const intro = section.querySelector('.hero-timeline-intro');
			if (intro && getComputedStyle(intro).display === 'none') {
				site.toast(intro.textContent, 4000);
			}
			// Only scroll if the strip is off-screen (e.g. visitor is down in the
			// projects); otherwise nothing on the page moves.
			const r = section.getBoundingClientRect();
			if (r.top < 0 || r.bottom > window.innerHeight) {
				section.scrollIntoView({ behavior: site.reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
			}
		});
	}

	function hide() {
		if (!section) return;
		section.classList.remove('is-in');
		section.hidden = true;
	}

	function toggle() {
		if (isRevealed()) hide(); else reveal();
	}

	// --- History handling ----------------------------------------------------
	// Chrome marks history entries added by pushState without a user gesture as
	// "skippable", so the entry is pushed on the first real interaction
	// (click/tap/key), never on load.
	const page = location.pathname + location.search;

	// A #bugs left over from a reload or old link: start clean.
	if (location.hash === '#bugs') history.replaceState(null, '', page);

	// After a reload the entry from the previous visit survives as the current one.
	let armed = !!(history.state && history.state.bugsGuard);
	// Touch only counts as a user gesture on release (pointerup/touchend), mouse
	// already on press, so listen to both and push on the first one that the
	// browser actually treats as activation. A push without activation would be
	// marked skippable.
	const ACTIVATION_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];

	function arm() {
		if (armed || !section) return;
		if (navigator.userActivation && !navigator.userActivation.isActive) return; // not a real gesture yet
		armed = true;
		ACTIVATION_EVENTS.forEach((t) => document.removeEventListener(t, arm, true));
		history.pushState({ bugsGuard: true }, '', page);
	}

	if (!armed) ACTIVATION_EVENTS.forEach((t) => document.addEventListener(t, arm, true));

	window.addEventListener('popstate', (e) => {
		if (!armed || isRevealed()) return;
		if (e.state && e.state.bugsGuard) return; // moved forward onto the guard
		// In-page anchor links (#one etc.) also fire popstate with no state; ignore
		// them. #bugs may survive from an earlier visit, so it still counts.
		if (location.hash && location.hash !== '#bugs') return;
		history.replaceState(null, '', page + '#bugs');
		reveal();
	});
})();
