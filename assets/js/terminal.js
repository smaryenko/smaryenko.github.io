// Hidden terminal: type "help" anywhere (or press the key left of 1), Esc to close.
// Built from <template id="term-template"> as a non-modal <dialog>, so the page
// behind stays usable and toasts can sit above it. Tab is kept inside the panel;
// Esc and clicks outside close it.
(() => {
	let term, out, input, returnFocus;
	const cmdHistory = [];
	let histPos = 0;

	// A static site can't read its own filesystem, so the tree is built from what
	// the page actually references in the DOM: <script>, <link>, <img>, favicon.
	// Doing this on every call means newly added files show up without any rebuild.
	// Fonts aren't referenced in HTML (they live in CSS), so they're the one
	// hardcoded part. secret-test.json isn't linked anywhere in the DOM, so it's
	// never auto-discovered; instead we add it by hand with its name redacted, as
	// a nudge that there's a .json worth finding. The real file is still served.
	const SECRET_FILE = 'assets/***********.json';
	const STATIC_FONTS = ['fraunces-latin.woff2', 'inter-latin.woff2'];

	// Insert a "path/to/file" (relative to site root) into a nested tree object.
	function addPath(tree, path) {
		const parts = path.replace(/^\.?\//, '').split('/').filter(Boolean);
		if (!parts.length) return;
		let node = tree;
		parts.forEach((part, i) => {
			if (i === parts.length - 1) {
				if (!(part in node)) node[part] = null; // file
			} else {
				if (node[part] === null || !(part in node)) node[part] = {}; // dir
				node = node[part];
			}
		});
	}

	// Directory the current page lives in, as an absolute URL ending in "/".
	// Everything in the tree is shown relative to here, so it reads the same on
	// file://, a project subpath, or the live domain (no machine paths leak in).
	const baseUrl = new URL('.', location.href);

	// Turn a resource URL into a path relative to the page directory, or null if
	// it's off-site or sits outside that directory (another origin, a CDN, "../").
	function localPath(url) {
		if (!url) return null;
		let u;
		try { u = new URL(url, location.href); } catch (e) { return null; }
		if (u.origin !== baseUrl.origin) return null;
		if (!u.pathname.startsWith(baseUrl.pathname)) return null; // outside the page dir
		let p = decodeURIComponent(u.pathname.slice(baseUrl.pathname.length));
		if (!p || p.endsWith('/')) return null; // directory index, skip
		return p;
	}

	function buildTree() {
		const tree = { 'index.html': null, 'README.md': null };

		// Scripts and stylesheets the page loads (includes any newly added file).
		document.querySelectorAll('script[src]').forEach((el) => {
			const p = localPath(el.getAttribute('src'));
			if (p) addPath(tree, p);
		});
		document.querySelectorAll('link[rel~="stylesheet"], link[rel~="icon"], link[rel~="apple-touch-icon"]').forEach((el) => {
			const p = localPath(el.getAttribute('href'));
			if (p) addPath(tree, p);
		});
		// Images referenced on the page.
		document.querySelectorAll('img[src]').forEach((el) => {
			const p = localPath(el.getAttribute('src'));
			if (p) addPath(tree, p);
		});

		// Fonts can't be discovered from the DOM; add the known ones.
		STATIC_FONTS.forEach((f) => addPath(tree, 'assets/fonts/' + f));

		// The secret file, shown with its name redacted as a breadcrumb.
		addPath(tree, SECRET_FILE);

		return tree;
	}

	// Recursive `ls`: Unicode branch characters, dirs before files per level.
	function renderTree(node, prefix) {
		const names = Object.keys(node).sort((a, b) => {
			const da = node[a] !== null, db = node[b] !== null;
			if (da !== db) return da ? -1 : 1;
			return a.localeCompare(b);
		});
		let lines = '';
		names.forEach((name, i) => {
			const last = i === names.length - 1;
			const isDir = node[name] !== null;
			lines += prefix + (last ? '└── ' : '├── ') + name + (isDir ? '/' : '') + '\n';
			if (isDir) lines += renderTree(node[name], prefix + (last ? '    ' : '│   '));
		});
		return lines;
	}

	const MONTHS = {
		jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
		may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
		sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
		dec: 11, december: 11
	};
	const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];

	// Parse a loose date string into { date } or { error }.
	// Accepts (year optional, defaults to the current year):
	//   18/12   18.12   18-12            (day/month, numeric)
	//   18 dec   dec 18   18 december   december 18
	//   any of the above with a trailing/leading 4-digit year (e.g. 18 dec 2025)
	// Day/month order: for pure numbers we assume day-first (DD/MM), matching the
	// examples. Values are validated against a real calendar.
	// The whole input must match one format; any leftover text is rejected.
	function parseDate(raw) {
		let s = raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
		if (!s) return { error: 'empty' };

		let year = new Date().getFullYear();
		// Optional 4-digit year, either leading ("2025 18 dec") or trailing
		// ("18 dec 2025", "18/12/2025"). Only one is allowed.
		let ym = s.match(/^(\d{4}) (.+)$/) || s.match(/^(.+?)[ /.\-](\d{4})$/);
		if (ym) {
			const leading = /^\d{4}$/.test(ym[1]);
			year = parseInt(leading ? ym[1] : ym[2], 10);
			s = leading ? ym[2] : ym[1];
		}

		let day, month, m;
		if ((m = s.match(/^(\d{1,2})[/.\- ](\d{1,2})$/))) {
			// Numeric, day first: 18/12  18.12  18-12  18 12
			day = parseInt(m[1], 10);
			month = parseInt(m[2], 10) - 1;
		} else if ((m = s.match(/^(\d{1,2}) ?([a-z]+)$/) || s.match(/^([a-z]+) (\d{1,2})$/))) {
			// Named month on either side: 18 dec  dec 18  18 december
			const dayFirst = /^\d/.test(m[1]);
			const key = dayFirst ? m[2] : m[1];
			if (!(key in MONTHS)) return { error: 'month' };
			month = MONTHS[key];
			day = parseInt(dayFirst ? m[1] : m[2], 10);
		} else {
			// A word that isn't a month is the most helpful thing to point out.
			const word = s.match(/[a-z]+/);
			if (word && !(word[0] in MONTHS)) return { error: 'month' };
			return { error: 'format' };
		}

		if (month < 0 || month > 11) return { error: 'month' };
		const date = new Date(year, month, day);
		// Reject rollovers like 31/02 (JS would silently roll into March).
		if (date.getMonth() !== month || date.getDate() !== day || day < 1) {
			return { error: 'day' };
		}
		return { date };
	}

	function jump(arg) {
		const q = (arg || '').trim();
		if (!q || q === 'help') {
			return 'jump <date> — travel to any date and see what the page does.\n\n' +
				'Formats (year optional, defaults to this year):\n' +
				'  7/3   7.3   7-3\n' +
				'  7 mar   mar 7   7 march   march 7\n' +
				'  add a year too: 7 mar 2025\n\n' +
				'Some days are more festive than others. Go find them.\n' +
				'Use "jump today" or "jump reset" to go back to the real date.';
		}
		if (/^(today|now|reset|clear|real)$/i.test(q)) {
			if (!site.clearSimulatedDate) return 'Seasonal module not loaded.';
			site.clearSimulatedDate();
			const now = new Date();
			return 'Back to real time: ' + now.getDate() + ' ' + MONTH_NAMES[now.getMonth()] + ' ' + now.getFullYear() + '.';
		}
		const res = parseDate(q);
		if (res.error) {
			const why = {
				empty: 'Give me a date.',
				month: 'That month doesn\'t look right.',
				day: 'That day doesn\'t exist on the calendar.',
				format: 'Couldn\'t read that date.'
			}[res.error] || 'Couldn\'t read that date.';
			return why + '\nType "jump" on its own to see the formats.';
		}
		if (!site.setSimulatedDate) return 'Seasonal module not loaded.';
		const kind = site.setSimulatedDate(res.date);
		const d = res.date;
		const stamp = d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
		let note;
		if (kind === 'birthday') note = '🎉 Happy birthday! A party cone landed on the S.';
		else if (kind === 'xmas') note = '🎅 Merry Christmas! Santa left a hat on the S.';
		else note = 'Nothing special on this date. Try 18 Dec or 25 Dec.';
		return 'Jumped to ' + stamp + '.\n' + note + '\n\n(Close the terminal to look. "jump reset" restores today.)';
	}

	const commands = {
		help: () => 'Available commands:\n\n' +
			['about', 'ls', 'jump', 'coffee', 'sudo', 'rm -rf /', 'konami', '42', 'clear', 'exit'].join('\n'),
		ls: () => '.\n' + renderTree(buildTree(), '').replace(/\n$/, ''),
		about: () => 'Stanislav Maryenko\nSoftware Developer in Test and Data Quality Analyst.\nBreaks things professionally, so you don\'t have to.',
		coffee: () => 'ERROR: Coffee machine not connected.',
		sudo: () => 'Nice try.',
		'rm -rf /': () => 'Permission denied.\n\nQA saved the day.',
		konami: () => '↑ ↑ ↓ ↓ ← → ← → B A\n\n' +
			'Close the terminal (Esc) and enter it on the page.\n' +
			'Shortcuts are for developers. QA does it by hand.',
		42: () => 'The Answer to the Ultimate Question of Life, the Universe, and Everything.\nStill waiting on the question. Ticket is in the backlog.\n\nCoincidentally, 42 tests are failing. Close the terminal and fix them by hand (click the red dots).',
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

	// Commands that take the rest of the line as an argument.
	const argCommands = { jump, date: jump };

	function run(raw) {
		if (!out) return; // terminal never opened (e.g. no <dialog> support)
		const cmd = raw.trim().replace(/\s+/g, ' ');
		print('> ' + raw, 'term-cmd');
		if (!cmd) return;
		cmdHistory.push(cmd);
		histPos = cmdHistory.length;

		// First try "verb <args>" commands (e.g. "jump 18 dec").
		const sp = cmd.indexOf(' ');
		const verb = (sp === -1 ? cmd : cmd.slice(0, sp)).toLowerCase();
		if (argCommands[verb]) {
			const result = argCommands[verb](sp === -1 ? '' : cmd.slice(sp + 1));
			if (result) print(result, '');
			return;
		}

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
		// Clicks outside the panel close it (the moth is exempt, so it can be caught).
		document.addEventListener('pointerdown', (e) => {
			if (!isOpen() || term.contains(e.target)) return;
			if (e.target.closest && e.target.closest('.idle-moth')) return;
			// Another modal on top (e.g. the 404 report) owns the clicks.
			if (document.querySelector('dialog[open]:not(.term)')) return;
			close();
		});
		// Keep Tab inside the panel, like a modal would.
		term.addEventListener('keydown', (e) => {
			if (e.key !== 'Tab') return;
			const items = [...term.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])')]
				.filter((el) => !el.disabled && el.offsetParent !== null);
			if (!items.length) return;
			const first = items[0], last = items[items.length - 1];
			if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
			else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
		});
		// Every way of closing goes through here.
		term.addEventListener('close', () => {
			if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
			returnFocus = null;
		});
		input.addEventListener('keydown', (e) => {
			// Keep terminal typing from triggering page shortcuts (e.g. Konami).
			e.stopPropagation();
			if (e.key === 'Escape' || isToggleKey(e)) {
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
		// The terminal is a <dialog>; skip it where that isn't supported.
		if (!site.canDialog) return;
		if (!term) build();
		if (term.open) return;
		// Remember where focus was (e.g. a link) so closing can put it back.
		const active = document.activeElement;
		returnFocus = active && active !== document.body ? active : null;
		term.show();
		fitViewport();
		input.focus({ preventScroll: true });
	}

	function close() {
		if (isOpen()) term.close();
	}

	// Mobile keyboards overlay the page without resizing the layout viewport,
	// so lift the terminal above the keyboard and fit it to the visible area.
	const vv = window.visualViewport;
	function fitViewport() {
		if (!term || !vv) return;
		const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
		term.style.setProperty('--kb', kb + 'px');
		term.style.setProperty('--vvh', vv.height + 'px');
		if (term.open) out.scrollTop = out.scrollHeight;
	}
	if (vv) {
		vv.addEventListener('resize', fitViewport);
		vv.addEventListener('scroll', fitViewport);
	}

	// Two triggers:
	//  - the key below Esc / left of "1": ` ~ on US/Windows, § ± on Mac ISO.
	//    Matched by physical code and by character, so any layout works;
	//  - typing the word "help" anywhere on the page (no special key needed).
	function isToggleKey(e) {
		return e.code === 'Backquote' || e.code === 'IntlBackslash' ||
			['`', '~', '§', '±'].includes(e.key);
	}

	let typed = '';
	document.addEventListener('keydown', (e) => {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		// Esc closes the terminal from anywhere (unless another modal is on top).
		if (e.key === 'Escape' && isOpen() && !document.querySelector('dialog[open]:not(.term)')) {
			close();
			return;
		}
		const t = e.target;
		if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
		// Another modal (e.g. the 404 report) owns the keyboard.
		if (!isOpen() && document.querySelector('dialog[open]')) return;
		if (isToggleKey(e)) {
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
			if (site.media('(hover: none)').matches) e.preventDefault();
		});
	}

	site.openTerminal = open;
	site.runTerminal = run;
})();
