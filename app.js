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
    const name = (n) => (ctx.nums ? DEG[mod(pcOf(n) - ctx.keyPc)] : pretty(noteName(pcOf(n) + ctx.shift, ctx.flats))).replace(/[♭♯]/g, '<span class="acc">$&</span>');
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
      if (/^@\w+\s/.test(line)) continue;
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
        // Each word is its own block so lines wrap between words on a phone; a chord rides on the word it starts.
        const parts = line.split(/\[([^\]]*)\]/);
        const seg = (ch, text) => `<span class="seg"><b class="ch">${ch}</b><span class="ly">${text ? esc(text) : "&nbsp;"}</span></span>`;
        const words = (text) => text.match(/\S*\s*/g).filter(Boolean);
        let html = words(parts[0]).map((w) => seg("", w)).join("");
        for (let i = 1; i < parts.length; i += 2) {
          const [first = "", ...rest] = words(parts[i + 1] || "");
          html += seg(chordHTML(parts[i], ctx), first) + rest.map((w) => seg("", w)).join("");
        }
        out.push(`<div class="sh-line">${html}</div>`);
      } else {
        out.push(`<div class="sh-ly${/^\s*\(/.test(line) ? " cmt" : ""}">${esc(line)}</div>`);
      }
    }
    if (open) out.push("</section>");
    return out.join("");
  }

  // ---------- views ----------
  // Layout follows SongSelect: plain white pages, hairline-divided lists, one clear action per row.

  const lineup = (set) => `<ul class="lineup">${set.roles.map(([role, who]) => `
    <li class="r-${roleKey(role)}${who.length ? "" : " open"}"><span class="dot"></span><span class="role">${esc(role)}</span><span class="who">${who.length ? who.map(personLink).join(", ") : "Open"}</span></li>`).join("")}</ul>`;

  // One song row: number, title + artist, lead, key. The whole row opens the sheet.
  const songRow = (s) => `
    <li class="srow"><a href="#sheet/${s.id}">
      <span class="n">${s.n}</span>
      <span class="ti"><span class="t">${esc(s.title)}</span><span class="a">${esc(s.artist)}</span></span>
      <span class="ld">${esc(s.lead)}</span>
      <span class="k">${esc(s.key)}</span>
      <span class="chev" aria-hidden="true">›</span>
    </a></li>`;
  const songList = (set) => `<ol class="slist">
    <li class="shead" aria-hidden="true"><span>#</span><span>Song</span><span class="ld">Lead</span><span class="k">Key</span><span></span></li>
    ${set.songs.map((s) => s.interlude ? `<li class="gap">${esc(s.interlude)}</li>` : songRow(s)).join("")}</ol>`;

  function home() {
    return `
      <header class="phead">
        <div>
          <h1>Running order</h1>
          <p class="sub">${D.sets.length} sets · ${allSongs.length} songs · tap a song for its chord sheet</p>
        </div>
        <a class="btn" href="#focus">Focus mode</a>
      </header>
      ${D.sets.map((set, i) => `
        <section class="block">
          <a class="bhead" href="#${set.id}"><span class="set-no">${i + 1}</span><span><span class="label">${esc(set.name)}</span><h2>${esc(set.title)}</h2></span><span class="more">Lineup ›</span></a>
          ${songList(set)}
        </section>`).join("")}`;
  }

  // Focus: the running order only, big. Read-only; tap/← → just marks where you are on this screen.
  let now = -1;
  function focusView() {
    let g = 0;
    return `
      <div class="focus">
        <div class="focus-bar"><a class="btn" href="#home">✕ Exit</a><span class="hint">Tap a song or use ← → to mark where we are · Esc exits</span></div>
        ${D.sets.map((set, i) => `
          <section class="focus-set">
            <h2><span class="set-no">${i + 1}</span>${esc(set.title)}</h2>
            <ol>${set.songs.map((s) => s.interlude
              ? `<li class="gap">${esc(s.interlude)}</li>`
              : `<li class="f-song" data-g="${g++}"><span class="n">${s.n}</span><span class="t">${esc(s.title)}<small>${esc(s.lead)}</small></span><span class="k">${esc(s.key)}</span></li>`).join("")}</ol>
          </section>`).join("")}
      </div>`;
  }
  function markNow() {
    document.querySelectorAll(".f-song").forEach((li) => {
      const g = +li.dataset.g;
      li.classList.toggle("now", g === now);
      li.classList.toggle("done", now >= 0 && g < now);
    });
    document.querySelector(".f-song.now")?.scrollIntoView({ block: "center" });
  }

  function songMap(list, jump) {
    if (!list.length) return "";
    const secs = collapse(list);
    return `
      <ol class="map">${secs.map((s) => `
        <li class="blk t-${s.type}"${jump ? ` data-jump="${esc(s.name.toLowerCase())}" tabindex="0"` : ""}>${esc(s.name)}${s.x > 1 ? `<span class="x">×${s.x}</span>` : ""}</li>`).join("")}
      </ol>
      ${secs.some((s) => s.note) ? `<ul class="map-notes">${secs.filter((s) => s.note).map((s) => `<li><b>${esc(s.name)}</b> ${esc(s.note)}</li>`).join("")}</ul>` : ""}`;
  }

  function setView(set) {
    const i = D.sets.indexOf(set);
    return `
      <header class="phead">
        <div>
          <div class="label"><span class="set-no sm">${i + 1}</span>${esc(set.name)} · ${songs(set).length} songs</div>
          <h1>${esc(set.title)}</h1>
          ${set.subtitle ? `<p class="sub">${esc(set.subtitle)}</p>` : ""}
        </div>
      </header>
      <div class="two">
        <div class="main-col">
          <ol class="songs">
            ${set.songs.map((s) => s.interlude ? `<li class="gap">${esc(s.interlude)}</li>` : `
              <li class="song">
                <a class="song-link" href="#sheet/${s.id}">
                  <span class="n">${s.n}</span>
                  <span class="ti"><span class="t">${esc(s.title)}</span><span class="a">${esc(s.artist)} · Lead ${esc(s.lead)}</span></span>
                  <span class="k">${esc(s.key)}</span>
                </a>
                ${s.note ? `<p class="song-note">${esc(s.note)}</p>` : ""}
                ${s.sections?.length ? `<div class="arr"><span class="label">Arrangement</span>${songMap(s.sections)}</div>` : ""}
              </li>`).join("")}
          </ol>
        </div>
        <aside class="side-col">
          <h2 class="label">Lineup</h2>
          ${lineup(set)}
          <p class="fine">(g) sings while playing guitar · (?) not confirmed</p>
        </aside>
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
    return { tr: 0, capo: 0, nums: false, size: 1, cols: 2, ...v };
  };
  const lockedNote = () => `<div class="notice"><b>Sheets are for the team.</b> Open the team link once on this device and every SongSelect chart shows up here. Ask Anderson for it.</div>`;
  const KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  // Header/footer lines copied from the PDF ("@authors …", "@meta Key - A | Tempo …", "@footer …").
  const metaOf = (text) => {
    const m = { authors: [], note: [], meta: [], footer: [] };
    for (const l of text.split("\n")) { const x = l.match(/^@(\w+)\s+(.*)$/); if (x && m[x[1]]) m[x[1]].push(x[2]); }
    return m;
  };

  function sheetView(s) {
    const v = viewState(s);
    const idx = allSongs.indexOf(s);
    const prev = allSongs[idx - 1], next = allSongs[idx + 1];
    const kp = keyPcOf(s);
    return `
      <div class="viewer">
        <aside class="opts" id="opts">
          <a class="back" href="#${s.set.id}">‹ ${esc(s.set.name)}</a>
          <h1>${esc(s.title)}</h1>
          <p class="sub">${esc(s.artist)}<br>Lead ${esc(s.lead)} · Song ${s.n} of ${songs(s.set).length}</p>

          <div class="opt">
            <span class="label">Key</span>
            <div class="keys" role="group" aria-label="Key">${KEYS.map((k) => `<button type="button" data-key="${pcOf(k)}"${pcOf(k) === kp ? ' class="orig" title="Original key"' : ""}>${pretty(k)}</button>`).join("")}</div>
            <select class="key-sel" id="key-sel" aria-label="Key">${KEYS.map((k) => `<option value="${pcOf(k)}">${pretty(k)}${pcOf(k) === kp ? " (original)" : ""}</option>`).join("")}</select>
          </div>
          <div class="opt row">
            <label><span class="label">Capo</span>
              <select id="capo">${[0, 1, 2, 3, 4, 5, 6, 7].map((c) => `<option value="${c}"${c === v.capo ? " selected" : ""}>${c || "None"}</option>`).join("")}</select>
            </label>
            <div><span class="label">Show</span>
              <div class="segc" role="group"><button type="button" data-nums="0">Chords</button><button type="button" data-nums="1">Numbers</button></div>
            </div>
          </div>
          <div class="opt row">
            <div class="cols-opt"><span class="label">Columns</span>
              <div class="segc" role="group"><button type="button" data-cols="1">1</button><button type="button" data-cols="2">2</button></div>
            </div>
            <div><span class="label">Size</span>
              <div class="segc" role="group"><button type="button" data-size="-1" aria-label="Smaller">A−</button><button type="button" data-size="1" aria-label="Bigger">A+</button></div>
            </div>
          </div>
          <div class="opt acts">
            <button type="button" class="btn" data-act="stage">Stage mode</button>
            <button type="button" class="btn ghost" data-act="print">Print</button>
          </div>
          ${s.sections?.length ? `<div class="opt jump"><span class="label">Arrangement · tap to jump</span>${songMap(s.sections, true)}</div>` : ""}
          <nav class="pn">
            ${prev ? `<a href="#sheet/${prev.id}"><small>Previous</small>${esc(prev.title)}</a>` : "<span></span>"}
            ${next ? `<a class="nx" href="#sheet/${next.id}"><small>Next</small>${esc(next.title)}</a>` : ""}
          </nav>
        </aside>

        <div class="canvas">
          <div class="stagebar">
            <button type="button" class="btn ghost" data-act="stage">✕</button>
            <span class="st-t">${esc(s.title)}</span>
            <button type="button" class="btn ghost" data-step="-1" aria-label="Key down">−</button>
            <span class="st-k" id="st-k"></span>
            <button type="button" class="btn ghost" data-step="1" aria-label="Key up">+</button>
            ${next ? `<a class="btn ghost" href="#sheet/${next.id}">Next ›</a>` : ""}
          </div>
          <article class="paper" id="paper"></article>
        </div>
      </div>`;
  }

  function wireSheet(s) {
    const v = viewState(s);
    const kp = keyPcOf(s);
    const paper = document.getElementById("paper");
    const page = document.querySelector(".viewer");
    const save = () => store.set("view:" + s.id, JSON.stringify(v));

    function paint() {
      const sounding = mod(kp + v.tr), shapes = sounding - v.capo;
      const keyName = pretty(noteName(sounding, flatKey(sounding)));
      const ctx = { keyPc: kp, shift: v.tr - v.capo, flats: flatKey(shapes), nums: v.nums };
      const text = sheetText(s);
      const m = metaOf(text);
      const meta = (m.meta[0] || `Key - ${s.key}`).replace(/Key - [^|]+/, `Key - ${keyName}${v.tr ? ` (orig. ${pretty(s.key.split("→")[0].trim())})` : ""} `)
        + (v.capo ? ` | Capo ${v.capo}: play ${pretty(noteName(shapes, flatKey(shapes)))} shapes` : "");
      paper.style.setProperty("--fs", v.size);
      paper.classList.toggle("one", v.cols === 1);
      paper.innerHTML = text.trim() ? `
        <header class="p-head">
          <h2>${esc(s.title)}</h2>
          ${m.authors.map((a) => `<div class="p-auth">${esc(a)}</div>`).join("")}
          ${m.note.map((a) => `<div class="p-auth">${esc(a)}</div>`).join("")}
          <div class="p-meta">${esc(meta).replace(/[♭♯]/g, '<span class="acc">$&</span>')}</div>
        </header>
        <div class="p-body">${sheetHTML(text, ctx)}</div>
        ${m.footer.length ? `<footer class="p-foot">${m.footer.map((f) => `<div>${esc(f)}</div>`).join("")}</footer>` : ""}`
        : unlocked() ? `<p class="empty">This sheet isn't posted yet.</p>` : lockedNote();
      tidy();

      document.querySelectorAll(".keys button").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.key === sounding));
      document.getElementById("key-sel").value = sounding;
      document.getElementById("st-k").textContent = keyName;
      document.querySelectorAll("[data-nums]").forEach((b) => b.setAttribute("aria-pressed", (b.dataset.nums === "1") === v.nums));
      document.querySelectorAll("[data-cols]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.cols === v.cols));
      document.querySelectorAll("[data-act=stage]").forEach((b) => b.setAttribute("aria-pressed", document.body.classList.contains("is-stage")));
    }
    // Like the PDF, chords float above the lyric without stretching it. Only where two chords
    // would collide does the lyric get pushed apart; and wrapped rows with no chords lose the chord row.
    function tidy() {
      const gap = parseFloat(getComputedStyle(paper).fontSize) * .45;
      for (const line of paper.querySelectorAll(".sh-line")) {
        const segs = [...line.children];
        segs.forEach((x) => { x.classList.remove("bare"); x.style.marginLeft = ""; });
        let top = -1, right = 0;
        for (const x of segs) {
          const ch = x.firstElementChild;
          if (x.offsetTop !== top) { top = x.offsetTop; right = 0; }
          if (!ch.textContent) continue;
          if (x.offsetLeft < right) x.style.marginLeft = right - x.offsetLeft + "px";
          if (x.offsetTop !== top) { top = x.offsetTop; } // pushed onto the next row
          right = x.offsetLeft + ch.offsetWidth + gap;
        }
        const rows = new Map();
        for (const x of segs) rows.set(x.offsetTop, (rows.get(x.offsetTop) || []).concat(x));
        for (const row of rows.values()) if (!row.some((x) => x.firstElementChild.textContent)) row.forEach((x) => x.classList.add("bare"));
      }
    }
    onresize = () => view === "sheet" && tidy();
    const setKey = (pc) => { let t = mod(pc - kp); if (t > 6) t -= 12; v.tr = t; };

    page.onclick = (e) => {
      const b = e.target.closest("button, [data-jump]");
      if (!b) return;
      if (b.dataset.key) setKey(+b.dataset.key);
      else if (b.dataset.step) setKey(kp + v.tr + +b.dataset.step);
      else if (b.dataset.nums) v.nums = b.dataset.nums === "1";
      else if (b.dataset.cols) v.cols = +b.dataset.cols;
      else if (b.dataset.size) v.size = Math.max(.8, Math.min(1.8, +(v.size + b.dataset.size * .1).toFixed(1)));
      else if (b.dataset.act === "stage") { const on = document.body.classList.toggle("is-stage"); store.set("stage", on ? "1" : null); }
      else if (b.dataset.act === "print") return print();
      else if (b.dataset.jump) {
        const want = b.dataset.jump, secs = [...paper.querySelectorAll(".sh-sec")];
        const hit = secs.find((x) => x.dataset.sec === want) || secs.find((x) => x.dataset.sec.startsWith(want.split(" ")[0]));
        hit?.scrollIntoView({ block: "start" });
        return;
      } else return;
      save();
      paint();
    };
    document.getElementById("key-sel").onchange = (e) => { setKey(+e.target.value); save(); paint(); };
    document.getElementById("capo").onchange = (e) => { v.capo = +e.target.value; save(); paint(); };
    paint();
  }

  function sheetsIndex() {
    const ready = allSongs.filter((s) => sheetText(s).trim()).length;
    return `
      <header class="phead">
        <div>
          <h1>Chord sheets</h1>
          <p class="sub">${unlocked() ? `${ready} of ${allSongs.length} SongSelect charts · change key, capo or numbers on any of them` : "The SongSelect chart for every song, in any key."}</p>
        </div>
      </header>
      ${unlocked() ? "" : lockedNote()}
      ${D.sets.map((set, i) => `
        <section class="block">
          <div class="bhead"><span class="set-no">${i + 1}</span><span><span class="label">${esc(set.name)}</span><h2>${esc(set.title)}</h2></span></div>
          ${songList(set)}
        </section>`).join("")}`;
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
      <header class="phead">
        <div>
          <h1>Who's on what</h1>
          <p class="sub">${all.length} people · find your name and read across</p>
        </div>
      </header>
      <input class="search" id="search" type="search" placeholder="Find your name" value="${esc(focus || "")}" autocomplete="off">
      <div class="table-wrap">
        <table class="matrix" id="people">
          <thead><tr><th>Name</th>${D.sets.map((s) => `<th><a href="#${s.id}">${esc(s.name)}</a></th>`).join("")}<th class="leads-h">Leads</th></tr></thead>
          <tbody>
          ${all.map(([name, bySet]) => `
            <tr class="${focus && name === focus ? "hl" : ""}" data-name="${esc(name.toLowerCase())}">
              <th scope="row">${esc(name)}</th>
              ${D.sets.map((s) => `<td>${(bySet.get(s) || []).map(([r, x]) => roleChip(r, x)).join("") || `<span class="off">–</span>`}</td>`).join("")}
              <td class="leads">${esc(leads(name).join(", ")) || `<span class="off">–</span>`}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      ${open.length ? `<p class="fine open">Still open: ${open.map(([s, r]) => `${esc(s.name)} ${esc(r.toLowerCase())}`).join(" · ")}</p>` : ""}`;
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
    document.body.dataset.view = view;
    document.body.classList.toggle("is-focus", view === "focus");
    document.body.classList.toggle("is-stage", view === "sheet" && store.get("stage") === "1");

    const active = set ? set.id : view === "sheet" ? "sheets" : view === "focus" ? "home" : view;
    document.querySelectorAll("#tabs a").forEach((a) => {
      if (a.dataset.view === active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = `${set ? set.name + " · " : sheetSong ? sheetSong.title + " · " : view !== "home" ? view[0].toUpperCase() + view.slice(1) + " · " : ""}P&P ${D.term}`;

    if (view === "sheet") wireSheet(sheetSong);
    if (view === "focus") { document.querySelectorAll(".f-song").forEach((li) => li.onclick = () => { now = +li.dataset.g === now ? -1 : +li.dataset.g; markNow(); }); markNow(); }
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

  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|select|textarea/i.test(e.target.tagName)) return;
    if (view === "sheet") {
      const i = allSongs.findIndex((s) => location.hash === "#sheet/" + s.id);
      const go = (s) => s && (location.hash = "sheet/" + s.id);
      const step = (d) => document.querySelector(`.stagebar [data-step="${d}"]`)?.click();
      if (e.key === "ArrowRight") go(allSongs[i + 1]);
      else if (e.key === "ArrowLeft") go(allSongs[i - 1]);
      else if (e.key === "+" || e.key === "=") step(1);
      else if (e.key === "-" || e.key === "_") step(-1);
      else if (e.key === "f" || e.key === "F" || (e.key === "Escape" && document.body.classList.contains("is-stage"))) document.querySelector("[data-act=stage]")?.click();
      else return;
      e.preventDefault();
      return;
    }
    if (view !== "focus") return;
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

  // Works offline once opened (and can be added to the home screen).
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

  addEventListener("hashchange", () => render());
  render();
  loadTeam();
})();
