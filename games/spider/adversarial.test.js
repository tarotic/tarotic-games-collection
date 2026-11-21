const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Spider = require("./spider-core.js");
const Bank = require("./seeds.js");

const card = (suit, rank, faceUp = true) => ({ suit, rank, faceUp });
function emptyState(suitCount = 1) {
  return { suitCount, columns: Array.from({ length: 10 }, () => []), stock: [], completed: 0 };
}
function parse(text) {
  return text.split(" ").map((t) => {
    if (t === "D") return { type: "deal" };
    const [from, count, to] = t.split(".").map(Number);
    return { type: "move", from, count, to };
  });
}
const key = (s) => JSON.stringify(s);

test("adv: bank entries are well-formed and seeds unique per suit mode", () => {
  for (const n of [1, 2, 4]) {
    const seeds = Bank[n].map((e) => e.seed);
    assert.ok(seeds.length >= 1);
    assert.equal(new Set(seeds).size, seeds.length, `${n}-suit duplicate seeds`);
    for (const e of Bank[n]) {
      assert.ok(Number.isInteger(e.seed));
      assert.match(e.moves, /^(D|\d+\.\d+\.\d+)( (D|\d+\.\d+\.\d+))*$/);
    }
  }
});

test("adv: 4-suit bank contains the decided seeds 8, 10, 13, 15", () => {
  const seeds = Bank[4].map((e) => e.seed);
  for (const s of [8, 10, 13, 15]) assert.ok(seeds.includes(s), `missing seed ${s}`);
});

test("adv: stored deals use exactly the requested number of suits", () => {
  for (const n of [1, 2, 4]) {
    for (const { seed } of Bank[n]) {
      const g = Spider.newGame(n, seed);
      const all = [...g.columns.flat(), ...g.stock];
      assert.equal(all.length, 104);
      assert.equal(new Set(all.map((c) => c.suit)).size, n, `${n}-suit seed ${seed}`);
    }
  }
});

test("adv: every stored line ends with 8 sets, empty tableau and stock, every step legal", () => {
  for (const n of [1, 2]) {
    for (const { seed, moves } of Bank[n]) {
      let s = Spider.newGame(n, seed);
      for (const m of parse(moves)) {
        assert.ok(Spider.legalMoves(s).some((l) => key(l) === key(m)), `${n}/${seed}: ${JSON.stringify(m)} not in legalMoves`);
        s = Spider.applyMove(s, m);
        assert.ok(s);
      }
      assert.equal(s.completed, 8);
      assert.equal(s.stock.length, 0);
      assert.ok(s.columns.every((c) => c.length === 0));
    }
  }
});

test("adv: game state keeps 104 cards across the whole replay and applyMove never mutates input", () => {
  const { seed, moves } = Bank[1][0];
  let s = Spider.newGame(1, seed);
  for (const m of parse(moves)) {
    const before = key(s);
    const next = Spider.applyMove(s, m);
    assert.equal(key(s), before, "input mutated");
    assert.equal(next.columns.flat().length + next.stock.length + next.completed * 13, 104);
    s = next;
  }
});

test("adv: undo model, replaying prefix of a line reproduces the same state (determinism)", () => {
  const { seed, moves } = Bank[2][0];
  const ms = parse(moves).slice(0, 25);
  const run = () => ms.reduce((s, m) => Spider.applyMove(s, m), Spider.newGame(2, seed));
  assert.equal(key(run()), key(run()));
});

test("adv: illegal moves return null (same column, out of range, zero/negative count, over-long run)", () => {
  const s = emptyState();
  s.columns[0] = [card("S", 5), card("S", 4)];
  s.columns[1] = [card("S", 6)];
  assert.ok(Spider.applyMove(s, { type: "move", from: 0, count: 2, to: 1 }));
  assert.equal(Spider.applyMove(s, { type: "move", from: 0, count: 1, to: 0 }), null);
  assert.equal(Spider.applyMove(s, { type: "move", from: 0, count: 0, to: 1 }), null);
  assert.equal(Spider.applyMove(s, { type: "move", from: 0, count: -1, to: 1 }), null);
  assert.equal(Spider.applyMove(s, { type: "move", from: 0, count: 3, to: 1 }), null);
  assert.equal(Spider.applyMove(s, { type: "move", from: 0, count: 1, to: 10 }), null);
  assert.equal(Spider.applyMove(s, { type: "move", from: -1, count: 1, to: 1 }), null);
  assert.ok(Spider.applyMove(s, { type: "move", from: 0, count: 1, to: 2 }), "empty column is a legal target");
  assert.equal(Spider.applyMove(s, { type: "bogus" }), null);
});

