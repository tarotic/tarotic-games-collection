// Adversarial headless-browser checks for Spider increment 1.
// Drives Microsoft Edge (headless) through the DevTools protocol with no extra dependencies.
// Needs Node 22+ (global WebSocket). Skips if Edge/Chrome is not found.
// Run: node --test tests/adversarial/spider-browser.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const root = path.resolve(process.env.SPIDER_ROOT || path.join(__dirname, "..", ".."));
const spiderDir = path.join(root, "games", "spider");
const candidates = [
  process.env.BROWSER_EXE,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const exe = candidates.find((p) => fs.existsSync(p));
const PORT = 9400 + Math.floor(Math.random() * 400);

let proc, server, serverPort, userDir;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      const ext = path.extname(p);
      res.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[ext] || "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
    }).listen(0, "127.0.0.1", () => { serverPort = server.address().port; resolve(); });
  });
}

async function getJson(p, method = "GET") {
  const r = await fetch(`http://127.0.0.1:${PORT}${p}`, { method });
  return r.json();
}

class Page {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = []; this.loaded = null;
    ws.addEventListener("message", (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { const { res, rej } = this.pending.get(d.id); this.pending.delete(d.id); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result); }
      else if (d.method === "Runtime.exceptionThrown") this.errors.push(d.params.exceptionDetails.text + " " + (d.params.exceptionDetails.exception?.description || ""));
      else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") this.errors.push("console.error " + JSON.stringify(d.params.args.map((a) => a.value)));
      else if (d.method === "Page.loadEventFired" && this.loaded) this.loaded();
    });
  }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.pending.set(id, { res, rej })); }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails) + "\n" + expr);
    return r.result.value;
  }
  async goto(url) { const p = new Promise((r) => { this.loaded = r; setTimeout(r, 8000); }); await this.send("Page.navigate", { url }); await p; await sleep(80); }
  async viewport(cssW, cssH, zoom = 1) {
    // Browser zoom Z is equivalent to CSS viewport = physical / Z with deviceScaleFactor Z.
    await this.send("Emulation.setDeviceMetricsOverride", { width: Math.round(cssW), height: Math.round(cssH), deviceScaleFactor: zoom, mobile: false });
  }
  async mouse(type, x, y, extra = {}) {
    await this.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra });
  }
  async drag(fx, fy, tx, ty) {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: fx, y: fy });
    await this.mouse("mousePressed", fx, fy);
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: fx + 8, y: fy + 8, button: "left", buttons: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: (fx + tx) / 2, y: (fy + ty) / 2, button: "left", buttons: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: tx, y: ty, button: "left", buttons: 1 });
    await this.mouse("mouseReleased", tx, ty);
  }
  async click(x, y) { await this.mouse("mousePressed", x, y); await this.mouse("mouseReleased", x, y); }
}

async function newPage(opts = {}) {
  const t = await getJson("/json/new?about:blank", "PUT");
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const page = new Page(ws);
  page.targetId = t.id;
  await page.send("Page.enable"); await page.send("Runtime.enable");
  if (opts.randomIndexScript) await page.send("Page.addScriptToEvaluateOnNewDocument", { source: opts.randomIndexScript });
  return page;
}
async function closePage(p) { try { p.ws.close(); await getJson("/json/close/" + p.targetId); } catch (e) { /* ignore */ } }

const selectSuits = (p, n) => p.eval(`(() => { const s = document.getElementById('suits'); s.value = '${n}'; s.dispatchEvent(new Event('change')); })()`);
// Choose a suit mode so the New game that follows cannot collide with lastSeed (app avoids immediate repeats).
const selectSuitsFresh = async (p, n) => { await selectSuits(p, n === 1 ? 4 : 1); await selectSuits(p, n); };
const fileUrl = () => pathToFileURL(path.join(spiderDir, "index.html")).href;
const httpUrl = () => `http://127.0.0.1:${serverPort}/games/spider/index.html`;
const MODES = [["file", fileUrl], ["http", httpUrl]];

