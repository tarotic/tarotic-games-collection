// Adversarial checks for Spider increment 1 (independent of the engineer's tests).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dir = path.join(__dirname, "..", "..", "games", "spider");
const Core = require(path.join(dir, "spider-core.js"));

function loadBank() {
  const ctx = { };
  ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, "seeds.js"), "utf8"), ctx);
  return ctx.SpiderSeedBank;
}
const Bank = loadBank();

function parse(text) {
  return text.trim().split(/\s+/).map((t) => {
    if (t === "D") return { type: "deal" };
    const [from, count, to] = t.split(".").map(Number);
    return { type: "move", from, count, to };
  });
}

test("bank has 1, 2 and 4 suit keys with entries; 4-suit seeds are 8,10,13,15", () => {
  assert.ok(Bank[1].length > 0 && Bank[2].length > 0);
  const s4 = Bank[4].map((e) => e.seed); for (const x of [8, 10, 13, 15]) assert.ok(s4.includes(x), "missing 4-suit seed " + x);
});

for (const n of [1, 2, 4]) {
  test(`independent replay: every ${n}-suit stored line wins, all moves legal, no mutation of start`, () => {
    for (const { seed, moves } of Bank[n]) {
      let s = Core.newGame(n, seed);
      const suits = new Set([...s.columns.flat(), ...s.stock].map((c) => c.suit));
      assert.equal(suits.size, n, `seed ${seed} suit count`);
      assert.equal(s.columns.flat().length + s.stock.length, 104);
      for (const m of parse(moves)) {
        const next = Core.applyMove(s, m);
        assert.ok(next, `seed ${seed}: illegal move ${JSON.stringify(m)}`);
        s = next;
      }
      assert.ok(Core.isWon(s), `seed ${seed} not won`);
      assert.equal(s.completed, 8);
    }
  });

  test(`${n}-suit seeds are unique`, () => {
    const seeds = Bank[n].map((e) => e.seed);
    assert.equal(new Set(seeds).size, seeds.length);
  });
}

test("undo-ish: applyMove never mutates input and set completion is reversible by snapshot", () => {
  let s = Core.newGame(1, Bank[1][0].seed);
  const snap = JSON.stringify(s);
  for (const m of parse(Bank[1][0].moves)) {
    const before = JSON.stringify(s);
    const n = Core.applyMove(s, m);
    assert.equal(JSON.stringify(s), before);
    s = n;
  }
  assert.equal(JSON.stringify(Core.newGame(1, Bank[1][0].seed)), snap);
});

test("deal blocked with empty column and with empty stock; illegal count rejected", () => {
  const s = Core.newGame(4, 8);
  const empty = JSON.parse(JSON.stringify(s));
  empty.columns[3] = [];
  assert.equal(Core.applyMove(empty, { type: "deal" }), null);
  const noStock = JSON.parse(JSON.stringify(s));
  noStock.stock = [];
  assert.equal(Core.applyMove(noStock, { type: "deal" }), null);
  assert.equal(Core.applyMove(s, { type: "move", from: 0, count: 0, to: 1 }), null);
  assert.equal(Core.applyMove(s, { type: "move", from: 0, count: 1, to: 0 }), null);
  assert.equal(Core.applyMove(s, { type: "move", from: 0, count: 1, to: 99 }), null);
  assert.equal(Core.applyMove(s, { type: "move", from: 0, count: 99, to: 1 }), null);
});

test("style.css contains the planned scrollbar fix and app.js the ghost fix", () => {
  const css = fs.readFileSync(path.join(dir, "style.css"), "utf8");
  const app = fs.readFileSync(path.join(dir, "app.js"), "utf8");
  assert.match(css, /--card-w:\s*min\(84px/);
  assert.doesNotMatch(css, /min-width:\s*max-content/);
  assert.match(app, /ghost face-\$\{settings\.face\}/);
});

test("package.json test script covers spider; forbidden files unchanged is checked via git by the tester", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"));
  assert.match(pkg.scripts.test, /games\/spider/);
});
