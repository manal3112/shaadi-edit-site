import { CONFIG } from "./config.js";
import { $, el, icon, toast, openModal, modalHead, confirmDialog, rupees, parseRupees, ago, copyText, fmtDate } from "./ui.js";
import { parseLink, embedUrl, cleanHandle } from "./links.js";
import { S, can, cat, functions, areas, itemTopAreas } from "./state.js";
import { refresh, paintWedding } from "./app.js";

const VSTATUS = [["shortlisted", "Shortlisted"], ["contacted", "Contacted"], ["quoted", "Quoted"], ["booked", "Booked ✓"], ["dropped", "Not going ahead"]];
const statusLabel = s => VSTATUS.find(x => x[0] === s)?.[1] || s;
const waLink = phone => { const d = String(phone || "").replace(/\D/g, ""); return d.length >= 10 ? `https://wa.me/${d.length === 10 ? "91" + d : d}` : null; };
export const briefUrl = token => `${location.origin}${location.pathname}#/b/${token}`;

/* ================= Vendors tab ================= */

export function renderVendors(root) {
  const W = S.W, wid = W.wedding.id;
  const known = new Set(W.vendors.map(v => (v.handle || "").toLowerCase()).filter(Boolean));
  const fromSaves = new Map();
  for (const it of W.items) if (it.vendor_handle && !known.has(it.vendor_handle.toLowerCase())) {
    const h = it.vendor_handle.toLowerCase(); const e = fromSaves.get(h) || { n: 0, area: itemTopAreas(it)[0] || null }; e.n++; fromSaves.set(h, e);
  }
  for (const r of W.replies) if (r.handle && !known.has(r.handle.toLowerCase()) && !fromSaves.has(r.handle.toLowerCase())) fromSaves.set(r.handle.toLowerCase(), { n: 0, area: W.briefs.find(b => b.id === r.brief_id)?.area_id || null, reply: r });

  const booked = W.vendors.filter(v => v.status === "booked"), bookedSum = booked.reduce((s, v) => s + (Number(v.quote) || 0), 0);
  const quoted = W.vendors.filter(v => v.status === "quoted" && v.quote);
  const ideasBy = h => W.items.filter(i => (i.vendor_handle || "").toLowerCase() === (h || "").toLowerCase()).length;
  const repliesBy = h => W.replies.filter(r => h && (r.handle || "").toLowerCase() === h.toLowerCase());

  const groups = [...areas(), { id: null, name: "Other" }].map(a => ({ a, vs: W.vendors.filter(v => (v.area_id || null) === a.id || (a.id === null && v.area_id && !cat(v.area_id))) }))
    .filter(g => g.vs.length);
  const order = { booked: 0, quoted: 1, contacted: 2, shortlisted: 3, dropped: 4 };

  root.replaceChildren(el("main", { class: "page wide" },
    el("div", { class: "row between wrap" },
      el("div", {}, el("h2", { class: "serif" }, "Vendors"),
        el("p", { class: "muted" }, W.vendors.length ? `${booked.length} booked${bookedSum ? " · " + rupees(bookedSum) + " committed" : ""}${quoted.length ? ` · ${quoted.length} quote${quoted.length > 1 ? "s" : ""} to decide on` : ""}` : "Keep every vendor you're considering in one place: quotes, contacts and their work.")),
      can.edit() ? el("button", { class: "btn primary", onclick: () => vendorForm({ wedding_id: wid }) }, icon("plus"), "Add vendor") : null),
    fromSaves.size && can.edit() ? el("section", { class: "suggest" },
      el("h3", {}, "From your saves"),
      el("p", { class: "muted small" }, "These accounts made ideas you saved, or replied to a brief. Add them to compare and track them."),
      el("div", { class: "chips" }, ...[...fromSaves].map(([h, e]) => el("button", { class: "chip", type: "button", onclick: async () => {
        await S.store.saveVendor({ wedding_id: wid, handle: h, name: e.reply?.vendor_name || null, area_id: e.area, status: e.reply?.quote ? "quoted" : "shortlisted", quote: e.reply?.quote ?? null, phone: e.reply?.contact || null });
        toast(`@${h} added`); await refresh();
      } }, "+ @" + h, e.n ? el("span", { class: "n" }, e.n) : el("span", { class: "n" }, "replied"))))) : null,
    !W.vendors.length && !fromSaves.size ? el("div", { class: "empty" }, el("p", { class: "muted" }, "Tip: when you save an Instagram post, add the account's @handle. It shows up here so you can track that vendor.")) : null,
    ...groups.map(({ a, vs }) => el("section", { class: "v-group" },
      el("h3", { class: "sec" }, a.name, el("span", { class: "muted" }, ` · ${vs.length}`)),
      el("div", { class: "v-grid" }, ...vs.sort((x, y) => order[x.status] - order[y.status] || (Number(x.quote) || 1e12) - (Number(y.quote) || 1e12)).map(v => {
        const reps = repliesBy(v.handle), n = ideasBy(v.handle), wa = waLink(v.phone);
        return el("article", { class: "v-card st-" + v.status },
          el("div", { class: "row between" },
            el("div", {}, el("h4", {}, v.name || (v.handle ? "@" + v.handle : "Vendor")),
              v.handle ? el("a", { class: "small", href: `https://www.instagram.com/${v.handle}/`, target: "_blank", rel: "noopener" }, "@" + v.handle + " ↗") : null),
            can.edit() ? el("select", { "aria-label": "Status", onchange: async e => { await S.store.saveVendor({ id: v.id, status: e.target.value }); await refresh(); } },
              ...VSTATUS.map(([k, l]) => el("option", { value: k, selected: v.status === k }, l))) : el("span", { class: "pill" }, statusLabel(v.status))),
          v.quote ? el("p", { class: "quote" }, rupees(v.quote)) : null,
          v.notes ? el("p", { class: "small" }, v.notes) : null,
          reps.length ? el("p", { class: "small muted" }, `Replied to ${reps.length} brief${reps.length > 1 ? "s" : ""}`) : null,
          el("div", { class: "row wrap" },
            n ? el("button", { class: "btn small", onclick: () => { Object.assign(S.filter, { vendor: v.handle.toLowerCase(), status: "all", fn: null, area: null, sub: null }); location.hash = `#/w/${wid}/board`; } }, `See ${n} idea${n > 1 ? "s" : ""}`) : null,
            wa ? el("a", { class: "btn small", href: wa, target: "_blank", rel: "noopener" }, icon("wa", 15), "WhatsApp") : null,
            v.phone && !wa ? el("span", { class: "small" }, v.phone) : null,
            can.edit() ? el("button", { class: "btn small ghost", onclick: () => vendorForm(v) }, "Edit") : null));
      }))))));
}

