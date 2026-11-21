// Increment 2 (animated stock deal) adversarial tests, written by the tester.
// Kept in its own file so adversarial.test.js (increment 1) stays untouched.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Spider = require("./spider-core.js");
const Anim = require("./deal-anim.js");

const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const animSrc = read("deal-anim.js");
const appSrc = read("app.js");
const cssSrc = read("style.css");
const c2 = (suit, rank, faceUp = true) => ({ suit, rank, faceUp });

// ---------- pure plan / guard ----------

test("deal2: plan matches core for all 5 deals in 1, 2 and 4 suit games", () => {
  for (const n of [1, 2, 4]) {
    let g = Spider.newGame(n, 5);
    for (let d = 0; d < 5; d++) {
      const next = Spider.dealRow(g);
      assert.ok(next, `${n} suit deal ${d}`);
      const steps = Anim.dealPlan(g, next);
      assert.equal(steps.length, 10);
      assert.equal(Anim.dealDuration(steps), 840);
      steps.forEach((s, i) => {
        assert.equal(s.col, i);
        assert.equal(s.delay, i * 60);
        assert.equal(s.duration, 300);
        const expected = g.stock[g.stock.length - 1 - i];
        assert.equal(s.card.suit, expected.suit);
        assert.equal(s.card.rank, expected.rank);
        assert.equal(s.card.faceUp, true);
        if (s.landIndex >= 0) {
          assert.equal(s.landIndex, g.columns[i].length);
          assert.deepEqual(next.columns[i][s.landIndex], s.card);
        }
      });
      g = next;
    }
    assert.equal(g.stock.length, 0);
  }
});

test("deal2: plan options, zero values are honoured and reduceMotion truthy gives null", () => {
  const g = Spider.newGame(2, 5);
  const n = Spider.dealRow(g);
  const z = Anim.dealPlan(g, n, { cardMs: 0, staggerMs: 0 });
  assert.equal(z.length, 10);
  z.forEach((s) => { assert.equal(s.delay, 0); assert.equal(s.duration, 0); });
  assert.equal(Anim.dealDuration(z), 0);
  assert.equal(Anim.dealPlan(g, n, { reduceMotion: 1 }), null);
  assert.equal(Anim.dealPlan(g, n, { reduceMotion: false }).length, 10);
  assert.equal(Anim.dealPlan(g, n, {}).length, 10);
  assert.equal(Anim.dealPlan(g, n, undefined).length, 10);
  assert.equal(Anim.dealPlan(g, g), null, "unchanged state is not a deal");
  assert.equal(Anim.dealPlan(n, g), null, "reversed (undo) is not a deal");
});

test("deal2: a completing deal in a column that keeps cards below gives landIndex -1", () => {
  const col0 = [c2("H", 7, false)];
  for (let r = 13; r >= 2; r--) col0.push(c2("S", r, true));
  const columns = [col0];
  for (let i = 1; i < 10; i++) columns.push([c2("S", 5, true), c2("S", 4, true)]);
  const stock = [];
  for (let i = 0; i < 9; i++) stock.push(c2("S", 9, false));
  stock.push(c2("S", 1, false));
  const s = { suitCount: 1, columns, stock, completed: 0 };
  const before = JSON.stringify(s);
  const n = Spider.dealRow(s);
  assert.equal(JSON.stringify(s), before);
  assert.equal(n.completed, 1);
  assert.equal(n.columns[0].length, 1);
  assert.equal(n.columns[0][0].faceUp, true, "newly exposed card flipped");
  const steps = Anim.dealPlan(s, n);
  assert.equal(steps[0].landIndex, -1);
  assert.equal(steps[0].card.rank, 1);
  for (let i = 1; i < 10; i++) assert.equal(steps[i].landIndex, 2);
  assert.equal(Anim.dealDuration(steps), 840);
});

