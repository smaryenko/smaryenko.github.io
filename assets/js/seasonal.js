// Seasonal easter eggs that sit on the "S" of "Stanislav":
//   - 18 December: a birthday party cone (it's a birthday).
//   - 25 December: Santa's hat (Christmas).
// By default the real date decides. The terminal "jump" command can set a
// simulated date (see site.setSimulatedDate) so you can preview either egg on
// any day. The simulation lives only in memory for this page view.
(() => {
	let simulated = null; // a Date, or null to use the real clock.
	let host;             // the ".letter" span holding the first "S".
	let deco;             // the decoration element mounted on that letter.

	// What date should the page behave as? Real now, unless simulated.
	function effectiveDate() {
		return simulated ? new Date(simulated) : new Date();
	}

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
	function apply() {
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
		return apply();
	};
	site.clearSimulatedDate = () => {
		simulated = null;
		return apply();
	};
	site.getSimulatedDate = () => (simulated ? new Date(simulated) : null);
	site.applySeasonal = apply;

	// utils.js rewrites the h1 (splitting it into letters) in its own IIFE.
	// Script order in index.html puts utils.js after this file, so wait for the
	// full load before first applying, by which point the letters exist.
	if (document.readyState === 'complete') {
		apply();
	} else {
		window.addEventListener('load', apply, { once: true });
	}

	// Keep the decoration glued to the "S" across resizes/orientation changes
	// (position is pure CSS, but re-apply if the name was re-rendered).
	window.addEventListener('resize', () => { if (!host || !host.isConnected) apply(); }, { passive: true });
})();