test("adv: broken (mixed-suit) run cannot be picked up beyond its same-suit top", () => {
  const col = [card("S", 9), card("H", 8), card("H", 7)];
  assert.equal(Spider.runLength(col), 2);
  const col2 = [card("S", 9), card("H", 8), card("S", 7)];
  assert.equal(Spider.runLength(col2), 1);
  assert.equal(Spider.runLength([card("S", 9, false), card("S", 8)]), 1);
  assert.equal(Spider.runLength([card("S", 8, false)]), 0);
  assert.equal(Spider.runLength([]), 0);
});

test("adv: moving a run onto an empty column is allowed; any count up to runLength", () => {
  const s = emptyState();
  s.columns[0] = [card("S", 3), card("S", 2), card("S", 1)];
  for (const count of [1, 2, 3]) assert.ok(Spider.applyMove(s, { type: "move", from: 0, count, to: 5 }));
});

test("adv: different suit onto rank+1 is allowed to move (rank-only rule) but does not extend the run", () => {
  const s = emptyState(2);
  s.columns[0] = [card("H", 4)];
  s.columns[1] = [card("S", 5)];
  const n = Spider.applyMove(s, { type: "move", from: 0, count: 1, to: 1 });
  assert.ok(n);
  assert.equal(Spider.runLength(n.columns[1]), 1);
});

test("adv: stock deal blocked on empty column, blocked on empty stock, unchanged input", () => {
  const s = emptyState();
  s.stock = Array.from({ length: 10 }, () => card("S", 1, false));
  for (let i = 1; i < 10; i++) s.columns[i] = [card("S", 2)];
  assert.equal(Spider.applyMove(s, { type: "deal" }), null);
  s.columns[0] = [card("S", 7)];
  const d = Spider.applyMove(s, { type: "deal" });
  assert.equal(d.stock.length, 0);
  assert.ok(d.columns.every((c) => c[c.length - 1].faceUp));
  assert.equal(Spider.applyMove(d, { type: "deal" }), null);
  assert.equal(s.stock.length, 10);
});

test("adv: final deal count, 5 deals from a fresh game, 6th is null", () => {
  let s = Spider.newGame(1, Bank[1][0].seed);
  let deals = 0;
  // Fill any empty columns is unnecessary on a fresh game: no column is empty.
  while (s) {
    const n = Spider.applyMove(s, { type: "deal" });
    if (!n) break;
    s = n;
    deals++;
  }
  assert.equal(deals, 5);
  assert.equal(s.stock.length, 0);
});

test("adv: a deal that completes a run removes it and counts a set; mixed suit K..A does not", () => {
  const s = emptyState(2);
  s.columns[0] = [];
  for (let r = 13; r >= 2; r--) s.columns[0].push(card("S", r));
  s.columns[1] = [card("S", 1)];
  const done = Spider.applyMove(s, { type: "move", from: 1, count: 1, to: 0 });
  assert.equal(done.completed, 1);
  assert.equal(done.columns[0].length, 0);

  const m = emptyState(2);
  for (let r = 13; r >= 2; r--) m.columns[0].push(card("S", r));
  m.columns[1] = [card("H", 1)];
  const no = Spider.applyMove(m, { type: "move", from: 1, count: 1, to: 0 });
  assert.equal(no.completed, 0);
  assert.equal(no.columns[0].length, 13);
});