test("deal2: two completing columns in one deal both get landIndex -1", () => {
  const mk = () => {
    const col = [];
    for (let r = 13; r >= 2; r--) col.push(c2("S", r, true));
    return col;
  };
  const columns = [mk(), mk()];
  for (let i = 2; i < 10; i++) columns.push([c2("D", 5, true)]);
  const stock = [];
  for (let i = 0; i < 8; i++) stock.push(c2("D", 9, false));
  stock.push(c2("S", 1, false));
  stock.push(c2("S", 1, false));
  const s = { suitCount: 2, columns, stock, completed: 0 };
  const n = Spider.dealRow(s);
  assert.equal(n.completed, 2);
  const steps = Anim.dealPlan(s, n);
  assert.equal(steps[0].landIndex, -1);
  assert.equal(steps[1].landIndex, -1);
  for (let i = 2; i < 10; i++) assert.equal(steps[i].landIndex, 1);
});

test("deal2: guard, double begin, cancel when idle, tokens never reused", () => {
  const gd = Anim.createDealGuard();
  gd.cancel();
  assert.equal(gd.isBusy(), false);
  const a = gd.begin();
  const b = gd.begin();
  assert.notEqual(a, b);
  assert.equal(gd.isCurrent(a), false);
  assert.equal(gd.end(a), false);
  assert.equal(gd.isBusy(), true);
  gd.cancel();
  const c = gd.begin();
  assert.ok(c > b);
  assert.equal(gd.isCurrent(b), false);
  assert.equal(gd.end(0), false);
  assert.equal(gd.end(undefined), false);
  assert.equal(gd.end(c), true);
  assert.equal(gd.isCurrent(c), false);
  const g1 = Anim.createDealGuard();
  const g2 = Anim.createDealGuard();
  g1.begin();
  assert.equal(g2.isBusy(), false);
});

// ---------- static checks ----------

test("deal2 static: deal-anim.js is DOM free and not named like a test file", () => {
  assert.doesNotMatch(animSrc, /\bwindow\b|\bdocument\b|matchMedia|localStorage/);
  assert.doesNotMatch("deal-anim.js", /\.test\.js$|-test\.js$|_test\.js$|^test-/);
});

test("deal2 static: app.js has no hard-coded timing and uses onfinish, not finished.then", () => {
  assert.doesNotMatch(appSrc, /\.finished\b/);
  assert.match(appSrc, /onfinish/);
  assert.match(appSrc, /fill:\s*"both"/);
  assert.doesNotMatch(appSrc, /\b(300|840)\b/);
  assert.doesNotMatch(appSrc, /\b60\b/);
  assert.equal((appSrc.match(/ghost\.className =/g) || []).length, 1);
  assert.ok(appSrc.includes("ghost.className = `ghost face-${settings.face}`;"));
});

test("deal2 static: style.css keeps the plan constraints and adds the deal block", () => {
  assert.doesNotMatch(cssSrc, /max-content/);
  assert.equal((cssSrc.match(/--card-w:/g) || []).length, 2);
  const block = cssSrc.slice(cssSrc.indexOf("/* ---------- Stock deal animation"), cssSrc.indexOf("/* ---------- Settings dialog"));
  assert.ok(block.length > 100);
  assert.doesNotMatch(block, /--card-w:|--card-h:/);
  assert.match(block, /\.deal-layer \{[^}]*position: fixed[^}]*inset: 0[^}]*pointer-events: none[^}]*overflow: hidden/);
  assert.match(block, /\.card\.deal-pending \{ visibility: hidden; \}/);
  assert.match(block, /backface-visibility: hidden/);
  assert.match(cssSrc, /\.table \{ overflow-x: auto; padding-bottom: 8px; \}/);
});