function vendorForm(v) {
  const edit = !!v.id;
  const close = openModal(el("div", {}, modalHead(edit ? "Edit vendor" : "Add a vendor", () => close()),
    el("form", { class: "m-body stack", onsubmit: async e => {
      e.preventDefault(); const f = e.target;
      const row = { ...(edit ? { id: v.id } : { wedding_id: v.wedding_id }), name: f.vname.value.trim() || null, handle: cleanHandle(f.handle.value) || null,
        area_id: f.area.value || null, status: f.status.value, quote: parseRupees(f.quote.value), phone: f.phone.value.trim() || null, notes: f.notes.value.trim() || null };
      if (!row.name && !row.handle) return toast("Add a name or an Instagram handle.", "err");
      try { await S.store.saveVendor(row); close(); toast("Saved"); await refresh(); } catch (err) { toast(/unique|duplicate/i.test(err.message) ? "That handle is already on your list." : err.message, "err"); }
    } },
      el("label", { class: "field" }, el("span", {}, "Name"), el("input", { name: "vname", value: v.name || "", placeholder: "Bloom Decor", autofocus: true })),
      el("div", { class: "row2" },
        el("label", { class: "field" }, el("span", {}, "Instagram"), el("input", { name: "handle", value: v.handle ? "@" + v.handle : "", placeholder: "@bloomdecor" })),
        el("label", { class: "field" }, el("span", {}, "Phone / WhatsApp"), el("input", { name: "phone", type: "tel", value: v.phone || "", placeholder: "98xxxxxxxx" }))),
      el("div", { class: "row2" },
        el("label", { class: "field" }, el("span", {}, "For"), el("select", { name: "area" }, el("option", { value: "" }, "—"), ...areas().map(a => el("option", { value: a.id, selected: v.area_id === a.id }, a.name)))),
        el("label", { class: "field" }, el("span", {}, "Status"), el("select", { name: "status" }, ...VSTATUS.map(([k, l]) => el("option", { value: k, selected: (v.status || "shortlisted") === k }, l))))),
      el("label", { class: "field" }, el("span", {}, "Quote"), el("input", { name: "quote", inputmode: "decimal", value: v.quote ? String(v.quote) : "", placeholder: "e.g. 4.5 lakh" })),
      el("label", { class: "field" }, el("span", {}, "Notes"), el("textarea", { name: "notes", rows: 3, placeholder: "Includes setup? Advance? Dates free?" }, v.notes || "")),
      el("div", { class: "row between" },
        edit ? el("button", { type: "button", class: "btn ghost danger-text", onclick: async () => { if (await confirmDialog("Remove this vendor?", "Remove")) { await S.store.deleteVendor(v.id); close(); await refresh(); } } }, "Remove") : el("span"),
        el("button", { class: "btn primary", type: "submit" }, "Save")))), { label: "Vendor" });
}

