/*
 * 모바일 최적화 레이아웃 (archived)
 *
 * Saved snapshot of layoutMagnetMobile + layoutBlockMobile for
 * 레이아웃 테스트5 / 테스트6. Not loaded by the site — restore into
 * gallery.js when the user asks to re-enable "모바일 최적화 레이아웃".
 *
 * Test5: vertical-biased magnet scatter from center, denser pack, scrollable height.
 * Test6: portrait jagged flush block recipes with integer edge snapping (no overlaps).
 *
 * These functions expect the same closure helpers as gallery mosaic:
 * items, ratioOf, placeAt, mosaic.
 */
    // Mobile magnet: same center-out scatter as PC, but tall ellipse (vertical first, still some width).
    function layoutMagnetMobile(width) {
      const article = mosaic.closest(".project");
      if (article) article.classList.add("is-magnet-wall");
      const gutter = 3;
      // Narrower+taller board; denser pack than before.
      const boardW = 760;
      const boardH = 1700;
      const cx = boardW / 2;
      const cy = boardH / 2;
      const fracs = [0.46, 0.36, 0.32, 0.3, 0.28, 0.26, 0.24, 0.23, 0.22, 0.21, 0.2, 0.2];
      const rotPad = 3;
      const ringStepX = 18;
      const ringStepY = 34;
      const ringBaseX = 8;
      const ringBaseY = 14;

      function tryPack(sizeMul) {
        const placed = [];
        const boxes = [];

        function collides(left, top, w, h) {
          const aL = left - rotPad;
          const aT = top - rotPad;
          const aR = left + w + rotPad;
          const aB = top + h + rotPad;
          for (let i = 0; i < placed.length; i++) {
            const p = placed[i];
            if (aL < p.right + gutter && aR + gutter > p.left && aT < p.bottom + gutter && aB + gutter > p.top) {
              return true;
            }
          }
          return false;
        }

        function candidates(itemW, itemH, index) {
          const points = [];
          const angle0 = index * 2.15;
          for (let ring = 0; ring <= 32; ring++) {
            const rx = ring === 0 ? 0 : ringBaseX + ring * ringStepX;
            const ry = ring === 0 ? 0 : ringBaseY + ring * ringStepY;
            const count = ring === 0 ? 1 : 10 + ring * 4;
            for (let i = 0; i < count; i++) {
              const a = angle0 + (i / count) * Math.PI * 2 + ring * 0.28;
              const x = Math.round(cx + Math.cos(a) * rx - itemW / 2);
              const y = Math.round(cy + Math.sin(a) * ry - itemH / 2);
              if (x < 0 || y < 0 || x + itemW > boardW || y + itemH > boardH) continue;
              // Prefer up/down arms of the ellipse; still sample left/right.
              points.push({ left: x, top: y, ring, score: Math.abs(Math.cos(a)) });
            }
          }
          points.sort((a, b) => a.ring - b.ring || a.score - b.score);
          return points;
        }

        function findSpot(itemW, itemH, index) {
          const opts = candidates(itemW, itemH, index);
          for (let o = 0; o < opts.length; o++) {
            const p = opts[o];
            if (!collides(p.left, p.top, itemW, itemH)) return p;
          }
          // Vertical-first fallback from center.
          for (let rad = 0; rad < boardH; rad += 4) {
            for (let dx = 0; dx <= rad; dx += 4) {
              for (const sy of [-1, 1]) {
                for (const sx of dx === 0 ? [0] : [-1, 1]) {
                  const left = Math.round(cx + sx * dx - itemW / 2);
                  const top = Math.round(cy + sy * rad - itemH / 2);
                  if (left < 0 || top < 0 || left + itemW > boardW || top + itemH > boardH) continue;
                  if (!collides(left, top, itemW, itemH)) return { left, top };
                }
              }
            }
          }
          return null;
        }

        for (let index = 0; index < items.length; index++) {
          const item = items[index];
          let itemW = Math.round(boardW * fracs[Math.min(index, fracs.length - 1)] * sizeMul);
          itemW = Math.max(120, Math.min(Math.round(boardW * 0.52 * sizeMul), itemW));
          const itemH = Math.max(1, Math.round(ratioOf(item) * itemW));
          const best = findSpot(itemW, itemH, index);
          if (!best) return null;
          placed.push({
            left: best.left - rotPad,
            top: best.top - rotPad,
            right: best.left + itemW + rotPad,
            bottom: best.top + itemH + rotPad,
          });
          boxes.push({ item, left: best.left, top: best.top, w: itemW, h: itemH, index });
        }
        return boxes;
      }

      let boxes = null;
      for (let mul = 1; mul >= 0.4; mul -= 0.05) {
        boxes = tryPack(mul);
        if (boxes) break;
      }
      if (!boxes) boxes = tryPack(0.35) || [];

      let minX = Infinity;
      let minY = Infinity;
      let maxX = 0;
      let maxY = 0;
      boxes.forEach((box) => {
        minX = Math.min(minX, box.left);
        minY = Math.min(minY, box.top);
        maxX = Math.max(maxX, box.left + box.w);
        maxY = Math.max(maxY, box.top + box.h);
      });
      const clusterW = Math.max(1, maxX - minX);
      const clusterH = Math.max(1, maxY - minY);
      const pad = 10;
      // Fit width; vertical scatter scrolls.
      const scale = (width - pad * 2) / clusterW;
      const usedW = clusterW * scale;
      const usedH = clusterH * scale;
      const offsetX = (width - usedW) / 2 - minX * scale;
      const offsetY = pad - minY * scale;

      boxes.forEach((box) => {
        placeAt(box.item, offsetX + box.left * scale, offsetY + box.top * scale, box.w * scale);
        const tilt = ((box.index % 7) - 3) * 0.55;
        box.item.el.style.transform = "rotate(" + tilt + "deg)";
        box.item.el.style.zIndex = String(items.length - box.index);
        box.item.el.classList.add("is-scatter", "is-magnet");
      });
      mosaic.style.height = usedH + pad * 2 + "px";
    }

    // Mobile block: same flush/jagged language as PC — airy silhouette, not a solid brick wall.
    function layoutBlockMobile(width) {
      const article = mosaic.closest(".project");
      if (article) article.classList.add("is-magnet-wall");
      // Portrait remakes of the desktop recipes: edge-aligned tiles, intentional notches/gaps.
      const recipes = {
        8: [
          [1, 0, 5, 3],
          [6, 1, 3, 4],
          [0, 3, 3, 3],
          [3, 3, 3, 2],
          [6, 5, 3, 3],
          [1, 6, 4, 3],
          [0, 9, 3, 3],
          [3, 9, 5, 3],
        ],
        9: [
          [1, 0, 4, 3],
          [5, 0, 3, 2],
          [5, 2, 4, 3],
          [0, 3, 3, 3],
          [3, 3, 2, 2],
          [1, 6, 4, 3],
          [5, 5, 3, 3],
          [0, 9, 3, 3],
          [3, 9, 5, 3],
        ],
        10: [
          [1, 0, 5, 3],
          [6, 0, 3, 4],
          [0, 3, 3, 3],
          [3, 3, 3, 2],
          [6, 4, 3, 3],
          [1, 6, 3, 3],
          [4, 5, 2, 2],
          [4, 7, 5, 2],
          [0, 9, 4, 3],
          [4, 9, 3, 3],
        ],
        11: [
          [1, 0, 5, 3],
          [6, 0, 3, 4],
          [0, 3, 3, 3],
          [3, 3, 3, 2],
          [6, 4, 3, 3],
          [1, 6, 4, 3],
          [5, 7, 2, 2],
          [7, 7, 2, 3],
          [0, 9, 3, 3],
          [3, 9, 4, 2],
          [3, 11, 5, 3],
        ],
        12: [
          [1, 0, 4, 3],
          [5, 0, 3, 2],
          [5, 2, 4, 3],
          [0, 3, 3, 3],
          [3, 3, 2, 2],
          [1, 6, 3, 3],
          [4, 5, 3, 3],
          [7, 5, 2, 3],
          [0, 9, 4, 2],
          [4, 8, 3, 3],
          [7, 9, 2, 2],
          [2, 11, 5, 3],
        ],
      };

      const n = items.length;
      let slots = recipes[n];
      if (!slots) {
        slots = [];
        let cursor = 1;
        let row = 0;
        items.forEach((item) => {
          const ratio = ratioOf(item);
          const cw = ratio < 0.85 ? 4 : ratio > 1.2 ? 3 : 4;
          const ch = ratio < 0.85 ? 3 : ratio > 1.2 ? 4 : 3;
          if (cursor + cw > 9) {
            cursor = 1;
            row += 3;
          }
          slots.push([cursor, row, cw, ch]);
          cursor += cw;
        });
      }

      const pool = items.map((item, index) => ({ item, index, ratio: ratioOf(item) }));
      const assigned = new Array(slots.length);
      const slotMeta = slots.map((s, i) => ({ i, w: s[2], h: s[3], ar: s[3] / s[2] }));
      slotMeta.sort((a, b) => b.w * b.h - a.w * a.h);
      slotMeta.forEach((slot) => {
        let best = -1;
        let bestScore = Infinity;
        for (let p = 0; p < pool.length; p++) {
          if (!pool[p]) continue;
          const score = Math.abs(Math.log((pool[p].ratio || 1) / slot.ar));
          if (score < bestScore) {
            bestScore = score;
            best = p;
          }
        }
        assigned[slot.i] = pool[best];
        pool[best] = null;
      });

      let maxGX = 0;
      let maxGY = 0;
      let minGX = Infinity;
      let minGY = Infinity;
      slots.forEach((s) => {
        minGX = Math.min(minGX, s[0]);
        minGY = Math.min(minGY, s[1]);
        maxGX = Math.max(maxGX, s[0] + s[2]);
        maxGY = Math.max(maxGY, s[1] + s[3]);
      });

      const pad = 16;
      const spanX = Math.max(1, maxGX - minGX);
      const spanY = Math.max(1, maxGY - minGY);
      // Integer unit + edge snapping so neighboring tiles never overlap from rounding.
      const unit = Math.floor((width - pad * 2) / spanX);
      const usedW = spanX * unit;
      const usedH = spanY * unit;
      const originX = Math.round((width - usedW) / 2) - minGX * unit;
      const originY = pad - minGY * unit;
      function edgeX(g) {
        return originX + g * unit;
      }
      function edgeY(g) {
        return originY + g * unit;
      }

      slots.forEach((s, i) => {
        const photo = assigned[i];
        if (!photo) return;
        const left = edgeX(s[0]);
        const top = edgeY(s[1]);
        const w = edgeX(s[0] + s[2]) - left;
        const h = edgeY(s[1] + s[3]) - top;
        placeAt(photo.item, left, top, w, h);
        photo.item.el.style.zIndex = String(20 - i);
        photo.item.el.classList.add("is-magnet", "is-block");
      });
      mosaic.style.height = usedH + pad * 2 + "px";
    }

