(function () {
  const D = window.PANDP;
  const app = document.getElementById("app");

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // "David (g)" -> "David"; "Anderson (?)" -> "Anderson"
  const baseName = (n) => n.replace(/\s*\(.*\)\s*$/, "").trim();
  const personLink = (n) => `<a class="person" href="#people/${encodeURIComponent(baseName(n))}">${esc(n)}</a>`;
  const songs = (set) => set.songs.filter((s) => !s.interlude);

  // Every instrument has one color, used everywhere it appears (CSS: .r-<key>).
  const ROLE_ORDER = ["vocals", "guitar", "electric", "piano", "cello", "bass", "cajon", "sound", "slides"];
  const roleKey = (role) => role.toLowerCase().replace(/[^a-z]/g, "");
  const roleChip = (role, extra = "") => `<span class="rchip r-${roleKey(role)}${extra === "?" ? " maybe" : ""}">${esc(role)}${extra === "?" ? " ?" : ""}</span>`;

  // Arrangement sections: "Bridge x3" / "2x" note -> repeat count, and a color by type.
  function section(s) {
    const sec = typeof s === "string" ? { name: s } : { ...s };
    const rep = /\s*(?:x\s*(\d+)|(\d+)\s*x)\b\.?\s*/i;
    for (const f of ["name", "note"]) {
      const m = sec[f] && sec[f].match(rep);
      if (m) { sec.x = +(m[1] || m[2]); sec[f] = sec[f].replace(rep, " ").trim(); }
    }
    const w = sec.name.toLowerCase();
    sec.type = /^(v|verse)\b/.test(w) ? "verse" : /chorus/.test(w) ? "chorus" : /bridge/.test(w) ? "bridge"
      : /^(tag|vamp)/.test(w) ? "tag" : "other";
    return sec;
  }
  // Same section twice in a row with no notes -> one block with x2.
  function collapse(list) {
    const out = [];
    for (const sec of list.map(section)) {
      const last = out[out.length - 1];
      if (last && last.name === sec.name && !last.note && !sec.note && !last.dynamics && !sec.dynamics) last.x = (last.x || 1) + (sec.x || 1);
      else out.push(sec);
    }
    return out;
  }

  // ---------- dates ----------
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmt = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const daysAway = (d) => Math.round((d - today) / 864e5);
  const inDays = (n) => n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`;
  function upcoming() {
    const next = new Date(today);
    next.setDate(today.getDate() + ((D.practice.weekday - today.getDay() + 7) % 7));
    const items = [{ date: next, what: "Practice", detail: `${D.practice.time} · ${D.practice.detail}` }];
    for (const e of D.events) {
      const d = new Date(e.date + "T00:00:00");
      if (d >= today) items.push({ date: d, what: e.what, detail: "", big: true });
    }
    return items.sort((a, b) => a.date - b.date);
  }

  // ---------- views ----------

  function lineupStrip(set) {
    return `<div class="strip">${set.roles.filter(([, who]) => who.length).map(([role, who]) =>
      `<span class="strip-item r-${roleKey(role)}"><i></i>${esc(who.map(baseName).join(", "))}</span>`).join("")}</div>`;
  }

  // Running order: every set, songs in order. Sets sit side by side on wide screens.
  function home() {
    const total = D.sets.reduce((n, s) => n + songs(s).length, 0);
    return `
      <section class="page-head">
        <div class="label">${esc(D.title)} · ${esc(D.term)}</div>
        <h1>Running order</h1>
        <div class="sub">${D.sets.length} sets · ${total} songs, in the order we play them</div>
      </section>
      <div class="when">${upcoming().map((u) => `
        <div class="when-item${u.big ? " big" : ""}">
          <span class="when-in">${inDays(daysAway(u.date))}</span>
          <span class="when-what">${esc(u.what)} · ${fmt(u.date)}</span>
          ${u.detail ? `<span class="when-detail">${esc(u.detail)}</span>` : ""}
        </div>`).join("")}
      </div>
      <div class="order-grid">
      ${D.sets.map((set, i) => {
        let n = 0;
        return `
        <section class="order-set s${i + 1}">
          <a class="order-set-head" href="#${set.id}">
            <span class="set-no">${i + 1}</span>
            <span class="set-name">
              <span class="label">${esc(set.name)} · ${songs(set).length} songs · ${esc(set.practice.replace(/^Saturdays\s*/, "Sat "))}</span>
              <h2>${esc(set.title)}</h2>
            </span>
            <span class="go" aria-hidden="true">→</span>
          </a>
          <ol class="order">
            ${set.songs.map((s) => s.interlude
              ? `<li class="gap">${esc(s.interlude)}</li>`
              : `<li><span class="n">${++n}</span><span class="tm"><span class="t">${esc(s.title)}</span><span class="m"><b>${esc(s.lead)}</b> · ${esc(s.artist)}</span></span><span class="k">${esc(s.key)}</span></li>`).join("")}
          </ol>
          ${lineupStrip(set)}
        </section>`;
      }).join("")}
      </div>
      ${legend()}`;
  }

  function legend() {
    const used = new Set(D.sets.flatMap((s) => s.roles.map(([r]) => roleKey(r))));
    const names = Object.fromEntries(D.sets.flatMap((s) => s.roles.map(([r]) => [roleKey(r), r])));
    return `<div class="legend"><span class="label">Colors</span>${ROLE_ORDER.filter((k) => used.has(k)).map((k) => roleChip(names[k])).join("")}</div>`;
  }

  function songMap(list) {
    if (!list.length) return `<p class="flow-empty">Arrangement not posted yet.</p>`;
    const secs = collapse(list);
    const notes = secs.map((s, i) => [i + 1, s]).filter(([, s]) => s.note);
    return `
      <ol class="map">${secs.map((s, i) => `
        <li class="blk t-${s.type}"><span class="blk-n">${i + 1}</span>${esc(s.name)}${s.x > 1 ? `<span class="x">×${s.x}</span>` : ""}${s.note ? `<sup>*</sup>` : ""}${s.dynamics ? `<span class="dyn">${esc(s.dynamics)}</span>` : ""}</li>`).join("")}
      </ol>
      ${notes.length ? `<ul class="map-notes">${notes.map(([n, s]) => `<li><span class="blk-n">${n}</span><b>${esc(s.name)}</b> ${esc(s.note)}</li>`).join("")}</ul>` : ""}`;
  }

  function song(s, n) {
    const chart = s.chart
      ? `<a class="btn primary" href="${esc(s.chart)}" target="_blank" rel="noopener">Open chart ↗</a>`
      : `<span class="btn" aria-disabled="true">Chart coming soon</span>`;
    return `
      <article class="card song">
        <div class="song-top">
          <div class="song-num">${n}</div>
          <div class="song-main">
            <h3>${esc(s.title)}</h3>
            <div class="artist">${esc(s.artist)}</div>
            <div class="song-tags">
              <span class="chip">Lead · ${s.lead.split("→").map((x) => personLink(x.trim())).join(" → ")}</span>
              ${s.confirmed ? `<span class="chip ok">Key confirmed</span>` : ""}
            </div>
          </div>
          <div class="key"><small>Key</small>${esc(s.key)}</div>
        </div>
        ${s.note ? `<p class="song-note">${esc(s.note)}</p>` : ""}
        ${songMap(s.sections || [])}
        <div class="song-actions">${chart}</div>
      </article>`;
  }

  function setView(set) {
    let n = 0;
    const i = D.sets.indexOf(set);
    return `
      <section class="page-head s${i + 1}">
        <div class="label"><span class="dot-no">${i + 1}</span>${esc(set.name)} · ${songs(set).length} songs · ${esc(set.practice)}</div>
        <h1>${esc(set.title)}</h1>
        ${set.subtitle ? `<div class="sub">${esc(set.subtitle)}</div>` : ""}
      </section>

      <div class="set-layout">
        <aside class="set-side">
          <h2 class="side-title">Who's on what</h2>
          <div class="roster">
            ${set.roles.map(([role, who]) => `
              <div class="r-${roleKey(role)}${who.length ? "" : " open"}">
                <div class="role"><i></i>${esc(role)}</div>
                <div class="who">${who.length ? who.map(personLink).join(", ") : "Open"}</div>
              </div>`).join("")}
          </div>
          <p class="note-small">(g) = sings while playing guitar · (?) = not confirmed</p>
          <div class="map-key"><span class="label">Song map</span>${["verse", "chorus", "bridge", "tag", "other"].map((t) =>
            `<span class="blk t-${t}">${{ verse: "Verse", chorus: "Chorus", bridge: "Bridge", tag: "Tag / Vamp", other: "Other" }[t]}</span>`).join("")}</div>
        </aside>
        <div class="songs">
          ${set.songs.map((s) => s.interlude ? `<div class="interlude">${esc(s.interlude)}</div>` : song(s, ++n)).join("")}
        </div>
      </div>`;
  }

  // Everyone, with every set + role they're on, built from the set rosters.
  function roster() {
    const map = new Map();
    for (const set of D.sets) {
      for (const [role, who] of set.roles) {
        for (const raw of who) {
          const name = baseName(raw);
          const extra = (raw.match(/\((.*)\)/) || [])[1] || "";
          if (!map.has(name)) map.set(name, new Map());
          const bySet = map.get(name);
          if (!bySet.has(set)) bySet.set(set, []);
          bySet.get(set).push([role, extra]);
        }
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function peopleView(focus) {
    const all = roster();
    const open = [];
    for (const set of D.sets) for (const [role, who] of set.roles) if (!who.length) open.push([set, role]);
    const leads = (name) => D.sets.flatMap((s) => songs(s).filter((x) => x.lead.split("→").some((l) => baseName(l.trim()) === name)).map((x) => x.title));
    return `
      <section class="page-head">
        <div class="label">Team</div>
        <h1>Who's on what</h1>
        <div class="sub">${all.length} people across ${D.sets.length} sets. Find your name, read across.</div>
      </section>
      <input class="search" id="search" type="search" placeholder="Find your name…" value="${esc(focus || "")}" autocomplete="off">
      <div class="matrix-wrap card">
        <table class="matrix" id="people">
          <thead><tr><th>Name</th>${D.sets.map((s, i) => `<th><a href="#${s.id}"><span class="dot-no s${i + 1}">${i + 1}</span>${esc(s.name)}</a></th>`).join("")}<th class="leads-h">Leads</th></tr></thead>
          <tbody>
          ${all.map(([name, bySet]) => `
            <tr class="${focus && name === focus ? "hl" : ""}" data-name="${esc(name.toLowerCase())}">
              <th scope="row">${esc(name)}<span class="count">${bySet.size}/${D.sets.length}</span></th>
              ${D.sets.map((s) => `<td>${(bySet.get(s) || []).map(([r, x]) => roleChip(r, x)).join("") || `<span class="off">—</span>`}</td>`).join("")}
              <td class="leads">${esc(leads(name).join(", ")) || `<span class="off">—</span>`}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      ${legend()}
      ${open.length ? `<div class="card open-slots"><h3>Still need someone</h3><ul>${open.map(([s, r]) => `<li>${roleChip(r)} <a href="#${s.id}">${esc(s.name)}</a></li>`).join("")}</ul></div>` : ""}`;
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
      if (a.dataset.view === active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = `${set ? set.name + " · " : view === "people" ? "People · " : ""}P&P ${D.term}`;

    wire();
    window.scrollTo(0, 0);
  }

  function wire() {
    const search = document.getElementById("search");
    if (search) {
      const filter = () => {
        const q = search.value.trim().toLowerCase();
        document.querySelectorAll("#people tbody tr").forEach((r) => { r.hidden = q && !r.dataset.name.includes(q); });
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