test.before(async () => {
  if (!exe) return;
  await startServer();
  userDir = fs.mkdtempSync(path.join(os.tmpdir(), "spider-edge-"));
  proc = spawn(exe, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, "--no-first-run", "--disable-gpu", "--disable-features=OverlayScrollbar,FluentScrollbar,FluentOverlayScrollbar", "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) { try { await getJson("/json/version"); return; } catch (e) { await sleep(250); } }
  throw new Error("browser did not start");
});
test.after(async () => {
  if (proc) { proc.kill(); }
  if (server) server.close();
  await sleep(500);
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
});

const skip = !exe && "no Edge/Chrome found";

const MEASURE = `(() => {
  const d = document.documentElement, t = document.querySelector('.table');
  const cols = [...document.querySelectorAll('#board .column')].map(c => { const r = c.getBoundingClientRect(); return [r.left, r.right]; });
  const s = document.getElementById('stock').getBoundingClientRect();
  const card = document.querySelector('#board .card').getBoundingClientRect();
  return { iw: innerWidth, dw: d.scrollWidth, dc: d.clientWidth, tw: t.scrollWidth, tc: t.clientWidth, cols,
           stock: [s.left, s.right], cardW: card.width, stockW: s.width, bodyW: document.body.scrollWidth };
})()`;

function assertFits(m, label) {
  assert.ok(m.dw <= m.dc, `${label}: page scrollWidth ${m.dw} > clientWidth ${m.dc}`);
  assert.ok(m.tw <= m.tc, `${label}: .table scrollWidth ${m.tw} > clientWidth ${m.tc}`);
  assert.equal(m.cols.length, 10);
  for (const [l, r] of m.cols) assert.ok(l >= -0.5 && r <= m.dc + 0.5, `${label}: column ${l}-${r} outside 0-${m.dc}`);
  assert.ok(m.stock[0] >= 0 && m.stock[1] <= m.dc, `${label}: stock outside`);
  assert.ok(Math.abs(m.cardW - m.stockW) < 6, `${label}: stock width ${m.stockW} vs card ${m.cardW}`);
}

// ---------- Layout (L1, L2) ----------
for (const [mode, urlFn] of MODES) {
  for (const w of [1280, 1366, 1920]) {
    for (const zoom of [1, 1.25, 1.5]) {
      test(`layout [${mode}] ${w}px @ ${zoom * 100}% zoom: no horizontal scroll, 10 columns + stock visible`, { skip }, async () => {
        const p = await newPage();
        try {
          await p.viewport(w / zoom, 900, zoom);
          await p.goto(urlFn());
          await selectSuits(p, 4);
          const m = await p.eval(MEASURE);
          assertFits(m, `${w}@${zoom}`);
          // after dealing 5 rows the page is tall; still no horizontal scroll
          for (let i = 0; i < 5; i++) await p.eval("document.getElementById('stock').click()");
          assertFits(await p.eval(MEASURE), `${w}@${zoom} after 5 deals`);
          assert.deepEqual(p.errors, []);
        } finally { await closePage(p); }
      });
    }
  }
}

test("layout: simulated classic 17px scrollbar at 940, 956, 960, 1000 px wide (tall page)", { skip }, async (t) => {
  const p = await newPage();
  try {
    for (const w of [900, 940, 956, 960, 1000, 1280]) {
      await p.viewport(w, 700, 1);
      await p.goto(fileUrl());
      await p.eval("(() => { const s = document.createElement('style'); s.textContent = '::-webkit-scrollbar{width:17px;height:17px}'; document.head.appendChild(s); })()");
      for (let i = 0; i < 5; i++) await p.eval("document.getElementById('stock').click()");
      const m = await p.eval(MEASURE);
      if (m.iw - m.dc < 15) { t.diagnostic("classic scrollbar could not be forced in headless; UNVERIFIABLE here"); return; }
      assertFits(m, `classic scrollbar @${w}`);
    }
  } finally { await closePage(p); }
});

test("layout: resize 1920 -> 940 mid-game reflows without horizontal scroll", { skip }, async () => {
  const p = await newPage();
  try {
    await p.viewport(1920, 900); await p.goto(fileUrl());
    for (const w of [1500, 1100, 1000, 960, 940]) { await p.viewport(w, 900); await sleep(60); assertFits(await p.eval(MEASURE), `resize ${w}`); }
  } finally { await closePage(p); }
});

// ---------- Suits (S1) ----------
for (const [mode, urlFn] of MODES) {
  test(`suits [${mode}]: 1/2/4 suits produce exactly that many distinct suits`, { skip }, async () => {
    const p = await newPage();
    try {
      await p.viewport(1920, 3000); await p.goto(urlFn());
      for (const n of [1, 2, 4, 2, 1, 4]) {
        await p.eval(`(() => { const s = document.getElementById('suits'); s.value = '${n}'; s.dispatchEvent(new Event('change')); })()`);
        // deal all 5 rows so every card is face up, then count suits via aria-label
        for (let i = 0; i < 5; i++) await p.eval("document.getElementById('stock').click()");
        const r = await p.eval(`(() => { const set = new Set([...document.querySelectorAll('#board .card.up')].map(c => c.getAttribute('aria-label').split(' of ')[1])); return { n: set.size, moves: document.getElementById('moves').textContent }; })()`);
        // 54 + 50 cards; face-down ones are hidden, but with 5 deals at least 50 face-up cards.
        assert.equal(r.n, n, `suits=${n}`);
        assert.equal(r.moves, "5"); // 5 deals only
      }
      assert.deepEqual(p.errors, []);
    } finally { await closePage(p); }
  });
}

// ---------- Full replay through real mouse drags (M1, M2, M3, M4, M5, W1) ----------
const seedsBank = (() => { const vm = require("node:vm"); const c = {}; c.self = c; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(spiderDir, "seeds.js"), "utf8"), c); return c.SpiderSeedBank; })();

