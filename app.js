(function () {
  const D = window.PANDP;
  const app = document.getElementById("app");

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // "David (g)" -> "David"; "Anderson (?)" -> "Anderson"
  const baseName = (n) => n.replace(/\s*\(.*\)\s*$/, "").trim();
  const personLink = (n) => `<a class="person" href="#people/${encodeURIComponent(baseName(n))}">${esc(n)}</a>`;
  const songs = (set) => set.songs.filter((s) => !s.interlude);
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (const set of D.sets) songs(set).forEach((s, i) => Object.assign(s, { id: slug(s.title), set, n: i + 1 }));
  const allSongs = D.sets.flatMap(songs);

  // Saved in this browser only: view settings per song and the team's cached sheets.
  const store = {
    get(k) { try { return localStorage.getItem("pp:" + k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem("pp:" + k) : localStorage.setItem("pp:" + k, v); } catch (e) {} },
  };

  // Every instrument has one color, used everywhere it appears (CSS: .r-<key>).
  const ROLE_ORDER = ["vocals", "guitar", "electric", "piano", "cello", "bass", "cajon", "sound", "slides"];
  const roleKey = (role) => role.toLowerCase().replace(/[^a-z]/g, "");
  const roleChip = (role, extra = "") => `<span class="rchip r-${roleKey(role)}${extra === "?" ? " maybe" : ""}">${esc(role)}${extra === "?" ? " ?" : ""}</span>`;

  // Arrangement sections: "Bridge x3" / "2x" note -> repeat count, and a color by type.
  function section(s) {
    const sec = typeof s === "string" ? { name: s } : { ...s };
    const rep = /\s*(?:x\s*(\d+)|(\d+)\s*x)\b[.,]?\s*/i;
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

  // ---------- music: chords, transpose, numbers ----------
  const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const EXTRA = { Cb: 11, Fb: 4, "E#": 5, "B#": 0 };
  const mod = (n) => ((n % 12) + 12) % 12;
  const norm = (s) => s.replace(/♭/g, "b").replace(/♯/g, "#");
  const pcOf = (n) => { n = norm(n); return n in EXTRA ? EXTRA[n] : SHARP.includes(n) ? SHARP.indexOf(n) : FLAT.indexOf(n); };
  const flatKey = (p) => [5, 10, 3, 8, 1].includes(mod(p)); // F B♭ E♭ A♭ D♭
  const noteName = (p, flats) => (flats ? FLAT : SHARP)[mod(p)];
  const pretty = (s) => s.replace(/([A-G])#/g, "$1♯").replace(/([A-G])b/g, "$1♭");
  const DEG = ["1", "♭2", "2", "♭3", "3", "4", "♯4", "5", "♭6", "6", "♭7", "7"];
  const CHORD = /^([A-G][#b]?)((?:maj|min|dim|aug|sus|add|omit|no|No|m|M|[0-9]|[#b+°ø()^*-])*)(?:\/([A-G][#b]?))?(?:\(([A-G][^)]*)\))?$/;
  const isChord = (t) => CHORD.test(norm(t)) || /^N\.?C\.?$/i.test(t) || /^\([A-G].*\)$/.test(t) && CHORD.test(norm(t.slice(1, -1)));
  const keyPcOf = (song) => pcOf(song.key.split("→")[0].trim());

  // ctx: { keyPc, shift (semitones applied to what's written), flats, nums }
  function chordHTML(raw, ctx) {
    if (/^\(.+\)$/.test(raw)) return `(${chordHTML(raw.slice(1, -1), ctx)})`; // "(Db2)" alternate chord
    const m = norm(raw).match(CHORD);
    if (!m) return esc(raw);
    const [, root, qual, bass, alt] = m;
    const name = (n) => ctx.nums ? DEG[mod(pcOf(n) - ctx.keyPc)] : pretty(noteName(pcOf(n) + ctx.shift, ctx.flats));
    // Like SongSelect: minor "m" full size, the rest (2, sus, (4), maj7) raised.
    const [, minor = "", ext] = qual.match(/^(m(?!aj))?(.*)$/);
    return `${name(root)}${minor}${ext ? `<span class="q">${esc(ext)}</span>` : ""}${bass ? `<span class="sl">/${name(bass)}</span>` : ""}${alt ? `<span class="alt">(${chordHTML(alt, ctx)})</span>` : ""}`;
  }

  const BAR = /^[|:.\]\[]+$|^\|\|?:?$|^:?\|\|?$/;
  const REP = /^(x\d+|\d+x|\(x?\d+x?\)|-|–|\/|%|N\.?C\.?)$/i;
  const TAIL = /\s+(\((?![A-G][^)]*\)$)[^)]*\))\s*$/; // "| A | D | (To Ch. 2)"
  function isChordLine(line) {
    const toks = line.replace(TAIL, "").replace(/[\[\]]/g, " ").trim().split(/\s+/);
    return toks.some(isChord) && toks.every((t) => isChord(t) || BAR.test(t) || REP.test(t));
  }

  // Sheet format: "# Verse 1" = section, "[A]lyric [D]words" = chords over lyrics,
  // "| A | D | E |" = chord-only line, anything else = a lyric/comment line.
  function sheetHTML(text, ctx) {
    const out = [];
    let open = false;
    for (const raw of text.split("\n")) {
      const line = raw.replace(/\s+$/, "");
      const h = line.match(/^\s*#+\s*(.+)$/) || line.match(/^\s*\{\s*(?:c:|comment:)?\s*(.+?)\s*\}$/i);
      if (h) {
        if (open) out.push("</section>");
        const sec = section(h[1].trim());
        out.push(`<section class="sh-sec t-${sec.type}" data-sec="${esc(sec.name.toLowerCase())}"><h3 class="sh-h">${esc(sec.name)}${sec.x > 1 ? `<span class="x">×${sec.x}</span>` : ""}</h3>`);
        open = true;
      } else if (!line.trim()) {
        out.push(`<div class="sh-gap"></div>`);
      } else if (isChordLine(line)) {
        const tail = (line.match(TAIL) || [])[1];
        out.push(`<div class="sh-bars">${line.replace(TAIL, "").replace(/[\[\]]/g, " ").trim().split(/\s+/).map((t) =>
          BAR.test(t) ? `<span class="bar">${esc(t)}</span>` : isChord(t) ? `<b class="ch">${chordHTML(t, ctx)}</b>` : `<span class="rep">${esc(t)}</span>`).join("")}${tail ? `<span class="rep note">${esc(tail)}</span>` : ""}</div>`);
      } else if (line.includes("[")) {
        const parts = line.split(/\[([^\]]*)\]/);
        let html = parts[0] ? `<span class="seg"><b class="ch"></b><span class="ly">${esc(parts[0])}</span></span>` : "";
        for (let i = 1; i < parts.length; i += 2) html += `<span class="seg"><b class="ch">${chordHTML(parts[i], ctx)}</b><span class="ly">${parts[i + 1] ? esc(parts[i + 1]) : "&nbsp;"}</span></span>`;
        out.push(`<div class="sh-line">${html}</div>`);
      } else {
        out.push(`<div class="sh-ly${/^\s*\(/.test(line) ? " cmt" : ""}">${esc(line)}</div>`);
      }
    }
    if (open) out.push("</section>");
    return out.join("");
  }

  // ---------- views ----------

  function lineupStrip(set) {
    return `<div class="strip">${set.roles.filter(([, who]) => who.length).map(([role, who]) =>
      `<span class="strip-item r-${roleKey(role)}"><i></i>${esc(who.map(baseName).join(", "))}</span>`).join("")}</div>`;
  }

  // Running order: every set, songs in order. Sets sit side by side on wide screens.
  function home() {
    const total = allSongs.length;
    return `
      <section class="page-head row">
        <div>
          <div class="label">${esc(D.title)} · ${esc(D.term)}</div>
          <h1>Running order</h1>
          <div class="sub">${D.sets.length} sets · ${total} songs, in the order we play them</div>
        </div>
        <a class="btn primary focus-btn" href="#focus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>Focus mode</a>
      </section>
      <div class="order-grid">
      ${D.sets.map((set, i) => `
        <section class="order-set rise" style="--i:${i}">
          <a class="order-set-head" href="#${set.id}">
            <span class="set-no">${i + 1}</span>
            <span class="set-name">
              <span class="label">${esc(set.name)} · ${songs(set).length} songs</span>
              <h2>${esc(set.title)}</h2>
            </span>
            <span class="go" aria-hidden="true">→</span>
          </a>
          <ol class="order">
            ${set.songs.map((s) => s.interlude
              ? `<li class="gap">${esc(s.interlude)}</li>`
              : `<li><a class="row" href="#sheet/${s.id}"><span class="n">${s.n}</span><span class="tm"><span class="t">${esc(s.title)}</span><span class="m"><b>${esc(s.lead)}</b> · ${esc(s.artist)}</span></span><span class="k">${esc(s.key)}</span></a></li>`).join("")}
          </ol>
          ${lineupStrip(set)}
        </section>`).join("")}
      </div>
      ${legend()}`;
  }

  // Focus: the running order only, big, for reading at a glance. Tap a song (or ← →) to mark where you are.
  let now = -1;
  function focusView() {
    let g = 0;
    return `
      <div class="focus">
        <div class="focus-bar">
          <a class="btn" href="#home">✕ Exit</a>
          <span class="hint">Tap a song to mark where we are · ← → to move · Esc to exit</span>
        </div>
        ${D.sets.map((set, i) => `
          <section class="focus-set rise" style="--i:${i}">
            <h2><span class="set-no">${i + 1}</span>${esc(set.title)}</h2>
            <ol>
              ${set.songs.map((s) => s.interlude
                ? `<li class="gap">${esc(s.interlude)}</li>`
                : `<li class="f-song" data-g="${g++}"><span class="n">${s.n}</span><span class="t">${esc(s.title)}<small>${esc(s.lead)}</small></span><span class="k">${esc(s.key)}</span><a class="f-sheet" href="#sheet/${s.id}" aria-label="Open sheet for ${esc(s.title)}">Sheet</a></li>`).join("")}
            </ol>
          </section>`).join("")}
      </div>`;
  }
  function markNow() {
    document.querySelectorAll(".f-song").forEach((li) => {
      const g = +li.dataset.g;
      li.classList.toggle("now", g === now);
      li.classList.toggle("done", now >= 0 && g < now);
    });
    const cur = document.querySelector(".f-song.now");
    if (cur) cur.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function legend() {
    const used = new Set(D.sets.flatMap((s) => s.roles.map(([r]) => roleKey(r))));
    const names = Object.fromEntries(D.sets.flatMap((s) => s.roles.map(([r]) => [roleKey(r), r])));
    return `<div class="legend"><span class="label">Colors</span>${ROLE_ORDER.filter((k) => used.has(k)).map((k) => roleChip(names[k])).join("")}</div>`;
  }

  function songMap(list, opts = {}) {
    if (!list.length) return opts.compact ? "" : `<p class="flow-empty">Arrangement not posted yet.</p>`;
    const secs = collapse(list);
    const notes = secs.map((s, i) => [i + 1, s]).filter(([, s]) => s.note);
    return `
      <ol class="map${opts.compact ? " compact" : ""}">${secs.map((s, i) => `
        <li class="blk t-${s.type}" data-jump="${esc(s.name.toLowerCase())}"><span class="blk-n">${i + 1}</span>${esc(s.name)}${s.x > 1 ? `<span class="x">×${s.x}</span>` : ""}${s.note ? `<sup>*</sup>` : ""}${s.dynamics ? `<span class="dyn">${esc(s.dynamics)}</span>` : ""}</li>`).join("")}
      </ol>
      ${notes.length ? `<ul class="map-notes">${notes.map(([n, s]) => `<li><span class="blk-n">${n}</span><b>${esc(s.name)}</b> ${esc(s.note)}</li>`).join("")}</ul>` : ""}`;
  }

  function song(s, i) {
    return `
      <article class="card song rise" style="--i:${i}">
        <div class="song-top">
          <div class="song-num">${s.n}</div>
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
        <div class="song-actions">
          <a class="btn primary" href="#sheet/${s.id}">Open sheet</a>
          ${s.chart ? `<a class="btn" href="${esc(s.chart)}" target="_blank" rel="noopener">PDF chart ↗</a>` : ""}
        </div>
      </article>`;
  }

  function setView(set) {
    const i = D.sets.indexOf(set);
    let c = 0;
    return `
      <section class="page-head">
        <div class="label"><span class="dot-no">${i + 1}</span>${esc(set.name)} · ${songs(set).length} songs</div>
        <h1>${esc(set.title)}</h1>
        ${set.subtitle ? `<div class="sub">${esc(set.subtitle)}</div>` : ""}
      </section>

      <div class="set-layout">
        <aside class="set-side">
          <h2 class="side-title">Who's on what</h2>
          <div class="roster">
            ${set.roles.map(([role, who]) => `
              <div class="r-${roleKey(role)}${who.length ? "" : " open"}">
                <div class="role">${esc(role)}</div>
                <div class="who">${who.length ? who.map(personLink).join(", ") : "Open"}</div>
              </div>`).join("")}
          </div>
          <p class="note-small">(g) = sings while playing guitar · (?) = not confirmed</p>
          <div class="map-key"><span class="label">Song map</span>${["verse", "chorus", "bridge", "tag", "other"].map((t) =>
            `<span class="blk t-${t}">${{ verse: "Verse", chorus: "Chorus", bridge: "Bridge", tag: "Tag / Vamp", other: "Other" }[t]}</span>`).join("")}</div>
        </aside>
        <div class="songs">
          ${set.songs.map((s) => s.interlude ? `<div class="interlude">${esc(s.interlude)}</div>` : song(s, c++)).join("")}
        </div>
      </div>`;
  }

  // ---------- chord sheets ----------
  // Read-only copies of the SongSelect charts. They're licensed, so they aren't in this public code:
  // the team link (#unlock/<key>) fetches them from the Cloudflare worker and caches them on this device.

  let team = {};
  try { team = JSON.parse(store.get("team-sheets") || "{}"); } catch (e) {}
  const unlocked = () => !!store.get("team-key");
  async function loadTeam() {
    const key = store.get("team-key");
    if (!key) return;
    try {
      const r = await fetch("/api/sheets", { headers: { "x-team-key": key }, cache: "no-store" });
      if (!r.ok) return; // offline or wrong site: keep the cached copy
      const text = await r.text();
      if (text === store.get("team-sheets")) return;
      team = JSON.parse(text);
      store.set("team-sheets", text);
      if (view === "sheet" || view === "sheets") render(true);
    } catch (e) {}
  }

  const sheetText = (s) => team[s.id] ?? s.sheet ?? "";
  const viewState = (s) => {
    let v = {};
    try { v = JSON.parse(store.get("view:" + s.id) || "{}"); } catch (e) {}
    return { tr: 0, capo: 0, nums: false, size: 1, ...v };
  };
  const lockedNote = () => `<div class="locked card"><b>Sheets are for the team.</b> Open the team link once on this device and every SongSelect sheet shows up here. Ask Anderson for it.</div>`;

  function sheetView(s) {
    const v = viewState(s);
    const idx = allSongs.indexOf(s);
    const prev = allSongs[idx - 1], next = allSongs[idx + 1];
    return `
      <div class="sheet-page">
        <div class="sheet-head">
          <a class="back" href="#${s.set.id}">← ${esc(s.set.name)} · Song ${s.n}</a>
          <h1>${esc(s.title)}</h1>
          <div class="sub">${esc(s.artist)} · Lead ${esc(s.lead)} · Key ${esc(s.key)}</div>
        </div>

        <div class="toolbar" id="tb">
          <div class="ctl seg-ctl" role="group" aria-label="Transpose">
            <button type="button" data-act="down" aria-label="Transpose down">−</button>
            <span class="key-now" id="key-now"></span>
            <button type="button" data-act="up" aria-label="Transpose up">+</button>
          </div>
          <label class="ctl sel">Capo
            <select id="capo">${[0, 1, 2, 3, 4, 5, 6, 7].map((c) => `<option value="${c}"${c === v.capo ? " selected" : ""}>${c || "None"}</option>`).join("")}</select>
          </label>
          <button type="button" class="ctl tgl" data-act="nums" aria-pressed="${v.nums}" title="Nashville numbers">1·4·5</button>
          <div class="ctl seg-ctl" role="group" aria-label="Text size">
            <button type="button" data-act="smaller" aria-label="Smaller text">A−</button>
            <button type="button" data-act="bigger" aria-label="Bigger text">A+</button>
          </div>
          <button type="button" class="ctl" data-act="reset" title="Back to the original key">Reset</button>
        </div>
        <div class="capo-note" id="capo-note"></div>

        ${songMap(s.sections || [], { compact: true })}

        <div class="sheet-body">
          <div class="sheet" id="sheet" style="--fs:${v.size}"></div>
        </div>

        <nav class="sheet-nav">
          ${prev ? `<a class="btn" href="#sheet/${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}
          ${next ? `<a class="btn" href="#sheet/${next.id}">${esc(next.title)} →</a>` : ""}
        </nav>
      </div>`;
  }

  function wireSheet(s) {
    const v = viewState(s);
    const keyPc = keyPcOf(s);
    const sheet = document.getElementById("sheet");
    const save = () => store.set("view:" + s.id, JSON.stringify(v));

    function paint(pop) {
      const sounding = keyPc + v.tr, shapes = sounding - v.capo;
      const ctx = { keyPc, shift: v.tr - v.capo, flats: flatKey(shapes), nums: v.nums };
      const text = sheetText(s);
      sheet.innerHTML = text.trim() ? sheetHTML(text, ctx) : unlocked() ? `<p class="flow-empty">This sheet isn't posted yet.</p>` : lockedNote();
      sheet.style.setProperty("--fs", v.size);
      const k = document.getElementById("key-now");
      k.innerHTML = `<small>${v.tr ? (v.tr > 0 ? "+" : "") + v.tr : "Key"}</small>${pretty(noteName(sounding, flatKey(sounding)))}`;
      if (pop) { k.classList.remove("pop"); void k.offsetWidth; k.classList.add("pop"); }
      document.getElementById("capo-note").innerHTML = v.capo
        ? `Capo ${v.capo} · play <b>${pretty(noteName(shapes, flatKey(shapes)))}</b> shapes, sounds in ${pretty(noteName(sounding, flatKey(sounding)))}`
        : v.nums ? `Numbers relative to ${esc(s.key)}` : "";
    }

    document.getElementById("tb").onclick = (e) => {
      const btn = e.target.closest("[data-act]");
      const act = btn?.dataset.act;
      if (!act) return;
      if (act === "up" || act === "down") { v.tr = Math.max(-11, Math.min(11, v.tr + (act === "up" ? 1 : -1))); paint(true); }
      if (act === "nums") { v.nums = !v.nums; btn.setAttribute("aria-pressed", v.nums); paint(); }
      if (act === "bigger" || act === "smaller") { v.size = Math.max(.8, Math.min(1.8, +(v.size + (act === "bigger" ? .1 : -.1)).toFixed(1))); paint(); }
      if (act === "reset") {
        Object.assign(v, { tr: 0, capo: 0, nums: false });
        document.getElementById("capo").value = 0;
        document.querySelector("[data-act=nums]").setAttribute("aria-pressed", false);
        paint(true);
      }
      save();
    };
    document.getElementById("capo").onchange = (e) => { v.capo = +e.target.value; paint(); save(); };
    // Song map blocks jump to that section of the sheet.
    document.querySelectorAll(".map.compact .blk").forEach((b) => b.onclick = () => {
      const want = b.dataset.jump;
      const secs = [...sheet.querySelectorAll(".sh-sec")];
      const hit = secs.find((x) => x.dataset.sec === want) || secs.find((x) => x.dataset.sec.startsWith(want.split(" ")[0]));
      if (hit) { hit.scrollIntoView({ behavior: "smooth", block: "start" }); hit.classList.remove("flash"); void hit.offsetWidth; hit.classList.add("flash"); }
    });
    paint();
  }

  function sheetsIndex() {
    const ready = allSongs.filter((s) => sheetText(s).trim()).length;
    return `
      <section class="page-head">
        <div class="label">Chord sheets</div>
        <h1>Sheets</h1>
        <div class="sub">${unlocked() ? `${ready} of ${allSongs.length} songs ready. Transpose, capo and numbers on every sheet.` : "The SongSelect charts for every song, ready to transpose."}</div>
      </section>
      ${unlocked() ? "" : lockedNote()}
      <div class="order-grid">
        ${D.sets.map((set, i) => `
          <section class="order-set rise" style="--i:${i}">
            <a class="order-set-head" href="#${set.id}"><span class="set-no">${i + 1}</span><span class="set-name"><span class="label">${esc(set.name)}</span><h2>${esc(set.title)}</h2></span></a>
            <ol class="order">${songs(set).map((s) => {
              const has = !!sheetText(s).trim();
              return `<li><a class="row" href="#sheet/${s.id}"><span class="n">${s.n}</span><span class="tm"><span class="t">${esc(s.title)}</span><span class="m"><span class="st st-${has ? "pub" : "none"}">${has ? "Sheet ready" : unlocked() ? "Not posted yet" : "Team link needed"}</span></span></span><span class="k">${esc(s.key)}</span></a></li>`;
            }).join("")}</ol>
          </section>`).join("")}
      </div>`;
  }

  // ---------- people ----------

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
    const leads = (name) => allSongs.filter((x) => x.lead.split("→").some((l) => baseName(l.trim()) === name)).map((x) => x.title);
    return `
      <section class="page-head">
        <div class="label">Team</div>
        <h1>Who's on what</h1>
        <div class="sub">${all.length} people across ${D.sets.length} sets. Find your name, read across.</div>
      </section>
      <input class="search" id="search" type="search" placeholder="Find your name…" value="${esc(focus || "")}" autocomplete="off">
      <div class="matrix-wrap card rise">
        <table class="matrix" id="people">
          <thead><tr><th>Name</th>${D.sets.map((s, i) => `<th><a href="#${s.id}"><span class="dot-no">${i + 1}</span>${esc(s.name)}</a></th>`).join("")}<th class="leads-h">Leads</th></tr></thead>
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

  let view = "home";
  function render(keepScroll) {
    const hash = decodeURIComponent(location.hash.slice(1)) || "home";
    const [v, arg] = hash.split("/");
    // Team link: remember the key on this device, then drop it from the address bar.
    if (v === "unlock" && arg) {
      store.set("team-key", arg);
      history.replaceState(null, "", location.pathname + location.search + "#sheets");
      loadTeam();
      return render();
    }
    const set = D.sets.find((s) => s.id === v);
    const sheetSong = v === "sheet" && allSongs.find((s) => s.id === arg);
    view = set ? "set" : sheetSong ? "sheet" : ["people", "focus", "sheets"].includes(v) ? v : "home";

    app.innerHTML = { set: () => setView(set), sheet: () => sheetView(sheetSong), people: () => peopleView(arg),
      focus: focusView, sheets: sheetsIndex, home }[view]();
    app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter");
    document.body.classList.toggle("is-focus", view === "focus");

    const active = set ? set.id : view === "sheet" ? "sheets" : view === "focus" ? "home" : view;
    document.querySelectorAll("#tabs a").forEach((a) => {
      if (a.dataset.view === active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    moveInd();
    document.title = `${set ? set.name + " · " : sheetSong ? sheetSong.title + " · " : view !== "home" ? view[0].toUpperCase() + view.slice(1) + " · " : ""}P&P ${D.term}`;

    if (view === "sheet") wireSheet(sheetSong);
    if (view === "focus") { document.querySelectorAll(".f-song").forEach((li) => li.onclick = (e) => { if (!e.target.closest("a")) { now = +li.dataset.g === now ? -1 : +li.dataset.g; markNow(); } }); markNow(); }
    const search = document.getElementById("search");
    if (search) {
      const filter = () => {
        const q = search.value.trim().toLowerCase();
        document.querySelectorAll("#people tbody tr").forEach((r) => { r.hidden = q && !r.dataset.name.includes(q); });
      };
      search.oninput = filter;
      filter();
    }
    if (!keepScroll) window.scrollTo(0, 0);
  }

  // Sliding pill behind the active tab.
  const ind = document.querySelector(".tab-ind");
  function moveInd() {
    const a = document.querySelector("#tabs a[aria-current]");
    ind.style.opacity = a ? 1 : 0;
    if (a) { ind.style.width = a.offsetWidth + "px"; ind.style.transform = `translateX(${a.offsetLeft}px)`; }
  }
  addEventListener("resize", moveInd);

  addEventListener("keydown", (e) => {
    if (view !== "focus" || e.metaKey || e.ctrlKey || e.altKey) return;
    const total = document.querySelectorAll(".f-song").length;
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { now = Math.min(total - 1, now + 1); markNow(); e.preventDefault(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { now = Math.max(0, now - 1); markNow(); e.preventDefault(); }
    if (e.key === "Escape") location.hash = "home";
  });

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

  addEventListener("hashchange", () => render());
  render();
  loadTeam();
  document.fonts?.ready.then(moveInd);
})();
