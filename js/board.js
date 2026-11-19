import { $, el, icon, toast, openModal, modalHead, confirmDialog, rupees, parseRupees, ago, debounce, lsGet, lsSet, shrinkImage, initials } from "./ui.js";
import { parseLink, embedUrl, cleanHandle } from "./links.js";
import { S, can, cat, functions, areas, subAreas, itemFns, itemAreas, itemTopAreas, votesFor, commentsFor, nameOf, vendorByHandle,
  STATUS, statusMode, matches, visibleItems, cellStats } from "./state.js";
import { refresh, paintWedding } from "./app.js";

/* ================= Board tab ================= */

export function renderBoard(root) {
  const f = S.filter, W = S.W;
  const mode = statusMode();
  const base = { ...f, status: "all" };
  const n = st => W.items.filter(i => matches(i, base, "all") && (st === "curated" ? i.status !== "idea" : i.status === st)).length;

  const chip = (label, on, onclick, extra = {}) => el("button", { type: "button", class: "chip" + (on ? " on" : ""), "aria-pressed": String(on), onclick, ...extra }, label);
  const countIn = (fnId, areaId) => W.items.filter(i => matches(i, { ...f, fn: fnId, area: areaId, sub: null }, mode)).length;

  const fnRow = el("div", { class: "chips scroll", role: "group", "aria-label": "Functions" },
    chip(["All functions"], !f.fn, () => set({ fn: null })),
    ...functions().map(c => chip([el("span", { class: "dot", style: { background: c.color } }), c.name, el("span", { class: "n" }, countIn(c.id, f.area))],
      f.fn === c.id, () => set({ fn: f.fn === c.id ? null : c.id }))));
  const areaRow = el("div", { class: "chips scroll", role: "group", "aria-label": "What for" },
    chip("Everything", !f.area, () => set({ area: null, sub: null })),
    ...areas().map(a => chip([a.name, el("span", { class: "n" }, countIn(f.fn, a.id))], f.area === a.id, () => set({ area: f.area === a.id ? null : a.id, sub: null }))));
  const subs = f.area ? subAreas(f.area) : [];
  const subRow = subs.length ? el("div", { class: "chips scroll sub", role: "group", "aria-label": "Finer" },
    el("span", { class: "sub-label" }, cat(f.area).name, " ›"),
    chip("All", !f.sub, () => set({ sub: null })),
    ...subs.map(s => chip(s.name, f.sub === s.id, () => set({ sub: f.sub === s.id ? null : s.id })))) : null;

  const seg = el("div", { class: "seg", role: "group", "aria-label": "Show" },
    ...[["curated", "★ Curated", n("curated")], ["idea", "Ideas", n("idea")], ["final", "✓ Final", n("final")], ["all", "All", null]].map(([k, l, c]) =>
      el("button", { type: "button", class: "seg-btn", "aria-pressed": String(mode === k), onclick: () => set({ status: k }) }, l, c != null ? el("span", { class: "n" }, c) : null)));
  const search = el("input", { type: "search", class: "search", placeholder: "Search ideas & vendors", value: f.q, "aria-label": "Search",
    oninput: debounce(e => { S.filter.q = e.target.value.trim().toLowerCase(); paintResults(); }, 150) });
  const viewSeg = el("div", { class: "seg icons", role: "group", "aria-label": "View" },
    el("button", { type: "button", class: "seg-btn", title: "Grid", "aria-label": "Grid", "aria-pressed": String(S.view === "grid"), onclick: () => setView("grid") }, icon("grid")),
    el("button", { type: "button", class: "seg-btn", title: "Functions × areas", "aria-label": "Functions by area", "aria-pressed": String(S.view === "matrix"), onclick: () => setView("matrix") }, icon("table")));

  const results = el("div", { id: "results" });
  root.replaceChildren(
    el("section", { class: "filters" }, fnRow, areaRow, subRow,
      el("div", { class: "row wrap tools" }, seg, search, viewSeg),
      f.vendor ? el("p", { class: "vendor-filter" }, "Showing work by ", el("b", {}, "@" + f.vendor), el("button", { class: "link-btn", onclick: () => set({ vendor: null }) }, "Clear")) : null,
      mode === "all" && f.status === "curated" && W.items.length ? el("p", { class: "hint" }, icon("star", 14), " Nothing is curated yet, so you're seeing every idea. Tap ☆ on the ones you love: the board then opens on your curated picks.") : null),
    results);
  paintResults();

  function paintResults() { results.replaceChildren(S.view === "matrix" ? matrix() : grid()); }
}

