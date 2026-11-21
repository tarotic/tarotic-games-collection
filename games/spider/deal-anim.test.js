const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Spider = require("./spider-core.js");
const Anim = require("./deal-anim.js");

const card = (suit, rank, faceUp = true) => ({ suit, rank, faceUp });

function dealPair() {
  const g = Spider.newGame(2, 5);
  return { g, n: Spider.dealRow(g) };
}

test("deal-anim: timing constants are 300 ms per card and 60 ms stagger", () => {
  assert.equal(Anim.DEAL_CARD_MS, 300);
  assert.equal(Anim.DEAL_STAGGER_MS, 60);
});

test("deal-anim: plan has one step per column, left to right, staggered", () => {
  const { g, n } = dealPair();
  const steps = Anim.dealPlan(g, n);
  assert.equal(steps.length, 10);
  steps.forEach((s, i) => {
    assert.equal(s.col, i);
    assert.equal(s.delay, i * 60);
    assert.equal(s.duration, 300);
  });
});

test("deal-anim: whole deal lasts 840 ms, under 1.2 s", () => {
  const { g, n } = dealPair();
  const d = Anim.dealDuration(Anim.dealPlan(g, n));
  assert.equal(d, 840);
  assert.ok(d < 1200);
  assert.equal(Anim.dealDuration(null), 0);
  assert.equal(Anim.dealDuration([]), 0);
  assert.equal(Anim.dealDuration(Anim.dealPlan(g, n, { cardMs: 100, staggerMs: 10 })), 190);
});

test("deal-anim: each step's card is the card that landed in its column, face-up", () => {
  const { g, n } = dealPair();
  for (const s of Anim.dealPlan(g, n)) {
    assert.equal(s.landIndex, g.columns[s.col].length);
    assert.deepEqual(s.card, n.columns[s.col][s.landIndex]);
    assert.equal(s.card.faceUp, true);
  }
});

test("deal-anim: reduce motion gives no plan", () => {
  const { g, n } = dealPair();
  assert.equal(Anim.dealPlan(g, n, { reduceMotion: true }), null);
});

test("deal-anim: no plan when the change is not a deal", () => {
  const { g, n } = dealPair();
  assert.equal(Anim.dealPlan(g, null), null);
  assert.equal(Anim.dealPlan(null, n), null);
  const mv = Spider.legalMoves(g).find((m) => m.type === "move");
  assert.ok(mv, "seed 5, 2 suits should have a legal non-deal move");
  const moved = Spider.applyMove(g, mv);
  assert.equal(Anim.dealPlan(g, moved), null);
});

test("deal-anim: plan does not change either state", () => {
  const { g, n } = dealPair();
  const gj = JSON.stringify(g);
  const nj = JSON.stringify(n);
  const steps = Anim.dealPlan(g, n);
  assert.equal(JSON.stringify(g), gj);
  assert.equal(JSON.stringify(n), nj);
  steps[0].card.rank = 99;
  steps[0].card.faceUp = false;
  assert.equal(JSON.stringify(g), gj);
  assert.equal(JSON.stringify(n), nj);
});

test("deal-anim: a deal that completes a set marks that column with landIndex -1", () => {
  const col0 = [];
  for (let r = 13; r >= 2; r--) col0.push(card("S", r, true));
  const columns = [col0];
  for (let i = 1; i < 10; i++) columns.push([card("S", 5, true)]);
  const stock = [];
  for (let i = 0; i < 9; i++) stock.push(card("S", 9, false));
  stock.push(card("S", 1, false)); // stock[9] is dealt to column 0
  const s = { suitCount: 1, columns, stock, completed: 0 };
  const n = Spider.dealRow(s);
  assert.equal(n.completed, 1);
  assert.equal(n.columns[0].length, 0);
  const steps = Anim.dealPlan(s, n);
  assert.equal(steps[0].landIndex, -1);
  assert.equal(steps[0].card.suit, "S");
  assert.equal(steps[0].card.rank, 1);
  assert.equal(steps[0].card.faceUp, true);
  for (let i = 1; i < 10; i++) assert.equal(steps[i].landIndex, 1);
});

test("deal-anim: guard blocks while busy and ignores stale tokens", () => {
  const gd = Anim.createDealGuard();
  assert.equal(gd.isBusy(), false);
  const t1 = gd.begin();
  assert.equal(gd.isBusy(), true);
  assert.equal(gd.isCurrent(t1), true);
  assert.equal(gd.end(t1), true);
  assert.equal(gd.isBusy(), false);
  assert.equal(gd.end(t1), false);
  const t2 = gd.begin();
  gd.cancel();
  assert.equal(gd.isBusy(), false);
  assert.equal(gd.isCurrent(t2), false);
  const t3 = gd.begin();
  assert.equal(gd.end(t2), false);
  assert.equal(gd.isBusy(), true);
  assert.equal(gd.end(t3), true);
});

test("deal-anim: index.html loads deal-anim.js after seeds.js and before app.js", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const a = html.indexOf('src="seeds.js"');
  const b = html.indexOf('src="deal-anim.js"');
  const c = html.indexOf('src="app.js"');
  assert.ok(a >= 0 && a < b && b < c);
  assert.ok(html.includes('id="deal-layer"'));
});