test("deal2 static: baseline blocks (:root, .table, .board, 600px) are byte-identical to HEAD", () => {
  const { execFileSync } = require("node:child_process");
  let head;
  try {
    head = execFileSync("git", ["show", "HEAD:games/spider/style.css"], { cwd: dir, encoding: "utf8" });
  } catch (e) {
    return; // no git available: skip
  }
  const norm = (t) => t.replace(/\r\n/g, "\n");
  const pick = (t, re) => { const m = norm(t).match(re); assert.ok(m, String(re)); return m[0]; };
  for (const re of [/:root \{[^}]*\}/, /\.table \{[^}]*\}/, /\.board \{[^}]*\}/, /@media \(max-width: 600px\) \{[\s\S]*?\n\}/]) {
    assert.equal(pick(cssSrc, re), pick(head, re), String(re));
  }
});

// ---------- app.js run against a fake DOM ----------

function makeHarness({ reduceMotion = false, hasAnimate = true } = {}) {
  class FakeEl {
    constructor(tag) {
      this.tag = tag; this.className = ""; this.children = []; this.parent = null;
      this.dataset = {}; this.style = { setProperty() {} }; this.listeners = {};
      this.disabled = false; this.value = ""; this.open = false; this._text = "";
      this.classList = {
        add: (...c) => { const s = new Set(this.className.split(/\s+/).filter(Boolean)); c.forEach((x) => s.add(x)); this.className = [...s].join(" "); },
        remove: (...c) => { this.className = this.className.split(/\s+/).filter((x) => x && !c.includes(x)).join(" "); },
        toggle: (c, on) => { if (on) this.classList.add(c); else this.classList.remove(c); },
        contains: (c) => this.className.split(/\s+/).includes(c),
      };
    }
    get lastElementChild() { return this.children[this.children.length - 1] || null; }
    appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
    remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
    set textContent(v) { this.children.forEach((c) => { c.parent = null; }); this.children = []; this._text = v; }
    get textContent() { return this._text; }
    set innerHTML(v) { this._html = v; }
    setAttribute() {}
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
    getBoundingClientRect() {
      const i = this.parent ? this.parent.children.indexOf(this) : 0;
      const col = Number(this.dataset.col) || 0;
      return { left: 100 + col * 90, top: 50 + i * 20 };
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const out = [];
      const m = sel.match(/^\.column\[data-col="(\d+)"\]$/);
      const walk = (e) => e.children.forEach((c) => {
        if (sel === ".column" && c.classList.contains("column")) out.push(c);
        if (m && c.classList.contains("column") && String(c.dataset.col) === m[1]) out.push(c);
        walk(c);
      });
      walk(this);
      return out;
    }
    closest() { return null; }
    showModal() { this.open = true; }
    fire(type, evt) { (this.listeners[type] || []).forEach((f) => f(evt || {})); }
  }
  const animations = [];
  if (hasAnimate) {
    FakeEl.prototype.animate = function (kf, opts) {
      const a = {
        el: this, kf, opts, cancelled: false, onfinish: null,
        cancel() { this.cancelled = true; },
        finish() { if (!this.cancelled && this.onfinish) this.onfinish(); },
      };
      animations.push(a);
      return a;
    };
  }
  const els = {};
  const doc = new FakeEl("doc");
  doc.getElementById = (id) => {
    if (!els[id]) { els[id] = new FakeEl("x"); if (id === "suits") els[id].value = "1"; }
    return els[id];
  };
  doc.createElement = (t) => new FakeEl(t);
  doc.querySelectorAll = () => [];
  doc.documentElement = new FakeEl("html");
  doc.body = new FakeEl("body");
  doc.elementFromPoint = () => null;
  const ctx = {
    Element: FakeEl, getComputedStyle: () => ({ getPropertyValue: () => "28" }),
    localStorage: { getItem: () => null, setItem() {} }, console,
  };
  ctx.window = ctx;
  ctx.document = doc;
  ctx.matchMedia = () => ({ matches: reduceMotion });
  vm.createContext(ctx);
  for (const f of ["spider-core.js", "seeds.js", "deal-anim.js"]) vm.runInContext(read(f), ctx, { filename: f });
  vm.runInContext(appSrc, ctx, { filename: "app.js" });
  const q = (id) => els[id];
  return { ctx, doc, els, animations, q, board: q("board"), stock: q("stock"), undo: q("undo"), layer: q("deal-layer"), moves: q("moves") };
}