/* ================= Briefs tab ================= */

export function renderBriefs(root) {
  const W = S.W;
  const scopeName = b => [cat(b.function_id)?.name, cat(b.area_id)?.name].filter(Boolean).join(" · ") || "Whole wedding";
  root.replaceChildren(el("main", { class: "page wide" },
    el("div", { class: "row between wrap" },
      el("div", {}, el("h2", { class: "serif" }, "Briefs"),
        el("p", { class: "muted" }, "A brief is one link for a vendor: your curated ideas for a function, your notes, and a form to reply with a quote. Vendors don't need an account.")),
      can.edit() ? el("button", { class: "btn primary", onclick: newBrief }, icon("plus"), "New brief") : null),
    !W.briefs.length ? el("div", { class: "empty" }, el("p", { class: "muted" }, "Curate a few ideas first (★), then create a brief, for example \"Haldi · Decor\", and send it to three decorators on WhatsApp.")) : null,
    ...W.briefs.map(b => {
      const reps = W.replies.filter(r => r.brief_id === b.id);
      return el("section", { class: "brief" + (b.closed ? " closed" : "") },
        el("div", { class: "row between wrap" },
          el("div", {}, el("h3", {}, b.title), el("p", { class: "muted small" }, scopeName(b), " · ", b.closed ? "Closed" : "Open", " · ", ago(b.created_at))),
          el("div", { class: "row wrap" },
            el("a", { class: "btn small", href: `#/b/${b.token}`, target: "_blank" }, "Preview"),
            !b.closed ? el("button", { class: "btn small", onclick: () => shareBrief(b) }, "Share link") : null,
            can.edit() ? el("button", { class: "btn small ghost", onclick: async () => { await S.store.updateBrief(b.id, { closed: !b.closed }); await refresh(); } }, b.closed ? "Reopen" : "Close") : null,
            can.edit() ? el("button", { class: "btn small ghost danger-text", onclick: async () => { if (await confirmDialog("Delete this brief and its replies?")) { await S.store.deleteBrief(b.id); await refresh(); } } }, "Delete") : null)),
        b.message ? el("p", { class: "b-msg" }, b.message) : null,
        el("h4", { class: "sec" }, reps.length ? `${reps.length} repl${reps.length > 1 ? "ies" : "y"}` : "No replies yet"),
        reps.length ? el("div", { class: "replies" }, ...reps.sort((x, y) => (Number(x.quote) || 1e12) - (Number(y.quote) || 1e12)).map(r => replyCard(r, b))) : null);
    })));
}

function replyCard(r, b) {
  const W = S.W, already = r.handle && W.vendors.some(v => (v.handle || "").toLowerCase() === r.handle.toLowerCase());
  const wa = waLink(r.contact);
  return el("article", { class: "reply" },
    el("div", { class: "row between" },
      el("div", {}, el("b", {}, r.vendor_name), r.handle ? el("a", { class: "small", href: `https://www.instagram.com/${r.handle}/`, target: "_blank", rel: "noopener" }, " @" + r.handle) : null,
        el("p", { class: "small muted" }, ago(r.created_at))),
      r.quote ? el("span", { class: "quote" }, rupees(r.quote)) : null),
    r.message ? el("p", {}, r.message) : null,
    r.links?.length ? el("ul", { class: "links" }, ...r.links.map(l => el("li", {}, el("a", { href: l, target: "_blank", rel: "noopener" }, l.replace(/^https?:\/\/(www\.)?/, ""))))) : null,
    el("div", { class: "row wrap" },
      wa ? el("a", { class: "btn small", href: wa, target: "_blank", rel: "noopener" }, icon("wa", 15), "WhatsApp") : r.contact ? el("span", { class: "small" }, r.contact) : null,
      can.edit() && !already ? el("button", { class: "btn small", onclick: async () => {
        await S.store.saveVendor({ wedding_id: W.wedding.id, name: r.vendor_name, handle: r.handle || null, area_id: b.area_id || null, status: r.quote ? "quoted" : "contacted", quote: r.quote ?? null, phone: r.contact || null });
        toast("Added to vendors"); await refresh();
      } }, "+ Add to vendors") : already ? el("span", { class: "pill" }, "On your vendor list") : null));
}

