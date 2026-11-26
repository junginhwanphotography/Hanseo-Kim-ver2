/**
 * Pure scatter packing shared by the build (home-layout) and the browser.
 * Coordinates are relative to the inner board (padX is applied by the caller).
 */

function unitRand(seed) {
  let t = (seed >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function itemSeed(key, index) {
  const text = String(key || index);
  let h = 2166136261 ^ (index * 2654435761);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {Array<{ key: string, ratio: number }>} items
 * @param {{ boardW: number, homeMobile?: boolean }} options
 * @returns {{ height: number, boxes: Array<{ left: number, top: number, width: number, height: number, rotate: number, key: string }> }}
 */
function packScatter(items, options) {
  const boardW = Math.max(160, options.boardW || 1000);
  const homeMobile = !!options.homeMobile;
  const gutter = homeMobile ? 8 : 7;
  const fracs = homeMobile
    ? [0.48, 0.38, 0.42, 0.32, 0.5, 0.36, 0.44, 0.3, 0.46, 0.4, 0.34, 0.28]
    : [0.38, 0.24, 0.3, 0.2, 0.42, 0.26, 0.34, 0.22, 0.46, 0.28, 0.32, 0.18];
  const placed = [];
  const BAND = 128;
  const bands = Object.create(null);
  let maxBottom = 0;
  const step = Math.max(homeMobile ? 5 : 6, gutter - (homeMobile ? 2 : 0));
  const boxes = [];

  function bandOf(y) {
    return (y / BAND) | 0;
  }

  function addPlaced(box) {
    placed.push(box);
    const a = bandOf(box.top);
    const b = bandOf(box.bottom);
    for (let i = a; i <= b; i++) {
      if (!bands[i]) bands[i] = [];
      bands[i].push(box);
    }
  }

  function collides(left, top, w, h) {
    const right = left + w;
    const bottom = top + h;
    const a = bandOf(Math.max(0, top - gutter));
    const b = bandOf(bottom + gutter);
    for (let i = a; i <= b; i++) {
      const list = bands[i];
      if (!list) continue;
      for (let j = 0; j < list.length; j++) {
        const p = list[j];
        if (
          left < p.right + gutter &&
          right + gutter > p.left &&
          top < p.bottom + gutter &&
          bottom + gutter > p.top
        ) {
          return true;
        }
      }
    }
    return false;
  }

  items.forEach((item, index) => {
    const seed = itemSeed(item.key, index);
    const r0 = unitRand(seed);
    const r1 = unitRand(seed ^ 0x9e3779b9);
    const r2 = unitRand(seed ^ 0x85ebca6b);
    const r3 = unitRand(seed ^ 0xc2b2ae35);

    let frac = fracs[index % fracs.length];
    // Home mobile: larger tiles so fewer are on-screen while scrolling.
    if (homeMobile) frac = 0.36 + r0 * 0.28;
    let itemW = Math.round(boardW * frac);
    itemW = Math.max(homeMobile ? 132 : 140, Math.min(boardW, itemW));
    const ratio = item.ratio > 0 ? item.ratio : 2 / 3;
    const itemH = Math.max(1, Math.round(ratio * itemW));
    const lean = homeMobile ? 0.02 + r1 * 0.9 : index % 2 === 0 ? 0.06 : 0.58;
    const prefer = Math.round(lean * Math.max(1, boardW - itemW));
    const yJitter = homeMobile ? Math.round((r2 - 0.5) * 18) : 0;

    const lefts = [];
    const seenLeft = Object.create(null);
    function pushLeft(x) {
      const left = Math.max(0, Math.min(boardW - itemW, Math.round(x)));
      if (seenLeft[left]) return;
      seenLeft[left] = 1;
      lefts.push(left);
    }
    pushLeft(prefer);
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      pushLeft(p.right + gutter);
      pushLeft(p.left - gutter - itemW);
    }
    for (let x = 0; x <= boardW - itemW; x += step) pushLeft(x);
    if (homeMobile && r3 > 0.45 && lefts.length > 1) {
      const head = lefts[0];
      const rest = lefts.slice(1).reverse();
      lefts.length = 0;
      lefts.push(head);
      for (let i = 0; i < rest.length; i++) lefts.push(rest[i]);
    }

    let best = null;
    const limit = Math.max(maxBottom + itemH + gutter * 4, itemH + 40);
    for (let top = 0; top <= limit && !best; top += step) {
      for (let o = 0; o < lefts.length; o++) {
        const left = lefts[o];
        const tryTop = Math.max(0, top + (top === 0 ? 0 : yJitter));
        if (!collides(left, tryTop, itemW, itemH)) {
          best = { left, top: tryTop };
          break;
        }
        if (yJitter && !collides(left, top, itemW, itemH)) {
          best = { left, top };
          break;
        }
      }
    }
    if (!best) best = { left: 0, top: maxBottom + gutter };
    const rotate = homeMobile
      ? r0 * 7.2 - 3.6 + (r3 * 1.4 - 0.7)
      : ((index % 7) - 3) * (homeMobile ? 1.05 : 1.15);
    const right = best.left + itemW;
    const bottom = best.top + itemH;
    addPlaced({ left: best.left, top: best.top, right, bottom });
    if (bottom > maxBottom) maxBottom = bottom;
    boxes.push({
      key: item.key,
      left: best.left,
      top: best.top,
      width: itemW,
      height: itemH,
      rotate: Math.round(rotate * 100) / 100,
    });
  });

  return {
    height: Math.max(0, maxBottom + gutter + 16),
    boxes,
  };
}

module.exports = { packScatter };