const pending = (h) => h.board.querySelectorAll(".column").reduce((n, c) => n + c.children.filter((k) => k.classList.contains("deal-pending")).length, 0);
const countCards = (h) => h.board.querySelectorAll(".column").reduce((n, c) => n + c.children.length, 0);
const finishAll = (anims) => anims.slice().forEach((a) => a.finish());

test("deal2 app: a stock click makes 10 flights in column order, staggered, fill both, plan timing", () => {
  const h = makeHarness();
  const before = countCards(h);
  h.stock.fire("click");
  assert.equal(h.animations.length, 10);
  h.animations.forEach((a, i) => {
    assert.equal(a.opts.duration, 300);
    assert.equal(a.opts.delay, i * 60);
    assert.equal(a.opts.fill, "both");
    assert.equal(a.kf.length, 2);
    assert.equal(a.el.style.left, `${100 + i * 90}px`);
  });
  assert.equal(h.layer.children.length, 10);
  assert.equal(pending(h), 10);
  assert.equal(countCards(h), before + 10, "state updated at the click");
  assert.equal(h.stock.disabled, true);
  assert.equal(h.undo.disabled, true);
  assert.equal(h.moves.textContent, "1");
});

test("deal2 app: after all flights finish the layer is empty, nothing pending, stock and undo enabled", () => {
  const h = makeHarness();
  h.stock.fire("click");
  h.animations.slice(0, 9).forEach((a) => a.finish());
  assert.equal(h.layer.children.length, 1, "only the last card still flying");
  assert.equal(h.stock.disabled, true);
  h.animations[9].finish();
  assert.equal(h.layer.children.length, 0);
  assert.equal(pending(h), 0);
  assert.equal(h.stock.disabled, false);
  assert.equal(h.undo.disabled, false);
  assert.equal(h.moves.textContent, "1");
});

test("deal2 app: second stock click, Undo, Ctrl+Z, drag and double-click are ignored mid-deal", () => {
  const h = makeHarness();
  h.stock.fire("click");
  h.stock.fire("click");
  h.stock.fire("click");
  assert.equal(h.animations.length, 10, "no second deal");
  assert.equal(h.moves.textContent, "1");
  h.undo.fire("click");
  h.doc.fire("keydown", { ctrlKey: true, key: "z", preventDefault() {} });
  assert.equal(h.moves.textContent, "1", "undo ignored");
  const boom = { button: 0, target: { closest() { throw new Error("handler ran while busy"); } } };
  h.board.fire("pointerdown", boom);
  h.board.fire("dblclick", boom);
  finishAll(h.animations);
  const n = h.animations.length;
  h.undo.fire("click");
  assert.equal(h.moves.textContent, "0");
  assert.equal(h.animations.length, n, "undo does not animate");
  assert.equal(h.undo.disabled, true);
  assert.equal(h.stock.disabled, false);
});

test("deal2 app: all 5 deals animate in turn and the empty stock then deals nothing", () => {
  const h = makeHarness();
  for (let d = 1; d <= 5; d++) {
    h.stock.fire("click");
    assert.equal(h.animations.length, 10 * d, `deal ${d} animates`);
    finishAll(h.animations);
    assert.equal(h.moves.textContent, String(d));
    assert.equal(h.layer.children.length, 0);
  }
  assert.equal(h.stock.disabled, true, "stock empty");
  h.stock.fire("click");
  assert.equal(h.animations.length, 50, "no deal from empty stock");
  assert.equal(h.q("status").textContent, "No cards left to deal.");
  h.undo.fire("click");
  assert.equal(h.moves.textContent, "4", "undo works at once");
});

