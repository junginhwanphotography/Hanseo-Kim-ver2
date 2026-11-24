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

    projects.forEach((project) => {
      const row = document.createElement("a");
      row.className = "recent-row";
      row.href = "#photographs/" + encodeURIComponent(project.id);
      const title = document.createElement("span");
      title.className = "recent-title";
      title.textContent = project.title || project.id;
      const text = document.createElement("span");
      text.className = "recent-text";
      text.textContent = project.text || "";
      row.append(title, text);
      const thumb = project.images && project.images[0];
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