function newBrief() {
  const f = S.filter;
  const fnSel = el("select", { name: "fn" }, el("option", { value: "" }, "All functions"), ...functions().map(c => el("option", { value: c.id, selected: f.fn === c.id }, c.name)));
  const arSel = el("select", { name: "area" }, el("option", { value: "" }, "Everything"), ...areas().map(a => el("option", { value: a.id, selected: f.area === a.id }, a.name)));
  const title = el("input", { name: "title", required: true, maxlength: "120" });
  const autoTitle = () => { if (!title.dataset.touched) title.value = [cat(fnSel.value)?.name, cat(arSel.value)?.name].filter(Boolean).join(" · ") || "Our wedding"; };
  title.addEventListener("input", () => (title.dataset.touched = "1"));
  fnSel.addEventListener("change", autoTitle); arSel.addEventListener("change", autoTitle); autoTitle();
  const count = el("p", { class: "small muted" });
  const paintCount = () => {
    const its = S.W.items.filter(i => (!fnSel.value || i.cat_ids.includes(fnSel.value)) && (!arSel.value || itemTopAreas(i).includes(arSel.value)));
    const cur = its.filter(i => i.status !== "idea");
    count.textContent = cur.length ? `${cur.length} curated idea${cur.length > 1 ? "s" : ""} will be shown.` : its.length ? `Nothing curated here yet, so all ${its.length} ideas will be shown. Curate first to send only your favourites.` : "No ideas here yet. Add some first.";
  };
  fnSel.addEventListener("change", paintCount); arSel.addEventListener("change", paintCount); paintCount();
  const close = openModal(el("div", {}, modalHead("New brief", () => close()),
    el("form", { class: "m-body stack", onsubmit: async e => {
      e.preventDefault(); const t = e.target;
      try {
        const b = await S.store.createBrief({ wedding_id: S.W.wedding.id, title: title.value.trim(), function_id: fnSel.value || null, area_id: arSel.value || null, message: t.msg.value.trim() || null });
        close(); await refresh(); shareBrief(b);
      } catch (err) { toast(err.message, "err"); }
    } },
      el("div", { class: "row2" }, el("label", { class: "field" }, el("span", {}, "Function"), fnSel), el("label", { class: "field" }, el("span", {}, "For"), arSel)),
      count,
      el("label", { class: "field" }, el("span", {}, "Title"), title),
      el("label", { class: "field" }, el("span", {}, "Message to vendors"), el("textarea", { name: "msg", rows: 5, placeholder: "Date, venue, guest count, budget range, and anything that matters (e.g. \"no artificial flowers\")." })),
      el("div", { class: "row end" }, el("button", { class: "btn primary", type: "submit" }, "Create brief")))), { label: "New brief" });
}

function shareBrief(b) {
  const url = briefUrl(b.token);
  const text = `Hi! We're planning ${S.W.wedding.title}'s wedding${S.W.wedding.city ? " in " + S.W.wedding.city : ""}. Here's our brief for ${b.title}: our favourite ideas and details. You can reply with your quote right there, no login needed: ${url}`;
  const close = openModal(el("div", {}, modalHead("Send to vendors", () => close()),
    el("div", { class: "m-body stack" },
      el("p", { class: "muted" }, "Anyone with this link can see the ideas in this brief and reply. You can close it any time."),
      el("div", { class: "copy-row" }, el("input", { value: url, readonly: true, "aria-label": "Brief link", onfocus: e => e.target.select() }),
        el("button", { class: "btn", onclick: async () => toast((await copyText(url)) ? "Link copied" : "Couldn't copy", "") }, "Copy")),
      el("div", { class: "row wrap" },
        el("a", { class: "btn primary", href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: "_blank", rel: "noopener" }, icon("wa", 16), "Send on WhatsApp"),
        navigator.share ? el("button", { class: "btn", onclick: () => navigator.share({ title: b.title, text, url }).catch(() => {}) }, "More…") : null,
        el("a", { class: "btn ghost", href: `#/b/${b.token}`, target: "_blank" }, "Preview")),
      S.store.demo ? el("p", { class: "fine" }, "Demo: this link only works in this browser. On a real board it works for anyone.") : null)), { label: "Share brief" });
}

/* ================= Public brief (what vendors see) ================= */

