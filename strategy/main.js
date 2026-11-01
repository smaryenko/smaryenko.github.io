(function () {
  "use strict";

  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var progressBar = document.getElementById("progressBar");
  var dotsNav = document.getElementById("dots");
  var backToTop = document.getElementById("backToTop");
  var miniDots = Array.prototype.slice.call(
    document.querySelectorAll("#miniDots .mini-dot")
  );

  /* ---------- shared helpers for the auto-advancing pick games ----------
     A shuffle-bag deck: deal through every item once in random order, never
     repeating the same item twice in a row (including across a reshuffle),
     then refill with all items and continue. */
  function makeDeck(items) {
    var pool = items.slice();
    var last = null;
    function draw() {
      if (!pool.length) pool = items.slice(); // exhausted: refill
      var i = Math.floor(Math.random() * pool.length);
      // avoid repeating the previous item (matters at a reshuffle seam)
      if (pool[i] === last && pool.length > 1) {
        i = (i + 1) % pool.length;
      }
      last = pool[i];
      pool.splice(i, 1);
      return last;
    }
    return { draw: draw };
  }

  // how long the resolved answer stays up before the next question auto-deals
  // — long enough to read the feedback (what was wrong, and why)
  // (read lazily: reduceMotion is defined further down)
  function autoAdvanceMs() {
    return reduceMotion ? 5200 : 3800;
  }

  // run `fn` once the element first scrolls into view (for the opening deal)
  function onFirstInView(el, fn) {
    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            obs.disconnect();
            fn();
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
  }

  /* ---------- build dot navigation ---------- */
  var dotButtons = slides.map(function (slide, i) {
    var btn = document.createElement("button");
    btn.type = "button";
    var label = slide.getAttribute("data-label") || "Section " + (i + 1);
    btn.setAttribute("aria-label", label);
    var tip = document.createElement("span");
    tip.textContent = label;
    btn.appendChild(tip);
    btn.addEventListener("click", function () {
      slide.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    dotsNav.appendChild(btn);
    return btn;
  });

  /* ---------- slide-level reveal (headings / blocks) ---------- */
  var revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
        }
      });
    },
    { threshold: 0.2 }
  );
  slides.forEach(function (s) {
    revealObserver.observe(s);
  });

  /* ---------- staggered groups: children appear one by one ---------- */
  var STEP = 140; // ms between each item
  var staggerObserver = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var container = entry.target;
        obs.unobserve(container); // run once
        var kids = Array.prototype.slice.call(container.children);
        var step = Number(container.getAttribute("data-stagger-step")) || STEP;
        kids.forEach(function (child, i) {
          window.setTimeout(function () {
            child.classList.add("shown");
          }, i * step);
        });
      });
    },
    { threshold: 0.25 }
  );
  Array.prototype.slice
    .call(document.querySelectorAll(".stagger"))
    .forEach(function (g) {
      staggerObserver.observe(g);
    });

  var activeObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var idx = slides.indexOf(entry.target);
          dotButtons.forEach(function (b, i) {
            b.classList.toggle("active", i === idx);
          });
        }
      });
    },
    { threshold: 0.55 }
  );
  slides.forEach(function (s) {
    activeObserver.observe(s);
  });

  /* ---------- scroll progress bar ---------- */
  function updateProgress() {
    var h = document.documentElement;
    var scrolled = h.scrollTop || document.body.scrollTop;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (scrolled / max) * 100 : 0;
    progressBar.style.width = pct + "%";
    var showBackToTop = slides[2] && scrolled >= slides[2].offsetTop;
    backToTop.classList.toggle("is-visible", Boolean(showBackToTop));
    backToTop.setAttribute("aria-hidden", showBackToTop ? "false" : "true");
    backToTop.tabIndex = showBackToTop ? 0 : -1;
    // mobile position hint: light the dot for the current third of the page
    if (miniDots.length) {
      var third = pct >= 66.6 ? 2 : pct >= 33.3 ? 1 : 0;
      miniDots.forEach(function (d, i) {
        d.classList.toggle("active", i === third);
      });
    }
  }
  var ticking = false;
  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          updateProgress();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true }
  );
  updateProgress();

  /* first slide visible immediately */
  if (slides[0]) slides[0].classList.add("in-view");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- back to top ---------- */
  backToTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  /* =========================================================
     1. COST GAME — a bug falls through the stages and gets
        pricier at each one. Catch it as early as you can.
     ========================================================= */
  (function () {
    var chart = document.querySelector("[data-cost]");
    if (!chart) return;
    var rows = Array.prototype.slice.call(chart.querySelectorAll(".cost-row"));
    var note = chart.querySelector("[data-read-note]");
    var costEl = chart.querySelector("[data-cost-cost]");
    var bestEl = chart.querySelector("[data-cost-best]");
    var dropBtn = chart.querySelector("[data-cost-drop]");
    var catchBtn = chart.querySelector("[data-cost-catch]");

    // cost of catching the bug at each stage (coffee break → war room)
    var COSTS = [1, 3, 8, 20, 50];
    var LABEL = ["Unit", "Component", "Integration", "System", "Production"];
    var timer = null,
      pos = 0,
      live = false,
      best = Infinity;

    function clearState() {
      rows.forEach(function (r) {
        r.classList.remove("hot", "active", "caught", "missed");
      });
    }
    function setNote(t) {
      if (note) note.textContent = t;
    }
    function setCost(t, cls) {
      if (!costEl) return;
      costEl.textContent = t;
      costEl.className = "cost-cost" + (cls ? " " + cls : "");
    }
    function light(i) {
      rows.forEach(function (r, k) {
        r.classList.toggle("hot", k === i);
      });
      setCost("cost: " + COSTS[i] + "×");
    }
    function stop() {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    }
    // Time the bug spends on each stage before falling to the next. Short at
    // Unit (react fast!), longer toward Production — it slows as it descends.
    var DWELL = reduceMotion
      ? [1200, 1200, 1200, 1200]
      : [380, 620, 900, 1200];
    function schedule() {
      if (pos >= rows.length - 1) {
        // reached Production: a short grace, then it escapes
        timer = window.setTimeout(function () {
          if (live) end(rows.length - 1, true);
        }, reduceMotion ? 1200 : 900);
        return;
      }
      timer = window.setTimeout(function () {
        pos++;
        light(pos);
        schedule();
      }, DWELL[pos]);
    }
    function end(caughtAt, escaped) {
      stop();
      live = false;
      if (catchBtn) catchBtn.disabled = true;
      if (dropBtn) {
        dropBtn.disabled = false;
        dropBtn.textContent = "Drop another";
      }
      var row = rows[caughtAt];
      if (escaped) {
        if (row) row.classList.add("missed");
        setCost("cost: " + COSTS[caughtAt] + "× — war room", "bad");
        setNote("It reached production. Catch it earlier next time.");
      } else {
        if (row) row.classList.add("caught");
        setCost("caught at " + LABEL[caughtAt] + " — " + COSTS[caughtAt] + "×", "good");
        setNote(
          caughtAt === 0
            ? "A coffee break. That's the whole point."
            : "Caught at " + LABEL[caughtAt] + ". Earlier would've been cheaper."
        );
        if (COSTS[caughtAt] < best) {
          best = COSTS[caughtAt];
          if (bestEl) bestEl.textContent = "Best: " + best + "×";
        }
      }
    }
    function drop() {
      stop();
      clearState();
      chart.classList.add("playing");
      pos = 0;
      live = true;
      if (dropBtn) dropBtn.disabled = true;
      if (catchBtn) catchBtn.disabled = false;
      setNote("Bug loose — catch it!");
      light(0);
      schedule();
    }
    function grab() {
      if (!live) return;
      end(pos, false);
    }
    if (dropBtn) dropBtn.addEventListener("click", drop);
    if (catchBtn) catchBtn.addEventListener("click", grab);
    // also allow clicking the hot stage itself to catch it
    rows.forEach(function (row) {
      row.addEventListener("click", function () {
        if (live && row.classList.contains("hot")) grab();
      });
    });
  })();

  /* =========================================================
     2. PYRAMID — click a layer to reveal its detail
     ========================================================= */
  (function () {
    var pyr = document.querySelector("[data-pyramid]");
    if (!pyr) return;
    var detail = document.querySelector("[data-pyramid-detail]");
    var rows = Array.prototype.slice.call(pyr.querySelectorAll(".pyr-row"));
    rows.forEach(function (row) {
      row.addEventListener("click", function () {
        rows.forEach(function (r) {
          r.classList.remove("active");
        });
        row.classList.add("active");
        var key = "data-detail-" + row.getAttribute("data-level");
        var text = pyr.getAttribute(key) || "";
        var name = row.querySelector("span").textContent;
        detail.textContent = name + ": " + text;
      });
    });
  })();

  /* =========================================================
     3. TYPE CHIPS — click to expand the question it asks
     ========================================================= */
  (function () {
    var box = document.querySelector("[data-chips]");
    if (!box) return;
    var detail = document.querySelector("[data-chips-detail]");
    var chips = Array.prototype.slice.call(box.querySelectorAll(".chip"));
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var already = chip.classList.contains("active");
        chips.forEach(function (c) {
          c.classList.remove("active");
        });
        if (already) {
          detail.textContent = "Click a type to see the question it asks.";
          return;
        }
        chip.classList.add("active");
        detail.textContent =
          chip.textContent.trim() + " — " + chip.getAttribute("data-detail");
      });
    });
  })();

  /* =========================================================
     4. CIRCULAR AI LOOP — auto-rotate, hover to pause, click to jump
     ========================================================= */
  (function () {
    var loop = document.querySelector("[data-loop]");
    if (!loop) return;
    var token = loop.querySelector("[data-loop-token]");
    var stepEl = loop.querySelector("[data-loop-step]");
    var textEl = loop.querySelector("[data-loop-text]");
    var nodes = Array.prototype.slice.call(loop.querySelectorAll(".loop-node"));
    var steps = [
      {
        name: "Understand",
        text: "Reads the existing codebase and maps how it behaves today, before a single line changes.",
      },
      {
        name: "Shape",
        text: "Turns a raw requirement into a clear, testable, AI-ready spec and checks how it fits the current state.",
      },
      {
        name: "Generate",
        text: "Derives positive, negative and boundary cases, then writes the test code to match in the repo's own style.",
      },
      {
        name: "Fix",
        text: "Runs the suite, reads the failures, repairs flaky or broken tests, and loops back until it's green.",
      },
    ];
    // angles for each node, starting at top (−90deg), clockwise
    var angles = [-90, 0, 90, 180];
    var r = 128,
      cx = 160,
      cy = 160;
    var current = 0;
    var paused = false;
    var timer = null;

    function placeToken(i) {
      var a = (angles[i] * Math.PI) / 180;
      token.setAttribute("cx", cx + r * Math.cos(a));
      token.setAttribute("cy", cy + r * Math.sin(a));
    }
    function show(i) {
      current = i;
      placeToken(i);
      nodes.forEach(function (n, k) {
        n.classList.toggle("active", k === i);
      });
      stepEl.textContent = steps[i].name;
      textEl.textContent = steps[i].text;
    }
    function advance() {
      if (paused) return;
      show((current + 1) % steps.length);
    }
    function start() {
      if (reduceMotion || timer) return;
      timer = window.setInterval(advance, 5000);
    }
    nodes.forEach(function (n, i) {
      n.addEventListener("click", function () {
        show(i);
      });
      n.addEventListener("mouseenter", function () {
        paused = true;
        show(i);
      });
      n.addEventListener("mouseleave", function () {
        paused = false;
      });
    });
    show(0);
    // only run the auto-rotation while the loop is on screen
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          start();
        } else if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      });
    }, { threshold: 0.4 });
    io.observe(loop);
  })();

  /* =========================================================
     5. PIPELINE — run a commit through, optionally inject a failure
     ========================================================= */
  (function () {
    var pipe = document.querySelector("[data-pipeline]");
    if (!pipe) return;
    var runBtn = document.querySelector("[data-pipe-run]");
    var failChk = document.querySelector("[data-pipe-fail]");
    var statusEl = document.querySelector("[data-pipe-status]");
    var stages = Array.prototype.slice.call(
      pipe.querySelectorAll(".pipe-stage")
    );
    var links = Array.prototype.slice.call(pipe.querySelectorAll(".pipe-link"));
    var names = ["Commit", "Unit + Component", "Integration", "System", "Release"];
    var running = false;

    function reset() {
      stages.forEach(function (s) {
        s.classList.remove("running", "pass", "fail", "dim");
      });
      links.forEach(function (l) {
        l.classList.remove("flowing");
      });
      statusEl.className = "pipe-status";
      statusEl.textContent = "idle, press run";
    }

    var cur = -1, // index of the stage currently running
      stepTimer = null;
    var LAST = stages.length - 1; // Release — can't be failed by injection

    function failHere(i) {
      stop();
      stages[i].classList.remove("running");
      stages[i].classList.add("fail");
      for (var k = i + 1; k < stages.length; k++) stages[k].classList.add("dim");
      statusEl.className = "pipe-status bad";
      statusEl.textContent = "red at " + names[i] + " — line stopped";
      finish();
    }
    function stop() {
      if (stepTimer) {
        window.clearTimeout(stepTimer);
        stepTimer = null;
      }
    }
    function finish() {
      running = false;
      cur = -1;
      runBtn.disabled = false;
    }

    var plannedFail = -1; // stage the injected failure will trip

    function run() {
      if (running) return;
      running = true;
      runBtn.disabled = true;
      reset();
      // Checked before the run? Pick a random mid stage to fail at
      // (Unit+Component, Integration or System) — same as the original.
      plannedFail =
        failChk && failChk.checked ? 1 + Math.floor(Math.random() * 3) : -1;
      var i = 0;
      function step() {
        if (i > 0) {
          stages[i - 1].classList.remove("running");
          stages[i - 1].classList.add("pass");
          if (links[i - 1]) links[i - 1].classList.add("flowing");
        }
        if (i >= stages.length) {
          statusEl.className = "pipe-status ok";
          statusEl.textContent = "all green — promoted to release";
          finish();
          return;
        }
        cur = i;
        stages[i].classList.add("running");
        statusEl.className = "pipe-status";
        statusEl.textContent = "running " + names[i] + "…";
        // Fail when we reach the planned stage (before Release).
        if (plannedFail === i && i < LAST) {
          failHere(i);
          return;
        }
        i++;
        stepTimer = window.setTimeout(step, reduceMotion ? 160 : 760);
      }
      step();
    }

    runBtn.addEventListener("click", run);
    // Toggle the checkbox mid-run: check it → fail the stage running right now
    // (if it's before Release); uncheck it → clear the planned failure so the
    // run carries on to the end.
    if (failChk)
      failChk.addEventListener("change", function () {
        if (running) {
          if (failChk.checked && cur >= 0 && cur < LAST) failHere(cur);
          else if (!failChk.checked) plannedFail = -1;
        } else {
          reset();
        }
      });
  })();

  /* =========================================================
     6. TEST-DATA DEMO — shared counter, strict vs delta assertion
     ========================================================= */
  (function () {
    var demo = document.querySelector("[data-delta]");
    if (!demo) return;
    var startEl = demo.querySelector("[data-delta-start]");
    var strictLine = demo.querySelector("[data-delta-strict]");
    var deltaLine = demo.querySelector("[data-delta-delta]");
    var strictRes = demo.querySelector("[data-delta-strict-res]");
    var deltaRes = demo.querySelector("[data-delta-delta-res]");
    var runBtn = demo.querySelector("[data-delta-run]");
    var resetBtn = demo.querySelector("[data-delta-reset]");
    var start = 7;

    function randStart() {
      start = Math.floor(Math.random() * 9) + 3; // 3..11, rarely 0
      startEl.textContent = start;
    }
    function clearRes() {
      strictRes.textContent = "";
      deltaRes.textContent = "";
      strictRes.className = "";
      deltaRes.className = "";
    }
    function run() {
      var end = start + 10;
      // strict: expects count == 10, only true if start was 0
      var strictPass = end === 10;
      strictRes.textContent = strictPass
        ? "pass (count is 10)"
        : "fail (count is " + end + ")";
      strictRes.className = strictPass ? "pass" : "fail";
      // delta: always true, we added 10
      deltaRes.textContent = "pass (went " + start + " \u2192 " + end + ")";
      deltaRes.className = "pass";
    }
    if (runBtn) runBtn.addEventListener("click", run);
    if (resetBtn)
      resetBtn.addEventListener("click", function () {
        clearRes();
        randStart();
      });
    randStart();
  })();

  /* =========================================================
     7. ASSURANCE SLIDER — locked to "QA-assured"
     ========================================================= */
  (function () {
    var decide = document.querySelector("[data-decide]");
    if (!decide) return;
    var track = decide.querySelector("[data-decide-track]");
    var fill = decide.querySelector("[data-decide-fill]");
    var knob = decide.querySelector("[data-decide-knob]");
    var msg = decide.querySelector("[data-decide-msg]");
    var dragging = false;

    function setVisual(pct) {
      fill.style.width = pct + "%";
      knob.style.left = pct + "%";
    }
    function fromEvent(clientX) {
      var rect = track.getBoundingClientRect();
      var pct = ((clientX - rect.left) / rect.width) * 100;
      return Math.max(0, Math.min(100, pct));
    }
    function snapBack(pct) {
      // follow the drag, then always snap back to 100 (human)
      setVisual(pct);
      if (pct < 70) {
        msg.textContent = "No — AI-only evidence is not enough. The control snaps back.";
        msg.classList.add("snap");
      } else {
        msg.textContent = "Try moving the control toward \u201CAI-only\u201D.";
        msg.classList.remove("snap");
      }
    }
    function release() {
      if (!dragging) return;
      dragging = false;
      setVisual(100);
      knob.style.background = "var(--lime)";
      window.setTimeout(function () {
        msg.textContent = "AI produces at scale. QA owns independent assurance.";
        msg.classList.add("snap");
      }, 380);
    }
    function pointerDown(e) {
      dragging = true;
      var x = e.touches ? e.touches[0].clientX : e.clientX;
      snapBack(fromEvent(x));
    }
    function pointerMove(e) {
      if (!dragging) return;
      var x = e.touches ? e.touches[0].clientX : e.clientX;
      snapBack(fromEvent(x));
    }
    knob.addEventListener("mousedown", pointerDown);
    track.addEventListener("mousedown", pointerDown);
    knob.addEventListener("touchstart", pointerDown, { passive: true });
    window.addEventListener("mousemove", pointerMove);
    window.addEventListener("touchmove", pointerMove, { passive: true });
    window.addEventListener("mouseup", release);
    window.addEventListener("touchend", release);
    setVisual(100);
  })();

  /* =========================================================
     8. GATES — toggle each principle on; the merge unblocks
        only once all four gates are enforced
     ========================================================= */
  (function () {
    var wrap = document.querySelector("[data-gates]");
    if (!wrap) return;
    var cards = Array.prototype.slice.call(wrap.querySelectorAll("[data-gate]"));
    var meter = document.querySelector("[data-gate-meter]");
    var countEl = meter && meter.querySelector("[data-gate-count]");
    var verdictEl = meter && meter.querySelector("[data-gate-verdict]");

    function sync() {
      var on = cards.filter(function (c) {
        return c.getAttribute("aria-pressed") === "true";
      }).length;
      if (countEl) countEl.textContent = on;
      var ready = on === cards.length;
      if (verdictEl)
        verdictEl.textContent = ready ? "merge green." : "merge blocked.";
      if (meter) meter.setAttribute("data-state", ready ? "ready" : "blocked");
    }
    cards.forEach(function (card) {
      card.addEventListener("click", function () {
        var on = card.getAttribute("aria-pressed") === "true";
        card.setAttribute("aria-pressed", on ? "false" : "true");
        sync();
      });
    });
    sync();
  })();

  /* =========================================================
     9. OBSERVABILITY — light up each signal; the dark box
        becomes testable as the gauge fills
     ========================================================= */
  (function () {
    var box = document.querySelector("[data-observe]");
    if (!box) return;
    var cards = Array.prototype.slice.call(box.querySelectorAll("[data-obs]"));
    var fill = document.querySelector("[data-obs-fill]");
    var read = document.querySelector("[data-obs-read]");
    var reads = [
      "Dark box — light up each signal to make it testable.",
      "A little visible. A test can barely tell what happened.",
      "Getting there — failures start to be traceable.",
      "Almost. One more signal and the change proves itself.",
      "Fully observable — the feature can prove it worked, in test and in prod.",
    ];
    function sync() {
      var on = cards.filter(function (c) {
        return c.getAttribute("aria-pressed") === "true";
      }).length;
      var pct = (on / cards.length) * 100;
      if (fill) fill.style.width = pct + "%";
      if (read) {
        read.textContent = reads[on];
        read.classList.toggle("full", on === cards.length);
      }
      box.classList.toggle("all-lit", on === cards.length);
    }
    cards.forEach(function (card) {
      card.addEventListener("click", function () {
        var on = card.getAttribute("aria-pressed") === "true";
        card.setAttribute("aria-pressed", on ? "false" : "true");
        sync();
      });
    });
    sync();
  })();

  /* =========================================================
     10. RISK TILES — pick a tier to see a concrete change
         and how much evidence it earns
     ========================================================= */
  (function () {
    var wrap = document.querySelector("[data-risk]");
    if (!wrap) return;
    var cards = Array.prototype.slice.call(
      wrap.querySelectorAll("[data-risk-card]")
    );
    var readout = document.querySelector("[data-risk-readout]");
    var cls = ["rr-low", "rr-med", "rr-high"];
    var names = ["Low", "Medium", "High"];
    var tierIndex = { low: 0, med: 1, high: 2 };

    // triage game state
    var game = document.querySelector("[data-rgame]");
    var askEl = game && game.querySelector("[data-rt-ask]");
    var badgeEl = game && game.querySelector("[data-rt-badge]");
    var scoreEl = game && game.querySelector("[data-rt-score]");
    var changes = [
      { tier: "low", text: "“Rename the ‘Save’ button.”" },
      { tier: "low", text: "“Flip a flag on an internal dashboard.”" },
      { tier: "med", text: "“Add a loyalty step across two services.”" },
      { tier: "med", text: "“Change an API response a partner reads.”" },
      { tier: "high", text: "“Let users delete their account for good.”" },
      { tier: "high", text: "“Rework how card payments are authorised.”" },
      { tier: "high", text: "“Change who can approve a withdrawal.”" },
      { tier: "med", text: "“Add a nightly summary-email job.”" },
    ];
    var deck = makeDeck(changes);
    var pending = null,
      answered = false,
      right = 0,
      total = 0,
      advanceTimer = null;

    function explore(card, i) {
      var already = card.getAttribute("aria-pressed") === "true";
      cards.forEach(function (c) {
        c.setAttribute("aria-pressed", "false");
        c.classList.remove("correct", "wrong");
      });
      if (already) {
        if (readout)
          readout.innerHTML =
            "Tap a tier to see a change that fits it — and the evidence it earns.";
        return;
      }
      card.setAttribute("aria-pressed", "true");
      if (readout)
        readout.innerHTML =
          '<b class="' + cls[i] + '">' + names[i] + "</b>, like " +
          card.getAttribute("data-risk-example") +
          ' — <span style="color:var(--ink)">' +
          card.getAttribute("data-risk-evidence") + "</span>";
    }

    function grade(card, i) {
      answered = true;
      total++;
      var ok = card.getAttribute("data-rtier") === pending.tier;
      if (ok) right++;
      cards.forEach(function (c) {
        c.classList.remove("correct", "wrong");
        c.setAttribute("aria-pressed", "false");
      });
      card.classList.add(ok ? "correct" : "wrong");
      if (!ok) {
        cards.forEach(function (c) {
          if (c.getAttribute("data-rtier") === pending.tier)
            c.classList.add("correct");
        });
      }
      var ti = tierIndex[pending.tier];
      var right2 = cards[ti];
      if (readout)
        readout.innerHTML =
          (ok ? "Right — " : "It's ") +
          '<b class="' + cls[ti] + '">' + names[ti] + "</b>. " +
          '<span style="color:var(--ink)">Evidence: ' +
          right2.getAttribute("data-risk-evidence") + "</span>";
      if (badgeEl) badgeEl.textContent = ok ? "Triaged ✓" : "Re-triage";
      if (scoreEl) scoreEl.textContent = "Triaged: " + right + " / " + total;
      pending = null;
      advanceTimer = window.setTimeout(deal, autoAdvanceMs());
    }

    cards.forEach(function (card, i) {
      card.addEventListener("click", function () {
        if (pending && !answered) {
          grade(card, i);
          return;
        }
        explore(card, i);
      });
    });

    function deal() {
      if (advanceTimer) {
        window.clearTimeout(advanceTimer);
        advanceTimer = null;
      }
      cards.forEach(function (c) {
        c.classList.remove("correct", "wrong");
        c.setAttribute("aria-pressed", "false");
      });
      pending = deck.draw();
      answered = false;
      if (badgeEl) badgeEl.textContent = "Change";
      if (askEl) askEl.textContent = pending.text + "  → which tier?";
      if (readout) readout.innerHTML = "Click the tier this change belongs in.";
    }
    if (game) onFirstInView(game, deal); // first change deals itself
  })();

  /* =========================================================
     11. GATES MERGE — the merge button is locked and shakes
         until all four gates are enforced, then it ships
     ========================================================= */
  (function () {
    var btn = document.querySelector("[data-gate-btn]");
    var label = document.querySelector("[data-gate-btn-label]");
    var meter = document.querySelector("[data-gate-merge] [data-gate-count]");
    var cards = Array.prototype.slice.call(
      document.querySelectorAll("[data-gate]")
    );
    if (!btn || !cards.length) return;
    var merged = false;

    function enforcedCount() {
      return cards.filter(function (c) {
        return c.getAttribute("aria-pressed") === "true";
      }).length;
    }
    function refresh() {
      if (merged) return;
      var on = enforcedCount();
      if (meter) meter.textContent = on;
      var ready = on === cards.length;
      btn.classList.toggle("ready", ready);
      var lock = btn.querySelector(".gate-btn-lock");
      if (lock) lock.textContent = ready ? "\uD83D\uDD13" : "\uD83D\uDD12";
      if (label) label.textContent = ready ? "Merge" : "Merge blocked";
    }
    cards.forEach(function (c) {
      c.addEventListener("click", refresh);
    });
    btn.addEventListener("click", function () {
      if (merged) return;
      if (enforcedCount() !== cards.length) {
        // not ready: refuse and shake
        btn.classList.remove("shake");
        void btn.offsetWidth; // restart animation
        btn.classList.add("shake");
        return;
      }
      merged = true;
      btn.classList.remove("ready");
      btn.classList.add("merged");
      var lock = btn.querySelector(".gate-btn-lock");
      if (lock) lock.textContent = "\u2713";
      if (label) label.textContent = "Merged — evidence trusted";
    });
    btn.addEventListener("animationend", function () {
      btn.classList.remove("shake");
    });
    refresh();
  })();

  /* =========================================================
     12. CANARY — you're on call. Expose to 5%, watch the
         live signals, then promote or roll back. A breach
         means you should roll back; healthy means promote.
     ========================================================= */
  (function () {
    var game = document.querySelector("[data-cgame]");
    if (!game) return;
    var errEl = game.querySelector("[data-cg-err]");
    var latEl = game.querySelector("[data-cg-lat]");
    var outEl = game.querySelector("[data-cg-out]");
    var spark = game.querySelector("[data-cg-spark]");
    var status = game.querySelector("[data-cg-status]");
    var scoreEl = game.querySelector("[data-cg-score]");
    var startBtn = game.querySelector("[data-cg-start]");
    var promoteBtn = game.querySelector("[data-cg-promote]");
    var rollbackBtn = game.querySelector("[data-cg-rollback]");
    var dials = Array.prototype.slice.call(game.querySelectorAll(".cg-dial"));

    var right = 0,
      wrong = 0,
      timer = null,
      step = 0,
      healthy = true,
      live = false;

    function setStatus(text, cls) {
      status.textContent = text;
      status.className = "cg-status" + (cls ? " " + cls : "");
    }
    function setScore() {
      scoreEl.textContent =
        "Calls: " + right + " right · " + wrong + " wrong";
    }
    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }
    function tick() {
      step++;
      // base healthy numbers with a little noise
      var err, lat;
      var breaching = !healthy && step >= 4; // breach reveals after a few ticks
      if (breaching) {
        err = (1.4 + Math.random() * 2.5).toFixed(2);
        lat = Math.round(340 + Math.random() * 260);
        outEl.textContent = "dropping";
        dials[2].classList.add("breach");
      } else {
        err = (0.1 + Math.random() * 0.6).toFixed(2);
        lat = Math.round(150 + Math.random() * 110);
        outEl.textContent = "steady";
      }
      errEl.textContent = err + "%";
      latEl.textContent = lat + "ms";
      var errBad = parseFloat(err) >= 1.0;
      var latBad = lat >= 300;
      dials[0].classList.toggle("breach", errBad);
      dials[1].classList.toggle("breach", latBad);
      var bad = errBad || latBad || breaching;
      spark.style.width = Math.min(100, step * 12) + "%";
      spark.classList.toggle("breach", bad);
      if (breaching) {
        setStatus("Signals are breaching the SLO. Make the call.", "warn");
      } else {
        setStatus("Canary live at 5%. Watch a few ticks, then decide.", "");
      }
      if (step >= 8) stop(); // enough signal to decide
    }
    function start() {
      stop();
      live = true;
      step = 0;
      healthy = Math.random() < 0.5;
      dials.forEach(function (d) {
        d.classList.remove("breach");
      });
      spark.classList.remove("breach");
      spark.style.width = "0%";
      startBtn.disabled = true;
      promoteBtn.disabled = false;
      rollbackBtn.disabled = false;
      setStatus("Exposing to 5%…", "");
      tick();
      if (!reduceMotion) timer = window.setInterval(tick, 700);
      else {
        // reduced motion: jump to the settled signal
        step = 5;
        tick();
      }
    }
    function decide(promote) {
      if (!live) return;
      live = false;
      stop();
      promoteBtn.disabled = true;
      rollbackBtn.disabled = true;
      startBtn.disabled = false;
      startBtn.textContent = "Run another";
      var correct = promote === healthy;
      if (correct) {
        right++;
        setStatus(
          promote
            ? "Healthy — promoted to 100%. Good call. ✓"
            : "Breach caught — rolled back before users noticed. ✓",
          "good"
        );
      } else {
        wrong++;
        setStatus(
          promote
            ? "You promoted a breaching canary — that's an incident. ✗"
            : "Rolled back a healthy release — safe, but you shipped nothing. ✗",
          "bad"
        );
      }
      setScore();
    }
    startBtn.addEventListener("click", start);
    promoteBtn.addEventListener("click", function () {
      decide(true);
    });
    rollbackBtn.addEventListener("click", function () {
      decide(false);
    });
  })();

  /* =========================================================
     13. ASSURANCE — an AI request arrives; place it on the
         rung whose safeguards actually bound that action
     ========================================================= */
  (function () {
    var game = document.querySelector("[data-lgame]");
    var ladder = document.querySelector("[data-ladder]");
    if (!game || !ladder) return;
    var askEl = game.querySelector("[data-lg-ask]");
    var badgeEl = game.querySelector("[data-lg-badge]");
    var fbEl = game.querySelector("[data-lg-feedback]");
    var scoreEl = game.querySelector("[data-lg-score]");
    var rows = Array.prototype.slice.call(ladder.querySelectorAll(".ladder-row"));

    var requests = [
      { rung: "assist", text: "“Explain how this payment service can fail.”", why: "Read-only analysis — Assist." },
      { rung: "generate", text: "“Here's the spec — write the tests and code.”", why: "Produces change — Generate." },
      { rung: "repair", text: "“Diagnose this flaky test and propose a fix.”", why: "Diagnose and repair — Repair." },
      { rung: "release", text: "“Recommend whether we promote this release.”", why: "Release support — QA owns the verdict." },
      { rung: "prod", text: "“Delete the stuck records in prod.”", why: "Production action — never autonomous." },
      { rung: "generate", text: "“Turn these tickets into tests and code.”", why: "Produces change — Generate." },
      { rung: "prod", text: "“Roll back the live deploy right now.”", why: "Acts on prod — never autonomous." },
      { rung: "assist", text: "“Draft the acceptance criteria for this feature.”", why: "Drafting, not shipping — Assist." },
    ];
    var deck = makeDeck(requests);
    var current = null,
      answered = false,
      right = 0,
      total = 0,
      advanceTimer = null;

    function clearRows() {
      rows.forEach(function (r) {
        r.classList.remove("correct", "wrong");
      });
    }
    function deal() {
      if (advanceTimer) {
        window.clearTimeout(advanceTimer);
        advanceTimer = null;
      }
      clearRows();
      answered = false;
      current = deck.draw();
      badgeEl.textContent = "Incoming";
      badgeEl.style.color = "";
      askEl.textContent = current.text;
      fbEl.textContent = "Pick the rung that bounds this action.";
      fbEl.className = "lg-feedback";
      ladder.classList.add("armed");
    }
    rows.forEach(function (row) {
      row.addEventListener("click", function () {
        if (!current || answered) return;
        answered = true;
        total++;
        var picked = row.getAttribute("data-rung");
        var ok = picked === current.rung;
        if (ok) right++;
        row.classList.add(ok ? "correct" : "wrong");
        if (!ok) {
          var good = rows.filter(function (r) {
            return r.getAttribute("data-rung") === current.rung;
          })[0];
          if (good) good.classList.add("correct");
        }
        fbEl.textContent = (ok ? "Right. " : "Not quite. ") + current.why;
        fbEl.className = "lg-feedback " + (ok ? "good" : "bad");
        badgeEl.textContent = ok ? "Bounded ✓" : "Review";
        scoreEl.textContent = "Score: " + right + " / " + total;
        ladder.classList.remove("armed");
        advanceTimer = window.setTimeout(deal, autoAdvanceMs());
      });
    });
    onFirstInView(game, deal); // first request deals itself
  })();

  /* =========================================================
     14. T-SHAPED QA — AI greenlights a change; pick the lens
         it looked past that QA's connected view would catch
     ========================================================= */
  (function () {
    var game = document.querySelector("[data-tgame]");
    if (!game) return;
    var scenarioEl = game.querySelector("[data-tg-scenario]");
    var fbEl = game.querySelector("[data-tg-feedback]");
    var scoreEl = game.querySelector("[data-tg-score]");
    var lenses = Array.prototype.slice.call(game.querySelectorAll(".tg-lens"));

    var changes = [
      { text: "“Tests pass — the ‘export my data’ button ships.”", lens: "Security", why: "It exports personal data — who's allowed?" },
      { text: "“Latency's fine locally — recommendations ship.”", lens: "Operations", why: "How does it behave under real load?" },
      { text: "“Unit tests green on the new one-click checkout.”", lens: "Customer", why: "Can a real person complete it?" },
      { text: "“The refactor compiles and the suite is green.”", lens: "Business", why: "Does it still serve the outcome?" },
      { text: "“The API change works; mobile wasn't in scope.”", lens: "Product", why: "How does it land across the product?" },
      { text: "“Feature added; old integration tests still pass.”", lens: "Development", why: "What else depends on this code path?" },
    ];
    var deck = makeDeck(changes);
    var current = null,
      answered = false,
      caught = 0,
      total = 0,
      advanceTimer = null;

    function reset() {
      lenses.forEach(function (l) {
        l.classList.remove("correct", "wrong");
        l.disabled = false;
      });
    }
    function next() {
      if (advanceTimer) {
        window.clearTimeout(advanceTimer);
        advanceTimer = null;
      }
      reset();
      answered = false;
      current = deck.draw();
      scenarioEl.textContent = current.text;
      fbEl.textContent = "Which lens did AI look past?";
      fbEl.className = "tg-feedback";
    }
    lenses.forEach(function (lens) {
      lens.addEventListener("click", function () {
        if (!current || answered) return;
        answered = true;
        total++;
        var ok = lens.getAttribute("data-lens") === current.lens;
        if (ok) caught++;
        lens.classList.add(ok ? "correct" : "wrong");
        if (!ok) {
          lenses.forEach(function (l) {
            if (l.getAttribute("data-lens") === current.lens)
              l.classList.add("correct");
          });
        }
        lenses.forEach(function (l) {
          l.disabled = true;
        });
        fbEl.textContent = (ok ? "Yes. " : "The missed lens was " + current.lens + ". ") + current.why;
        fbEl.className = "tg-feedback " + (ok ? "good" : "bad");
        scoreEl.textContent = "Caught: " + caught + " / " + total;
        advanceTimer = window.setTimeout(next, autoAdvanceMs());
      });
    });
    onFirstInView(game, next); // first scenario deals itself
  })();

  /* =========================================================
     15. METRICS — real signal or vanity? Does it change a
         decision, or just look good on a dashboard?
     ========================================================= */
  (function () {
    var game = document.querySelector("[data-mgame]");
    if (!game) return;
    var claimEl = game.querySelector("[data-mg-claim]");
    var fbEl = game.querySelector("[data-mg-feedback]");
    var scoreEl = game.querySelector("[data-mg-score]");
    var realBtn = game.querySelector("[data-mg-real]");
    var vanityBtn = game.querySelector("[data-mg-vanity]");
    var card = game.querySelector("[data-mg-card]");
    var bins = Array.prototype.slice.call(game.querySelectorAll("[data-mg-bin]"));

    var metrics = [
      { real: true, text: "“Flaky rate crossed 2% — pause and stabilise.”", why: "Triggers an action and an owner." },
      { real: false, text: "“We wrote 1,200 new tests this quarter.”", why: "Test count alone changes nothing." },
      { real: true, text: "“Escaped defects in checkout rose — add a gate.”", why: "Names a risk and a response." },
      { real: false, text: "“Overall code coverage is 87%.”", why: "No threshold, no action — vanity." },
      { real: true, text: "“Canary breached its SLO, so it rolled back.”", why: "Threshold → automatic action." },
      { real: false, text: "“The dashboard had 4,000 views.”", why: "Views don't change what you ship." },
      { real: true, text: "“Feedback time dropped below 10 min — gate on it.”", why: "Changes what the team gates on." },
      { real: false, text: "“We ran the full suite 300 times.”", why: "Activity, not outcome." },
    ];
    var deck = makeDeck(metrics);
    var current = null,
      answered = false,
      right = 0,
      total = 0,
      advanceTimer = null;

    function binEl(kind) {
      return bins.filter(function (b) {
        return b.getAttribute("data-mg-bin") === kind;
      })[0];
    }
    function clearBins() {
      bins.forEach(function (b) {
        b.classList.remove("over", "hit-correct", "hit-wrong");
      });
    }
    function next() {
      if (advanceTimer) {
        window.clearTimeout(advanceTimer);
        advanceTimer = null;
      }
      answered = false;
      clearBins();
      current = deck.draw();
      card.textContent = current.text;
      card.hidden = false;
      card.disabled = false;
      card.setAttribute("draggable", "true");
      fbEl.textContent = "";
      fbEl.className = "mg-feedback";
      realBtn.disabled = false;
      vanityBtn.disabled = false;
    }
    // kind: "real" -> "Changes a decision"; "vanity" -> "Vanity"
    function resolve(kind) {
      if (!current || answered) return;
      answered = true;
      total++;
      var saysReal = kind === "real";
      var ok = saysReal === current.real;
      if (ok) right++;
      card.disabled = true;
      card.setAttribute("draggable", "false");
      card.classList.remove("dragging");
      realBtn.disabled = true;
      vanityBtn.disabled = true;
      clearBins();
      var dropped = binEl(kind);
      if (dropped) dropped.classList.add(ok ? "hit-correct" : "hit-wrong");
      if (!ok) {
        var correct = binEl(current.real ? "real" : "vanity");
        if (correct) correct.classList.add("hit-correct");
      }
      fbEl.textContent =
        (ok ? "Right. " : "Actually " + (current.real ? "a real signal. " : "vanity. ")) +
        current.why;
      fbEl.className = "mg-feedback " + (ok ? "good" : "bad");
      scoreEl.textContent = "Score: " + right + " / " + total;
      advanceTimer = window.setTimeout(next, autoAdvanceMs());
    }

    /* ---- pointer drag (mouse + touch) ---- */
    var drag = null; // {startX, startY, moved}
    function binUnder(x, y) {
      return bins.filter(function (b) {
        var r = b.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      })[0];
    }
    function pointerDown(e) {
      if (card.disabled || answered) return;
      var t = e.touches ? e.touches[0] : e;
      drag = { x: t.clientX, y: t.clientY, moved: false };
      card.classList.add("dragging");
    }
    function pointerMove(e) {
      if (!drag) return;
      var t = e.touches ? e.touches[0] : e;
      var dx = t.clientX - drag.x,
        dy = t.clientY - drag.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      card.style.transform = "translate(" + dx + "px," + dy + "px)";
      var over = binUnder(t.clientX, t.clientY);
      bins.forEach(function (b) {
        b.classList.toggle("over", b === over);
      });
      if (e.cancelable && drag.moved) e.preventDefault();
    }
    function pointerUp(e) {
      if (!drag) return;
      var t = e.changedTouches ? e.changedTouches[0] : e;
      var over = binUnder(t.clientX, t.clientY);
      card.classList.remove("dragging");
      card.style.transform = "";
      bins.forEach(function (b) {
        b.classList.remove("over");
      });
      var wasDragging = drag.moved;
      drag = null;
      if (over) resolve(over.getAttribute("data-mg-bin"));
      // a tap without movement falls through to the click handler
      else if (wasDragging) {
        /* dropped outside a bin: no-op, card stays for another try */
      }
    }
    card.addEventListener("mousedown", pointerDown);
    card.addEventListener("touchstart", pointerDown, { passive: true });
    window.addEventListener("mousemove", pointerMove);
    window.addEventListener("touchmove", pointerMove, { passive: false });
    window.addEventListener("mouseup", pointerUp);
    window.addEventListener("touchend", pointerUp);

    /* ---- keyboard on the card: ← decision, → vanity ---- */
    card.addEventListener("keydown", function (e) {
      if (card.disabled) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        resolve("real");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        resolve("vanity");
      }
    });

    /* ---- fallback buttons + clicking a bin ---- */
    realBtn.addEventListener("click", function () {
      resolve("real");
    });
    vanityBtn.addEventListener("click", function () {
      resolve("vanity");
    });
    bins.forEach(function (b) {
      b.addEventListener("click", function () {
        resolve(b.getAttribute("data-mg-bin"));
      });
    });
    onFirstInView(game, next); // first metric deals itself
  })();
})();