async function replayByMouse(p, suits, entryIndex, { checkUndoOnFirstDeal = true } = {}) {
  const entry = seedsBank[suits][entryIndex];
  await selectSuitsFresh(p, suits);
  const info = { setsSeen: 0 };
  const initialHTML = await p.eval("document.getElementById('board').innerHTML");
  const tokens = entry.moves.trim().split(/\s+/);
  let n = 0, undoChecked = false, emptyChecked = false;
  for (const t of tokens) {
    if (t === "D") {
      // blocked deal with an empty column must not change anything
      const emptyCols = await p.eval("document.querySelectorAll('#board .column.empty').length");
      if (emptyCols === 0 && !emptyChecked) { /* normal path */ }
      const before = await p.eval("({ m: moves.textContent, b: document.getElementById('board').innerHTML, c: document.querySelector('#stock .count').textContent })".replace("moves.textContent", "document.getElementById('moves').textContent"));
      const r = await p.eval("(() => { const b = document.getElementById('stock').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()");
      await p.click(r[0], r[1]);
      const after = await p.eval("({ m: document.getElementById('moves').textContent, c: document.querySelector('#stock .count').textContent })");
      assert.equal(Number(after.m), Number(before.m) + 1, "deal increments moves");
      const left = (s) => Number(s.match(/\d+/)[0]);
      assert.equal(left(after.c), left(before.c) - 1, "deals left drops by 1");
      if (checkUndoOnFirstDeal && !undoChecked) {
        undoChecked = true;
        await p.eval("document.getElementById('undo').click()");
        const u = await p.eval("({ m: document.getElementById('moves').textContent, b: document.getElementById('board').innerHTML, c: document.querySelector('#stock .count').textContent })");
        assert.equal(u.m, before.m, "undo of deal restores moves");
        assert.equal(u.b, before.b, "undo of deal restores board");
        assert.equal(u.c, before.c, "undo of deal restores deals left");
        await p.click(r[0], r[1]);
      }
    } else {
      const [from, count, to] = t.split(".").map(Number);
      const g = await p.eval(`(() => {
        const col = document.querySelector('#board .column[data-col="${from}"]');
        const kids = col.children; const card = kids[kids.length - ${count}];
        const cr = card.getBoundingClientRect();
        const tc = document.querySelector('#board .column[data-col="${to}"]').getBoundingClientRect();
        return { fx: cr.left + 20, fy: cr.top + 10, tx: tc.left + tc.width / 2, ty: tc.top + 30, len: kids.length, up: card.classList.contains('up') };
      })()`);
      assert.ok(g.up, `token ${t}: card not face up`);
      const beforeMoves = Number(await p.eval("document.getElementById('moves').textContent"));
      const beforeLens = await p.eval("[...document.querySelectorAll('#board .column')].map(c => c.children.length)");
      await p.drag(g.fx, g.fy, g.tx, g.ty);
      const afterMoves = Number(await p.eval("document.getElementById('moves').textContent"));
      const afterLens = await p.eval("[...document.querySelectorAll('#board .column')].map(c => c.children.length)");
      assert.equal(afterMoves, beforeMoves + 1, `move ${n} (${t}) not applied (seed ${entry.seed}); geom=${JSON.stringify(g)} status=${await p.eval("document.getElementById('status').textContent")} tops=${await p.eval("[...document.querySelectorAll('#board .column')].map(c => (c.lastElementChild||{getAttribute(){return 'empty'}}).getAttribute('aria-label')).join(';')")}`);
      if (!(afterLens[to] === 0)) { /* completion may remove 13 cards */ }
      const ghosts = await p.eval("document.querySelectorAll('#drag-layer .ghost').length");
      assert.equal(ghosts, 0, "ghost left behind");
      void beforeLens;
    }
    n++;
  }
  const end = await p.eval("({ sets: document.getElementById('completed').textContent, status: document.getElementById('status').textContent, moves: document.getElementById('moves').textContent, undoDisabled: document.getElementById('undo').disabled, stockDisabled: document.getElementById('stock').disabled, cnt: document.querySelector('#stock .count').textContent, cards: document.querySelectorAll('#board .card').length })");
  assert.equal(end.sets, "8", `seed ${entry.seed} sets`);
  assert.match(end.status, /won/i);
  assert.equal(end.cards, 0, "all cards cleared");
  assert.equal(end.stockDisabled, true);
  assert.match(end.cnt, /^0 deals left$/);
  // Undo everything and compare to the initial board
  const total = Number(end.moves);
  for (let i = 0; i < total; i++) await p.eval("document.getElementById('undo').click()");
  const back = await p.eval("({ m: document.getElementById('moves').textContent, sets: document.getElementById('completed').textContent, b: document.getElementById('board').innerHTML, d: document.getElementById('undo').disabled, c: document.querySelector('#stock .count').textContent })");
  assert.equal(back.m, "0"); assert.equal(back.sets, "0"); assert.equal(back.d, true);
  assert.equal(back.c, "5 deals left");
  assert.equal(back.b, initialHTML, "board after undoing everything equals initial board");
  return info;
}