function set(patch) { Object.assign(S.filter, patch); paintWedding(); }
function setView(v) { S.view = v; lsSet("se-view", v); paintWedding(); }

function grid() {
  const items = visibleItems();
  if (!S.W.items.length) return firstRun();
  if (!items.length) return el("div", { class: "empty" }, el("h2", { class: "serif" }, "Nothing here yet"),
    el("p", { class: "muted" }, statusMode() === "curated" ? "No curated ideas match. Switch to Ideas to see everything saved." : "No ideas match these filters."),
    el("div", { class: "row center" },
      statusMode() !== "all" ? el("button", { class: "btn", onclick: () => set({ status: "all" }) }, "Show all ideas") : null,
      el("button", { class: "btn ghost", onclick: () => set({ fn: null, area: null, sub: null, q: "", vendor: null, status: "all" }) }, "Clear filters"),
      can.edit() ? el("button", { class: "btn primary", onclick: () => openAdd() }, "Add an idea") : null));
  return el("div", { class: "masonry" }, ...items.map(card));
}

function firstRun() {
  const android = /android/i.test(navigator.userAgent);
  return el("div", { class: "first-run" },
    el("h2", { class: "serif" }, "Your board is ready"),
    el("p", { class: "muted" }, "Add your first idea. Here are three quick ways:"),
    el("ol", { class: "how" },
      el("li", {}, el("b", {}, "Paste a link. "), "Copy a reel or post link in Instagram (Share › Copy link), then come here and paste anywhere, or tap Add idea."),
      el("li", {}, el("b", {}, android ? "Share from Instagram. " : "Add to your home screen. "),
        android ? "Install this app (browser menu › Add to Home screen), then Instagram's Share › More shows Shaadi Edit." : "In Safari, tap Share › Add to Home Screen, so the board is one tap away."),
      el("li", {}, el("b", {}, "Add photos. "), "Screenshots, lookbooks, photos from a shop visit: they all work.")),
    can.edit() ? el("button", { class: "btn primary big", onclick: () => openAdd() }, icon("plus"), "Add the first idea") : null,
    can.own() ? el("p", { class: "fine" }, "Then invite family from the ", el("a", { href: `#/w/${S.W.wedding.id}/family` }, "Family"), " tab.") : null);
}

/* ---------- Cards ---------- */

function card(it) {
  const v = votesFor(it.id), mine = v.some(x => x.user_id === S.me.id), cs = commentsFor(it.id);
  const open = () => openDetail(it.id);
  return el("article", { class: `card s-${it.status}`, "data-id": it.id },
    media(it, false, open),
    el("div", { class: "c-body", role: "button", tabindex: "0", "aria-label": "Open " + (it.title || "idea"), onclick: open, onkeydown: e => { if (e.key === "Enter") open(); } },
      el("div", { class: "c-tags" },
        it.status !== "idea" ? el("span", { class: "badge " + (it.status === "final" ? "final" : "cur") }, it.status === "final" ? "✓ Final" : "★ Curated") : null,
        ...itemFns(it).map(c => el("span", { class: "fn-tag", style: { "--c": c.color } }, c.name)),
        ...itemAreas(it).filter(a => a.parent_id || !itemAreas(it).some(b => b.parent_id === a.id)).map(a => el("span", { class: "tag" }, a.name))),
      it.title ? el("h3", { class: "c-title" }, it.title) : null,
      it.note && it.kind !== "note" ? el("p", { class: "c-note" }, it.note) : null,
      it.vendor_handle || it.price ? el("p", { class: "c-meta" },
        it.vendor_handle ? el("button", { class: "handle", type: "button", onclick: e => { e.stopPropagation(); set({ vendor: it.vendor_handle.toLowerCase(), status: "all" }); } }, "@" + it.vendor_handle) : null,
        it.price ? el("span", { class: "price" }, rupees(it.price)) : null) : null),
    el("div", { class: "c-foot" },
      el("button", { type: "button", class: "vote" + (mine ? " on" : ""), disabled: !can.comment(), "aria-pressed": String(mine), "aria-label": `Love it (${v.length})`,
        title: v.length ? v.map(x => nameOf(x.user_id)).join(", ") : "Love it", onclick: () => vote(it, !mine) }, icon("heart", 16), v.length || ""),
      el("button", { type: "button", class: "cm", onclick: open, "aria-label": `${cs.length} comments` }, icon("chat", 15), cs.length || ""),
      el("span", { class: "grow" }),
      can.edit() ? el("button", { type: "button", class: "q star" + (it.status !== "idea" ? " on" : ""), title: it.status === "idea" ? "Curate" : "Back to ideas",
        "aria-label": it.status === "idea" ? "Curate" : "Uncurate", onclick: () => setStatus(it, it.status === "idea" ? "curated" : "idea") }, icon("star", 17)) : null,
      can.edit() ? el("button", { type: "button", class: "q fin" + (it.status === "final" ? " on" : ""), title: it.status === "final" ? "Not final" : "Mark final",
        "aria-label": it.status === "final" ? "Not final" : "Mark final", onclick: () => setStatus(it, it.status === "final" ? "curated" : "final") }, icon("check", 17)) : null));
}

