(function () {
  function columnsFor(width) {
    if (width < 980) return 2;
    return 4;
  }

  function list(root, projects) {
    root.replaceChildren();
    if (!projects.length) {
      const empty = document.createElement("p");
      empty.className = "site-message";
      empty.textContent = "No books yet.";
      root.appendChild(empty);
      return { destroy() {} };
    }
    const board = document.createElement("div");
    board.className = "books";
    const items = projects.map((project) => {
      const item = document.createElement("article");
      item.className = "book";
      const thumb = document.createElement("a");
      thumb.className = "book-thumb";
      thumb.href = "#books/" + encodeURIComponent(project.id);
      const img = document.createElement("img");
      const cover =
        window.HanseoTags && window.HanseoTags.coverFromImages
          ? window.HanseoTags.coverFromImages(project.images)
          : project.images && project.images[0];
      img.src = cover || "";
      img.alt = project.title || project.id;
      img.decoding = "async";
      thumb.appendChild(img);
      const title = document.createElement("a");
      title.className = "book-title";
      title.href = thumb.href;
      title.textContent = project.title || project.id;
      item.append(thumb, title);
      board.appendChild(item);
      img.addEventListener("load", layout);
      return item;
    });
    root.appendChild(board);

    function layout() {
      const width = board.clientWidth;
      if (!width) return;
      const columns = columnsFor(width);
      const gap = width < 680 ? 28 : 36;
      const colWidth = (width - gap * (columns - 1)) / columns;
      const heights = Array(columns).fill(0);
      items.forEach((item) => {
        item.style.width = colWidth + "px";
        const col = heights.indexOf(Math.min.apply(null, heights));
        item.style.left = col * (colWidth + gap) + "px";
        item.style.top = heights[col] + "px";
        heights[col] += item.offsetHeight + gap;
      });
      board.style.height = Math.max.apply(null, heights) - gap + "px";
    }

    window.addEventListener("resize", layout);
    layout();
    return {
      destroy() {
        window.removeEventListener("resize", layout);
      },
    };
  }

  window.HanseoBooks = { list };
})();
