// Hidden terminal: type "help" anywhere (or press the key left of 1), Esc to close.
// Built from <template id="term-template"> as a modal <dialog>, so the browser
// traps focus inside it and Esc closes it.
(() => {
	let term, out, input, returnFocus;
	const cmdHistory = [];
	let histPos = 0;

	const commands = {
		help: () => 'Available commands:\n\n' +
			['about', 'tests', 'bugs', 'coffee', 'sudo', 'rm -rf /', 'konami', '42', 'clear', 'exit'].join('\n'),
		about: () => 'Stanislav Maryenko\nSoftware Developer in Test and Data Quality Analyst.\nBreaks things professionally, so you don\'t have to.',
		tests: () => {
			// Report what the hero grid is actually showing right now.
			if (!site.testStats) return 'No test runner found.';
			const s = site.testStats();
			let text = 'Running ' + s.total + ' tests...\n\n' +
				s.pass + ' passed, ' + s.fail + ' failed, ' + s.queued + ' queued, ' + s.none + ' not run';
			if (s.fail) {
				text += '\n\nFailed:\n' + s.failed.map((id) => '  ✗ ' + id).join('\n') +
					'\n\nClick the red dots on the page to fix them.';
			} else {
				text += '\n\nAll green. Suspicious.';
			}
			return text;
		},
		bugs: () => '42 bugs currently known.',
		coffee: () => 'ERROR: Coffee machine not connected.',
		sudo: () => 'Nice try.',
		'rm -rf /': () => 'Permission denied.\n\nQA saved the day.',
		konami: () => '↑ ↑ ↓ ↓ ← → ← → B A\n\n' +
			'Close the terminal (Esc) and enter it on the page.\n' +
			'Shortcuts are for developers. QA does it by hand.',
		42: () => 'The Answer to the Ultimate Question of Life, the Universe, and Everything.\nStill waiting on the question. Ticket is in the backlog.',
		clear: () => { out.textContent = ''; return ''; },
		exit: () => { close(); return ''; }
	};

	function print(text, cls) {
		const line = document.createElement('div');
		if (cls) line.className = cls;
		line.textContent = text;
		out.appendChild(line);
		out.scrollTop = out.scrollHeight;
	}

	function run(raw) {
		const cmd = raw.trim().replace(/\s+/g, ' ');
		print('> ' + raw, 'term-cmd');
		if (!cmd) return;
		cmdHistory.push(cmd);
		histPos = cmdHistory.length;
		// "sudo anything" is still a nice try.
		const fn = commands[cmd] || (/^sudo\b/.test(cmd) && commands.sudo);
		const result = fn ? fn() : 'command not found: ' + cmd + '\nType "help" for available commands.';
		if (result) print(result, fn ? '' : 'term-err');
	}

	function build() {
		const template = document.getElementById('term-template');
		term = template.content.firstElementChild.cloneNode(true);
		document.body.appendChild(term);
		out = term.querySelector('.term-out');
		input = term.querySelector('input');
		print('Welcome, curious visitor. Type "help" to begin.', 'term-dim');

		term.querySelector('.term-close').addEventListener('click', close);
		term.querySelector('form').addEventListener('submit', (e) => {
			e.preventDefault();
			run(input.value);
			input.value = '';
		});
		// Clicks outside the panel land on the dialog's backdrop, i.e. the dialog itself.
		term.addEventListener('pointerdown', (e) => {
			if (e.target === term) close();
		});
		// Esc (native cancel) and every other way of closing go through here.
		term.addEventListener('close', () => {
			if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
			returnFocus = null;
		});
		input.addEventListener('keydown', (e) => {
			// Keep terminal typing from triggering page shortcuts (e.g. Konami).
			e.stopPropagation();
			if (e.key === 'Escape' || e.code === 'Backquote' || e.code === 'IntlBackslash' || e.key === '`') {
				e.preventDefault();
				close();
			} else if (e.key === 'ArrowUp' && histPos > 0) {
				e.preventDefault();
				input.value = cmdHistory[--histPos];
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				histPos = Math.min(cmdHistory.length, histPos + 1);
				input.value = cmdHistory[histPos] || '';
			}
		});
	}

	function isOpen() {
		return Boolean(term && term.open);
	}

	function open() {
		if (!term) build();
		if (term.open) return;
		// Remember where focus was (e.g. a link) so closing can put it back.
		const active = document.activeElement;
		returnFocus = active && active !== document.body ? active : null;
		term.showModal();
		input.focus({ preventScroll: true });
	}

	function close() {
		if (isOpen()) term.close();
	}

	// Two triggers:
	//  - the key left of "1" / above Tab, by physical position (works on any layout);
	//  - typing the word "help" anywhere on the page (no special key needed).
	let typed = '';
	document.addEventListener('keydown', (e) => {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const t = e.target;
		if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
		// Another modal (e.g. the 404 report) owns the keyboard.
		if (!isOpen() && document.querySelector('dialog[open]')) return;
		if (e.code === 'Backquote' || e.code === 'IntlBackslash' || e.key === '`') {
			e.preventDefault();
			if (isOpen()) close(); else open();
			return;
		}
		if (e.key.length !== 1) return;
		typed = (typed + e.key.toLowerCase()).slice(-4);
		if (typed === 'help' && !isOpen()) {
			// Don't let the final "p" land in the freshly focused prompt.
			e.preventDefault();
			typed = '';
			open();
			run('help');
		}
	});

	// Touch trigger (no keyboard on phones): long-press the name in the hero.
	const heading = document.querySelector('.hero h1');
	if (heading) {
		let pressTimer, startX, startY;
		heading.addEventListener('pointerdown', (e) => {
			if (e.pointerType !== 'touch') return;
			startX = e.clientX;
			startY = e.clientY;
			clearTimeout(pressTimer);
			pressTimer = setTimeout(() => {
				if (navigator.vibrate) navigator.vibrate(30);
				open();
				run('help');
			}, 800);
		});
		heading.addEventListener('pointermove', (e) => {
			// A scroll or swipe isn't a long-press.
			if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) clearTimeout(pressTimer);
		});
		['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
			heading.addEventListener(type, () => clearTimeout(pressTimer));
		});
		// Stop the system copy/lookup menu from popping up on long-press.
		heading.addEventListener('contextmenu', (e) => {
			if (window.matchMedia('(hover: none)').matches) e.preventDefault();
		});
	}

	site.openTerminal = open;
	site.runTerminal = run;
})();