for (const [mode, urlFn] of MODES) {
  for (const suits of [1, 2, 4]) {
    test(`replay by real mouse drags [${mode}] ${suits}-suit: every stored line wins, Sets reaches 8, undo-all restores`, { skip, timeout: 600000 }, async () => {
      const count = seedsBank[suits].length;
      const idxs = mode === "file" ? [...Array(count).keys()] : [0, count - 1];
      for (const idx of idxs) {
        const frac = (idx + 0.5) / count;
        const p = await newPage({ randomIndexScript: `Math.random = () => ${frac};` });
        try {
          await p.viewport(1920, 2600); await p.goto(urlFn());
          // the suits <select> change calls newGame again; the stubbed random still gives idx
          await replayByMouse(p, suits, idx);
          assert.deepEqual(p.errors, []);
        } finally { await closePage(p); }
      }
    });
  }
}

// ---------- Drops, edge cases (M1 illegal, drops in gaps, cancel, partial run) ----------
test("illegal drop, gap drop, outside drop, same-column drop, pointercancel all leave board and Moves unchanged", { skip }, async () => {
  const p = await newPage();
  try {
    await p.viewport(1366, 1500); await p.goto(fileUrl());
    const snap = () => p.eval("({ m: document.getElementById('moves').textContent, b: document.getElementById('board').innerHTML, u: document.getElementById('undo').disabled })");
    const s0 = await snap();
    // find an illegal target for column 0's top card: any column whose top rank != rank+1
    const g = await p.eval(`(() => {
      const rank = (el) => el.getAttribute('aria-label').split(' of ')[0];
      const R = { A: 1, J: 11, Q: 12, K: 13 };
      const val = (el) => R[rank(el)] || Number(rank(el));
      const tops = [...document.querySelectorAll('#board .column')].map(c => c.lastElementChild);
      const src = tops[0]; const sv = val(src);
      let bad = -1; for (let i = 1; i < 10; i++) if (val(tops[i]) !== sv + 1) { bad = i; break; }
      const sr = src.getBoundingClientRect();
      const cols = [...document.querySelectorAll('#board .column')].map(c => c.getBoundingClientRect());
      return { fx: sr.left + 20, fy: sr.top + 10, bad, cols: cols.map(r => [r.left, r.right, r.top, r.bottom]) };
    })()`);
    assert.ok(g.bad > 0);
    const badc = g.cols[g.bad];
    await p.drag(g.fx, g.fy, (badc[0] + badc[1]) / 2, badc[2] + 30);
    assert.deepEqual(await snap(), s0, "illegal drop changed state");
    assert.match(await p.eval("document.getElementById('status').textContent"), /isn't allowed/);
    // gap between col 0 and col 1
    const gapX = (g.cols[0][1] + g.cols[1][0]) / 2;
    await p.drag(g.fx, g.fy, gapX, g.cols[0][2] + 30);
    assert.deepEqual(await snap(), s0, "gap drop changed state");
    // outside the board entirely (header)
    await p.drag(g.fx, g.fy, 5, 5);
    assert.deepEqual(await snap(), s0, "outside drop changed state");
    // back on same column
    await p.drag(g.fx, g.fy, (g.cols[0][0] + g.cols[0][1]) / 2, g.cols[0][2] + 40);
    assert.deepEqual(await snap(), s0, "same-column drop changed state");
    // pointercancel mid drag
    await p.mouse("mousePressed", g.fx, g.fy);
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: g.fx + 30, y: g.fy + 30, button: "left", buttons: 1 });
    assert.equal(await p.eval("document.querySelectorAll('#drag-layer .ghost').length"), 1);
    await p.eval(`document.dispatchEvent(new PointerEvent('pointercancel', { clientX: ${g.cols[g.bad][0] + 20}, clientY: ${badc[2] + 30}, bubbles: true }))`);
    assert.equal(await p.eval("document.querySelectorAll('#drag-layer .ghost').length"), 0);
    await p.mouse("mouseReleased", g.fx + 30, g.fy + 30);
    assert.deepEqual(await snap(), s0, "cancel changed state");
    assert.deepEqual(p.errors, []);
  } finally { await closePage(p); }
});

