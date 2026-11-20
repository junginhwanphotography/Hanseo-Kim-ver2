(function () {
  const intro = document.getElementById("intro");
  const site = document.getElementById("site");
  const view = document.getElementById("site-view");
  const titles = {
    recent: "Recent Pictures",
    books: "Books and Printed Work",
    info: "Info",
  };
  let catalogPromise = null;
  let renderToken = 0;
  let active = null;
  let cover = false;
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
    if (!hash || hash === "intro") return { name: "intro" };
    if (hash === "photographs" || hash === "recent") return { name: "recent" };
    if (hash === "contact" || hash === "info") return { name: "info" };
    if (hash === "books") return { name: "books" };
    if (hash.indexOf("recent/") === 0) return { name: "recent", id: hash.slice("recent/".length) };
    if (hash.indexOf("books/") === 0) return { name: "books", id: hash.slice("books/".length) };
    if (/^photo\/\d+$/.test(hash)) return { name: "recent" };
    return { name: "intro" };
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

  function showBoard(event) {
    if (event) event.preventDefault();
    if (cover || parseHash().name === "intro") return;
    cover = true;
    intro.style.transition = "";
    document.documentElement.classList.add("intro-cover");
    intro.removeAttribute("inert");
    intro.setAttribute("aria-hidden", "false");
    site.setAttribute("inert", "");
    site.setAttribute("aria-hidden", "true");
    window.dispatchEvent(new Event("resize"));
  }

  function hideBoard() {
    if (!cover) return;
    cover = false;
    document.documentElement.classList.remove("intro-cover");
    intro.setAttribute("inert", "");
    intro.setAttribute("aria-hidden", "true");
    site.removeAttribute("inert");
    site.setAttribute("aria-hidden", "false");
  }

  async function render() {
    const token = ++renderToken;
    const route = parseHash();
    const inside = route.name !== "intro";
    document.documentElement.classList.toggle("is-inside", inside);
    if (cover) hideBoard();
    document.documentElement.classList.remove("enter-now");
    intro.classList.toggle("is-leaving", inside);
    intro.toggleAttribute("inert", inside);
    intro.setAttribute("aria-hidden", inside ? "true" : "false");
    site.toggleAttribute("inert", !inside);
    site.setAttribute("aria-hidden", inside ? "false" : "true");
    site.hidden = false;
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === route.name) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (!inside) {
      setActive(null);
      view.replaceChildren();
      document.title = "Hanseo Kim";
      window.dispatchEvent(new Event("resize"));
      return;
    }
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
    window.scrollTo(0, 0);
    site.scrollTop = 0;
    const sectionTitle = titles[route.name];
    if (route.name === "info") {
      document.title = sectionTitle + " – Hanseo Kim";
      setActive(window.HanseoInfo.render(view, catalog.info || ""));
      return;
    }
    const projects = route.name === "books" ? catalog.books || [] : catalog.recent || [];
    const project = route.id ? findProject(projects, route.id) : null;
    if (project) {
      document.title = (project.title || project.id) + " – Hanseo Kim";
      setActive(window.HanseoGallery.open(view, project));
      return;
    }
    document.title = sectionTitle + " – Hanseo Kim";
    const section = route.name === "books" ? window.HanseoBooks : window.HanseoRecent;
    setActive(section.list(view, projects));
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
  document.querySelector('[data-nav="intro"]').addEventListener("click", showBoard);
  document.getElementById("enter").addEventListener("click", (event) => {
    if (!cover) return;
    event.preventDefault();
    hideBoard();
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (event.hanseoPhoto || document.documentElement.classList.contains("photo-open")) return;
    if (cover) {
      hideBoard();
      return;
    }
    const route = parseHash();
    if (route.id) location.hash = route.name;
    else if (route.name !== "intro") location.hash = "";
  });

  render();
})();
