(function () {
  function makeBackLink(href, label) {
    const link = document.createElement("a");
    link.className = "section-back";
    link.href = href;
    link.setAttribute("aria-label", label || "Back");
    link.innerHTML =
      '<svg viewBox="0 0 56 36" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" d="M24 4 6 18 24 32M9 18h40"/></svg>';
    return link;
  }

  function openPrints(root, project) {
    const images = project.images || [];
    root.replaceChildren();
    const article = document.createElement("article");
    article.className = "book-show";
    const caption = document.createElement("p");
    caption.className = "book-caption";
    const lines = [project.title || project.id || ""];
    if (project.text) lines.push(project.text);
    lines.filter(Boolean).forEach((line, lineIndex) => {
      String(line)
        .split("\n")
        .forEach((part, partIndex) => {
          if (lineIndex || partIndex) caption.appendChild(document.createElement("br"));
          caption.appendChild(document.createTextNode(part));
        });
    });
    const frame = document.createElement("div");
    frame.className = "book-frame";
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.alt = project.title || "";
    img.decoding = "async";
    figure.appendChild(img);
    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "book-arrow is-prev";
    prev.setAttribute("aria-label", "Previous");
    prev.innerHTML =
      '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M67.37,100L28.195,50,67.37,0,71.8,5.5,37.581,50,71.8,94.5Z"></path></svg>';
    const next = document.createElement("button");
    next.type = "button";
    next.className = "book-arrow is-next";
    next.setAttribute("aria-label", "Next");
    next.innerHTML =
      '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M32.63,0,71.805,50,32.63,100,28.2,94.5,62.419,50,28.2,5.5Z"></path></svg>';
    frame.append(prev, figure, next);
    const dots = document.createElement("div");
    dots.className = "book-dots";
    const dotButtons = images.map((_, dotIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", "View slide " + (dotIndex + 1));
      button.addEventListener("click", () => show(dotIndex));
      dots.appendChild(button);
      return button;
    });
    article.append(caption, frame, dots, makeBackLink("#books", "Back to books"));
    root.appendChild(article);

    let index = 0;
    let token = 0;
    let touchStart = null;

    function show(nextIndex) {
      if (!images.length) return;
      index = Math.max(0, Math.min(images.length - 1, nextIndex));
      dotButtons.forEach((button, dotIndex) => {
        const on = dotIndex === index;
        button.classList.toggle("is-on", on);
        if (on) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
      });
      prev.disabled = index <= 0;
      next.disabled = index >= images.length - 1;
      const current = ++token;
      img.style.opacity = "0";
      const reveal = () => {
        if (current !== token) return;
        img.style.opacity = "1";
      };
      img.src = images[index];
      if (img.complete && img.naturalWidth) reveal();
      else img.addEventListener("load", reveal, { once: true });
    }

    function step(direction) {
      show(index + direction);
    }

    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));

    function onKey(event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    }

    function onTouchStart(event) {
      if (!event.changedTouches.length) return;
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchEnd(event) {
      if (!touchStart || !event.changedTouches.length) {
        touchStart = null;
        return;
      }
      const touch = event.changedTouches[0];
      const dx = touchStart.x - touch.clientX;
      const dy = touchStart.y - touch.clientY;
      touchStart = null;
      if (Math.abs(dx) < 28 || Math.abs(dx) < Math.abs(dy)) return;
      step(dx > 0 ? 1 : -1);
    }

    window.addEventListener("keydown", onKey);
    frame.addEventListener("touchstart", onTouchStart, { passive: true });
    frame.addEventListener("touchend", onTouchEnd, { passive: true });
    show(0);

    return {
      destroy() {
        window.removeEventListener("keydown", onKey);
      },
    };
  }

  function thumbUrlFor(src, kind) {
    const parts = String(src || "")
      .normalize("NFC")
      .split("/")
      .filter(Boolean);
    if (parts.length < 3) return "";
    let collectionId = parts[1];
    let file = parts[parts.length - 1];
    try {
      collectionId = decodeURIComponent(collectionId);
      file = decodeURIComponent(file);
    } catch (error) {
      // Keep raw path segments when the URL is not encoded.
    }
    const stem = file.replace(/\.[^.]+$/, "");
    if (!collectionId || !stem) return "";
    // sm = mosaic tile, lg = lightbox — encode so Korean folder names resolve.
    const base = "thumbs/" + encodeURIComponent(collectionId) + "/" + encodeURIComponent(stem);
    if (kind === "lg") return base + ".webp?v=8";
    return base + ".sm.webp?v=8";
  }

  function manifestKeyFor(src) {
    const parts = String(src || "")
      .normalize("NFC")
      .split("/")
      .filter(Boolean);
    if (parts.length < 3) return "";
    let collectionId = parts[1];
    let file = parts[parts.length - 1];
    try {
      collectionId = decodeURIComponent(collectionId);
      file = decodeURIComponent(file);
    } catch (error) {
      // Keep raw path segments when the URL is not encoded.
    }
    return collectionId + "/" + file;
  }

  let thumbManifestPromise = null;
  function loadThumbManifest() {
    if (!thumbManifestPromise) {
      const boot = window.__hanseoBoot && window.__hanseoBoot.manifest;
      thumbManifestPromise = (boot || fetch("thumbs/manifest.json").then((res) => (res.ok ? res.json() : {}))).catch(
        () => ({})
      );
    }
    return thumbManifestPromise;
  }

  function open(root, project, options) {
    if (options && options.layout === "prints") return openPrints(root, project);
    root.replaceChildren();
    const images = project.images || [];
    const isScatterHome = options && options.layout === "scatter";
    const article = document.createElement("article");
    article.className = "project";
    const showLabel = !options || options.label !== false;
    const label = document.createElement("p");
    label.className = "project-label";
    label.append(document.createTextNode(project.title || project.id || ""));
    label.append(document.createElement("br"));
    label.append(document.createTextNode(project.year || ""));
    const mosaic = document.createElement("div");
    mosaic.className = "mosaic";
    const ratioHints = Object.create(null);
    const items = images.map((src, photoIndex) => {
      const figure = document.createElement("figure");
      figure.className = "mosaic-item is-pending";
      const img = document.createElement("img");
      img.alt = project.title || "";
      img.decoding = "async";
      const mosaicThumb = thumbUrlFor(src, "sm") || thumbUrlFor(src, "lg") || src;
      const lightboxThumb = thumbUrlFor(src, "lg") || mosaicThumb;
      const display = mosaicThumb;
      const key = manifestKeyFor(src);
      img.dataset.full = src;
      img.dataset.display = display;
      // src is assigned after the first layout so lazy loading sees real positions.
      img.addEventListener("error", () => {
        const current = img.getAttribute("src") || "";
        if (img.dataset.fellBack === "2") return;
        if (!img.dataset.fellBack) {
          img.dataset.fellBack = "1";
          if (lightboxThumb && current !== lightboxThumb) {
            img.src = lightboxThumb;
            return;
          }
        }
        img.dataset.fellBack = "2";
        if (current !== src) img.src = src;
      });
      img.addEventListener("load", () => {
        figure.classList.remove("is-pending");
        if (!ratioHints[key]) scheduleSoft();
      });
      figure.addEventListener("click", () => openViewer(photoIndex));
      figure.appendChild(img);
      mosaic.appendChild(figure);
      return { el: figure, img, src, display, lightbox: lightboxThumb, key };
    });
    if (showLabel) article.append(label);
    article.append(mosaic);
    if (project && project.id) {
      article.append(makeBackLink("#photographs", "Back to photographs"));
    }
    root.appendChild(article);

    let frame = 0;
    let softTimer = 0;
    let stage = null;
    let lastWidth = -1;
    let lazyObserver = null;
    let idlePrefetchTimer = 0;
    let idlePrefetchHandle = 0;
    let idlePrefetchStopped = false;
    let idlePrefetchOnScroll = null;
    const homeLayout = isScatterHome && project.homeLayout ? project.homeLayout : null;
    function ratioOf(item) {
      if (item.key && ratioHints[item.key]) return ratioHints[item.key];
      const nw = item.img.naturalWidth || 3;
      const nh = item.img.naturalHeight || 2;
      return nh / nw;
    }

    function placeAt(item, left, top, itemWidth, fixedHeight) {
      const itemHeight =
        fixedHeight != null ? Math.max(1, Math.round(fixedHeight)) : Math.max(1, Math.round(ratioOf(item) * itemWidth));
      item.el.style.left = Math.round(left) + "px";
      item.el.style.top = Math.round(top) + "px";
      item.el.style.width = Math.round(itemWidth) + "px";
      item.el.style.height = itemHeight + "px";
      item.el.style.transform = "";
      item.el.style.zIndex = "";
      item.el.classList.remove("is-scatter", "is-magnet", "is-block");
      return itemHeight;
    }

    function applyHomeLayout(width) {
      if (!homeLayout) return false;
      const narrow = width < 720;
      const pack = narrow ? homeLayout.mobile : homeLayout.desktop;
      if (!pack || !pack.boxes || pack.boxes.length !== items.length || !pack.boardW) return false;
      const padX = narrow ? 10 : 0;
      const boardW = Math.max(160, width - padX * 2);
      const scale = boardW / pack.boardW;
      items.forEach((item, index) => {
        const box = pack.boxes[index];
        const itemW = Math.max(1, Math.round(box.width * scale));
        const itemH = Math.max(1, Math.round(box.height * scale));
        const left = Math.round(box.left * scale) + padX;
        const top = Math.round(box.top * scale);
        placeAt(item, left, top, itemW, itemH);
        item.el.style.transform = "rotate(" + box.rotate + "deg)";
        item.el.classList.add("is-scatter");
      });
      mosaic.style.height = Math.max(0, Math.round(pack.height * scale) + 16) + "px";
      return true;
    }

    // Scattered wall collage: irregular sizes, slight tilt, tiny gaps, no overlap.
    // Mobile sizes follow the 레이아웃 테스트4 phone reference (2–3 across, print-table denseness).
    // Desktop sizes stay as-is. Home mobile gets seeded size/lean/tilt jitter.
    function layoutScatter(width) {
      const narrow = width < 720;
      const collectionSeed = Number(project.layoutSeed) >>> 0;
      // Same home collage rules; collectionSeed only shifts the pack so collections differ.
      const homeMobile = narrow && (isScatterHome || collectionSeed > 0);
      const padX = narrow ? 10 : 0;
      const boardW = Math.max(160, width - padX * 2);
      const gutter = narrow ? 8 : 7;
      const fracs = narrow
        ? [0.48, 0.38, 0.42, 0.32, 0.5, 0.36, 0.44, 0.3, 0.46, 0.4, 0.34, 0.28]
        : [0.38, 0.24, 0.3, 0.2, 0.42, 0.26, 0.34, 0.22, 0.46, 0.28, 0.32, 0.18];
      const placed = [];
      const BAND = 128;
      const bands = Object.create(null);
      let maxBottom = 0;
      const step = Math.max(narrow ? 5 : 6, gutter - (narrow ? 2 : 0));

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

      function unitRand(seed) {
        let t = (seed >>> 0) + 0x6d2b79f5;
        t = Math.imul(t ^ (t >>> 15), 1 | t);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }

      function itemSeed(item, index) {
        const key = String(item.src || item.key || index);
        let h = 2166136261 ^ (index * 2654435761) ^ collectionSeed;
        for (let i = 0; i < key.length; i++) {
          h ^= key.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return h >>> 0;
      }

      items.forEach((item, index) => {
        const seed = itemSeed(item, index);
        const r0 = unitRand(seed);
        const r1 = unitRand(seed ^ 0x9e3779b9);
        const r2 = unitRand(seed ^ 0x85ebca6b);
        const r3 = unitRand(seed ^ 0xc2b2ae35);

        let frac = fracs[index % fracs.length];
        if (isScatterHome && narrow) {
          // Home mobile: larger tiles so fewer load in view while scrolling.
          frac = 0.36 + r0 * 0.28;
        } else if (homeMobile) {
          frac = 0.26 + r0 * 0.28;
        } else if (collectionSeed) {
          frac = fracs[Math.floor(r0 * fracs.length) % fracs.length];
        }
        let itemW = Math.round(boardW * frac);
        itemW = Math.max(narrow ? (isScatterHome ? 132 : 108) : 140, Math.min(boardW, itemW));
        const itemH = Math.max(1, Math.round(ratioOf(item) * itemW));
        const lean = homeMobile || collectionSeed
          ? 0.02 + r1 * 0.9
          : index % 2 === 0
            ? 0.06
            : 0.58;
        const prefer = Math.round(lean * Math.max(1, boardW - itemW));
        const yJitter = homeMobile ? Math.round((r2 - 0.5) * 18) : collectionSeed ? Math.round((r2 - 0.5) * 10) : 0;

        // Build left candidates once per item (not once per top row).
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
        if ((homeMobile || collectionSeed) && r3 > 0.45 && lefts.length > 1) {
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
        const absLeft = best.left + padX;
        placeAt(item, absLeft, best.top, itemW);
        const tilt = homeMobile || collectionSeed
          ? (r0 * 7.2 - 3.6) + (r3 * 1.4 - 0.7)
          : ((index % 7) - 3) * (narrow ? 1.05 : 1.15);
        item.el.style.transform = "rotate(" + tilt.toFixed(2) + "deg)";
        item.el.classList.add("is-scatter");
        const right = best.left + itemW;
        const bottom = best.top + itemH;
        addPlaced({ left: best.left, top: best.top, right, bottom });
        if (bottom > maxBottom) maxBottom = bottom;
      });
      mosaic.style.height = Math.max(0, maxBottom + gutter + 16) + "px";
    }

    // Photographer magnet wall: modular tiles flush like the reference (레이아웃 테스트6).
    function layoutBlockPack(width) {
      const article = mosaic.closest(".project");
      if (article) article.classList.add("is-magnet-wall");

      const recipes = {
        8: [
          [1, 0, 5, 3],
          [6, 0, 3, 4],
          [9, 1, 4, 3],
          [13, 0, 3, 2],
          [0, 3, 3, 3],
          [3, 3, 3, 2],
          [9, 4, 3, 3],
          [12, 2, 4, 3],
        ],
        9: [
          [0, 1, 4, 3],
          [4, 0, 5, 4],
          [9, 0, 3, 2],
          [12, 1, 4, 3],
          [9, 2, 3, 3],
          [1, 4, 3, 3],
          [4, 4, 2, 2],
          [6, 4, 3, 3],
          [12, 4, 3, 2],
        ],
        10: [
          [0, 0, 4, 3],
          [4, 0, 3, 5],
          [7, 0, 4, 2],
          [11, 0, 3, 3],
          [14, 1, 3, 3],
          [7, 2, 4, 3],
          [0, 3, 2, 3],
          [2, 3, 2, 2],
          [11, 3, 3, 2],
          [2, 5, 9, 2],
        ],
        11: [
          [1, 0, 5, 3],
          [6, 0, 3, 5],
          [9, 0, 4, 2],
          [13, 1, 4, 3],
          [9, 2, 4, 3],
          [0, 3, 3, 3],
          [3, 3, 3, 2],
          [3, 5, 3, 2],
          [6, 5, 3, 2],
          [9, 5, 3, 3],
          [12, 4, 4, 2],
        ],
        12: [
          [0, 1, 4, 3],
          [4, 0, 5, 4],
          [9, 0, 3, 2],
          [12, 0, 3, 3],
          [15, 1, 3, 3],
          [9, 2, 3, 3],
          [12, 3, 3, 2],
          [0, 4, 2, 3],
          [2, 4, 2, 2],
          [4, 4, 5, 2],
          [9, 5, 3, 2],
          [12, 5, 4, 3],
        ],
        15: [
          [1, 0, 4, 3],
          [5, 0, 3, 4],
          [8, 0, 4, 2],
          [12, 0, 3, 3],
          [15, 1, 3, 3],
          [8, 2, 2, 3],
          [10, 2, 2, 2],
          [12, 3, 3, 2],
          [0, 3, 3, 3],
          [3, 3, 2, 2],
          [3, 5, 2, 2],
          [5, 4, 3, 3],
          [8, 5, 2, 2],
          [10, 4, 2, 3],
          [12, 5, 6, 2],
        ],
      };

      const n = items.length;
      let slots = recipes[n];
      if (!slots) {
        const cols = 16;
        slots = [];
        let cursor = 0;
        let row = 0;
        items.forEach((item) => {
          const ratio = ratioOf(item);
          const cw = ratio < 0.85 ? 5 : ratio > 1.2 ? 3 : 4;
          const ch = ratio < 0.85 ? 3 : ratio > 1.2 ? 4 : 3;
          if (cursor + cw > cols) {
            cursor = 0;
            row += 3;
          }
          slots.push([cursor, row, cw, ch]);
          cursor += cw;
        });
      }

      const pool = items.map((item, index) => ({ item, index, ratio: ratioOf(item) }));
      const assigned = new Array(slots.length);
      const slotMeta = slots.map((s, i) => ({ i, x: s[0], y: s[1], w: s[2], h: s[3], ar: s[3] / s[2] }));
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
      slots.forEach((s) => {
        maxGX = Math.max(maxGX, s[0] + s[2]);
        maxGY = Math.max(maxGY, s[1] + s[3]);
      });

      const label = article && article.querySelector(".project-label");
      const back = article && article.querySelector(".section-back");
      const chrome =
        (label ? label.getBoundingClientRect().height + 20 : 8) +
        (back ? back.getBoundingClientRect().height + 64 : 72) +
        28;
      const viewH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const availH = Math.max(220, Math.floor(viewH - chrome));
      const pad = 18;
      const unit = Math.floor(Math.min((width - pad * 2) / maxGX, (availH - pad * 2) / maxGY));
      const usedW = maxGX * unit;
      const usedH = maxGY * unit;
      const originX = Math.round((width - usedW) / 2);
      const originY = Math.round((availH - usedH) / 2);

      slots.forEach((s, i) => {
        const photo = assigned[i];
        if (!photo) return;
        const left = originX + s[0] * unit;
        const top = originY + s[1] * unit;
        const w = (s[0] + s[2]) * unit + originX - left;
        const h = (s[1] + s[3]) * unit + originY - top;
        placeAt(photo.item, left, top, w, h);
        photo.item.el.style.zIndex = String(20 - i);
        photo.item.el.classList.add("is-magnet", "is-block");
      });
      mosaic.style.height = availH + "px";
    }

    // Magnet wall: higher priority (earlier in order) near center; no overlaps.
    function layoutMagnetWall(width) {
      const article = mosaic.closest(".project");
      if (article) article.classList.add("is-magnet-wall");
      const gutter = 5;
      const boardW = 1600;
      const boardH = 900;
      const cx = boardW / 2;
      const cy = boardH / 2;
      const fracs = [0.3, 0.24, 0.22, 0.2, 0.19, 0.18, 0.17, 0.16, 0.15, 0.15, 0.14, 0.14];
      const rotPad = 5;
      const ringStepX = 30;
      const ringStepY = 20;
      const ringBaseX = 14;
      const ringBaseY = 10;

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
          for (let ring = 0; ring <= 28; ring++) {
            const rx = ring === 0 ? 0 : ringBaseX + ring * ringStepX;
            const ry = ring === 0 ? 0 : ringBaseY + ring * ringStepY;
            const count = ring === 0 ? 1 : 10 + ring * 4;
            for (let i = 0; i < count; i++) {
              const a = angle0 + (i / count) * Math.PI * 2 + ring * 0.28;
              const x = Math.round(cx + Math.cos(a) * rx - itemW / 2);
              const y = Math.round(cy + Math.sin(a) * ry - itemH / 2);
              if (x < 0 || y < 0 || x + itemW > boardW || y + itemH > boardH) continue;
              points.push({ left: x, top: y, ring, score: Math.abs(Math.sin(a)) });
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
          for (let rad = 0; rad < boardW; rad += 4) {
            for (let dy = 0; dy <= rad; dy += 4) {
              for (const sy of dy === 0 ? [0] : [-1, 1]) {
                for (const sx of [-1, 1]) {
                  const left = Math.round(cx + sx * rad - itemW / 2);
                  const top = Math.round(cy + sy * dy - itemH / 2);
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
          itemW = Math.max(80, Math.min(Math.round(boardW * 0.32 * sizeMul), itemW));
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

      const label = article && article.querySelector(".project-label");
      const back = article && article.querySelector(".section-back");
      const chrome =
        (label ? label.getBoundingClientRect().height + 20 : 8) +
        (back ? back.getBoundingClientRect().height + 64 : 72) +
        28;
      const viewH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const availH = Math.max(220, Math.floor(viewH - chrome));
      const pad = 14;
      const scale = Math.min((width - pad * 2) / clusterW, (availH - pad * 2) / clusterH);
      const usedW = clusterW * scale;
      const usedH = clusterH * scale;
      const offsetX = (width - usedW) / 2 - minX * scale;
      const offsetY = (availH - usedH) / 2 - minY * scale;

      boxes.forEach((box) => {
        placeAt(box.item, offsetX + box.left * scale, offsetY + box.top * scale, box.w * scale);
        const tilt = ((box.index % 7) - 3) * 0.55;
        box.item.el.style.transform = "rotate(" + tilt + "deg)";
        box.item.el.style.zIndex = String(items.length - box.index);
        box.item.el.classList.add("is-scatter", "is-magnet");
      });
      mosaic.style.height = availH + "px";
    }

    function layoutMobile(width) {
      const gutter = 6;
      const pool = items.slice();
      let y = 0;
      let block = 0;

      function takePrefer(wantPortrait) {
        const index = pool.findIndex((item) => {
          const portrait = ratioOf(item) >= 1;
          return wantPortrait ? portrait : !portrait;
        });
        if (index < 0) return pool.shift();
        return pool.splice(index, 1)[0];
      }

      function naturalH(item, itemWidth) {
        return Math.max(1, Math.round(ratioOf(item) * itemWidth));
      }

      // Fill each zigzag block so tall side matches the two stacked sides (cover crop).
      while (pool.length) {
        if (pool.length === 1) {
          y += placeAt(pool.shift(), 0, y, width) + gutter;
          break;
        }
        if (pool.length === 2) {
          const half = (width - gutter) / 2;
          const a = pool.shift();
          const b = pool.shift();
          const blockH = Math.max(naturalH(a, half), naturalH(b, half));
          placeAt(a, 0, y, half, blockH);
          placeAt(b, half + gutter, y, half, blockH);
          y += blockH + gutter;
          break;
        }

        const tallLeft = block % 2 === 0;
        block += 1;
        const tallW = Math.round((width - gutter) * 0.42);
        const stackW = width - gutter - tallW;
        const tall = takePrefer(true);
        const a = takePrefer(false);
        const b = takePrefer(false);
        const aNat = naturalH(a, stackW);
        const bNat = naturalH(b, stackW);
        const stackNat = aNat + gutter + bNat;
        const tallNat = naturalH(tall, tallW);
        const blockH = Math.max(tallNat, stackNat);
        const stackInner = Math.max(2, blockH - gutter);
        const aH = Math.max(1, Math.round((stackInner * aNat) / (aNat + bNat)));
        const bH = Math.max(1, stackInner - aH);

        if (tallLeft) {
          placeAt(tall, 0, y, tallW, blockH);
          placeAt(a, tallW + gutter, y, stackW, aH);
          placeAt(b, tallW + gutter, y + aH + gutter, stackW, bH);
        } else {
          placeAt(a, 0, y, stackW, aH);
          placeAt(b, 0, y + aH + gutter, stackW, bH);
          placeAt(tall, stackW + gutter, y, tallW, blockH);
        }
        y += blockH + gutter;
      }
      mosaic.style.height = Math.max(0, y - gutter) + "px";
    }

    function layoutDesktop(width, columns = 3) {
      const collectionId = String(project.id || "").normalize("NFC");
      const gutter =
        collectionId === "레이아웃 테스트3"
          ? 3
          : collectionId === "레이아웃 테스트2"
            ? 6
            : 10;
      const base = Math.floor((width - gutter * (columns - 1)) / columns);
      const heights = Array(columns).fill(0);
      items.forEach((item) => {
        const column = heights.indexOf(Math.min.apply(null, heights));
        const left = (base + gutter) * column;
        const itemWidth = column === columns - 1 ? width - left : base;
        const itemHeight = placeAt(item, left, heights[column], itemWidth);
        heights[column] += itemHeight + gutter;
      });
      const tallest = Math.max.apply(null, heights);
      mosaic.style.height = Math.max(0, tallest - gutter) + "px";
    }

    function layout() {
      const width = mosaic.clientWidth;
      if (width < 20 || !items.length) return;
      const collectionId = String(project.id || "").normalize("NFC");
      // 레이아웃 테스트1–6 keep their fixed experimental layouts.
      if (collectionId === "레이아웃 테스트1") {
        if (width < 720) layoutMobile(width);
        else layoutDesktop(width, 3);
        return;
      }
      if (collectionId === "레이아웃 테스트2") {
        layoutDesktop(width, 2);
        return;
      }
      if (collectionId === "레이아웃 테스트3") {
        layoutDesktop(width, 3);
        return;
      }
      if (collectionId === "레이아웃 테스트4") {
        if (!applyHomeLayout(width)) layoutScatter(width);
        return;
      }
      if (collectionId === "레이아웃 테스트5") {
        layoutMagnetWall(width);
        return;
      }
      if (collectionId === "레이아웃 테스트6") {
        layoutBlockPack(width);
        return;
      }
      // Home and all other collections use the home scatter format.
      if (!applyHomeLayout(width)) layoutScatter(width);
    }

    function runLayout() {
      layout();
      lastWidth = mosaic.clientWidth;
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(runLayout);
    }

    // Only for tiles whose ratio was unknown at first layout.
    function scheduleSoft() {
      if (softTimer) return;
      softTimer = window.setTimeout(() => {
        softTimer = 0;
        schedule();
      }, 32);
    }

    function stopIdlePrefetch() {
      idlePrefetchStopped = true;
      if (idlePrefetchTimer) {
        window.clearTimeout(idlePrefetchTimer);
        idlePrefetchTimer = 0;
      }
      if (idlePrefetchHandle && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idlePrefetchHandle);
        idlePrefetchHandle = 0;
      }
      if (idlePrefetchOnScroll) {
        window.removeEventListener("scroll", idlePrefetchOnScroll, true);
        idlePrefetchOnScroll = null;
      }
    }

    function armViewport() {
      if (lazyObserver) lazyObserver.disconnect();
      stopIdlePrefetch();
      function assignSrc(item, priority) {
        if (item.img.getAttribute("src")) return;
        if (priority) item.img.fetchPriority = priority;
        // After a failed thumb→full fallback, keep using the full file.
        item.img.src = item.img.dataset.fellBack === "2" ? item.src : item.display;
      }
      // First screen stays eager. High priority is only for the two LCP candidates.
      items.forEach((item, index) => {
        if (index >= 8) return;
        item.img.loading = "eager";
        if (index < 2) item.img.fetchPriority = "high";
        assignSrc(item);
      });
      if (!("IntersectionObserver" in window)) {
        items.forEach((item) => assignSrc(item));
        return;
      }
      // Prefetch ~1.75–2 viewports ahead/behind so mid-page scroll rarely waits.
      const prefetchMargin = Math.max(1200, Math.round(window.innerHeight * 1.85));
      lazyObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const item = items.find((entryItem) => entryItem.el === entry.target);
            if (!item) return;
            if (entry.isIntersecting) {
              assignSrc(item);
              return;
            }
            // Unload only on the large home wall. Collection pages are small, and
            // clearing src after a thumb 404→full fallback left permanent gray holes.
            if (!isScatterHome) return;
            const rect = entry.boundingClientRect;
            const far =
              rect.bottom < -window.innerHeight * 1.5 ||
              rect.top > window.innerHeight * 4;
            if (far && item.img.getAttribute("src")) {
              item.img.removeAttribute("src");
              delete item.img.dataset.fellBack;
              item.el.classList.add("is-pending");
            }
          });
        },
        { root: null, rootMargin: prefetchMargin + "px 0px", threshold: 0.01 }
      );
      items.forEach((item, index) => {
        if (index >= 8) lazyObserver.observe(item.el);
      });

      // After the first paint settles, quietly warm the next tiles in small idle batches.
      // Scatter order ≠ visual Y, so pick by on-screen top instead of array index.
      idlePrefetchStopped = false;
      const IDLE_BATCH = 3;
      const IDLE_AHEAD = 4;
      const IDLE_START_MS = 900;
      const IDLE_GAP_MS = 160;

      function scheduleIdlePrefetch(delay) {
        if (idlePrefetchStopped) return;
        if (idlePrefetchTimer) window.clearTimeout(idlePrefetchTimer);
        idlePrefetchTimer = window.setTimeout(() => {
          idlePrefetchTimer = 0;
          if (idlePrefetchStopped) return;
          if (typeof window.requestIdleCallback === "function") {
            idlePrefetchHandle = window.requestIdleCallback(runIdlePrefetch, { timeout: 1200 });
          } else {
            runIdlePrefetch({ timeRemaining: () => 12, didTimeout: true });
          }
        }, delay);
      }

      function runIdlePrefetch(deadline) {
        idlePrefetchHandle = 0;
        if (idlePrefetchStopped) return;
        if (typeof navigator !== "undefined" && navigator.connection && navigator.connection.saveData) {
          return;
        }
        const limit = window.innerHeight * IDLE_AHEAD;
        const pending = [];
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          if (item.img.getAttribute("src")) continue;
          const rect = item.el.getBoundingClientRect();
          if (rect.bottom < -window.innerHeight) continue;
          if (rect.top > limit) continue;
          pending.push({ item, top: rect.top });
        }
        pending.sort((a, b) => a.top - b.top);
        let loaded = 0;
        for (let i = 0; i < pending.length && loaded < IDLE_BATCH; i += 1) {
          if (deadline && typeof deadline.timeRemaining === "function" && deadline.timeRemaining() < 6) {
            break;
          }
          assignSrc(pending[i].item, "low");
          loaded += 1;
        }
        if (loaded) {
          scheduleIdlePrefetch(IDLE_GAP_MS);
          return;
        }
        const stillWaiting = items.some((item) => !item.img.getAttribute("src"));
        if (!stillWaiting) return;
        // Nothing in the ahead band yet — wake again on scroll instead of polling.
        if (!idlePrefetchOnScroll) {
          idlePrefetchOnScroll = () => {
            idlePrefetchOnScroll = null;
            scheduleIdlePrefetch(120);
          };
          window.addEventListener("scroll", idlePrefetchOnScroll, { passive: true, capture: true, once: true });
        }
      }

      scheduleIdlePrefetch(IDLE_START_MS);
    }

    const observer = new ResizeObserver(() => {
      if (mosaic.clientWidth === lastWidth) return;
      schedule();
    });
    observer.observe(mosaic);

    // Lay out immediately with default ratios to avoid CLS, then refine from manifest.
    runLayout();
    armViewport();
    loadThumbManifest().then((manifest) => {
      let changed = false;
      items.forEach((item) => {
        const size = item.key && manifest[item.key];
        if (!size || !size[0] || !size[1]) return;
        const next = size[1] / size[0];
        if (Math.abs((ratioHints[item.key] || 0) - next) > 0.001) changed = true;
        ratioHints[item.key] = next;
      });
      if (changed || homeLayout) runLayout();
      armViewport();
    });

    let slides = [];
    let index = 0;
    let busy = false;
    let touchStart = null;
    let ignoreClick = false;
    let ignoreTimer = 0;
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let gestureScale = 1;
    let drag = null;
    const STEP_LOCK_MS = 140;

    function resetZoom() {
      scale = 1;
      panX = 0;
      panY = 0;
      gestureScale = 1;
      if (stage) stage.classList.remove("is-panning");
      applyZoom();
    }

    function applyZoom() {
      if (!stage) return;
      stage.classList.toggle("is-zoomed", scale > 1.01);
      slides.forEach((slide, n) => {
        if (!slide) return;
        const img = slide.querySelector("img");
        if (!img) return;
        if (n === index) img.style.transform = "translate(" + panX + "px, " + panY + "px) scale(" + scale + ")";
        else img.style.transform = "";
      });
    }

    function setScale(next) {
      scale = Math.min(5, Math.max(1, next));
      if (scale <= 1.01) {
        scale = 1;
        panX = 0;
        panY = 0;
      }
      applyZoom();
    }

    function toggleZoomAt(clientX, clientY) {
      if (scale > 1.01) {
        resetZoom();
        return;
      }
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const next = 2.4;
      panX = (mx - cx) * (1 - next);
      panY = (my - cy) * (1 - next);
      scale = next;
      applyZoom();
    }

    function wrapIndex(n) {
      const len = images.length;
      if (!len) return 0;
      return ((n % len) + len) % len;
    }

    function ensureSlide(n) {
      n = wrapIndex(n);
      if (slides[n]) return slides[n];
      const figure = document.createElement("figure");
      figure.className = "photo-slide";
      const img = document.createElement("img");
      img.alt = project.title || "";
      const item = items[n];
      img.src =
        (item && item.lightbox) ||
        thumbUrlFor(images[n], "lg") ||
        (item && item.display) ||
        images[n];
      figure.appendChild(img);
      const anchor = stage.querySelector(".photo-zone, .photo-close");
      if (anchor) stage.insertBefore(figure, anchor);
      else stage.appendChild(figure);
      slides[n] = figure;
      return figure;
    }

    function arm(next) {
      [next - 1, next, next + 1].forEach((raw) => ensureSlide(wrapIndex(raw)));
    }

    function syncZones() {
      const prev = stage.querySelector(".photo-zone-prev");
      const next = stage.querySelector(".photo-zone-next");
      const alone = images.length <= 1;
      prev.disabled = alone;
      next.disabled = alone;
    }

    function show(nextIndex) {
      index = wrapIndex(nextIndex);
      resetZoom();
      syncZones();
      arm(index);
      slides.forEach((slide, n) => {
        if (!slide) return;
        slide.classList.toggle("is-active", n === index);
      });
      applyZoom();
    }

    function step(direction) {
      if (!stage || !images.length) return;
      if (busy) return;
      busy = true;
      show(index + direction);
      window.setTimeout(() => {
        busy = false;
      }, STEP_LOCK_MS);
    }

    function closeViewer() {
      if (!stage) return;
      stage.remove();
      stage = null;
      slides = [];
      resetZoom();
      drag = null;
      document.documentElement.classList.remove("photo-open");
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    }

    function openViewer(nextIndex) {
      if (!images.length) return;
      closeViewer();
      stage = document.createElement("div");
      stage.className = "photo-stage";
      stage.setAttribute("role", "dialog");
      stage.setAttribute("aria-label", project.title || "Photograph");
      // Build slides lazily — home can have 100+ photos.
      slides = new Array(images.length);
      const zones = [
        ["photo-zone-prev", "Previous photograph"],
        ["photo-zone-zoom", "Zoom photograph"],
        ["photo-zone-next", "Next photograph"],
      ];
      zones.forEach(([name, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "photo-zone " + name;
        button.setAttribute("aria-label", label);
        stage.appendChild(button);
      });
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "photo-close";
      closeBtn.setAttribute("aria-label", "Close photograph");
      closeBtn.innerHTML =
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>';
      stage.appendChild(closeBtn);
      stage.addEventListener("click", (event) => {
        if (ignoreClick) {
          ignoreClick = false;
          return;
        }
        if (event.target.closest(".photo-close")) {
          closeViewer();
          return;
        }
        const zone = event.target.closest(".photo-zone");
        if (!zone || zone.disabled) return;
        if (zone.classList.contains("photo-zone-zoom")) {
          toggleZoomAt(event.clientX, event.clientY);
          return;
        }
        if (scale > 1.01) return;
        if (zone.classList.contains("photo-zone-prev")) step(-1);
        else if (zone.classList.contains("photo-zone-next")) step(1);
      });
      stage.addEventListener("pointerdown", onPointerDown);
      stage.addEventListener("gesturestart", onGestureStart, { passive: false });
      stage.addEventListener("gesturechange", onGestureChange, { passive: false });
      stage.addEventListener("gestureend", onGestureEnd, { passive: false });
      document.body.appendChild(stage);
      document.documentElement.classList.add("photo-open");
      window.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
      show(nextIndex);
    }

    function onKey(event) {
      if (!stage) return;
      if (event.key === "Escape") {
        event.hanseoPhoto = true;
        event.preventDefault();
        event.stopImmediatePropagation();
        closeViewer();
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        step(-1);
      }
    }

    function onWheel(event) {
      if (!stage) return;
      event.preventDefault();
      // Trackpad pinch arrives as ctrl + wheel.
      if (event.ctrlKey) {
        setScale(scale * Math.exp(-event.deltaY * 0.012));
        return;
      }
      if (scale > 1.01) {
        panX -= event.deltaX;
        panY -= event.deltaY;
        applyZoom();
      }
    }

    function onGestureStart(event) {
      if (!stage) return;
      event.preventDefault();
      gestureScale = scale;
    }

    function onGestureChange(event) {
      if (!stage) return;
      event.preventDefault();
      setScale(gestureScale * (event.scale || 1));
    }

    function onGestureEnd(event) {
      if (!stage) return;
      event.preventDefault();
      gestureScale = scale;
    }

    function markIgnoreClick() {
      ignoreClick = true;
      window.clearTimeout(ignoreTimer);
      ignoreTimer = window.setTimeout(() => {
        ignoreClick = false;
      }, 280);
    }

    function onPointerDown(event) {
      if (!stage || scale <= 1.01) return;
      if (event.target.closest(".photo-close")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, panX, panY, id: event.pointerId, moved: false };
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (error) {}
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        stage.classList.add("is-panning");
      }
      if (!drag.moved) return;
      event.preventDefault();
      panX = drag.panX + dx;
      panY = drag.panY + dy;
      applyZoom();
    }

    function onPointerUp(event) {
      if (!drag || (event && event.pointerId !== drag.id)) return;
      const moved = drag.moved;
      drag = null;
      if (stage) stage.classList.remove("is-panning");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (moved) {
        markIgnoreClick();
        return;
      }
      // Click without drag while zoomed: zoom back out.
      if (scale > 1.01) {
        resetZoom();
        markIgnoreClick();
      }
    }

    function onTouchStart(event) {
      if (!stage || !event.changedTouches.length) return;
      if (scale > 1.01) return;
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchEnd(event) {
      if (!stage || !touchStart || !event.changedTouches.length) {
        touchStart = null;
        return;
      }
      if (scale > 1.01) {
        touchStart = null;
        return;
      }
      const touch = event.changedTouches[0];
      const dx = touchStart.x - touch.clientX;
      const dy = touchStart.y - touch.clientY;
      touchStart = null;
      const vertical = Math.abs(dy) >= Math.abs(dx);
      const delta = vertical ? dy : dx;
      if (Math.abs(delta) < 28) return;
      ignoreClick = true;
      window.clearTimeout(ignoreTimer);
      ignoreTimer = window.setTimeout(() => {
        ignoreClick = false;
      }, 400);
      step(delta > 0 ? 1 : -1);
    }

    window.addEventListener("keydown", onKey, true);

    return {
      destroy() {
        cancelAnimationFrame(frame);
        if (softTimer) window.clearTimeout(softTimer);
        stopIdlePrefetch();
        if (lazyObserver) lazyObserver.disconnect();
        observer.disconnect();
        window.removeEventListener("keydown", onKey, true);
        window.clearTimeout(ignoreTimer);
        closeViewer();
      },
    };
  }

  window.HanseoGallery = { open };
})();