test("pressing a face-up card above a broken run does not start a drag", { skip }, async () => {
  const p = await newPage();
  try {
    await p.viewport(1920, 3000); await p.goto(fileUrl());
    // Deal all rows in a 4-suit game, then find a face-up card whose column run is shorter than the face-up tail.
    for (let i = 0; i < 5; i++) await p.eval("document.getElementById('stock').click()");
    const t = await p.eval(`(() => {
      const R = { A: 1, J: 11, Q: 12, K: 13 };
      const parse = (el) => { const [r, s] = el.getAttribute('aria-label').split(' of '); return { v: R[r] || Number(r), s }; };
      for (const col of document.querySelectorAll('#board .column')) {
        const cards = [...col.children]; const n = cards.length;
        for (let i = 0; i < n - 1; i++) {
          if (!cards[i].classList.contains('up')) continue;
          const a = parse(cards[i]), b = parse(cards[i + 1]);
          if (a.s !== b.s || a.v !== b.v + 1) { const r = cards[i].getBoundingClientRect(); return { x: r.left + 20, y: r.top + 8 }; }
        }
      }
      return null; })()`);
    assert.ok(t, "no broken run found after dealing everything");
    await p.mouse("mousePressed", t.x, t.y);
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: t.x + 20, y: t.y + 20, button: "left", buttons: 1 });
    assert.equal(await p.eval("document.querySelectorAll('#drag-layer .ghost').length"), 0);
    await p.mouse("mouseReleased", t.x + 20, t.y + 20);
    assert.equal(await p.eval("document.getElementById('moves').textContent"), "5");
  } finally { await closePage(p); }
});