const urlCache = new Map();
function media(it, big, onclick) {
  const box = el("div", { class: "media" + (big ? " big" : ""), onclick });
  const emb = big && embedUrl(it);
  if (emb) { box.append(el("iframe", { src: emb, loading: "lazy", allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: true, title: it.title || "Embedded post" })); return box; }
  if (it.image_path) {
    const img = el("img", { alt: it.title || "", loading: "lazy", decoding: "async" });
    const known = urlCache.get(it.image_path);
    if (known) img.src = known;
    else S.store.imageUrl(it.image_path).then(u => { if (u) { urlCache.set(it.image_path, u); img.src = u; } });
    box.append(img);
    if (it.kind === "instagram" || it.kind === "video") box.append(el("span", { class: "play" }, it.kind === "video" || parseLink(it.url || "")?.isVideo ? "▶" : icon("ig", 16)));
    return box;
  }
  if (it.kind === "instagram" || it.kind === "video") {
    const p = parseLink(it.url || "");
    box.classList.add("ig-ph");
    box.append(icon(it.kind === "video" ? "link" : "ig", 30), el("span", {}, p?.isVideo ? "Instagram reel" : it.kind === "video" ? "Video" : "Instagram post"), el("small", {}, "Tap to play"));
    return box;
  }
  if (it.kind === "link") { box.classList.add("link-ph"); box.append(icon("link", 26), el("span", {}, (it.meta?.site || safeHost(it.url) || "Link"))); return box; }
  if (it.kind === "note") { box.classList.add("note-ph"); box.append(el("p", {}, it.note || "")); return box; }
  return null;
}
const safeHost = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

/* ---------- Matrix: functions × areas ---------- */

function matrix() {
  const fns = [...functions(), { id: null, name: "Any function", color: "var(--muted)" }];
  const ars = areas();
  const others = { ...S.filter, fn: null, area: null, sub: null };
  const cell = (fn, a) => {
    const its = S.W.items.filter(i => (fn.id ? i.cat_ids.includes(fn.id) : !itemFns(i).length) && itemTopAreas(i).includes(a.id) && matches(i, others, "all"));
    if (!its.length) {
      const add = can.edit() && fn.id
        ? el("button", { class: "add-cell", type: "button", "aria-label": `Add idea for ${fn.name}, ${a.name}`, onclick: () => openAdd({ fn: fn.id, area: a.id }) }, "+")
        : null;
      return el("td", { class: "empty-cell" }, add);
    }
    const fin = its.filter(i => i.status === "final"), cur = its.filter(i => i.status === "curated");
    const show = [...fin, ...cur, ...its.filter(i => i.status === "idea")].slice(0, 3);
    const open = () => { Object.assign(S.filter, { fn: fn.id, area: a.id, sub: null, status: fin.length || cur.length ? "curated" : "all" }); setView("grid"); };
    const counts = el("span", { class: "cell-n" },
      fin.length ? el("b", { class: "fin" }, `✓ ${fin.length}`) : null,
      cur.length ? el("b", { class: "cur" }, `★ ${cur.length}`) : null,
      el("span", {}, `${its.length} idea${its.length > 1 ? "s" : ""}`));
    const btn = el("button", { type: "button", class: "cell", onclick: open, "aria-label": `${fn.name}, ${a.name}: ${its.length} ideas` },
      el("span", { class: "thumbs" }, ...show.map(thumb)), counts);
    return el("td", { class: fin.length ? "has-final" : cur.length ? "has-cur" : "" }, btn);
  };
  const head = el("thead", {}, el("tr", {}, el("th", { scope: "col" }, ""), ...ars.map(a => el("th", { scope: "col" }, a.name))));
  const rows = fns.map(fn => el("tr", {},
    el("th", { scope: "row" }, el("span", { class: "dot", style: { background: fn.color } }), fn.name),
    ...ars.map(a => cell(fn, a))));
  return el("div", { class: "matrix-wrap" },
    el("table", { class: "matrix" }, head, el("tbody", {}, ...rows)),
    el("p", { class: "hint" }, "★ curated · ✓ final. Tap a square to open those ideas; tap + to add one."));
}
function thumb(it) {
  const s = el("span", { class: "th" });
  if (it.image_path) S.store.imageUrl(it.image_path).then(u => { if (u) s.style.backgroundImage = `url("${u}")`; });
  else s.textContent = it.kind === "instagram" ? "IG" : it.kind === "note" ? "✎" : "↗";
  return s;
}