test("deal2 app: New game mid-deal cancels flights, clears the layer, stale callbacks do nothing", () => {
  const h = makeHarness();
  h.stock.fire("click");
  const old = h.animations.slice();
  h.q("new-game").fire("click");
  assert.ok(old.every((a) => a.cancelled), "every flight cancelled");
  assert.equal(h.layer.children.length, 0);
  assert.equal(pending(h), 0);
  assert.equal(h.moves.textContent, "0");
  assert.equal(h.stock.disabled, false);
  assert.equal(h.undo.disabled, true);
  old.forEach((a) => a.onfinish && a.onfinish());
  assert.equal(h.stock.disabled, false);
  h.stock.fire("click");
  assert.equal(h.animations.length, 20);
  old.forEach((a) => a.onfinish && a.onfinish());
  assert.equal(h.stock.disabled, true, "new deal still busy");
  assert.equal(h.layer.children.length, 10);
  finishAll(h.animations.slice(10));
  assert.equal(h.stock.disabled, false);
  assert.equal(h.layer.children.length, 0);
});

test("deal2 app: Suits change mid-deal behaves like New game", () => {
  const h = makeHarness();
  h.stock.fire("click");
  const old = h.animations.slice();
  h.q("suits").value = "2";
  h.q("suits").fire("change");
  assert.ok(old.every((a) => a.cancelled));
  assert.equal(h.layer.children.length, 0);
  assert.equal(pending(h), 0);
  assert.equal(h.stock.disabled, false);
  assert.equal(h.moves.textContent, "0");
});

test("deal2 app: reduce motion deals instantly with no flights, undo enabled at once", () => {
  const h = makeHarness({ reduceMotion: true });
  h.stock.fire("click");
  assert.equal(h.animations.length, 0);
  assert.equal(h.layer.children.length, 0);
  assert.equal(pending(h), 0);
  assert.equal(h.undo.disabled, false);
  assert.equal(h.stock.disabled, false);
  assert.equal(h.moves.textContent, "1");
  h.stock.fire("click");
  assert.equal(h.moves.textContent, "2", "no busy state with reduce motion");
});

test("deal2 app: no Element.animate available falls back to an instant deal", () => {
  const h = makeHarness({ hasAnimate: false });
  h.stock.fire("click");
  assert.equal(h.layer.children.length, 0);
  assert.equal(pending(h), 0);
  assert.equal(h.stock.disabled, false);
  assert.equal(h.undo.disabled, false);
  h.stock.fire("click");
  assert.equal(h.moves.textContent, "2");
});

test("deal2 app: reduce motion is re-read on every click", () => {
  let reduce = true;
  const h = makeHarness({ reduceMotion: true });
  h.ctx.matchMedia = () => ({ matches: reduce });
  h.stock.fire("click");
  assert.equal(h.animations.length, 0);
  reduce = false;
  h.stock.fire("click");
  assert.equal(h.animations.length, 10);
});

test("deal2 app: Settings change mid-deal restyles the deal layer, flights untouched", () => {
  const h = makeHarness();
  h.stock.fire("click");
  h.q("back-style").value = "red";
  h.q("back-style").fire("change");
  assert.match(h.layer.className, /deal-layer/);
  assert.match(h.layer.className, /back-red/);
  assert.match(h.layer.className, /face-classic/);
  assert.equal(h.layer.children.length, 10);
  h.q("face-style").value = "large";
  h.q("face-style").fire("change");
  assert.match(h.layer.className, /face-large/);
});

test("deal2 app: New game mid-deal with an empty seed bank must not leave hidden cards or a disabled stock", () => {
  const h = makeHarness();
  h.stock.fire("click");
  h.ctx.SpiderSeedBank[2] = [];
  h.q("suits").value = "2";
  h.q("suits").fire("change");
  assert.equal(h.layer.children.length, 0);
  assert.equal(pending(h), 0, "real cards left hidden by deal-pending");
  assert.equal(h.stock.disabled, false, "stock left disabled");
});
