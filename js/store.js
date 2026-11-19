// Two stores with the same interface:
//  - DemoStore keeps everything in this browser (localStorage + IndexedDB for photos). Used for "Try the sample wedding"
//    and whenever Supabase isn't configured.
//  - LiveStore talks to Supabase (auth, database with row-level security, private storage, edge functions).
import { CONFIG } from "./config.js";
import { uid, lsGet, lsSet } from "./ui.js";
import { parseLink, cleanHandle } from "./links.js";
import { AREAS, STYLES, colorFor } from "./templates.js";
import { sampleArt } from "./sample-art.js";

const now = () => new Date().toISOString();

/* ================= Demo ================= */

const DB_KEY = "se-demo-db";
const idb = (() => {
  let p;
  const open = () => (p ||= new Promise((res, rej) => {
    const r = indexedDB.open("shaadi-edit-demo", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("blobs");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("blobs", mode); const r = fn(t.objectStore("blobs")); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); };
  return { put: (k, v) => tx("readwrite", s => s.put(v, k)), get: k => tx("readonly", s => s.get(k)), del: k => tx("readwrite", s => s.delete(k)), clear: () => tx("readwrite", s => s.clear()) };
})();

export class DemoStore {
  constructor() { this.demo = true; this.urls = new Map(); this.db = lsGet(DB_KEY) || this.blank(); }
  blank() { return { weddings: [], members: [], categories: [], items: [], item_categories: [], votes: [], comments: [], vendors: [], briefs: [], replies: [], invites: [], profiles: [{ id: "me", display_name: "You" }] }; }
  save() { lsSet(DB_KEY, this.db); }
  async me() { return { id: "me", email: "you@example.com", name: "You" }; }
  async signIn() {} async verify() {} async signOut() {}

  async reset() { this.db = this.blank(); await idb.clear().catch(() => {}); this.save(); }
  hasSample() { return this.db.weddings.some(w => w.sample); }

  async listWeddings() {
    const mine = new Set(this.db.members.filter(m => m.user_id === "me").map(m => m.wedding_id));
    return this.db.weddings.filter(w => mine.has(w.id)).map(w => ({ ...w, role: this.role(w.id) }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  role(wid) { return this.db.members.find(m => m.wedding_id === wid && m.user_id === "me")?.role || "viewer"; }

  async createWedding({ title, date, city, functions, areas, sample = false }) {
    const w = { id: uid(), owner_id: "me", title, wedding_date: date || null, city: city || null, settings: {}, sample, created_at: now(), updated_at: now() };
    this.db.weddings.push(w);
    this.db.members.push({ wedding_id: w.id, user_id: "me", role: "owner", side: null, joined_at: now() });
    functions.forEach((name, k) => this.db.categories.push({ id: uid(), wedding_id: w.id, dim: "function", parent_id: null, name, color: colorFor(k), position: k }));
    areas.forEach((a, k) => {
      const id = uid();
      this.db.categories.push({ id, wedding_id: w.id, dim: "area", parent_id: null, name: a.name, color: null, position: k });
      (a.children || []).forEach((c, j) => this.db.categories.push({ id: uid(), wedding_id: w.id, dim: "area", parent_id: id, name: c, color: null, position: j }));
    });
    this.save();
    return w.id;
  }
  async updateWedding(id, patch) { Object.assign(this.db.weddings.find(w => w.id === id), patch, { updated_at: now() }); this.save(); }
  async deleteWedding(id) {
    const d = this.db;
    const items = new Set(d.items.filter(i => i.wedding_id === id).map(i => i.id));
    d.items.filter(i => items.has(i.id) && i.image_path && !i.image_path.startsWith("data:")).forEach(i => idb.del(i.image_path).catch(() => {}));
    for (const k of ["members", "categories", "items", "comments", "vendors", "briefs", "replies", "invites"]) d[k] = d[k].filter(r => r.wedding_id !== id);
    d.item_categories = d.item_categories.filter(r => !items.has(r.item_id)); d.votes = d.votes.filter(r => !items.has(r.item_id));
    d.weddings = d.weddings.filter(w => w.id !== id); this.save();
  }

  async loadWedding(id) {
    const d = this.db, wedding = d.weddings.find(w => w.id === id);
    if (!wedding) throw new Error("This wedding doesn't exist on this device.");
    const items = d.items.filter(i => i.wedding_id === id).map(i => ({ ...i, cat_ids: d.item_categories.filter(x => x.item_id === i.id).map(x => x.category_id) }));
    const ids = new Set(items.map(i => i.id));
    const names = new Map(d.profiles.map(p => [p.id, p.display_name]));
    return {
      wedding, role: this.role(id),
      categories: d.categories.filter(c => c.wedding_id === id).sort((a, b) => a.position - b.position),
      items,
      votes: d.votes.filter(v => ids.has(v.item_id)),
      comments: d.comments.filter(c => c.wedding_id === id),
      members: d.members.filter(m => m.wedding_id === id).map(m => ({ ...m, name: names.get(m.user_id) || "Someone" })),
      vendors: d.vendors.filter(v => v.wedding_id === id),
      briefs: d.briefs.filter(b => b.wedding_id === id),
      replies: d.replies.filter(r => r.wedding_id === id),
    };
  }

  async addItem(row, catIds = []) {
    const it = { id: uid(), status: "idea", title: null, note: null, url: null, image_path: null, vendor_handle: null, price: null, meta: {},
      created_by: "me", created_at: now(), updated_at: now(), ...row };
    this.db.items.push(it);
    catIds.forEach(c => this.db.item_categories.push({ item_id: it.id, category_id: c }));
    this.touch(it.wedding_id); this.save();
    return it;
  }
  async updateItem(id, patch, catIds) {
    const it = this.db.items.find(i => i.id === id);
    Object.assign(it, patch, { updated_at: now() });
    if (catIds) { this.db.item_categories = this.db.item_categories.filter(x => x.item_id !== id); catIds.forEach(c => this.db.item_categories.push({ item_id: id, category_id: c })); }
    this.touch(it.wedding_id); this.save();
  }
  async deleteItem(item) {
    const d = this.db;
    d.items = d.items.filter(i => i.id !== item.id); d.item_categories = d.item_categories.filter(x => x.item_id !== item.id);
    d.votes = d.votes.filter(v => v.item_id !== item.id); d.comments = d.comments.filter(c => c.item_id !== item.id);
    if (item.image_path && !item.image_path.startsWith("data:")) idb.del(item.image_path).catch(() => {});
    this.save();
  }
  touch(wid) { const w = this.db.weddings.find(x => x.id === wid); if (w) w.updated_at = now(); }

  async toggleVote(itemId, on) {
    this.db.votes = this.db.votes.filter(v => !(v.item_id === itemId && v.user_id === "me"));
    if (on) this.db.votes.push({ item_id: itemId, user_id: "me", created_at: now() });
    this.save();
  }
  async addComment(itemId, weddingId, body) { const c = { id: uid(), item_id: itemId, wedding_id: weddingId, author_id: "me", body, created_at: now() }; this.db.comments.push(c); this.save(); return c; }
  async deleteComment(id) { this.db.comments = this.db.comments.filter(c => c.id !== id); this.save(); }

  async addCategory(row) { const c = { id: uid(), color: null, parent_id: null, position: 999, ...row }; this.db.categories.push(c); this.save(); return c; }
  async updateCategory(id, patch) { Object.assign(this.db.categories.find(c => c.id === id), patch); this.save(); }
  async deleteCategory(id) {
    const kill = new Set([id, ...this.db.categories.filter(c => c.parent_id === id).map(c => c.id)]);
    this.db.categories = this.db.categories.filter(c => !kill.has(c.id));
    this.db.item_categories = this.db.item_categories.filter(x => !kill.has(x.category_id)); this.save();
  }

  async saveVendor(row) {
    if (row.id) { Object.assign(this.db.vendors.find(v => v.id === row.id), row); this.save(); return row; }
    const v = { id: uid(), status: "shortlisted", created_at: now(), ...row }; this.db.vendors.push(v); this.save(); return v;
  }
  async deleteVendor(id) { this.db.vendors = this.db.vendors.filter(v => v.id !== id); this.save(); }

  async createBrief(row) { const b = { id: uid(), token: uid().replace(/-/g, "").slice(0, 22), closed: false, created_by: "me", created_at: now(), ...row }; this.db.briefs.push(b); this.save(); return b; }
  async updateBrief(id, patch) { Object.assign(this.db.briefs.find(b => b.id === id), patch); this.save(); }
  async deleteBrief(id) { this.db.briefs = this.db.briefs.filter(b => b.id !== id); this.db.replies = this.db.replies.filter(r => r.brief_id !== id); this.save(); }

  async getPublicBrief(token) {
    const d = this.db, b = d.briefs.find(x => x.token === token && !x.closed);
    if (!b) return null;
    const w = d.weddings.find(x => x.id === b.wedding_id), cat = id => d.categories.find(c => c.id === id);
    const inScope = i => {
      const cs = d.item_categories.filter(x => x.item_id === i.id).map(x => cat(x.category_id)).filter(Boolean);
      return (!b.function_id || cs.some(c => c.id === b.function_id)) && (!b.area_id || cs.some(c => c.id === b.area_id || c.parent_id === b.area_id));
    };
    const scoped = d.items.filter(i => i.wedding_id === b.wedding_id && inScope(i));
    const picked = scoped.some(i => i.status !== "idea") ? scoped.filter(i => i.status !== "idea") : scoped;
    const items = await Promise.all(picked.sort((a, c) => (c.status === "final") - (a.status === "final")).map(async i => ({
      id: i.id, kind: i.kind, status: i.status, title: i.title, note: i.note, url: i.url, image_url: i.image_path ? await this.imageUrl(i.image_path) : null })));
    return { title: b.title, message: b.message, couple: w.title, date: w.wedding_date, city: w.city, function: cat(b.function_id)?.name || null, area: cat(b.area_id)?.name || null, items };
  }
  async replyBrief(token, r) {
    const b = this.db.briefs.find(x => x.token === token && !x.closed);
    if (!b) throw new Error("This brief is closed or the link is wrong.");
    this.db.replies.push({ id: uid(), brief_id: b.id, wedding_id: b.wedding_id, vendor_name: r.name, handle: cleanHandle(r.handle) || null, contact: r.contact || null,
      message: r.message || null, quote: r.quote ?? null, links: (r.links || []).slice(0, 10), created_at: now() });
    this.save();
  }

  async createInvite(weddingId, role, side) { const token = uid().replace(/-/g, "").slice(0, 22); this.db.invites.push({ id: uid(), wedding_id: weddingId, token, role, side, created_at: now() }); this.save(); return token; }
  async invitePreview(token) { const i = this.db.invites.find(x => x.token === token); const w = i && this.db.weddings.find(x => x.id === i.wedding_id); return w ? { title: w.title, wedding_date: w.wedding_date, inviter: "You" } : null; }
  async acceptInvite(token) { const i = this.db.invites.find(x => x.token === token); if (!i) throw new Error("This invite link is not valid."); return i.wedding_id; }
  async setMember(weddingId, userId, patch) { Object.assign(this.db.members.find(m => m.wedding_id === weddingId && m.user_id === userId), patch); this.save(); }
  async removeMember(weddingId, userId) { this.db.members = this.db.members.filter(m => !(m.wedding_id === weddingId && m.user_id === userId)); this.save(); }

  async upload(weddingId, blob) { const path = `${weddingId}/${uid()}.jpg`; await idb.put(path, blob); return path; }
  async imageUrl(path) {
    if (!path) return null;
    if (path.startsWith("data:")) return path;
    if (this.urls.has(path)) return this.urls.get(path);
    const b = await idb.get(path).catch(() => null);
    const u = b ? URL.createObjectURL(b) : null; this.urls.set(path, u); return u;
  }
  async unfurl(url) { const p = parseLink(url); return p?.handle ? { handle: p.handle } : {}; }
  async joinWaitlist() {}

  /** A full sample wedding so people can see the idea in 10 seconds, without signing up. */
  async seedSample() {
    const day = new Date(Date.now() + 118 * 86400000).toISOString().slice(0, 10);
    const id = await this.createWedding({ title: "Riya & Arjun", date: day, city: "Udaipur", functions: STYLES[0].functions, areas: AREAS, sample: true });
    const d = this.db, c = name => d.categories.find(x => x.wedding_id === id && x.name === name)?.id;
    this.db.profiles.push({ id: "mom", display_name: "Mummy (Riya's mom)" }, { id: "arjun", display_name: "Arjun" }, { id: "neha", display_name: "Neha (bridesmaid)" });
    this.db.members.push({ wedding_id: id, user_id: "mom", role: "commenter", side: "bride", joined_at: now() },
      { wedding_id: id, user_id: "arjun", role: "editor", side: "groom", joined_at: now() },
      { wedding_id: id, user_id: "neha", role: "editor", side: "bride", joined_at: now() });
    const S = [
      ["Marigold & mogra entrance arch", "Haldi", "Entrance", "curated", "sample.florals", ["#f4a300", "#fff3c4", "#e86a00"], "Full marigold arch, mogra strings at the sides. Mom loves this.", 180000, ["mom", "arjun"]],
      ["Yellow-and-white floor seating", "Haldi", "Seating", "idea", "sample.florals", ["#ffd54f", "#fffde7", "#f9a825"], "Low gaddas with bolsters, lots of brass urlis.", null, ["neha"]],
      ["Pastel lehenga with gota work", "Mehendi", "Lehenga", "curated", "sample.couture", ["#a5d6a7", "#f1f8e9", "#81c784"], "Mint with gota patti. Light enough to dance in.", 145000, ["mom", "neha"]],
      ["Floral jewellery set", "Mehendi", "Bride", "idea", null, ["#f8bbd0", "#fff0f5", "#ec407a"], "Fresh flowers, not artificial.", null, []],
      ["Mirror-work Sangeet stage", "Sangeet", "Stage / Mandap", "final", "sample.events", ["#7e57c2", "#ede7f6", "#4527a0"], "Booked: mirror panels with warm fairy lights.", 450000, ["mom", "arjun", "neha"]],
      ["Disco + dhol entry", "Sangeet", "Music & entertainment", "curated", "sample.beats", ["#26c6da", "#e0f7fa", "#006064"], "Dhol for the baraat-style entry, then the DJ.", 90000, ["arjun"]],
      ["Sequin saree for Sangeet", "Sangeet", "Saree", "idea", "sample.couture", ["#ce93d8", "#f3e5f5", "#8e24aa"], "Backup if the lehenga is too heavy.", 65000, []],
      ["Lake-view mandap at sunset", "Wedding", "Stage / Mandap", "curated", "sample.events", ["#ff8a65", "#fbe9e7", "#d84315"], "Mandap facing the lake, pheras at golden hour.", 600000, ["mom", "arjun"]],
      ["Red Banarasi lehenga", "Wedding", "Lehenga", "final", "sample.couture", ["#c62828", "#ffebee", "#8e0000"], "Final! Nani's dupatta on top.", 320000, ["mom", "arjun", "neha"]],
      ["Ivory sherwani with pearl buttons", "Wedding", "Sherwani", "curated", "sample.menswear", ["#d7ccc8", "#fafafa", "#8d6e63"], "Arjun's pick. Peach safa to match Riya.", 120000, ["arjun"]],
      ["Polki choker set", "Wedding", "Bride", "curated", "sample.jewels", ["#ffd54f", "#fff8e1", "#bf8f00"], "Uncut polki. Ask about rental.", 250000, ["mom"]],
      ["Rajasthani thali counter", "Wedding", "Live counters", "idea", null, ["#ffb74d", "#fff3e0", "#e65100"], "Dal baati churma live counter!", null, ["mom"]],
      ["Champagne-and-gold reception", "Reception", "Florals", "curated", "sample.events", ["#e6c9a8", "#fffaf2", "#a1887f"], "White florals, gold accents, very minimal.", 380000, ["neha"]],
      ["Velvet bandhgala for reception", "Reception", "Bandhgala", "idea", "sample.menswear", ["#283593", "#e8eaf6", "#1a237e"], "Midnight blue velvet.", 85000, []],
      ["Laser-cut invite with wax seal", null, "Invites & stationery", "curated", null, ["#bcaaa4", "#efebe9", "#6d4c41"], "Ivory card, maroon wax seal. Digital version for WhatsApp too.", 45000, ["mom"]],
    ];
    const t0 = Date.now();
    S.forEach(([title, fn, area, status, handle, colors, note, price, voters], k) => {
      const item = { id: uid(), wedding_id: id, kind: "image", status, title, note, url: null, image_path: sampleArt(title, colors, k), vendor_handle: handle, price, meta: {},
        created_by: ["me", "neha", "arjun"][k % 3], created_at: new Date(t0 - k * 3.6e6).toISOString(), updated_at: now() };
      d.items.push(item);
      const area0 = d.categories.find(x => x.wedding_id === id && x.name === area);
      [fn && c(fn), area0?.id, area0?.parent_id].filter(Boolean).forEach(cid => d.item_categories.push({ item_id: item.id, category_id: cid }));
      voters.forEach(v => d.votes.push({ item_id: item.id, user_id: v, created_at: now() }));
    });
    const it = t => d.items.find(i => i.wedding_id === id && i.title === t).id;
    d.comments.push(
      { id: uid(), item_id: it("Marigold & mogra entrance arch"), wedding_id: id, author_id: "mom", body: "Bahut sundar! Haldi ke liye yehi chahiye 🌼", created_at: new Date(t0 - 5e6).toISOString() },
      { id: uid(), item_id: it("Lake-view mandap at sunset"), wedding_id: id, author_id: "arjun", body: "Check if sunset is around 6:10 pm in February. Pandit ji's muhurat is 6:30.", created_at: new Date(t0 - 4e6).toISOString() },
      { id: uid(), item_id: it("Red Banarasi lehenga"), wedding_id: id, author_id: "neha", body: "OBSESSED ❤️", created_at: new Date(t0 - 2e6).toISOString() },
    );
    const v = (name, handle, area, status, quote, phone) => d.vendors.push({ id: uid(), wedding_id: id, name, handle, area_id: c(area), status, quote, phone, notes: null, created_at: now() });
    v("Sample Florals", "sample.florals", "Decor", "quoted", 520000, "+91 98000 00001");
    v("Sample Events Co.", "sample.events", "Decor", "booked", 1150000, "+91 98000 00002");
    v("Sample Couture", "sample.couture", "Bride's outfits", "contacted", null, null);
    v("Sample Beats", "sample.beats", "Music & entertainment", "shortlisted", null, null);
    const b = { id: uid(), wedding_id: id, token: "sample-brief-haldi", title: "Haldi decor", function_id: c("Haldi"), area_id: c("Decor"),
      message: "Morning haldi for ~120 guests by the pool. We love marigold and mogra, yellow-and-white, lots of brass. Budget around ₹4–6 lakh.", closed: false, created_by: "me", created_at: new Date(t0 - 8e6).toISOString() };
    d.briefs.push(b);
    d.replies.push(
      { id: uid(), brief_id: b.id, wedding_id: id, vendor_name: "Sample Florals", handle: "sample.florals", contact: "+91 98000 00001", message: "Lovely brief! We did a very similar marigold arch at a lakeside venue last season. We'd add hanging genda strings over the seating. Quote includes setup and teardown.", quote: 520000, links: [], created_at: new Date(t0 - 6e6).toISOString() },
      { id: uid(), brief_id: b.id, wedding_id: id, vendor_name: "Petal Story (sample)", handle: "petalstory.sample", contact: "petal@example.com", message: "We can do this with seasonal flowers and save ~15%. Happy to send a mock-up.", quote: 445000, links: [], created_at: new Date(t0 - 3e6).toISOString() },
    );
    this.save();
    return id;
  }
}

/* ================= Live (Supabase) ================= */

export class LiveStore {
  constructor() { this.demo = false; this.urls = new Map(); }
  async init() {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    // lock: Supabase serialises session access with navigator.locks. In some browsers (seen in headless Chrome on
    // github.io) that API never answers, which leaves sign-in stuck on "Loading…". A pass-through lock avoids it;
    // the only cost is that two open tabs could both refresh the session at once, which is harmless.
    this.sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, lock: async (_name, _timeout, fn) => await fn() },
    });
    return this;
  }
  q(p) { return p.then(({ data, error }) => { if (error) throw new Error(error.message); return data; }); }
  async me() {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    if (!this.profile) this.profile = await this.q(this.sb.from("profiles").select("display_name").eq("id", u.id).maybeSingle()).catch(() => null);
    return { id: u.id, email: u.email, name: this.profile?.display_name || u.email.split("@")[0] };
  }
  async signIn(email) { await this.q(this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })); }
  async verify(email, token) { await this.q(this.sb.auth.verifyOtp({ email, token, type: "email" })); }
  async signOut() { await this.sb.auth.signOut(); }
  async setName(name) { const u = await this.me(); await this.q(this.sb.from("profiles").update({ display_name: name }).eq("id", u.id)); this.profile = { display_name: name }; }

  async listWeddings() {
    const u = await this.me();
    const rows = await this.q(this.sb.from("members").select("role, weddings(*)").eq("user_id", u.id));
    return rows.filter(r => r.weddings).map(r => ({ ...r.weddings, role: r.role })).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  async createWedding({ title, date, city, functions, areas }) {
    return this.q(this.sb.rpc("create_wedding", { p_title: title, p_date: date || null, p_city: city || null, p_functions: functions, p_areas: areas }));
  }
  async updateWedding(id, patch) { await this.q(this.sb.from("weddings").update(patch).eq("id", id)); }
  async deleteWedding(id) { await this.q(this.sb.from("weddings").delete().eq("id", id)); }

  async loadWedding(id) {
    const u = await this.me(), sb = this.sb;
    const [wedding, categories, items, comments, members, vendors, briefs, replies] = await Promise.all([
      this.q(sb.from("weddings").select("*").eq("id", id).single()),
      this.q(sb.from("categories").select("*").eq("wedding_id", id).order("position")),
      this.q(sb.from("items").select("*, item_categories(category_id)").eq("wedding_id", id).order("created_at", { ascending: false })),
      this.q(sb.from("comments").select("*").eq("wedding_id", id).order("created_at")),
      this.q(sb.from("members").select("*").eq("wedding_id", id)),
      this.q(sb.from("vendors").select("*").eq("wedding_id", id)),
      this.q(sb.from("briefs").select("*").eq("wedding_id", id).order("created_at", { ascending: false })),
      this.q(sb.from("brief_replies").select("*").eq("wedding_id", id).order("created_at", { ascending: false })),
    ]);
    const ids = items.map(i => i.id);
    const votes = ids.length ? await this.q(sb.from("votes").select("*").in("item_id", ids)) : [];
    const profiles = await this.q(sb.from("profiles").select("id, display_name").in("id", members.map(m => m.user_id)));
    const names = new Map(profiles.map(p => [p.id, p.display_name]));
    // Colour functions the same way the demo does (stored colour wins).
    let k = 0; categories.forEach(c => { if (c.dim === "function" && !c.color) c.color = colorFor(k); if (c.dim === "function") k++; });
    return {
      wedding, role: members.find(m => m.user_id === u.id)?.role || "viewer", categories,
      items: items.map(({ item_categories, ...i }) => ({ ...i, cat_ids: (item_categories || []).map(x => x.category_id) })),
      votes, comments, members: members.map(m => ({ ...m, name: names.get(m.user_id) || "Someone" })), vendors, briefs, replies,
    };
  }

  async addItem(row, catIds = []) {
    const it = await this.q(this.sb.from("items").insert(row).select().single());
    if (catIds.length) await this.q(this.sb.from("item_categories").insert(catIds.map(c => ({ item_id: it.id, category_id: c }))));
    return it;
  }
  async updateItem(id, patch, catIds) {
    if (Object.keys(patch).length) await this.q(this.sb.from("items").update(patch).eq("id", id));
    if (catIds) {
      await this.q(this.sb.from("item_categories").delete().eq("item_id", id));
      if (catIds.length) await this.q(this.sb.from("item_categories").insert(catIds.map(c => ({ item_id: id, category_id: c }))));
    }
  }
  async deleteItem(item) {
    await this.q(this.sb.from("items").delete().eq("id", item.id));
    if (item.image_path) this.sb.storage.from("media").remove([item.image_path]);
  }
  async toggleVote(itemId, on) {
    const u = await this.me();
    if (on) await this.q(this.sb.from("votes").insert({ item_id: itemId }));
    else await this.q(this.sb.from("votes").delete().eq("item_id", itemId).eq("user_id", u.id));
  }
  async addComment(itemId, weddingId, body) { return this.q(this.sb.from("comments").insert({ item_id: itemId, wedding_id: weddingId, body }).select().single()); }
  async deleteComment(id) { await this.q(this.sb.from("comments").delete().eq("id", id)); }

  async addCategory(row) { return this.q(this.sb.from("categories").insert(row).select().single()); }
  async updateCategory(id, patch) { await this.q(this.sb.from("categories").update(patch).eq("id", id)); }
  async deleteCategory(id) { await this.q(this.sb.from("categories").delete().eq("id", id)); }

  async saveVendor(row) {
    if (row.id) { const { id, ...p } = row; await this.q(this.sb.from("vendors").update(p).eq("id", id)); return row; }
    return this.q(this.sb.from("vendors").insert(row).select().single());
  }
  async deleteVendor(id) { await this.q(this.sb.from("vendors").delete().eq("id", id)); }

  async createBrief(row) { return this.q(this.sb.from("briefs").insert(row).select().single()); }
  async updateBrief(id, patch) { await this.q(this.sb.from("briefs").update(patch).eq("id", id)); }
  async deleteBrief(id) { await this.q(this.sb.from("briefs").delete().eq("id", id)); }
  async getPublicBrief(token) {
    const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/brief?token=${encodeURIComponent(token)}`, { headers: { apikey: CONFIG.SUPABASE_KEY } });
    if (r.status === 404) return null;
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "Couldn't load the brief."); return j;
  }
  async replyBrief(token, r) {
    await this.q(this.sb.rpc("reply_to_brief", { p_token: token, p_name: r.name, p_handle: r.handle || null, p_contact: r.contact || null,
      p_message: r.message || null, p_quote: r.quote ?? null, p_links: r.links || [] }));
  }

  async createInvite(weddingId, role, side) { return (await this.q(this.sb.from("invites").insert({ wedding_id: weddingId, role, side: side || null }).select("token").single())).token; }
  async invitePreview(token) { return (await this.q(this.sb.rpc("invite_preview", { p_token: token })))[0] || null; }
  async acceptInvite(token) { return this.q(this.sb.rpc("accept_invite", { p_token: token })); }
  async setMember(weddingId, userId, patch) { await this.q(this.sb.from("members").update(patch).eq("wedding_id", weddingId).eq("user_id", userId)); }
  async removeMember(weddingId, userId) { await this.q(this.sb.from("members").delete().eq("wedding_id", weddingId).eq("user_id", userId)); }

  async upload(weddingId, blob) {
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${weddingId}/${uid()}.${ext}`;
    await this.q(this.sb.storage.from("media").upload(path, blob, { contentType: blob.type || "image/jpeg" }));
    return path;
  }
  async imageUrl(path) {
    if (!path) return null;
    const hit = this.urls.get(path); if (hit && hit.until > Date.now()) return hit.url;
    const { data } = await this.sb.storage.from("media").createSignedUrl(path, 3600);
    if (data?.signedUrl) this.urls.set(path, { url: data.signedUrl, until: Date.now() + 3300e3 });
    return data?.signedUrl || null;
  }
  async unfurl(url, weddingId) {
    try { return await this.q(this.sb.functions.invoke("unfurl", { body: { url, wedding_id: weddingId } })); }
    catch { const p = parseLink(url); return p?.handle ? { handle: p.handle } : {}; }
  }
  async joinWaitlist(row) { await this.q(this.sb.from("waitlist").insert(row)); }
}