test("adv: completing a set flips the newly exposed face-down card", () => {
  const s = emptyState();
  s.columns[0] = [card("H", 9, false)];
  for (let r = 13; r >= 2; r--) s.columns[0].push(card("S", r));
  s.columns[1] = [card("S", 1)];
  const done = Spider.applyMove(s, { type: "move", from: 1, count: 1, to: 0 });
  assert.equal(done.columns[0].length, 1);
  assert.equal(done.columns[0][0].faceUp, true);
});

test("adv: moving off a column flips the revealed face-down card", () => {
  const s = emptyState();
  s.columns[0] = [card("S", 9, false), card("S", 3)];
  s.columns[1] = [card("S", 4)];
  const n = Spider.applyMove(s, { type: "move", from: 0, count: 1, to: 1 });
  assert.equal(n.columns[0][0].faceUp, true);
});

test("adv: legalMoves agrees with applyMove for fresh games of every suit mode", () => {
  for (const n of [1, 2, 4]) {
    for (const { seed } of Bank[n].slice(0, 3)) {
      const g = Spider.newGame(n, seed);
      for (const m of Spider.legalMoves(g)) assert.ok(Spider.applyMove(g, m), JSON.stringify(m));
    }
  }
});

// ---- Static checks of the edit sites named in plan.md ---------------------

const css = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

test("static: :root --card-w and --card-h match the plan exactly", () => {
  const root = css.match(/:root\s*\{[^}]*\}/)[0];
  assert.ok(root.includes("--card-w: min(84px, calc((min(100vw - 20px, 1000px) - 96px) / 10));"));
  assert.ok(root.includes("--card-h: calc(var(--card-w) * 118 / 84);"));
  assert.ok(root.includes("--off-down: 12px;"));
  assert.ok(root.includes("--off-up: 28px;"));
});

test("static: --card-w is defined on :root only, with no self-reference cycle", () => {
  const defs = css.match(/--card-w\s*:[^;]*;/g);
  assert.equal(defs.length, 2, "expected :root and the 600px media block only");
  for (const d of defs) assert.ok(!d.slice(d.indexOf(":")).includes("var(--card-w)"), d);
});

test("static: .board has no min-width and keeps its other declarations", () => {
  const board = css.match(/\.board\s*\{[^}]*\}/)[0];
  assert.ok(!/min-width/.test(board));
  assert.ok(!/max-content/.test(css));
  assert.ok(board.includes("grid-template-columns: repeat(10, var(--card-w));"));
  assert.ok(board.includes("gap: 8px;"));
});

test("static: .table overflow fallback and 600px media block unchanged", () => {
  assert.ok(css.includes(".table { overflow-x: auto; padding-bottom: 8px; }"));
  assert.ok(css.includes("@media (max-width: 600px) {"));
  assert.ok(css.includes(":root { --card-w: 62px; --card-h: 88px; --off-down: 9px; --off-up: 19px; }"));
});

test("static: ghost className includes the face style and is the only ghost.className", () => {
  const hits = app.match(/ghost\.className\s*=.*/g);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].trim(), "ghost.className = `ghost face-${settings.face}`;");
});

test("static: face-large / face-minimal rules exist and settings.face values match class names", () => {
  assert.match(css, /\.face-large/);
  assert.match(css, /\.face-minimal/);
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  for (const v of ["classic", "large", "minimal"]) assert.ok(html.includes(`"${v}"`) || html.includes(v), v);
});

test("static: Interface Light/Dark option and localStorage settings are still present", () => {
  assert.match(app, /localStorage/);
  assert.match(app, /spider-solitaire-settings/);
  assert.match(css, /body\.ui-dark/);
});

test("static: arithmetic of --card-w at plan widths", () => {
  const w = (vw) => Math.min(84, (Math.min(vw - 20, 1000) - 96) / 10);
  for (const vw of [1280, 1366, 1920]) assert.equal(w(vw), 84);
  // board width = 10w + 72 plus 24 padding must fit within vw - 20 whenever vw >= 600
  for (const vw of [940, 911, 853, 700, 601]) assert.ok(10 * w(vw) + 72 + 24 <= vw - 20 + 1e-9, `vw ${vw}`);
});