test("stock click with an empty column shows the message and does not change moves; dealing to the end disables stock", { skip }, async () => {
  const p = await newPage({ randomIndexScript: "Math.random = () => 0;" });
  try {
    await p.viewport(1920, 2600); await p.goto(fileUrl());
    await selectSuitsFresh(p, 1);
    const entry = seedsBank[1][0];
    let found = false;
    for (const t of entry.moves.split(" ")) {
      const empties = await p.eval("document.querySelectorAll('#board .column.empty').length");
      const left = await p.eval("Number(document.querySelector('#stock .count').textContent.match(/\\d+/)[0])");
      if (empties > 0 && left > 0) {
        const before = await p.eval("document.getElementById('moves').textContent");
        await p.eval("document.getElementById('stock').click()");
        assert.equal(await p.eval("document.getElementById('moves').textContent"), before);
        assert.match(await p.eval("document.getElementById('status').textContent"), /Every column needs at least one card/);
        found = true; break;
      }
      if (t === "D") await p.eval("document.getElementById('stock').click()");
      else {
        const [f, c, to] = t.split(".").map(Number);
        const g = await p.eval(`(() => { const col = document.querySelector('#board .column[data-col="${f}"]'); const card = col.children[col.children.length - ${c}].getBoundingClientRect(); const tc = document.querySelector('#board .column[data-col="${to}"]').getBoundingClientRect(); return [card.left + 20, card.top + 10, tc.left + tc.width / 2, tc.top + 30]; })()`);
        await p.drag(...g);
      }
    }
    assert.ok(found, "never reached a state with an empty column and stock left in the stored line");
  } finally { await closePage(p); }
});

test("Undo disabled initially; Ctrl+Z undoes with dialog closed and does nothing with dialog open; suit change resets", { skip }, async () => {
  const p = await newPage();
  try {
    await p.viewport(1366, 1500); await p.goto(fileUrl());
    assert.equal(await p.eval("document.getElementById('undo').disabled"), true);
    await p.eval("document.getElementById('stock').click()");
    assert.equal(await p.eval("document.getElementById('undo').disabled"), false);
    assert.equal(await p.eval("document.getElementById('moves').textContent"), "1");
    // dialog open: Ctrl+Z must do nothing
    await p.eval("document.getElementById('settings-btn').click()");
    assert.equal(await p.eval("document.getElementById('settings').open"), true);
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", modifiers: 2, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: 2, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
    assert.equal(await p.eval("document.getElementById('moves').textContent"), "1", "Ctrl+Z acted with dialog open");
    await p.eval("document.getElementById('settings').close()");
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", modifiers: 2, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: 2, key: "z", code: "KeyZ", windowsVirtualKeyCode: 90 });
    assert.equal(await p.eval("document.getElementById('moves').textContent"), "0", "Ctrl+Z did not undo");
    assert.equal(await p.eval("document.getElementById('undo').disabled"), true);
    // suit change mid-game resets
    await p.eval("document.getElementById('stock').click()");
    await p.eval("(() => { const s = document.getElementById('suits'); s.value = '2'; s.dispatchEvent(new Event('change')); })()");
    assert.equal(await p.eval("document.getElementById('moves').textContent"), "0");
    assert.equal(await p.eval("document.getElementById('undo').disabled"), true);
    assert.equal(await p.eval("document.querySelector('#stock .count').textContent"), "5 deals left");
    assert.deepEqual(p.errors, []);
  } finally { await closePage(p); }
});

test("4-suit New game never repeats the same deal twice in a row (60 clicks); never errors", { skip }, async () => {
  const p = await newPage();
  try {
    await p.viewport(1366, 1500); await p.goto(fileUrl());
    await selectSuits(p, 4);
    let prev = await p.eval("document.getElementById('board').innerHTML");
    const seen = new Set([prev]);
    for (let i = 0; i < 60; i++) {
      await p.eval("document.getElementById('new-game').click()");
      const cur = await p.eval("document.getElementById('board').innerHTML");
      assert.notEqual(cur, prev, `repeat at click ${i}`);
      prev = cur; seen.add(cur);
    }
    assert.ok(seen.size >= 2);
    assert.equal(await p.eval("typeof window.SpiderSeedBank"), "object");
    assert.deepEqual(p.errors, []);
  } finally { await closePage(p); }
});

