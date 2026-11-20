(function () {
  function open(root, project) {
    root.replaceChildren();
    const images = project.images || [];
    const article = document.createElement("article");
    article.className = "project";
    const label = document.createElement("p");
    label.className = "project-label";
    label.append(document.createTextNode(project.title || project.id || ""));
    label.append(document.createElement("br"));
    label.append(document.createTextNode(project.year || ""));
    const mosaic = document.createElement("div");
    mosaic.className = "mosaic";
    const items = images.map((src, photoIndex) => {
      const figure = document.createElement("figure");
      figure.className = "mosaic-item";
      const img = document.createElement("img");
      img.alt = project.title || "";
      img.decoding = "async";
      img.src = src;
      img.addEventListener("load", layout);
      figure.addEventListener("click", () => openViewer(photoIndex));
      figure.appendChild(img);
      mosaic.appendChild(figure);
      return { el: figure, img };
    });
    article.append(label, mosaic);
    root.appendChild(article);

    let frame = 0;
    function layout() {
      const width = mosaic.clientWidth;
      if (width < 20 || !items.length) return;
      const gutter = 10;
      const columns = width < 720 ? 1 : 3;
      const base = Math.floor((width - gutter * (columns - 1)) / columns);
      const heights = Array(columns).fill(0);
      items.forEach(({ el, img }) => {
        const column = heights.indexOf(Math.min.apply(null, heights));
        const left = (base + gutter) * column;
        const itemWidth = column === columns - 1 ? width - left : base;
        const ratio =
          img.naturalWidth && img.naturalHeight ? img.naturalHeight / img.naturalWidth : 0.72;
        const itemHeight = Math.max(1, Math.floor(ratio * itemWidth));
        el.style.left = left + "px";
        el.style.top = heights[column] + "px";
        el.style.width = itemWidth + "px";
        el.style.height = itemHeight + "px";
        heights[column] += itemHeight + gutter;
      });
      const tallest = Math.max.apply(null, heights);
      mosaic.style.height = Math.max(0, tallest - gutter) + "px";
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    }

    const observer = new ResizeObserver(schedule);
    observer.observe(mosaic);
    schedule();

    let stage = null;
    let slides = [];
    let index = 0;
    let showToken = 0;
    let busy = false;
    let touchStart = null;
    let ignoreClick = false;
    let ignoreTimer = 0;

    function placeStage() {
      if (!stage) return;
      if (window.matchMedia("(max-width: 720px)").matches) closeViewer();
    }

    function arm(next) {
      [next - 1, next, next + 1].forEach((n) => {
        const img = slides[n] && slides[n].querySelector("img");
        if (img && !img.getAttribute("src")) img.src = images[n];
      });
    }

    function syncZones() {
      const prev = stage.querySelector(".photo-zone-prev");
      const next = stage.querySelector(".photo-zone-next");
      prev.disabled = index <= 0;
      next.disabled = index >= images.length - 1;
    }

    function show(nextIndex) {
      index = nextIndex;
      syncZones();
      const token = ++showToken;
      arm(index);
      const apply = () => {
        if (token !== showToken || !stage) return;
        slides.forEach((slide, n) => slide.classList.toggle("is-active", n === index));
      };
      const img = slides[index].querySelector("img");
      if (img.complete && img.naturalWidth) apply();
      else img.addEventListener("load", apply, { once: true });
    }

    function step(direction) {
      if (!stage || !images.length) return;
      if (busy) return;
      const next = index + direction;
      if (next < 0 || next >= images.length) return;
      busy = true;
      show(next);
      window.setTimeout(() => {
        busy = false;
      }, 120);
    }

    function closeViewer() {
      if (!stage) return;
      stage.remove();
      stage = null;
      slides = [];
      document.documentElement.classList.remove("photo-open");
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    }

    function openViewer(nextIndex) {
      if (window.matchMedia("(max-width: 720px)").matches || !images.length) return;
      closeViewer();
      stage = document.createElement("div");
      stage.className = "photo-stage";
      stage.setAttribute("role", "dialog");
      stage.setAttribute("aria-label", project.title || "Photograph");
      slides = images.map((src) => {
        const figure = document.createElement("figure");
        figure.className = "photo-slide";
        const img = document.createElement("img");
        img.alt = project.title || "";
        img.decoding = "async";
        img.dataset.src = src;
        figure.appendChild(img);
        stage.appendChild(figure);
        return figure;
      });
      const zones = [
        ["photo-zone-prev", "Previous photograph"],
        ["photo-zone-close", "Close photograph"],
        ["photo-zone-next", "Next photograph"],
      ];
      zones.forEach(([name, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "photo-zone " + name;
        button.setAttribute("aria-label", label);
        stage.appendChild(button);
      });
      stage.addEventListener("click", (event) => {
        if (ignoreClick) {
          ignoreClick = false;
          return;
        }
        const zone = event.target.closest(".photo-zone");
        if (!zone || zone.disabled) return;
        if (zone.classList.contains("photo-zone-close")) closeViewer();
        else if (zone.classList.contains("photo-zone-prev")) step(-1);
        else if (zone.classList.contains("photo-zone-next")) step(1);
      });
      const host = document.querySelector(".site") || document.body;
      host.appendChild(stage);
      document.documentElement.classList.add("photo-open");
      window.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
      placeStage();
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
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = horizontal ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 4) return;
      step(delta > 0 ? 1 : -1);
    }

    function onTouchStart(event) {
      if (!stage || !event.changedTouches.length) return;
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchEnd(event) {
      if (!stage || !touchStart || !event.changedTouches.length) {
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
    window.addEventListener("resize", placeStage);

    return {
      destroy() {
        cancelAnimationFrame(frame);
        observer.disconnect();
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("resize", placeStage);
        window.clearTimeout(ignoreTimer);
        closeViewer();
      },
    };
  }

  window.HanseoGallery = { open };
})();
