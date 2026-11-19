import { el, icon, toast, openModal, modalHead, confirmDialog, copyText, initials } from "./ui.js";
import { S, can, functions, areas, subAreas } from "./state.js";
import { refresh, go } from "./app.js";
import { colorFor } from "./templates.js";

const ROLES = [["editor", "Can add & curate"], ["commenter", "Can comment & vote"], ["viewer", "Can only look"]];
const SIDES = [["bride", "Bride's side"], ["groom", "Groom's side"], ["planner", "Planner"], ["friend", "Friend"]];
const roleLabel = r => (r === "owner" ? "Owner" : ROLES.find(x => x[0] === r)?.[1] || r);
const sideLabel = s => SIDES.find(x => x[0] === s)?.[1] || "";

export function renderFamily(root) {
  const W = S.W, wid = W.wedding.id;
  root.replaceChildren(el("main", { class: "page wide two-col" },
    el("section", {},
      el("div", { class: "row between" }, el("h2", { class: "serif" }, "Family & friends"),
        can.own() ? el("button", { class: "btn primary", onclick: invite }, icon("plus"), "Invite") : null),
      el("p", { class: "muted" }, "Everyone here sees the whole board. Choose who can add ideas and who can only comment and vote. Parents usually start as commenters."),
      el("ul", { class: "people" }, ...W.members.sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0)).map(m => el("li", {},
        el("span", { class: "avatar" }, initials(m.user_id === S.me.id ? S.me.name : m.name)),
        el("div", { class: "grow" }, el("b", {}, m.user_id === S.me.id ? (S.me.name === "You" ? "You" : `${S.me.name} (you)`) : m.name),
          el("p", { class: "small muted" }, [roleLabel(m.role), sideLabel(m.side)].filter(Boolean).join(" · "))),
        can.own() && m.role !== "owner" ? el("select", { "aria-label": "Role for " + m.name, onchange: async e => { await S.store.setMember(wid, m.user_id, { role: e.target.value }); toast("Updated"); await refresh(); } },
          ...ROLES.map(([k, l]) => el("option", { value: k, selected: m.role === k }, l))) : null,
        can.own() && m.role !== "owner" ? el("button", { class: "icon-btn", "aria-label": "Remove " + m.name, onclick: async () => {
          if (await confirmDialog(`Remove ${m.name} from this wedding?`, "Remove")) { await S.store.removeMember(wid, m.user_id); await refresh(); } } }, icon("close", 16)) : null))),
      !S.store.demo ? el("form", { class: "row name-form", onsubmit: async e => {
        e.preventDefault(); const n = e.target.n.value.trim(); if (!n) return;
        await S.store.setName(n); S.me = await S.store.me(); toast("Name saved"); await refresh();
      } }, el("label", { class: "field grow" }, el("span", {}, "Your name, as family sees it"), el("input", { name: "n", value: S.me.name, maxlength: "60" })), el("button", { class: "btn", type: "submit" }, "Save")) : null),
    can.edit() ? setup() : null));

  function invite() {
    let role = "editor", side = "";
    const out = el("div", { class: "stack" });
    const close = openModal(el("div", {}, modalHead("Invite someone", () => close()),
      el("div", { class: "m-body stack" },
        el("div", { class: "field" }, el("span", {}, "What can they do?"), el("div", { class: "chips" }, ...ROLES.map(([k, l]) => el("button", { type: "button", class: "chip" + (k === role ? " on" : ""), "data-k": k,
          onclick: e => { role = k; e.target.parentNode.querySelectorAll(".chip").forEach(b => b.classList.toggle("on", b.dataset.k === k)); } }, l)))),
        el("div", { class: "field" }, el("span", {}, "Whose side? (optional)"), el("div", { class: "chips" }, ...SIDES.map(([k, l]) => el("button", { type: "button", class: "chip", "data-k": k,
          onclick: e => { side = side === k ? "" : k; e.target.parentNode.querySelectorAll(".chip").forEach(b => b.classList.toggle("on", b.dataset.k === side)); } }, l)))),
        el("button", { class: "btn primary", onclick: async e => {
          e.target.disabled = true;
          try {
            const token = await S.store.createInvite(wid, role, side || null);
            const url = `${location.origin}${location.pathname}#/join/${token}`;
            const text = `Join our wedding board for ${W.wedding.title} on Shaadi Edit. Help us choose! ${url}`;
            out.replaceChildren(
              el("div", { class: "copy-row" }, el("input", { value: url, readonly: true, onfocus: ev => ev.target.select(), "aria-label": "Invite link" }),
                el("button", { class: "btn", onclick: async () => toast((await copyText(url)) ? "Link copied" : "Couldn't copy") }, "Copy")),
              el("a", { class: "btn primary", href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: "_blank", rel: "noopener" }, icon("wa", 16), "Send on WhatsApp"),
              el("p", { class: "fine" }, S.store.demo ? "Demo: invites are simulated in this browser." : "The link works for 30 days. They'll sign in with their email."));
          } catch (err) { toast(err.message, "err"); e.target.disabled = false; }
        } }, "Create invite link"), out)), { label: "Invite" });
  }

  function setup() {
    const w = W.wedding;
    const catList = (list, dim, parent = null) => el("ul", { class: "cat-list" + (parent ? " sub" : "") },
      ...list.map((c, k) => el("li", {},
        dim === "function" ? el("input", { type: "color", value: c.color && c.color.startsWith("#") ? c.color : colorFor(k), "aria-label": "Colour for " + c.name,
          onchange: async e => { await S.store.updateCategory(c.id, { color: e.target.value }); await refresh(); } }) : null,
        el("input", { value: c.name, "aria-label": "Name", class: "grow", onchange: async e => { const n = e.target.value.trim(); if (n) { await S.store.updateCategory(c.id, { name: n }); await refresh(); } } }),
        el("button", { class: "icon-btn small", "aria-label": "Move up", disabled: k === 0, onclick: () => move(list, k, -1) }, "↑"),
        el("button", { class: "icon-btn small", "aria-label": "Move down", disabled: k === list.length - 1, onclick: () => move(list, k, 1) }, "↓"),
        el("button", { class: "icon-btn small", "aria-label": "Delete " + c.name, onclick: async () => {
          if (await confirmDialog(`Delete “${c.name}”? Ideas stay on the board, just without this tag.`)) { await S.store.deleteCategory(c.id); await refresh(); } } }, icon("close", 14)),
        dim === "area" && !parent ? catList(subAreas(c.id), "area", c.id) : null)),
      el("li", { class: "add" }, el("input", { placeholder: parent ? "+ Add a finer choice" : dim === "function" ? "+ Add a function" : "+ Add something to decide", "aria-label": "Add",
        onkeydown: async e => { if (e.key !== "Enter" || !e.target.value.trim()) return; e.preventDefault();
          await S.store.addCategory({ wedding_id: wid, dim, parent_id: parent, name: e.target.value.trim(), position: list.length, color: dim === "function" ? colorFor(list.length) : null });
          await refresh(); } })));
    async function move(list, k, d) {
      const a = list[k], b = list[k + d];
      await Promise.all(list.map((c, i) => S.store.updateCategory(c.id, { position: c === a ? k + d : c === b ? k : i })));
      await refresh();
    }
    return el("section", { class: "setup" },
      el("h2", { class: "serif" }, "Board setup"),
      el("form", { class: "stack", onsubmit: async e => {
        e.preventDefault(); const f = e.target;
        await S.store.updateWedding(wid, { title: f.title.value.trim() || w.title, wedding_date: f.date.value || null, city: f.city.value.trim() || null });
        toast("Saved"); await refresh();
      } },
        el("label", { class: "field" }, el("span", {}, "Names"), el("input", { name: "title", value: w.title, maxlength: "120" })),
        el("div", { class: "row2" }, el("label", { class: "field" }, el("span", {}, "Date"), el("input", { name: "date", type: "date", value: w.wedding_date || "" })),
          el("label", { class: "field" }, el("span", {}, "City"), el("input", { name: "city", value: w.city || "" }))),
        el("div", { class: "row end" }, el("button", { class: "btn", type: "submit" }, "Save details"))),
      el("h3", { class: "sec" }, "Functions"), catList(functions(), "function"),
      el("h3", { class: "sec" }, "What you're deciding"), el("p", { class: "small muted" }, "Add finer choices under each, e.g. Decor › Stage, Entrance."), catList(areas(), "area"),
      can.own() ? el("div", { class: "danger-zone" }, el("button", { class: "btn ghost danger-text", onclick: async () => {
        if (await confirmDialog(`Delete the whole board for ${w.title}? Every idea, comment and brief will be gone. This can't be undone.`, "Delete everything")) { await S.store.deleteWedding(wid); S.W = null; toast("Deleted"); go("#/app"); } } }, "Delete this wedding board")) : null);
  }
}
