// Small DOM toolkit: el() builder, modals, toasts, formatting.

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "html") n.innerHTML = v;
    else if (k in n && typeof v !== "string" && k !== "list") n[k] = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
}

const SVG = {
  star: '<path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  check: '<path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/>',
  heart: '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/>',
  chat: '<path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4.3 3.4A.4.4 0 0 1 4 20.1V5a1 1 0 0 1 0-1z"/>',
  plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
  close: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z"/>',
  link: '<path d="M10.6 13.4a1 1 0 0 0 1.4 0l4.6-4.6a3 3 0 0 0-4.2-4.2l-1.7 1.7 1.4 1.4 1.7-1.7a1 1 0 0 1 1.4 1.4L10.6 12a1 1 0 0 0 0 1.4zm2.8-2.8a1 1 0 0 0-1.4 0l-4.6 4.6a3 3 0 0 0 4.2 4.2l1.7-1.7-1.4-1.4-1.7 1.7a1 1 0 0 1-1.4-1.4l4.6-4.6a1 1 0 0 0 0-1.4z"/>',
  grid: '<path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/>',
  table: '<path d="M3 4h18v16H3zm2 2v3h4V6zm6 0v3h8V6zm-6 5v3h4v-3zm6 0v3h8v-3zm-6 5v2h4v-2zm6 0v2h8v-2z"/>',
  ig: '<path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm5 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM17.3 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>',
  photo: '<path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v8.6l4-4 3 3 2-2 5 5V7zm10 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>',
  wa: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.1z"/>',
  back: '<path d="M15.4 5 8.4 12l7 7 1.4-1.4L11.2 12l5.6-5.6z"/>',
  more: '<path d="M6 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>',
};
export function icon(name, size = 18) {
  const s = el("span", { class: "ic", "aria-hidden": "true" });
  s.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor">${SVG[name] || ""}</svg>`;
  return s;
}

// ---------- Toasts ----------
let toastTimer;
export function toast(msg, kind = "") {
  let t = $("#toast");
  if (!t) { t = el("div", { id: "toast", role: "status", "aria-live": "polite" }); document.body.append(t); }
  t.textContent = msg; t.className = "toast show " + kind;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), kind === "err" ? 5000 : 2600);
}

// ---------- Modals ----------
const stack = [];
export function openModal(content, { wide = false, label = "", onClose } = {}) {
  const prev = document.activeElement;
  const panel = el("div", { class: "modal" + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": label, tabindex: "-1" }, content);
  const back = el("div", { class: "backdrop", onclick: e => { if (e.target === back) close(); } }, panel);
  const close = () => {
    const k = stack.indexOf(close); if (k < 0) return;
    stack.splice(k, 1); back.remove();
    if (!stack.length) document.body.classList.remove("locked");
    onClose?.(); prev?.focus?.();
  };
  stack.push(close);
  document.body.append(back); document.body.classList.add("locked");
  requestAnimationFrame(() => (panel.querySelector("[autofocus]") || panel).focus());
  return close;
}
export const closeTopModal = () => stack.at(-1)?.();
export const modalOpen = () => stack.length > 0;
document.addEventListener("keydown", e => { if (e.key === "Escape" && stack.length) { e.preventDefault(); closeTopModal(); } });

export function modalHead(title, close, extra = null) {
  return el("div", { class: "m-head" }, el("h2", {}, title), extra,
    el("button", { class: "icon-btn", type: "button", "aria-label": "Close", onclick: close }, icon("close")));
}

export function confirmDialog(message, okLabel = "Delete", danger = true) {
  return new Promise(res => {
    let done = false;
    const close = openModal(el("div", { class: "m-body confirm" },
      el("p", {}, message),
      el("div", { class: "row end" },
        el("button", { class: "btn ghost", type: "button", onclick: () => { done = true; close(); res(false); } }, "Cancel"),
        el("button", { class: "btn " + (danger ? "danger" : "primary"), type: "button", autofocus: true, onclick: () => { done = true; close(); res(true); } }, okLabel))),
      { label: "Confirm", onClose: () => { if (!done) res(false); } });
  });
}

// ---------- Formatting ----------
export const fmtDate = d => (d ? new Date(d + (String(d).length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const rupees = n => (n == null || n === "" ? "" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 }));
export function parseRupees(s) {
  if (s == null) return null;
  const t = String(s).toLowerCase().replace(/[₹,\s]/g, "");
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lakhs|lac|cr|crore)?$/);
  if (!m) return null;
  const mult = { k: 1e3, l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, cr: 1e7, crore: 1e7 }[m[2]] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}
export function daysTo(date) {
  if (!date) return null;
  const d = new Date(date + "T00:00:00"), now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}
export const initials = name => (name || "?").replace(/\(.*?\)/g, "").split(/[\s@._-]+/).map(w => w.match(/\p{L}/u)?.[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
export const ago = iso => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago"; if (s < 86400 * 7) return Math.floor(s / 86400) + "d ago";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const uid = () => crypto.randomUUID();
export function lsGet(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
export function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = el("textarea", { style: { position: "fixed", opacity: "0" } }, text); document.body.append(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

/** Shrink a photo to at most `max` px on its long side and return a JPEG blob. */
export async function shrinkImage(file, max = 1800) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, "image/jpeg", 0.84));
  } catch { return file; }
}
