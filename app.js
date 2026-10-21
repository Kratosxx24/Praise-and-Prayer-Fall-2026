(function () {
  const D = window.PANDP;
  const app = document.getElementById("app");

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // "David (g)" -> "David"; "Anderson (?)" -> "Anderson"
  const baseName = (n) => n.replace(/\s*\(.*\)\s*$/, "").trim();
  const personLink = (n) => `<a class="person" href="#people/${encodeURIComponent(baseName(n))}">${esc(n)}</a>`;
  const people = (list) => list.length ? list.map(personLink).join(", ") : `<span class="tbd">Open</span>`;
  const songs = (set) => set.songs.filter((s) => !s.interlude);

  // ---------- views ----------

  // Running order: every set, songs in order.
  function home() {
    return `
      <section class="order-head">
        <h1>Running order</h1>
        <div class="sub">${D.sets.length} sets · ${D.sets.reduce((n, s) => n + songs(s).length, 0)} songs</div>
      </section>
      ${D.sets.map((set) => {
        let n = 0;
        return `
        <section class="order-set">
          <div class="order-set-head">
            <h2>${esc(set.name)} <span>· ${esc(set.title)}</span></h2>
            <a href="#${set.id}">Details →</a>
          </div>
          <ol class="order">
            ${set.songs.map((s) => s.interlude
              ? `<li class="gap">${esc(s.interlude)}</li>`
              : `<li><span class="n">${++n}</span><span><div class="t">${esc(s.title)}</div><div class="m">${esc(s.lead)} · ${esc(s.artist)}</div></span><span class="k">${esc(s.key)}</span></li>`).join("")}
          </ol>
        </section>`;
      }).join("")}`;
  }

  function flow(sections) {
    if (!sections.length) return `<p class="flow-empty">Arrangement not posted yet.</p>`;
    return `<ol class="flow">${sections.map((s) => {
      const sec = typeof s === "string" ? { name: s } : s;
      return `<li><span class="sec">${esc(sec.name)}${sec.dynamics ? `<span class="chip accent">${esc(sec.dynamics)}</span>` : ""}${sec.note ? `<span class="sec-note">${esc(sec.note)}</span>` : ""}</span></li>`;
    }).join("")}</ol>`;
  }

  function song(s, n) {
    const chart = s.chart
      ? `<a class="btn primary" href="${esc(s.chart)}" target="_blank" rel="noopener">Open chart</a>`
      : `<span class="btn" aria-disabled="true">Chart not posted yet</span>`;
    return `
      <article class="card song">
        <div class="song-top">
          <div class="song-num">${n}</div>
          <div class="song-main">
            <h3>${esc(s.title)}</h3>
            <div class="artist">${esc(s.artist)}</div>
            <div class="song-tags">
              <span class="chip">Lead: ${s.lead.split("→").map((x) => personLink(x.trim())).join(" → ")}</span>
              ${s.confirmed ? `<span class="chip ok">Key confirmed</span>` : ""}
            </div>
          </div>
          <div class="key"><small>Key</small>${esc(s.key)}</div>
        </div>
        ${s.note ? `<p class="song-note">${esc(s.note)}</p>` : ""}
        ${flow(s.sections || [])}
        <div class="song-actions">${chart}</div>
      </article>`;
  }

  function setView(set) {
    let n = 0;
    return `
      <section class="set-head">
        <div class="label">${esc(set.name)}</div>
        <h1>${esc(set.title)}</h1>
        ${set.subtitle ? `<div class="sub">${esc(set.subtitle)}</div>` : ""}
        <div class="set-meta">
          <span class="chip">${songs(set).length} songs</span>
        </div>
      </section>

      <h2 class="section-title">Who's on what</h2>
      <div class="roster">
        ${set.roles.map(([role, who]) => `<div><div class="role">${esc(role)}</div><div class="who">${people(who)}</div></div>`).join("")}
      </div>
      <p class="note-small">(g) = sings while playing guitar.</p>

      <h2 class="section-title">Songs</h2>
      <div class="songs">
        ${set.songs.map((s) => s.interlude ? `<div class="interlude">${esc(s.interlude)}</div>` : song(s, ++n)).join("")}
      </div>`;
  }

  // Everyone, with every set + role they're on, built from the set rosters.
  function roster() {
    const map = new Map();
    for (const set of D.sets) {
      for (const [role, who] of set.roles) {
        for (const raw of who) {
          const name = baseName(raw);
          const extra = (raw.match(/\((.*)\)/) || [])[1];
          const label = role + (extra === "g" ? " (with guitar)" : extra === "?" ? " (tentative)" : "");
          if (!map.has(name)) map.set(name, []);
          const list = map.get(name);
          const hit = list.find((x) => x.set === set);
          hit ? hit.roles.push(label) : list.push({ set, roles: [label] });
        }
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function peopleView(focus) {
    const all = roster();
    const open = [];
    for (const set of D.sets) for (const [role, who] of set.roles) if (!who.length) open.push(`${set.name}: ${role}`);
    return `
      <section class="set-head">
        <div class="label">Team</div>
        <h1>Who's on what</h1>
        <div class="sub">${all.length} people across ${D.sets.length} sets</div>
      </section>
      <input class="search" id="search" type="search" placeholder="Find your name…" value="${esc(focus || "")}" autocomplete="off">
      <div class="people" id="people">
        ${all.map(([name, sets]) => `
          <div class="card pcard${focus && name === focus ? " hl" : ""}" data-name="${esc(name.toLowerCase())}" id="p-${esc(name)}">
            <h3>${esc(name)}</h3>
            <div class="count">${sets.length} set${sets.length > 1 ? "s" : ""}</div>
            <ul>${sets.map(({ set, roles }) => `<li><a class="chip accent" href="#${set.id}">${esc(set.name)}</a><span>${esc(roles.join(", "))}</span></li>`).join("")}</ul>
          </div>`).join("")}
      </div>
      ${open.length ? `<div class="card open-slots"><h3>Still open</h3><ul>${open.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div>` : ""}`;
  }

  // ---------- routing ----------

  function render() {
    const hash = decodeURIComponent(location.hash.slice(1)) || "home";
    const [view, arg] = hash.split("/");
    const set = D.sets.find((s) => s.id === view);

    if (set) app.innerHTML = setView(set);
    else if (view === "people") app.innerHTML = peopleView(arg);
    else app.innerHTML = home();

    const active = set ? set.id : view === "people" ? "people" : "home";
    document.querySelectorAll("#tabs a").forEach((a) => {
      a.toggleAttribute("aria-current", a.dataset.view === active);
      if (a.dataset.view === active) a.setAttribute("aria-current", "page");
    });
    document.title = `${set ? set.name + " · " : view === "people" ? "People · " : ""}P&P ${D.term}`;

    wire(view, arg);
    window.scrollTo(0, 0);
  }

  function wire(view, arg) {
    const search = document.getElementById("search");
    if (search) {
      const filter = () => {
        const q = search.value.trim().toLowerCase();
        document.querySelectorAll("#people .pcard").forEach((c) => { c.hidden = q && !c.dataset.name.includes(q); });
      };
      search.oninput = filter;
      filter();
    }
  }

  // ---------- light / dark ----------
  // No saved choice = follow the device setting.
  const root = document.documentElement;
  const media = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : media.matches;
  const syncTheme = () => root.classList.toggle("dark", isDark());
  document.getElementById("theme-btn").onclick = () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    syncTheme();
  };
  media.addEventListener("change", syncTheme);
  syncTheme();

  window.addEventListener("hashchange", render);
  render();
})();
