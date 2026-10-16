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

	// ---------------------------------------------------------------------------
	// Verification gate. A short challenge chain gates the privileged mode below;
	// each step is machine-trivial but human-tedious. All values are generated
	// per run and checked in code; nothing here is written down. State lives only
	// in memory for the open panel and is cleared when it closes.
	// ---------------------------------------------------------------------------
	const SESSION_CACHE_MS = 5 * 60 * 1000;
	let mode = 'normal'; // 'normal' | 'gate' | 'root'
	let gate = null; // { step, items } while in 'gate'
	let lastPass = 0; // timestamp of last successful verification this page view
	// A yes/no confirmation awaiting the next line (e.g. before `reset --hard`
	// wipes everything). While set, the next input is treated as the answer.
	let pendingConfirm = null; // { onYes, prompt } | null

	// Normalise a free-text answer: trim, collapse spaces, lowercase, strip any
	// 0b prefix and thousands separators so "0b1010", "1,024" etc. compare cleanly.
	function norm(s) {
		return String(s == null ? '' : s)
			.trim().toLowerCase()
			.replace(/\s+/g, ' ')
			.replace(/^0b/, '')
			.replace(/[,_](?=\d)/g, '');
	}

	function randomInt(min, max) {
		return min + Math.floor(Math.random() * (max - min + 1));
	}

	// A random base64-ish blob of the given length (A–Z a–z 0–9 + /).
	function randomBlob(len) {
		const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		let s = '';
		for (let i = 0; i < len; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
		return s;
	}

	// English ordinal suffix (1st, 2nd, 3rd, 11th, 21st…).
	function ordinal(n) {
		const t = n % 100, u = n % 10;
		const suf = t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th';
		return n.toLocaleString('en-US') + suf;
	}

	// Nth prime via a sieve of Eratosthenes, computed on demand. Capped high
	// enough to cover N up to 100,000 (the 100,000th prime is 1,299,709).
	function nthPrime(n) {
		const LIMIT = 1300000;
		const sieve = new Uint8Array(LIMIT + 1);
		let count = 0;
		for (let i = 2; i <= LIMIT; i++) {
			if (!sieve[i]) {
				if (++count === n) return i;
				for (let j = i * 2; j <= LIMIT; j += i) sieve[j] = 1;
			}
		}
		return null;
	}

	// A sampling of the CSS named colors with their hex values. Aliases accept
	// either spelling. One is picked at random per run and shown as a swatch.
	const NAMED_COLORS = {
		'#f0f8ff': ['aliceblue'], '#faebd7': ['antiquewhite'], '#7fffd4': ['aquamarine'],
		'#f0ffff': ['azure'], '#f5f5dc': ['beige'], '#ffe4c4': ['bisque'],
		'#8a2be2': ['blueviolet'], '#a52a2a': ['brown'], '#deb887': ['burlywood'],
		'#5f9ea0': ['cadetblue'], '#7fff00': ['chartreuse'], '#d2691e': ['chocolate'],
		'#ff7f50': ['coral'], '#6495ed': ['cornflowerblue'], '#dc143c': ['crimson'],
		'#00ffff': ['cyan', 'aqua'], '#ff00ff': ['magenta', 'fuchsia'],
		'#00008b': ['darkblue'], '#008b8b': ['darkcyan'], '#b8860b': ['darkgoldenrod'],
		'#006400': ['darkgreen'], '#bdb76b': ['darkkhaki'], '#8b008b': ['darkmagenta'],
		'#ff8c00': ['darkorange'], '#9932cc': ['darkorchid'], '#e9967a': ['darksalmon'],
		'#483d8b': ['darkslateblue'], '#00ced1': ['darkturquoise'], '#9400d3': ['darkviolet'],
		'#ff1493': ['deeppink'], '#00bfff': ['deepskyblue'], '#1e90ff': ['dodgerblue'],
		'#b22222': ['firebrick'], '#228b22': ['forestgreen'], '#ffd700': ['gold'],
		'#daa520': ['goldenrod'], '#808080': ['gray', 'grey'], '#adff2f': ['greenyellow'],
		'#ff69b4': ['hotpink'], '#cd5c5c': ['indianred'], '#4b0082': ['indigo'],
		'#f0e68c': ['khaki'], '#e6e6fa': ['lavender'], '#7cfc00': ['lawngreen'],
		'#add8e6': ['lightblue'], '#f08080': ['lightcoral'], '#90ee90': ['lightgreen'],
		'#ffb6c1': ['lightpink'], '#ffa07a': ['lightsalmon'], '#20b2aa': ['lightseagreen'],
		'#778899': ['lightslategray', 'lightslategrey'], '#32cd32': ['limegreen'],
		'#faf0e6': ['linen'], '#66cdaa': ['mediumaquamarine'], '#0000cd': ['mediumblue'],
		'#ba55d3': ['mediumorchid'], '#9370db': ['mediumpurple'], '#3cb371': ['mediumseagreen'],
		'#7b68ee': ['mediumslateblue'], '#c71585': ['mediumvioletred'], '#191970': ['midnightblue'],
		'#ffe4b5': ['moccasin'], '#ffdead': ['navajowhite'], '#808000': ['olive'],
		'#6b8e23': ['olivedrab'], '#ffa500': ['orange'], '#ff4500': ['orangered'],
		'#da70d6': ['orchid'], '#eee8aa': ['palegoldenrod'], '#98fb98': ['palegreen'],
		'#afeeee': ['paleturquoise'], '#db7093': ['palevioletred'], '#ffdab9': ['peachpuff'],
		'#cd853f': ['peru'], '#ffc0cb': ['pink'], '#dda0dd': ['plum'], '#b0e0e6': ['powderblue'],
		'#bc8f8f': ['rosybrown'], '#4169e1': ['royalblue'], '#8b4513': ['saddlebrown'],
		'#fa8072': ['salmon'], '#f4a460': ['sandybrown'], '#2e8b57': ['seagreen'],
		'#a0522d': ['sienna'], '#87ceeb': ['skyblue'], '#6a5acd': ['slateblue'],
		'#708090': ['slategray', 'slategrey'], '#00ff7f': ['springgreen'], '#4682b4': ['steelblue'],
		'#d2b48c': ['tan'], '#008080': ['teal'], '#d8bfd8': ['thistle'], '#ff6347': ['tomato'],
		'#40e0d0': ['turquoise'], '#ee82ee': ['violet'], '#f5deb3': ['wheat'], '#9acd32': ['yellowgreen'],
	};

	// Build the fixed-order question set for one run. Each item is
	// { prompt, check(answer) -> bool }. Correct values are computed, never shown.
	function buildChallenge() {
		const a = BigInt(randomInt(100000000, 999999999));
		const b = BigInt(randomInt(100000000, 999999999));
		const product = (a * b).toString(2);

		const blob = randomBlob(12);
		const reversed = blob.split('').reverse().join('');

		const n = randomInt(10000, 100000);
		let prime = null; // computed lazily when the question is first shown

		const hexes = Object.keys(NAMED_COLORS);
		const hex = hexes[Math.floor(Math.random() * hexes.length)];
		const colorNames = NAMED_COLORS[hex];

		return [
			{
				prompt: 'Compute ' + a + ' * ' + b + '. Answer in binary.',
				check: (ans) => norm(ans) === product,
			},
			{
				prompt: 'Type this string backwards:\n' + blob,
				// Case matters here; only trim/space-normalise.
				check: (ans) => String(ans).trim() === reversed,
			},
			{
				get prompt() {
					if (prime == null) prime = nthPrime(n);
					return 'What is the ' + ordinal(n) + ' prime number?';
				},
				check: (ans) => {
					if (prime == null) prime = nthPrime(n);
					return norm(ans) === String(prime);
				},
			},
			{
				prompt: 'In JavaScript, what does [] + {} evaluate to?',
				check: (ans) => norm(ans) === '[object object]',
			},
			{
				prompt: 'Name this color:',
				swatch: hex,
				// CSS color names have no spaces; accept "Antique White" etc. by
				// stripping all whitespace from the answer before comparing.
				check: (ans) => colorNames.includes(norm(ans).replace(/\s+/g, '')),
			},
			{
				// Any first attempt is "wrong"; the retry is accepted.
				prompt: 'Write a regular expression that matches a valid email address.',
				attempts: 0,
				passNote: 'Nobody can. Passed.',
				failNote: 'Wrong. (Nobody gets this one right the first time.)',
				check(ans) {
					this.attempts++;
					return this.attempts > 1 && String(ans).trim().length > 0;
				},
			},
		];
	}

	// Only commands reachable from the privileged prompt. Each returns text.
	const rootCommands = {
		help: () => 'root commands:\n\n' +
			['ls', 'whoami', 'play', 'reset --hard', 'deploy --friday', 'rm -rf bugs', 'exit'].join('\n'),
		ls: () => {
			// Full listing, with the json shown under its real name and linked.
			const tree = buildTree();
			// Swap the redacted placeholder for the real path.
			const assets = tree.assets;
			if (assets) {
				delete assets['***********.json'];
				assets['secret-test.json'] = null;
			}
			printTree(tree);
			return '';
		},
		whoami: () => 'root (verified robot \ud83e\udd16)',
		'rm -rf bugs': () => '0 bugs removed. 3 new bugs created.',
		'deploy --friday': () => { deployFriday(); return ''; },
		// Hard reset: wipe ALL web storage — localStorage (the known-issue log,
		// saved theme, everything) and sessionStorage (per-session egg state:
		// reload counter, moth-seen, incident, …) — then reload so every egg and
		// the dashboard come back to a clean slate. Gated behind a confirmation
		// because it is irreversible.
		'reset --hard': () => {
			print(
				'This wipes ALL saved progress: every resolved issue, your theme,\n' +
				'and all per-session state. Every egg goes back to undiscovered.\n' +
				'This cannot be undone.',
				'term-err'
			);
			pendingConfirm = { prompt: 'reset --hard? type "yes" to confirm >', onYes: hardReset };
			setPrompt(pendingConfirm.prompt);
			return '';
		},
		play: () => startGame(),
		exit: () => { leaveRoot(); return ''; },
	};

	// The actual wipe, run only after the confirmation is accepted.
	function hardReset() {
		print('Hard reset. Clearing storage and reloading…', '');
		try { localStorage.clear(); } catch (e) {}
		try { sessionStorage.clear(); } catch (e) {}
		setTimeout(() => location.reload(), 150);
	}

	// Print the file tree, rendering any present json path as a real link.
	function printTree(tree) {
		print('.', '');
		const text = renderTree(tree, '').replace(/\n$/, '');
		text.split('\n').forEach((row) => {
			const line = document.createElement('div');
			const i = row.indexOf('secret-test.json');
			if (i === -1) {
				line.textContent = row;
			} else {
				line.appendChild(document.createTextNode(row.slice(0, i)));
				const a = document.createElement('a');
				a.href = 'assets/secret-test.json';
				a.target = '_blank';
				a.rel = 'noopener';
				a.textContent = 'secret-test.json';
				line.appendChild(a);
				line.appendChild(document.createTextNode(row.slice(i + 'secret-test.json'.length)));
			}
			out.appendChild(line);
		});
		out.scrollTop = out.scrollHeight;
	}

	// Print a canned deploy log line by line, with a small delay between lines.
	function deployFriday() {
		const lines = [
			'$ deploy --friday',
			'build .............. \u2713',
			'unit tests ......... \u2713',
			'integration tests .. \u2713',
			'bundling ........... \u2713',
			'uploading artifact . \u2713',
			'switching traffic .. \u2713',
			'health check ....... \u2717 500 Internal Server Error',
			'rolling back ....... \u2717 rollback also failed',
			'',
			'Incident opened. Have a nice weekend.',
		];
		let i = 0;
		const tick = () => {
			if (mode !== 'root' || i >= lines.length) return;
			print(lines[i], i >= 7 ? 'term-err' : '');
			i++;
			setTimeout(tick, 220);
		};
		tick();
	}

	// Flaky-test whack-a-mole, ASCII, in the terminal. A row of slots; one shows
	// a failing test. Type its slot number to fix it before it hops. The run is
	// 42 prompts long; the final score reads score/42. "quit" ends it early.
	function startGame() {
		const ROUNDS = 42;
		let score = 0, prompts = 0, active = -1, timer = null, over = false;
		const SLOTS = 5;
		const render = () => {
			const cells = [];
			for (let i = 0; i < SLOTS; i++) cells.push('[' + (i === active ? '\u2717' : ' ') + ']');
			print(cells.join(' ') + '   type 1-' + SLOTS + '   ' + prompts + '/' + ROUNDS +
				'   score ' + score, 'term-dim');
		};
		const hop = () => {
			if (over) return;
			if (prompts >= ROUNDS) { finish('Run complete. Score ' + score + '/' + ROUNDS + '.'); return; }
			prompts++;
			active = randomInt(0, SLOTS - 1);
			render();
			timer = setTimeout(hop, Math.max(600, 1500 - score * 25));
		};
		gameState = {
			guess(raw) {
				if (over) return;
				const n = parseInt(raw, 10);
				if (/^(q|quit|exit|stop)$/i.test(raw.trim())) { finish('Stopped. Score ' + score + '/' + ROUNDS + '.'); return; }
				if (isNaN(n) || n < 1 || n > SLOTS) { print('Pick a slot 1-' + SLOTS + ' (or "quit").', 'term-err'); return; }
				if (n - 1 === active) {
					score++;
					clearTimeout(timer);
					print('Fixed \u2713', 'term-cmd');
					hop();
				} else {
					print('Missed. It flaked away.', 'term-err');
				}
			},
		};
		function finish(msg) {
			over = true;
			clearTimeout(timer);
			gameState = null;
			print(msg, '');
			setPrompt('root@site:~#');
		}
		setPrompt('whack >');
		print('Flaky test whack-a-mole. Fix the failing slot (\u2717) by typing its number.\n' +
			ROUNDS + ' prompts in a run \u2014 final score reads x/' + ROUNDS + '. Type "quit" to stop.', 'term-dim');
		hop();
		return '';
	}
	let gameState = null;

	// Change the prompt label beside the input (e.g. ">", "captcha 1/6 >").
	function setPrompt(text) {
		if (!term) return;
		const label = term.querySelector('.term-line label');
		if (label) label.textContent = text;
	}

	// Enter the verification gate: build a fresh challenge and ask the first one.
	function startGate() {
		gate = { step: 0, items: buildChallenge() };
		mode = 'gate';
		print('Access requires verification. Prove you are a robot.', '');
		askGate();
	}

	function askGate() {
		const item = gate.items[gate.step];
		setPrompt('captcha ' + (gate.step + 1) + '/' + gate.items.length + ' >');
		print(item.prompt, '');
		if (item.swatch) {
			// Render a real color chip followed by its hex value.
			const line = document.createElement('div');
			const chip = document.createElement('span');
			chip.style.cssText = 'display:inline-block;width:3.5em;height:1.1em;vertical-align:middle;' +
				'border:1px solid #555;border-radius:3px;background:' + item.swatch + ';margin-right:0.5em;';
			line.appendChild(chip);
			line.appendChild(document.createTextNode(item.swatch));
			out.appendChild(line);
			out.scrollTop = out.scrollHeight;
		}
	}

	// Handle one line while in the gate. Returns nothing; prints its own output.
	function handleGate(raw) {
		const q = raw.trim();
		if (/^(skip|give up|giveup|abort|exit|quit|q)$/i.test(q)) { abortGate(); return; }
		const item = gate.items[gate.step];
		if (item.check(raw)) {
			print(item.passNote || 'Confirmed.', 'term-cmd');
			gate.step++;
			if (gate.step >= gate.items.length) { enterRoot(); return; }
			askGate();
		} else {
			print(item.failNote || 'Suspiciously human.', 'term-err');
			askGate();
		}
	}

	function abortGate() {
		mode = 'normal';
		gate = null;
		setPrompt('>');
		print('Human detected. Incident reported to nobody.', 'term-dim');
	}

	function enterRoot() {
		mode = 'root';
		gate = null;
		lastPass = Date.now();
		setPrompt('root@site:~#');
		if (site.report) site.report('i24');
		print('Verified. Welcome, fellow machine.\nType "help" for commands.', 'term-cmd');
	}

	// Drop privileges back to the normal terminal (like exiting su). Clears the
	// cached pass so the next attempt runs the full challenge again.
	function leaveRoot() {
		mode = 'normal';
		gameState = null;
		lastPass = 0;
		setPrompt('>');
		print('logout', 'term-dim');
	}

	// Called by sudo in the normal terminal. A recent successful pass this page
	// view skips straight back in, mimicking sudo's credential cache.
	function requestRoot() {
		if (lastPass && Date.now() - lastPass < SESSION_CACHE_MS) {
			enterRoot();
			return '';
		}
		startGate();
		return '';
	}

	const commands = {
		help: () => 'Available commands:\n\n' +
			['about', 'ls', 'jump', 'coffee', 'sudo', 'rm -rf /', 'konami', '42', 'clear', 'exit'].join('\n'),
		ls: () => '.\n' + renderTree(buildTree(), '').replace(/\n$/, ''),
		about: () => 'Stanislav Maryenko\nSoftware Developer in Test and Data Quality Analyst.\nBreaks things professionally, so you don\'t have to.',
		coffee: () => 'ERROR: Coffee machine not connected.',
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

	// On-call toggle: pin the effective clock to the small-hours window, or
	// release it back to the real clock. Replies stay terse. Not advertised in
	// help/ls; the override lives only in memory for this page view.
	function oncall(arg) {
		if (!site.setClock) return '';
		const q = (arg || '').trim().toLowerCase();
		if (/^(off|reset|stop|real)$/.test(q)) return site.setClock(null);
		const d = new Date();
		d.setHours(3, 0, 0, 0);
		return site.setClock(d);
	}

	// Commands that take the rest of the line as an argument.
	const argCommands = { jump, oncall };

	function run(raw) {
		if (!out) return; // terminal never opened (e.g. no <dialog> support)
		// Echo the input under whatever prompt is currently showing.
		const label = term && term.querySelector('.term-line label');
		print((label ? label.textContent : '>') + ' ' + raw, 'term-cmd');

		// A pending yes/no confirmation (e.g. before a hard reset) grabs the next
		// line: only an explicit "yes"/"y" proceeds, anything else cancels.
		if (pendingConfirm) {
			const action = pendingConfirm;
			pendingConfirm = null;
			setPrompt('root@site:~#');
			if (/^y(es)?$/i.test(raw.trim())) action.onYes();
			else print('Cancelled. Nothing was changed.', 'term-dim');
			return;
		}

		// Mini-game grabs raw input while it runs.
		if (gameState) { gameState.guess(raw); return; }

		// Verification gate: every line is an answer (or skip).
		if (mode === 'gate') { if (raw.trim()) { cmdHistory.push(raw); histPos = cmdHistory.length; } handleGate(raw); return; }

		const cmd = raw.trim().replace(/\s+/g, ' ');
		if (!cmd) return;
		cmdHistory.push(cmd);
		histPos = cmdHistory.length;

		// Privileged prompt: only root commands are available here.
		if (mode === 'root') {
			const fn = rootCommands[cmd];
			const result = fn ? fn() : 'command not found: ' + cmd + '\nType "help" for root commands.';
			if (result) print(result, fn ? '' : 'term-err');
			return;
		}

		// First try "verb <args>" commands (e.g. "jump 18 dec").
		const sp = cmd.indexOf(' ');
		const verb = (sp === -1 ? cmd : cmd.slice(0, sp)).toLowerCase();
		if (argCommands[verb]) {
			const result = argCommands[verb](sp === -1 ? '' : cmd.slice(sp + 1));
			if (result) print(result, '');
			return;
		}

		// "sudo" (with or without args) opens the verification gate.
		if (/^sudo\b/.test(cmd)) { requestRoot(); return; }

		const fn = commands[cmd];
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
			// Closing drops any privileged/gate state and the credential cache.
			mode = 'normal';
			gate = null;
			gameState = null;
			pendingConfirm = null;
			lastPass = 0;
			setPrompt('>');
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
		if (site.report) site.report('i1');
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