/* ---------- Actions ---------- */

async function vote(it, on) {
  try { await S.store.toggleVote(it.id, on); await refresh(); } catch (e) { toast(e.message, "err"); }
}
export async function setStatus(it, status) {
  try {
    await S.store.updateItem(it.id, { status });
    toast(status === "final" ? "Marked final ✓" : status === "curated" ? "Curated ★" : "Moved back to ideas");
    await refresh();
    if ($(".modal .detail")) openDetail(it.id, true);
  } catch (e) { toast(e.message, "err"); }
}

/* ================= Detail ================= */

let closeDetail = null;
export function openDetail(id, replace = false) {
  const it = S.W.items.find(i => i.id === id); if (!it) return;
  if (replace && closeDetail) closeDetail();
  const v = votesFor(id), mine = v.some(x => x.user_id === S.me.id);
  const vendor = vendorByHandle(it.vendor_handle);
  const commentsBox = el("div", { class: "comments" });
  const paintComments = () => commentsBox.replaceChildren(...commentsFor(id).map(c => el("div", { class: "cmt" },
    el("span", { class: "avatar" }, initials(nameOf(c.author_id))),
    el("div", {}, el("p", { class: "who" }, el("b", {}, nameOf(c.author_id)), el("span", { class: "muted" }, " · " + ago(c.created_at))), el("p", {}, c.body)),
    c.author_id === S.me.id || can.own() ? el("button", { class: "icon-btn small", "aria-label": "Delete comment", onclick: async () => { await S.store.deleteComment(c.id); await refresh(); openDetail(id, true); } }, icon("close", 14)) : null)),
    ...(!commentsFor(id).length ? [el("p", { class: "muted small" }, "No comments yet.")] : []));
  paintComments();
  const stepper = el("div", { class: "stepper", role: "group", "aria-label": "Status" }, ...["idea", "curated", "final"].map(s =>
    el("button", { type: "button", class: "st " + s, "aria-pressed": String(it.status === s), disabled: !can.edit(), onclick: () => setStatus(it, s) },
      s === "curated" ? "★ " : s === "final" ? "✓ " : "", STATUS[s])));
  const composer = can.comment() ? el("form", { class: "composer", onsubmit: async e => {
    e.preventDefault(); const t = e.target.body.value.trim(); if (!t) return;
    e.target.querySelector("button").disabled = true;
    try { await S.store.addComment(id, S.W.wedding.id, t); await refresh(); openDetail(id, true); } catch (err) { toast(err.message, "err"); e.target.querySelector("button").disabled = false; }
  } }, el("textarea", { name: "body", rows: 2, placeholder: "Add a comment… (any language)", "aria-label": "Comment" }), el("button", { class: "btn primary small", type: "submit" }, "Post")) : null;

  const body = el("div", { class: "detail" },
    el("div", { class: "d-media" }, media(it, true) || el("div", { class: "media note-ph big" }, el("p", {}, it.note || ""))),
    el("div", { class: "d-info" },
      modalHead(it.title || (it.kind === "note" ? "Note" : "Idea"), () => closeDetail()),
      stepper,
      el("div", { class: "c-tags" }, ...itemFns(it).map(c => el("span", { class: "fn-tag", style: { "--c": c.color } }, c.name)), ...itemAreas(it).filter(a => a.parent_id || !itemAreas(it).some(b => b.parent_id === a.id)).map(a => el("span", { class: "tag" }, a.parent_id ? `${cat(a.parent_id)?.name} › ${a.name}` : a.name))),
      it.note && it.kind !== "note" ? el("p", { class: "d-note" }, it.note) : null,
      it.vendor_handle ? el("div", { class: "d-vendor" },
        el("span", {}, "By ", el("a", { href: `https://www.instagram.com/${it.vendor_handle}/`, target: "_blank", rel: "noopener" }, "@" + it.vendor_handle)),
        vendor ? el("a", { class: "pill", href: `#/w/${S.W.wedding.id}/vendors` }, "On your vendor list · " + vendor.status)
          : can.edit() ? el("button", { class: "btn small", onclick: async () => { await S.store.saveVendor({ wedding_id: S.W.wedding.id, handle: it.vendor_handle.toLowerCase(), name: null, area_id: itemTopAreas(it)[0] || null, status: "shortlisted" }); toast("Added to your vendors"); await refresh(); openDetail(id, true); } }, "+ Add to vendors") : null) : null,
      it.price ? el("p", {}, el("span", { class: "muted" }, "Estimate: "), el("b", {}, rupees(it.price))) : null,
      el("div", { class: "row" },
        el("button", { type: "button", class: "btn vote" + (mine ? " on" : ""), disabled: !can.comment(), onclick: async () => { await vote(it, !mine); openDetail(id, true); } }, icon("heart", 16), mine ? "Loved" : "Love it", v.length ? ` · ${v.length}` : ""),
        it.url ? el("a", { class: "btn", href: it.url, target: "_blank", rel: "noopener" }, it.kind === "instagram" ? "Open in Instagram ↗" : "Open link ↗") : null,
        can.edit() ? el("button", { class: "btn ghost", onclick: () => { closeDetail(); openAdd({ item: it }); } }, "Edit") : null,
        can.edit() ? el("button", { class: "btn ghost danger-text", onclick: async () => { if (await confirmDialog("Delete this idea for everyone?")) { await S.store.deleteItem(it); closeDetail(); toast("Deleted"); await refresh(); } } }, "Delete") : null),
      v.length ? el("p", { class: "small muted" }, "Loved by " + v.map(x => nameOf(x.user_id)).join(", ")) : null,
      el("p", { class: "small muted" }, `Added by ${nameOf(it.created_by)} · ${ago(it.created_at)}`),
      el("h3", { class: "sec" }, "Comments"), commentsBox, composer));
  closeDetail = openModal(body, { wide: true, label: it.title || "Idea" });
}