export async function renderPublicBrief(root, token) {
  document.title = `Brief · ${CONFIG.BRAND}`;
  root.replaceChildren(el("main", { class: "page narrow center" }, el("p", { class: "muted" }, "Loading…")));
  let b;
  try { b = await S.store.getPublicBrief(token); } catch (e) { b = { error: e.message }; }
  if (!b || b.error) {
    root.replaceChildren(el("main", { class: "page narrow center" }, el("h1", { class: "serif" }, "This brief isn't available"),
      el("p", { class: "muted" }, b?.error || "It may have been closed by the couple, or the link is incomplete."), el("a", { href: "#/" }, `About ${CONFIG.BRAND}`)));
    return;
  }
  document.title = `${b.title}: ${b.couple} · ${CONFIG.BRAND}`;
  const form = el("form", { class: "stack reply-form", onsubmit: async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector("[type=submit]");
    const links = f.links.value.split(/\s+/).map(s => s.trim()).filter(s => /^https?:\/\//.test(s)).slice(0, 10);
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      await S.store.replyBrief(token, { name: f.vname.value.trim(), handle: f.handle.value, contact: f.contact.value.trim(), quote: parseRupees(f.quote.value), message: f.msg.value.trim(), links });
      form.replaceWith(el("div", { class: "thanks" }, el("h2", { class: "serif" }, "Sent. Thank you! 🙏"),
        el("p", {}, `${b.couple} will see your reply on their board and get in touch.`),
        el("p", { class: "muted small" }, `Want more briefs like this? `, el("a", { href: "#/" }, `Join ${CONFIG.BRAND} for vendors`), ".")));
    } catch (err) { toast(err.message, "err"); btn.disabled = false; btn.textContent = "Send reply"; }
  } },
    el("h2", { class: "serif" }, "Reply with your idea and quote"),
    el("div", { class: "row2" },
      el("label", { class: "field" }, el("span", {}, "Business name"), el("input", { name: "vname", required: true, maxlength: "120" })),
      el("label", { class: "field" }, el("span", {}, "Instagram"), el("input", { name: "handle", placeholder: "@yourstudio" }))),
    el("div", { class: "row2" },
      el("label", { class: "field" }, el("span", {}, "Phone / WhatsApp or email"), el("input", { name: "contact", required: true, maxlength: "200" })),
      el("label", { class: "field" }, el("span", {}, "Estimated quote (₹)"), el("input", { name: "quote", inputmode: "decimal", placeholder: "e.g. 4.5 lakh" }))),
    el("label", { class: "field" }, el("span", {}, "Your message"), el("textarea", { name: "msg", rows: 5, maxlength: "4000", placeholder: "How you'd approach it, what's included, availability on the date…" })),
    el("label", { class: "field" }, el("span", {}, "Links to similar work (optional)"), el("textarea", { name: "links", rows: 2, placeholder: "Instagram posts, your website… one per line" })),
    el("button", { class: "btn primary big", type: "submit" }, "Send reply"));

  root.replaceChildren(
    el("header", { class: "lnav" }, el("a", { class: "brand", href: "#/" }, el("span", { class: "mark" }, "✦"), CONFIG.BRAND), el("span", { class: "pill" }, "Brief for vendors")),
    el("main", { class: "page brief-page" },
      el("p", { class: "eyebrow" }, [b.function, b.area].filter(Boolean).join(" · ") || "Wedding brief"),
      el("h1", { class: "serif" }, b.title),
      el("p", { class: "muted" }, [b.couple, b.date ? fmtDate(b.date) : null, b.city].filter(Boolean).join(" · ")),
      b.message ? el("blockquote", { class: "b-msg" }, b.message) : null,
      el("h2", { class: "sec" }, b.items.length ? `What we love (${b.items.length})` : "No ideas added yet"),
      el("div", { class: "masonry" }, ...b.items.map(i => {
        const emb = embedUrl(i);
        return el("article", { class: `card s-${i.status}` },
          i.image_url ? el("div", { class: "media" }, el("img", { src: i.image_url, alt: i.title || "", loading: "lazy" }))
            : emb ? el("div", { class: "media big" }, el("iframe", { src: emb, loading: "lazy", title: i.title || "Post", allowfullscreen: true }))
            : i.kind === "note" ? el("div", { class: "media note-ph" }, el("p", {}, i.note)) : null,
          el("div", { class: "c-body" },
            i.status === "final" ? el("span", { class: "badge final" }, "✓ Decided") : el("span", { class: "badge cur" }, "★ Shortlisted"),
            i.title ? el("h3", { class: "c-title" }, i.title) : null,
            i.note && i.kind !== "note" ? el("p", { class: "c-note" }, i.note) : null,
            i.url ? el("a", { class: "small", href: i.url, target: "_blank", rel: "noopener" }, "Open original ↗") : null));
      })),
      form),
    el("footer", { class: "lfoot" }, el("span", { class: "muted" }, `Made with ${CONFIG.BRAND}: the wedding planning board for couples, families and vendors.`)));
}
