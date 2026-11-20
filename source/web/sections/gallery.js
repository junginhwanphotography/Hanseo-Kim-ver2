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
    const items = images.map((src) => {
      const figure = document.createElement("figure");
      figure.className = "mosaic-item";
      const img = document.createElement("img");
      img.alt = project.title || "";
      img.decoding = "async";
      img.src = src;
      img.addEventListener("load", layout);
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

    return {
      destroy() {
        cancelAnimationFrame(frame);
        observer.disconnect();
      },
    };
  }

  window.HanseoGallery = { open };
})();