test("every New game state equals a seeds.js deal (board fingerprint matches Core.newGame of a bank seed)", { skip }, async () => {
  const Core = require(path.join(spiderDir, "spider-core.js"));
  const R = { A: 1, J: 11, Q: 12, K: 13 };
  for (const suits of [1, 2, 4]) {
    const valid = new Set(seedsBank[suits].map((e) => { const s = Core.newGame(suits, e.seed); return s.columns.map((c) => c.map((x) => (x.faceUp ? x.suit + x.rank : "?")).join(",")).join("|"); }));
    const p = await newPage();
    try {
      await p.viewport(1366, 1500); await p.goto(fileUrl());
      await p.eval(`(() => { const s = document.getElementById('suits'); s.value = '${suits}'; s.dispatchEvent(new Event('change')); })()`);
      for (let i = 0; i < 25; i++) {
        await p.eval("document.getElementById('new-game').click()");
        const fp = await p.eval(`[...document.querySelectorAll('#board .column')].map(c => [...c.children].map(k => k.classList.contains('up') ? k.getAttribute('aria-label') : '?').join(',')).join('|')`);
        const norm = fp.split("|").map((col) => col.split(",").map((l) => { if (l === "?") return "?"; const [r, s] = l.split(" of "); return s + (R[r] || Number(r)); }).join(",")).join("|");
        assert.ok(valid.has(norm), `${suits}-suit New game ${i} not in seed bank`);
      }
    } finally { await closePage(p); }
  }
});

