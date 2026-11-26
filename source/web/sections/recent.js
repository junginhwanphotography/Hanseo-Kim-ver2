(function () {
  function list(root, projects) {
    root.replaceChildren();
    if (!projects.length) {
      const empty = document.createElement("p");
      empty.className = "site-message";
      empty.textContent = "No pictures yet.";
      root.appendChild(empty);
      return { destroy() {} };
    }
    const listEl = document.createElement("div");
    listEl.className = "recent-list";
    const preview = document.createElement("div");
    preview.className = "recent-preview";
    preview.setAttribute("aria-hidden", "true");
    const frame = document.createElement("div");
    frame.className = "recent-preview-frame";
    const previewImg = document.createElement("img");
    previewImg.alt = "";
    previewImg.addEventListener("load", () => {
      previewImg.classList.toggle("is-landscape", previewImg.naturalWidth > previewImg.naturalHeight);
    });
    frame.appendChild(previewImg);
    preview.appendChild(frame);
    const canHover = window.matchMedia("(hover: hover)").matches;

    function showPreview(src) {
      if (!canHover || !src) return;
      if (previewImg.getAttribute("src") !== src) previewImg.src = src;
      preview.classList.remove("is-on");
      void preview.offsetWidth;
      preview.classList.add("is-on");
    }

    function hidePreview() {
      preview.classList.remove("is-on");
    }

    let sawLayoutTest = false;
    projects.forEach((project) => {
      const id = String(project.id || "").normalize("NFC");
      const isLayoutTest = /^레이아웃 테스트\d/.test(id);
      const row = document.createElement("a");
      row.className = "recent-row";
      if (isLayoutTest && !sawLayoutTest) {
        row.classList.add("is-spaced-top");
        sawLayoutTest = true;
      }
      if (id === "레이아웃 테스트4") {
        row.classList.add("is-spaced-top");
      }
      row.href = "#photographs/" + encodeURIComponent(project.id);
      const title = document.createElement("span");
      title.className = "recent-title";
      title.textContent = project.title || project.id;
      const text = document.createElement("span");
      text.className = "recent-text";
      text.textContent = project.text || "";
      row.append(title, text);
      const dark = document.documentElement.classList.contains("is-dark");
      const themed =
        (dark ? project.imagesDark : project.imagesLight) ||
        project.images ||
        [];
      const fallback = project.images || [];
      const coverPool = themed.length ? themed : fallback;
      const thumb =
        window.HanseoTags && window.HanseoTags.coverFromImages
          ? window.HanseoTags.coverFromImages(coverPool) ||
            window.HanseoTags.coverFromImages(fallback)
          : coverPool[0] || (fallback && fallback[0]);
      if (thumb) {
        row.addEventListener("mouseenter", () => showPreview(thumb));
        row.addEventListener("mouseleave", hidePreview);
      }
      listEl.appendChild(row);
    });
    root.append(listEl, preview);
    return {
      destroy() {
        hidePreview();
      },
    };
  }

  window.HanseoRecent = { list };
})();