/* ================= Add / edit ================= */

export function openAdd({ item = null, text = "", files = [], fn = null, area = null } = {}) {
  if (!can.edit()) return toast("You can comment and vote on this board, but not add ideas.", "err");
  const edit = !!item;
  const last = lsGet("se-last-tags-" + S.W.wedding.id, { fns: [], areas: [] });
  const picked = new Set(edit ? item.cat_ids : fn || area ? [fn, area].filter(Boolean) : [...last.fns, ...last.areas].filter(id => cat(id)));
  let photos = [...files], status = edit ? item.status : "idea", unfurled = null, unfurlFor = "";

  const input = el("textarea", { class: "smart", rows: 3, placeholder: "Paste an Instagram, Pinterest or any link… or write a note", "aria-label": "Link or note", autofocus: !edit });
  input.value = edit ? (item.url || (item.kind === "note" ? item.note || "" : "")) : text;
  const preview = el("div", { class: "link-preview" });
  const title = el("input", { placeholder: "Give it a name (optional)", maxlength: "140", "aria-label": "Title", value: edit ? item.title || "" : "" });
  const note = el("textarea", { rows: 2, placeholder: "Why you like it, or what to change", "aria-label": "Note" });
  note.value = edit && item.kind !== "note" ? item.note || "" : "";
  const handle = el("input", { placeholder: "@vendor (optional)", "aria-label": "Vendor Instagram handle", value: edit && item.vendor_handle ? "@" + item.vendor_handle : "", list: "handles" });
  const handles = el("datalist", { id: "handles" }, ...[...new Set([...S.W.vendors.map(v => v.handle), ...S.W.items.map(i => i.vendor_handle)].filter(Boolean))].map(h => el("option", { value: "@" + h })));
  const price = el("input", { inputmode: "decimal", placeholder: "e.g. 2.5 lakh", "aria-label": "Estimated price", value: edit && item.price ? String(item.price) : "" });
  const photoList = el("div", { class: "thumbs-row" });
  const fileIn = el("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: e => { photos.push(...e.target.files); e.target.value = ""; paintPhotos(); } });
  const drop = el("div", { class: "drop", tabindex: "0", role: "button", "aria-label": "Add photos", onclick: () => fileIn.click(), onkeydown: e => { if (e.key === "Enter") fileIn.click(); },
    ondragover: e => { e.preventDefault(); drop.classList.add("over"); }, ondragleave: () => drop.classList.remove("over"),
    ondrop: e => { e.preventDefault(); drop.classList.remove("over"); photos.push(...[...e.dataTransfer.files].filter(f => f.type.startsWith("image/"))); paintPhotos(); } },
    icon("photo", 20), edit ? "Replace the picture" : "Add photos or screenshots");
  const paintPhotos = () => photoList.replaceChildren(...photos.map((f, k) => el("span", { class: "ph" }, el("img", { src: URL.createObjectURL(f), alt: "" }),
    el("button", { type: "button", class: "x", "aria-label": "Remove photo", onclick: () => { photos.splice(k, 1); paintPhotos(); } }, "×"))),
    ...(photos.length > 1 && !parseLink(input.value) ? [el("small", { class: "muted" }, `${photos.length} photos → ${photos.length} ideas, all tagged the same`)] : []));

  const fnBox = el("div", { class: "chips" }), areaBox = el("div", { class: "chips" }), subBox = el("div", { class: "subs" });
  const toggle = id => { picked.has(id) ? picked.delete(id) : picked.add(id); paintTags(); };
  const paintTags = () => {
    fnBox.replaceChildren(...functions().map(c => el("button", { type: "button", class: "chip" + (picked.has(c.id) ? " on" : ""), "aria-pressed": String(picked.has(c.id)), onclick: () => toggle(c.id) },
      el("span", { class: "dot", style: { background: c.color } }), c.name)));
    areaBox.replaceChildren(...areas().map(a => {
      const on = picked.has(a.id) || subAreas(a.id).some(s => picked.has(s.id));
      return el("button", { type: "button", class: "chip" + (on ? " on" : ""), "aria-pressed": String(on), onclick: () => {
        if (on) { picked.delete(a.id); subAreas(a.id).forEach(s => picked.delete(s.id)); } else picked.add(a.id);
        paintTags(); } }, a.name);
    }));
    subBox.replaceChildren(...areas().filter(a => (picked.has(a.id) || subAreas(a.id).some(s => picked.has(s.id))) && subAreas(a.id).length).map(a =>
      el("div", { class: "chips small" }, el("span", { class: "sub-label" }, a.name + " ›"),
        ...subAreas(a.id).map(s => el("button", { type: "button", class: "chip" + (picked.has(s.id) ? " on" : ""), "aria-pressed": String(picked.has(s.id)),
          onclick: () => { picked.add(a.id); toggle(s.id); } }, s.name)))));
  };
  paintTags(); paintPhotos();

  const statusSeg = el("div", { class: "stepper", role: "group", "aria-label": "Status" }, ...["idea", "curated", "final"].map(s =>
    el("button", { type: "button", class: "st " + s, "aria-pressed": String(status === s), onclick: e => { status = s; statusSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === e.currentTarget))); } },
      s === "curated" ? "★ " : s === "final" ? "✓ " : "", STATUS[s])));

  const onInput = () => {
    const p = parseLink(input.value);
    preview.replaceChildren();
    if (!p) { paintPhotos(); return; }
    preview.append(el("span", { class: "src " + p.source }, p.source === "instagram" ? (p.isVideo ? "Instagram reel" : "Instagram post") : p.source === "youtube" ? "YouTube" : p.source === "pinterest" ? "Pinterest" : p.site || "Link"),
      el("span", { class: "muted small ellip" }, p.url));
    if (p.handle && !handle.value) handle.value = "@" + p.handle;
    const dup = S.W.items.find(i => i.url === p.url && i.id !== item?.id);
    if (dup) preview.append(el("span", { class: "warn small" }, "Already on the board"));
    // Live: fetch title / cover / account name in the background.
    if (!S.store.demo && p.url !== unfurlFor) {
      unfurlFor = p.url;
      preview.append(el("span", { class: "muted small", id: "unf" }, "Fetching preview…"));
      S.store.unfurl(p.url, S.W.wedding.id).then(u => {
        if (unfurlFor !== p.url) return;
        unfurled = u || {}; $("#unf")?.remove();
        if (u?.handle && !handle.value) handle.value = "@" + u.handle;
        if (u?.title && !title.value) title.value = u.title.slice(0, 140);
        if (u?.image_path) preview.append(el("span", { class: "ok small" }, "✓ Cover picture saved"));
      });
    }
    paintPhotos();
  };
  input.addEventListener("input", debounce(onInput, 250));
  if (input.value) onInput();

  const save = el("button", { class: "btn primary big", type: "submit" }, edit ? "Save changes" : "Add to board");
  const form = el("form", { class: "m-body add", onsubmit: async e => {
    e.preventDefault();
    const raw = input.value.trim(), p = parseLink(raw);
    if (!raw && !photos.length && !(edit && item.image_path)) return toast("Paste a link, write a note, or add a photo.", "err");
    save.disabled = true; save.textContent = "Saving…";
    try {
      const wid = S.W.wedding.id, tags = [...picked];
      const common = { title: title.value.trim() || null, vendor_handle: cleanHandle(handle.value) || null, price: parseRupees(price.value), status };
      const up = async f => S.store.upload(wid, await shrinkImage(f));
      if (edit) {
        const patch = { ...common };
        if (item.kind === "note" && !p) patch.note = raw; else { patch.note = note.value.trim() || null; if (p) patch.url = p.url; }
        if (photos[0]) patch.image_path = await up(photos[0]);
        await S.store.updateItem(item.id, patch, tags);
        toast("Saved");
      } else {
        let n = 0, rest = photos;
        if (p) {
          const cover = photos[0] ? await up(photos[0]) : unfurled?.image_path || null;
          rest = photos.slice(1);
          await S.store.addItem({ wedding_id: wid, kind: p.kind, url: p.url, note: note.value.trim() || (raw.replace(p.url, "").replace(/https?:\/\/\S+/g, "").trim() || null), image_path: cover, meta: p.site ? { site: p.site } : {}, ...common }, tags); n++;
        } else if (raw && !photos.length) { await S.store.addItem({ wedding_id: wid, kind: "note", note: raw, ...common }, tags); n++; }
        for (const f of rest) { await S.store.addItem({ wedding_id: wid, kind: "image", image_path: await up(f), note: (!p && raw) || note.value.trim() || null, ...common }, tags); n++; }
        lsSet("se-last-tags-" + wid, { fns: tags.filter(id => cat(id)?.dim === "function"), areas: tags.filter(id => cat(id)?.dim === "area") });
        const hidden = status === "idea" && statusMode() === "curated";
        toast((n === 1 ? "Added to the board" : `Added ${n} ideas`) + (hidden ? ". It's under Ideas until you curate it." : ""));
      }
      close(); await refresh();
    } catch (err) { toast(err.message, "err"); save.disabled = false; save.textContent = edit ? "Save changes" : "Add to board"; }
  } },
    input, preview,
    el("div", {}, drop, fileIn, photoList),
    el("div", { class: "field" }, el("span", {}, "Which function?"), fnBox),
    el("div", { class: "field" }, el("span", {}, "What is it for?"), areaBox, subBox),
    el("details", { class: "more", open: edit || null }, el("summary", {}, "Name, vendor, price & note"),
      el("div", { class: "stack" }, title, el("div", { class: "row2" }, handle, price), handles, note)),
    el("div", { class: "field" }, el("span", {}, "Status"), statusSeg),
    el("div", { class: "row end" }, el("button", { type: "button", class: "btn ghost", onclick: () => close() }, "Cancel"), save));
  const close = openModal(el("div", {}, modalHead(edit ? "Edit idea" : "Add an idea", () => close()), form), { label: edit ? "Edit idea" : "Add an idea" });
}
