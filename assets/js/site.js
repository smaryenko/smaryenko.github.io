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
