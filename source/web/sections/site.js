(function () {
  const site = document.getElementById("site");
  const view = document.getElementById("site-view");
  const paintDesk = document.getElementById("paint-desk");
  const titles = {
    home: "Hanseo Kim",
    photographs: "photographs",
    books: "books and printed work",
    contact: "contact",
  };
  let catalogPromise = null;
  let renderToken = 0;
  let active = null;
  let pressedLink = null;
  let pressedAt = 0;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function parseHash() {
    let hash = "";
    try {
      hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    } catch (error) {
      hash = location.hash.replace(/^#/, "");
    }
    if (!hash || hash === "intro") return { name: "home" };
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
    if (/^photo\/\d+$/.test(hash)) return { name: "home" };
    return { name: "home" };
  }

  function loadCatalog() {
    if (!catalogPromise) {
      const boot = window.__hanseoBoot && window.__hanseoBoot.catalog;
      catalogPromise = (boot || fetch("catalog.json").then((res) => {
        if (!res.ok) throw new Error("catalog");
        return res.json();
      })).catch((error) => {
        catalogPromise = null;
        throw error;
      });
    }
    return catalogPromise;
  }

  function thumbUrlFor(src) {
    const parts = String(src || "")
      .normalize("NFC")
      .split("/")
      .filter(Boolean);
    if (parts.length < 3) return "";
    const stem = parts[parts.length - 1].replace(/\.[^.]+$/, "");
    return stem ? "thumbs/" + parts[1] + "/" + stem + ".webp?v=3" : "";
  }

  function warmThumbs(urls) {
    urls.slice(0, 15).forEach((url, index) => {
      if (!url) return;
      const img = new Image();
      if (index < 8) img.fetchPriority = "high";
      img.decoding = "async";
      img.src = url;
    });
  }

  function findProject(list, id) {
    const needle = String(id || "").normalize("NFC");
    return (
      (list || []).find((item) => String(item.id || "").normalize("NFC") === needle) || null
    );
  }

  function setActive(next) {
    if (active) active.destroy();
    active = next;
  }

  const phoneQuery = window.matchMedia("(max-width: 720px)");

  // Jump to top once on route change. Do not keep fighting the user's scroll —
  // a long pin window felt like a brake on the first wheel/touch.
  function pinTop() {
    if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    if (site.scrollTop) site.scrollTop = 0;
  }

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

  function goHome() {
    const clean = location.pathname + location.search;
    if (location.hash) {
      history.pushState(null, "", clean);
      render();
      return;
    }
    render();
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

  function syncNav(route) {
    document.querySelectorAll(".site-nav [data-nav]").forEach((link) => {
      const current = link.dataset.nav === route.name;
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function isDarkTheme() {
    return document.documentElement.classList.contains("is-dark");
  }

  function openHomeMosaic(projects) {
    const dark = isDarkTheme();
    const root = dark ? "photographs_black/" : "photographs_white/";
    // Pin layout tests 6→4 to the top of the home scatter; leave photographs menu order alone.
    const pin = ["레이아웃 테스트6", "레이아웃 테스트5", "레이아웃 테스트4"];
    const byId = new Map();
    (projects || []).forEach((project) => {
      byId.set(String(project.id || "").normalize("NFC"), project);
    });
    const ordered = [];
    const seen = new Set();
    pin.forEach((id) => {
      const project = byId.get(id);
      if (project) {
        ordered.push(project);
        seen.add(id);
      }
    });
    (projects || []).forEach((project) => {
      const id = String(project.id || "").normalize("NFC");
      if (!seen.has(id)) ordered.push(project);
    });
    const images = [];
    ordered.forEach((project) => {
      const id = String(project.id || "").normalize("NFC");
      const preferred = dark ? project.imagesBlack : project.imagesWhite;
      let list =
        preferred && preferred.length
          ? preferred.slice()
          : (project.images || []).filter((src) => String(src).indexOf(root) !== -1);
      // Tests 4–6 live only under photographs_black — still show them on the home scatter.
      if (!list.length && pin.indexOf(id) !== -1) {
        list = (project.imagesBlack || project.images || []).slice();
      }
      list.forEach((src) => {
        if (pin.indexOf(id) !== -1 || String(src).indexOf(root) !== -1) images.push(src);
      });
    });
    // Prefetch mosaic thumbs into cache before/while the scatter mounts.
    warmThumbs(images.map(thumbUrlFor).filter(Boolean));
    return window.HanseoGallery.open(view, { title: "", images }, { layout: "scatter", label: false });
  }

  async function render() {
    const token = ++renderToken;
    const route = parseHash();
    document.documentElement.classList.add("is-inside");
    pinTop();
    setPaintDesk(route.name === "contact");
    site.removeAttribute("inert");
    site.setAttribute("aria-hidden", "false");
    site.hidden = false;
    syncNav(route);
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
    pinTop();
    const sectionTitle = titles[route.name];
    const projects = route.name === "books" ? catalog.books || [] : catalog.recent || [];

    if (route.name === "home") {
      document.title = "Hanseo Kim";
      setActive(openHomeMosaic(catalog.recent || []));
      return;
    }

    if (route.name === "contact") {
      document.title = sectionTitle + " – Hanseo Kim";
      setActive(window.HanseoContact.render(view, catalog.contact || ""));
      return;
    }

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
      document.title = sectionTitle + " – Hanseo Kim";
      setActive(window.HanseoRecent.list(view, projects));
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

    if (route.name === "books") {
      document.title = sectionTitle + " – Hanseo Kim";
      setActive(window.HanseoBooks.list(view, catalog.books || []));
      return;
    }

    setActive(null);
    view.replaceChildren();
    document.title = "Hanseo Kim";
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
  document.querySelector("[data-nav='home']").addEventListener("click", (event) => {
    event.preventDefault();
    goHome();
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
  window.addEventListener("popstate", render);
  function syncThemeToggle() {
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    const dark = isDarkTheme();
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  function setTheme(dark) {
    document.documentElement.classList.toggle("is-dark", dark);
    try {
      localStorage.setItem("hanseo-theme", dark ? "dark" : "light");
    } catch (error) {}
    syncThemeToggle();
    window.dispatchEvent(new Event("hanseo-theme"));
  }

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => setTheme(!isDarkTheme()));
  }
  syncThemeToggle();

  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const onColorScheme = () => {
    let saved = null;
    try {
      saved = localStorage.getItem("hanseo-theme");
    } catch (error) {}
    if (saved === "light" || saved === "dark") return;
    document.documentElement.classList.toggle("is-dark", colorScheme.matches);
    syncThemeToggle();
    if (parseHash().name === "home") render();
  };
  if (colorScheme.addEventListener) colorScheme.addEventListener("change", onColorScheme);
  else if (colorScheme.addListener) colorScheme.addListener(onColorScheme);
  window.addEventListener("hanseo-theme", () => {
    if (parseHash().name === "home") render();
  });
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
      if (route.name !== "home") goHome();
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
