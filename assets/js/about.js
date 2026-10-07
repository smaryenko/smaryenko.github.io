(() => {
	// Info panel next to the name: hover preview on mouse, tap/click/Enter to toggle,
	// closes on Escape or a tap outside.
	const btn = document.getElementById('about-toggle');
	const panel = document.getElementById('about-panel');
	if (!btn || !panel) return;

	const wrap = btn.parentElement;
	const canHover = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
	let pinned = false;
	let hideTimer;

	const isOpen = () => !panel.hidden;

	function show() {
		clearTimeout(hideTimer);
		panel.hidden = false;
		btn.setAttribute('aria-expanded', 'true');
	}

	function hide() {
		clearTimeout(hideTimer);
		pinned = false;
		panel.hidden = true;
		btn.setAttribute('aria-expanded', 'false');
	}

	btn.addEventListener('click', () => {
		if (isOpen() && pinned) hide();
		else { show(); pinned = true; }
	});

	const close = panel.querySelector('.about-close');
	if (close) {
		close.addEventListener('click', () => {
			hide();
			btn.focus();
		});
	}

	if (canHover) {
		// Small delay so the pointer can travel from the icon into the panel.
		wrap.addEventListener('mouseover', (e) => {
			if (btn.contains(e.target) || panel.contains(e.target)) show();
		});
		wrap.addEventListener('mouseleave', () => {
			if (!pinned) hideTimer = setTimeout(hide, 150);
		});
	}

	document.addEventListener('pointerdown', (e) => {
		if (isOpen() && !btn.contains(e.target) && !panel.contains(e.target)) hide();
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isOpen()) {
			hide();
			btn.focus();
		}
	});
})();
