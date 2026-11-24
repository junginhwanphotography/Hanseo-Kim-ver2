(function () {
  const site = document.getElementById("site");
  const view = document.getElementById("site-view");
  const paintDesk = document.getElementById("paint-desk");
  const titles = {
    photographs: "photographs",
    books: "books and printed work",
    contact: "contact",
  };
  let catalogPromise = null;
  let renderToken = 0;
  let active = null;
  let pressedLink = null;
  let pressedAt = 0;
  let photosOpen = false;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function parseHash() {
    let hash = "";
    try {
      hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    } catch (error) {
      hash = location.hash.replace(/^#/, "");
    }
    if (!hash || hash === "intro") return { name: "photographs" };
    if (hash === "photographs" || hash === "recent") return { name: "photographs" };
    if (hash === "contact" || hash === "info") return { name: "contact" };
    if (hash === "books") return { name: "books" };
    if (hash.indexOf("photographs/tag/") === 0) {
      const tag = hash.slice("photographs/tag/".length).toLowerCase();
      if (tag) return { name: "photographs", tag };
    }
    if (hash.indexOf("photographs/") === 0) return { name: "photographs", id: hash.slice("photographs/".length) };
    if (hash.indexOf("recent/") === 0) return { name: "photographs", id: hash.slice("recent/".length) };
    if (hash.indexOf("books/") === 0) return { name: "books", id: hash.slice("books/".length) };
    if (/^photo\/\d+$/.test(hash)) return { name: "photographs" };
    return { name: "photographs" };
  }

  function syncSide(projects, route) {
    const list = document.getElementById("side-collections");
    const toggle = document.querySelector("[data-nav='photographs']");
    if (!list || !toggle) return;
    list.replaceChildren();
    const preview = document.getElementById("side-preview");
    const previewImg = preview && preview.querySelector("img");
    const canHover = window.matchMedia("(hover: hover)").matches;
    (projects || []).forEach((project) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#photographs/" + encodeURIComponent(project.id);
      link.textContent = project.title || project.id;
      if (route.name === "photographs" && route.id === project.id) link.setAttribute("aria-current", "page");
      const thumb = project.images && project.images[0];
      if (thumb && preview && previewImg && canHover) {
        link.addEventListener("mouseenter", () => {
          if (previewImg.getAttribute("src") !== thumb) previewImg.src = thumb;
          preview.classList.add("is-on");
        });
        link.addEventListener("mouseleave", () => preview.classList.remove("is-on"));
      }
      item.appendChild(link);
      list.appendChild(item);
    });
    const open = photosOpen;
    list.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch("catalog.json", { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error("catalog");
          return res.json();
        })
        .catch((error) => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  }

  function findProject(list, id) {
    return (list || []).find((item) => item.id === id) || null;
  }

  function setActive(next) {
    if (active) active.destroy();
    active = next;
  }

  let pinUntil = 0;

  function pinTop() {
    if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    if (site.scrollTop) site.scrollTop = 0;
  }

  function holdTop() {
    pinUntil = performance.now() + 1400;
    pinTop();
  }

  window.addEventListener(
    "scroll",
    () => {
      if (performance.now() < pinUntil) pinTop();
    },
    { passive: true }
  );
  const phoneQuery = window.matchMedia("(max-width: 720px)");
  let listHold = true;
  let listTouchY = 0;

  site.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches[0]) listTouchY = event.touches[0].clientY;
    },
    { passive: true }
  );
  site.addEventListener(
    "touchmove",
    (event) => {
      const touch = event.touches[0];
      if (touch && Math.abs(touch.clientY - listTouchY) > 8) listHold = false;
    },
    { passive: true }
  );
  site.addEventListener(
    "scroll",
    () => {
      if (phoneQuery.matches) {
        if (listHold && site.scrollTop) site.scrollTop = 0;
        return;
      }
      if (performance.now() < pinUntil && site.scrollTop) site.scrollTop = 0;
    },
    { passive: true }
  );

  function setPaintDesk(on) {
    document.documentElement.classList.toggle("is-contact", on);
    if (!paintDesk) return;
    paintDesk.hidden = !on;
    paintDesk.setAttribute("aria-hidden", on ? "false" : "true");
    if (on) {
      window.dispatchEvent(new Event("resize"));
      if (window.HanseoInk) window.HanseoInk.prepare();
    } else if (window.HanseoInk) {
      window.HanseoInk.cancel();
    }
  }

  function openTag(tag) {
    const next = "photographs/tag/" + tag;
    let hash = "";
    try {
      hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    } catch (error) {
      hash = location.hash.replace(/^#/, "");
    }
    if (hash === next) return;
    location.hash = next;
  }

  window.addEventListener("hanseo-ink", (event) => {
    const tag = event.detail && event.detail.tag;
    if (tag) openTag(tag);
  });

  async function render() {
    const token = ++renderToken;
    const route = parseHash();
    document.documentElement.classList.add("is-inside");
    listHold = true;
    holdTop();
    setPaintDesk(route.name === "contact");
    site.removeAttribute("inert");
    site.setAttribute("aria-hidden", "false");
    site.hidden = false;
    document.querySelectorAll(".side-menu [data-nav]").forEach((link) => {
      const current =
        link.dataset.nav === route.name ||
        (link.dataset.nav === "photographs" && route.name === "photographs");
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    let catalog;
    try {
      catalog = await loadCatalog();
    } catch (error) {
      if (token !== renderToken) return;
      setActive(null);
      view.replaceChildren();
      const message = document.createElement("p");
      message.className = "site-message";
      message.textContent = "This page could not be loaded.";
      view.appendChild(message);
      return;
    }
    if (token !== renderToken) return;
    holdTop();
    const sectionTitle = titles[route.name];
    syncSide(catalog.recent || [], route);
    if (route.name === "contact") {
      document.title = sectionTitle + " – Hanseo Kim";
      setActive(window.HanseoContact.render(view, catalog.contact || ""));
      return;
    }
    const projects = route.name === "books" ? catalog.books || [] : catalog.recent || [];
    if (route.name === "photographs" && route.tag) {
      const images = [];
      projects.forEach((project) => {
        (project.images || []).forEach((src) => {
          if (window.HanseoTags.tagFromSrc(src) === route.tag) images.push(src);
        });
      });
      document.title = route.tag + " – Hanseo Kim";
      setActive(window.HanseoGallery.open(view, { title: "", images }, { layout: "mosaic", label: false }));
      return;
    }
    if (route.name === "photographs" && !route.id) {
      // 메인만: 라이트=photographs_white, 다크=photographs_black. 컬렉션 페이지는 아래 merged images 사용.
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const root = dark ? "photographs_black/" : "photographs_white/";
      const images = [];
      projects.forEach((project) => {
        const preferred = dark ? project.imagesBlack : project.imagesWhite;
        const list =
          preferred && preferred.length
            ? preferred
            : (project.images || []).filter((src) => String(src).indexOf(root) !== -1);
        list.forEach((src) => {
          if (String(src).indexOf(root) !== -1) images.push(src);
        });
      });
      document.title = "Hanseo Kim";
      setActive(window.HanseoGallery.open(view, { title: "", images }, { layout: "mosaic", label: false }));
      return;
    }
    const project = route.id ? findProject(projects, route.id) : null;
    if (project) {
      document.title = (project.title || project.id) + " – Hanseo Kim";
      setActive(
        window.HanseoGallery.open(view, project, {
          layout: route.name === "books" ? "prints" : "mosaic",
          label: route.name === "books",
        })
      );
      return;
    }
    if (route.name !== "books") {
      setActive(null);
      view.replaceChildren();
      document.title = "Hanseo Kim";
      return;
    }
    document.title = sectionTitle + " – Hanseo Kim";
    setActive(window.HanseoBooks.list(view, catalog.books || []));
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      pressedLink = event.target.closest("a.recent-row, a.book-thumb, a.book-title");
      pressedAt = pressedLink ? Date.now() : 0;
    },
    true
  );
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest("a.recent-row, a.book-thumb, a.book-title");
      if (!link) return;
      if (event.detail === 0) return;
      const pressed = pressedLink;
      const fresh = pressed && pressed.isConnected && Date.now() - pressedAt < 1500;
      pressedLink = null;
      if (!fresh) {
        event.preventDefault();
        return;
      }
      if (pressed !== link) {
        event.preventDefault();
        location.assign(pressed.href);
      }
    },
    true
  );
  document.querySelector("[data-nav='photographs']").addEventListener("click", () => {
    const route = parseHash();
    if (route.name === "photographs" && !route.id && !route.tag) {
      photosOpen = !photosOpen;
      const list = document.getElementById("side-collections");
      const toggle = document.querySelector("[data-nav='photographs']");
      if (list) list.hidden = !photosOpen;
      if (toggle) toggle.setAttribute("aria-expanded", photosOpen ? "true" : "false");
      return;
    }
    photosOpen = true;
    location.hash = "photographs";
  });
  function lockPhone() {
    if (!phoneQuery.matches) return;
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--hanseo-vh", Math.round(height) + "px");
    document.documentElement.style.setProperty("--hanseo-top", "0px");
    if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }

  window.addEventListener("resize", lockPhone);
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", lockPhone);
    visualViewport.addEventListener("scroll", lockPhone);
  }
  window.addEventListener("scroll", lockPhone, { passive: true });
  lockPhone();

  window.addEventListener("hashchange", render);
  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const onColorScheme = () => {
    const route = parseHash();
    if (route.name === "photographs" && !route.id && !route.tag) render();
  };
  if (colorScheme.addEventListener) colorScheme.addEventListener("change", onColorScheme);
  else if (colorScheme.addListener) colorScheme.addListener(onColorScheme);
  let typed = "";
  let typeTimer = 0;
  let lastLetter = "";
  let lastLetterAt = 0;

  const jamoLetter = {
    ㅂ: "q", ㅈ: "w", ㄷ: "e", ㄱ: "r", ㅅ: "t", ㅛ: "y", ㅕ: "u", ㅑ: "i", ㅐ: "o", ㅔ: "p",
    ㅁ: "a", ㄴ: "s", ㅇ: "d", ㄹ: "f", ㅎ: "g", ㅗ: "h", ㅓ: "j", ㅏ: "k", ㅣ: "l",
    ㅋ: "z", ㅌ: "x", ㅊ: "c", ㅍ: "v", ㅠ: "b", ㅜ: "n", ㅡ: "m",
    ㅃ: "q", ㅉ: "w", ㄸ: "e", ㄲ: "r", ㅆ: "t", ㅒ: "o", ㅖ: "p",
  };

  function commandLetter(event) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return "";
    const target = event.target;
    if (target && target.closest && target.closest("input, textarea, [contenteditable='true']")) return "";
    if (/^Key[A-Z]$/.test(event.code || "")) return event.code.slice(3).toLowerCase();
    const key = event.key || "";
    if (/^[a-z]$/i.test(key)) return key.toLowerCase();
    if (jamoLetter[key]) return jamoLetter[key];
    return "";
  }

  function knownTags(catalog) {
    const tags = new Set();
    (catalog.recent || []).forEach((project) => {
      (project.images || []).forEach((src) => {
        const tag = window.HanseoTags.tagFromSrc(src);
        if (tag) tags.add(tag);
      });
    });
    return [...tags];
  }

  function openTyped(text, settle) {
    const pending = text;
    loadCatalog()
      .then((catalog) => {
        if (typed !== pending && !settle) return;
        const tag = window.HanseoTags.commandTag(pending, knownTags(catalog), settle);
        if (!tag) return;
        typed = "";
        window.clearTimeout(typeTimer);
        openTag(tag);
      })
      .catch(() => {});
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (event.hanseoPhoto || document.documentElement.classList.contains("photo-open")) return;
      const route = parseHash();
      if (route.id || route.tag) location.hash = route.name;
      else if (route.name !== "photographs") location.hash = "photographs";
      return;
    }
    const letter = commandLetter(event);
    if (!letter) return;
    const now = performance.now();
    if (letter === lastLetter && now - lastLetterAt < 40) return;
    lastLetter = letter;
    lastLetterAt = now;
    event.preventDefault();
    typed = (typed + letter).slice(-32);
    window.clearTimeout(typeTimer);
    const pending = typed;
    typeTimer = window.setTimeout(() => {
      if (typed !== pending) return;
      typed = "";
      openTyped(pending, true);
    }, 700);
    openTyped(pending, false);
  }, true);

  render();
})();
