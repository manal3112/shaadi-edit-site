// App-wide state and the derived views of it (filters, counts, names).
import { lsGet } from "./ui.js";

export const S = {
  store: null,          // DemoStore or LiveStore
  live: null,           // the LiveStore when configured (kept even while viewing the demo)
  me: null,
  W: null,              // the open wedding: { wedding, role, categories, items, votes, comments, members, vendors, briefs, replies }
  tab: "board",         // board | vendors | briefs | family
  view: lsGet("se-view", "grid"),   // grid | matrix
  filter: { fn: null, area: null, sub: null, status: "curated", q: "", vendor: null },
};

export const resetFilter = () => { S.filter = { fn: null, area: null, sub: null, status: "curated", q: "", vendor: null }; };

export const can = {
  edit: () => ["owner", "editor"].includes(S.W?.role),
  comment: () => ["owner", "editor", "commenter"].includes(S.W?.role),
  own: () => S.W?.role === "owner",
};

export const cats = () => S.W?.categories || [];
export const cat = id => cats().find(c => c.id === id);
export const functions = () => cats().filter(c => c.dim === "function").sort((a, b) => a.position - b.position);
export const areas = () => cats().filter(c => c.dim === "area" && !c.parent_id).sort((a, b) => a.position - b.position);
export const subAreas = id => cats().filter(c => c.parent_id === id).sort((a, b) => a.position - b.position);
export const fnColor = id => cat(id)?.color || "var(--muted)";

export const itemFns = it => it.cat_ids.map(cat).filter(c => c?.dim === "function");
export const itemAreas = it => it.cat_ids.map(cat).filter(c => c?.dim === "area");
/** Top-level areas an item belongs to (directly or through a finer sub-area). */
export const itemTopAreas = it => [...new Set(itemAreas(it).map(c => c.parent_id || c.id))];

export const votesFor = id => S.W.votes.filter(v => v.item_id === id);
export const commentsFor = id => S.W.comments.filter(c => c.item_id === id);
export const nameOf = uid => (uid === S.me?.id ? "You" : S.W?.members.find(m => m.user_id === uid)?.name || "Someone");
export const vendorByHandle = h => h && S.W.vendors.find(v => v.handle && v.handle.toLowerCase() === h.toLowerCase());

export const STATUS = { idea: "Idea", curated: "Curated", final: "Final" };

/** "Curated" shows curated + final. Until anything is curated, it falls back to everything so a new board isn't empty. */
export function statusMode() {
  const f = S.filter.status;
  if (f === "curated" && !S.W.items.some(i => i.status !== "idea")) return "all";
  return f;
}

export function matches(it, f = S.filter, mode = statusMode()) {
  if (mode === "curated" && it.status === "idea") return false;
  if (mode === "final" && it.status !== "final") return false;
  if (mode === "idea" && it.status !== "idea") return false;
  if (f.fn && !it.cat_ids.includes(f.fn)) return false;
  if (f.sub) { if (!it.cat_ids.includes(f.sub)) return false; }
  else if (f.area && !itemTopAreas(it).includes(f.area)) return false;
  if (f.vendor && (it.vendor_handle || "").toLowerCase() !== f.vendor) return false;
  if (f.q) {
    const hay = [it.title, it.note, it.url, it.vendor_handle, ...it.cat_ids.map(id => cat(id)?.name), ...commentsFor(it.id).map(c => c.body)].join(" ").toLowerCase();
    if (!f.q.split(/\s+/).every(w => hay.includes(w))) return false;
  }
  return true;
}

export function visibleItems() {
  const order = { final: 0, curated: 1, idea: 2 };
  return S.W.items.filter(i => matches(i)).sort((a, b) =>
    S.filter.status === "all" || S.filter.status === "curated"
      ? (order[a.status] - order[b.status]) || votesFor(b.id).length - votesFor(a.id).length || b.created_at.localeCompare(a.created_at)
      : votesFor(b.id).length - votesFor(a.id).length || b.created_at.localeCompare(a.created_at));
}

/** Counts for one cell of the function × area grid. */
export function cellStats(fnId, areaId) {
  const its = S.W.items.filter(i => (!fnId || i.cat_ids.includes(fnId)) && (!areaId || itemTopAreas(i).includes(areaId)));
  return { all: its.length, curated: its.filter(i => i.status === "curated").length, final: its.filter(i => i.status === "final"), items: its };
}
