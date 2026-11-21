/* Pure helpers for the animated stock deal: flight plan, timing, input guard. No DOM access. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SpiderDealAnim = api;
  }
})(typeof self !== "undefined" ? self : globalThis, function () {
  const DEAL_CARD_MS = 300; // one card's flight
  const DEAL_STAGGER_MS = 60; // delay between one card's start and the next

  function dealPlan(prev, next, options) {
    const opts = options || {};
    if (opts.reduceMotion) return null;
    if (!prev || !next) return null;
    const n = prev.columns.length;
    if (prev.stock.length - next.stock.length !== n) return null;
    const cardMs = opts.cardMs === undefined ? DEAL_CARD_MS : opts.cardMs;
    const staggerMs = opts.staggerMs === undefined ? DEAL_STAGGER_MS : opts.staggerMs;
    const steps = [];
    for (let c = 0; c < n; c++) {
      const src = prev.stock[prev.stock.length - 1 - c];
      steps.push({
        col: c,
        card: { ...src, faceUp: true },
        delay: c * staggerMs,
        duration: cardMs,
        landIndex: next.columns[c].length === prev.columns[c].length + 1 ? prev.columns[c].length : -1,
      });
    }
    return steps;
  }

  function dealDuration(steps) {
    if (!steps || steps.length === 0) return 0;
    return Math.max(...steps.map((s) => s.delay + s.duration));
  }

  function createDealGuard() {
    let token = 0;
    let busy = false;
    return {
      begin() {
        token += 1;
        busy = true;
        return token;
      },
      isCurrent(t) {
        return busy && t === token;
      },
      end(t) {
        if (busy && t === token) {
          busy = false;
          return true;
        }
        return false;
      },
      cancel() {
        busy = false;
        token += 1;
      },
      isBusy() {
        return busy;
      },
    };
  }

  return { DEAL_CARD_MS, DEAL_STAGGER_MS, dealPlan, dealDuration, createDealGuard };
});