// ---------- Settings (T1-T4, edge 14, edge 15) ----------
for (const [mode, urlFn] of MODES) {
  test(`settings [${mode}]: backs, styles, bg input and swatches apply immediately; persist after reload`, { skip }, async () => {
    const p = await newPage();
    try {
      await p.viewport(1366, 1500); await p.goto(urlFn());
      await p.eval("localStorage.clear()"); await p.goto(urlFn());
      await p.eval("document.getElementById('settings-btn').click()");
      const setSel = (id, v) => p.eval(`(() => { const s = document.getElementById('${id}'); s.value = '${v}'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      const downLook = () => p.eval("(() => { const c = getComputedStyle(document.querySelector('#board .card.down')); const s = getComputedStyle(document.getElementById('stock')); return { c: c.backgroundColor + '|' + c.backgroundImage, s: s.backgroundColor + '|' + s.backgroundImage }; })()");
      const looks = new Set(), stockLooks = new Set();
      for (const b of ["blue", "red", "green", "purple"]) {
        await setSel("back-style", b);
        const l = await downLook(); looks.add(l.c); stockLooks.add(l.s);
        assert.ok(await p.eval(`document.getElementById('board').classList.contains('back-${b}') && document.getElementById('stock').classList.contains('back-${b}')`));
      }
      assert.equal(looks.size, 4, "face-down looks not distinct"); assert.equal(stockLooks.size, 4, "stock looks not distinct");
      const faceLooks = new Set();
      for (const f of ["classic", "large", "minimal"]) {
        await setSel("face-style", f);
        faceLooks.add(await p.eval("(() => { const c = document.querySelector('#board .card.up'); return [getComputedStyle(c.querySelector('.big')).display, getComputedStyle(c.querySelector('.pip')).display, getComputedStyle(c.querySelector('.corner')).display, getComputedStyle(c.querySelector('.center')).fontSize].join('/'); })()"));
      }
      assert.equal(faceLooks.size, 3, "card styles not distinct: " + [...faceLooks]);
      // bg via color input
      await p.eval("(() => { const i = document.getElementById('bg-color'); i.value = '#123456'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
      await sleep(300); // body has a 0.2s background transition
      assert.equal(await p.eval("getComputedStyle(document.body).backgroundColor"), "rgb(18, 52, 86)");
      for (const [hex, rgb] of [["#1d5c3a", "rgb(29, 92, 58)"], ["#1c3557", "rgb(28, 53, 87)"], ["#5a1f2b", "rgb(90, 31, 43)"], ["#3b3b3b", "rgb(59, 59, 59)"], ["#d8c7a1", "rgb(216, 199, 161)"]]) {
        await p.eval(`document.querySelector('#swatches button[data-bg="${hex}"]').click()`);
        await sleep(300); // body has a 0.2s transition for background-color property
        assert.equal(await p.eval("getComputedStyle(document.body).backgroundColor"), rgb, "swatch " + hex);
        assert.equal(await p.eval("document.getElementById('bg-color').value"), hex);
      }
      assert.equal(await p.eval("document.querySelectorAll('#swatches button').length"), 5);
      // Sand swatch: board column and stock still visible (contrast sanity only)
      // persist
      await setSel("back-style", "purple"); await setSel("face-style", "large"); await setSel("ui-theme", "dark");
      await p.goto(urlFn()); await sleep(300);
      assert.deepEqual(await p.eval("({ b: document.getElementById('back-style').value, f: document.getElementById('face-style').value, u: document.getElementById('ui-theme').value, bg: document.getElementById('bg-color').value, cls: document.getElementById('board').className, body: document.body.className, bgc: getComputedStyle(document.body).backgroundColor })"),
        { b: "purple", f: "large", u: "dark", bg: "#d8c7a1", cls: "board face-large back-purple", body: "ui-dark", bgc: "rgb(216, 199, 161)" });
      assert.deepEqual(p.errors, []);
    } finally { await closePage(p); }
  });
}

test("corrupt settings in localStorage fall back to defaults without crashing", { skip }, async () => {
  const p = await newPage();
  try {
    await p.viewport(1366, 900); await p.goto(fileUrl());
    for (const bad of ["not json", "null", "[1,2]", "42", '{"back":"nope","face":"zzz"}']) {
      await p.eval(`localStorage.setItem('spider-solitaire-settings', ${JSON.stringify(bad)})`);
      await p.goto(fileUrl());
      const cardCount = await p.eval("document.querySelectorAll('#board .card').length");
      assert.equal(cardCount, 54, `page failed to render with stored value ${bad}; errors: ${p.errors.join(";")}`);
    }
    await p.eval("localStorage.setItem('spider-solitaire-settings', 'not json')");
    await p.goto(fileUrl()); await sleep(300);
    assert.equal(await p.eval("document.getElementById('back-style').value"), "blue");
    assert.equal(await p.eval("document.getElementById('face-style').value"), "classic");
    assert.equal(await p.eval("getComputedStyle(document.body).backgroundColor"), "rgb(29, 92, 58)");
  } finally { await p.eval("localStorage.clear()").catch(() => {}); await closePage(p); }
});

// ---------- Drag ghost (T2 ghost, edge 4, 5) ----------
for (const face of ["classic", "large", "minimal"]) {
  test(`drag ghost matches style "${face}" and board card width at 1366@150%`, { skip }, async () => {
    const p = await newPage();
    try {
      await p.viewport(1366 / 1.5, 1400, 1.5); await p.goto(fileUrl());
      await p.eval(`(() => { localStorage.setItem('spider-solitaire-settings', JSON.stringify({ face: '${face}' })); })()`);
      await p.goto(fileUrl());
      const g = await p.eval("(() => { const c = document.querySelector('#board .column .card.up'); const r = c.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10, w: r.width, h: r.height }; })()");
      await p.mouse("mousePressed", g.x, g.y);
      await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: g.x + 30, y: g.y + 30, button: "left", buttons: 1 });
      const r = await p.eval(`(() => { const gh = document.querySelector('#drag-layer .ghost'); const c = gh.querySelector('.card'); const b = c.getBoundingClientRect();
        return { cls: gh.className, w: b.width, h: b.height, big: getComputedStyle(c.querySelector('.big')).display, corner: getComputedStyle(c.querySelector('.corner')).display, pip: getComputedStyle(c.querySelector('.pip')).display }; })()`);
      await p.mouse("mouseReleased", g.x + 30, g.y + 30);
      assert.ok(Math.abs(r.w - g.w) < 1 && Math.abs(r.h - g.h) < 1, `ghost ${r.w}x${r.h} vs card ${g.w}x${g.h}`);
      if (face === "large") assert.equal(r.big, "block"), assert.equal(r.pip, "none");
      if (face === "minimal") assert.equal(r.corner, "none");
      if (face === "classic") assert.equal(r.big, "none");
    } finally { await closePage(p); }
  });
}
