import { CONFIG, LIVE } from "./config.js";
import { $, el, icon, toast, fmtDate, daysTo, lsGet, lsSet, modalOpen, closeTopModal } from "./ui.js";
import { DemoStore, LiveStore } from "./store.js";
import { S, resetFilter } from "./state.js";
import { STYLES, AREAS } from "./templates.js";
import { sampleArt } from "./sample-art.js";
import { renderBoard, openAdd } from "./board.js";
import { renderVendors, renderBriefs, renderPublicBrief } from "./vendors.js";
import { renderFamily } from "./family.js";

const app = () => $("#app");
const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };
export { go };

/* ---------- Boot ---------- */

async function boot() {
  // Android share sheet (Web Share Target) lands here as ?url=…&text=…
  const qs = new URLSearchParams(location.search);
  if (qs.has("share")) {
    const text = [qs.get("title"), qs.get("text"), qs.get("url")].filter(Boolean).join(" ");
    sessionStorage.setItem("se-share", text);
    history.replaceState(null, "", location.pathname + "#/app");
  }
  if (LIVE) { try { S.live = await new LiveStore().init(); } catch { toast("Couldn't reach the server. Showing the demo.", "err"); } }
  pickStore();
  if (S.live) S.live.sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") { S.live.profile = null; if (S.store === S.live) route(); } });
  window.addEventListener("hashchange", route);
  document.addEventListener("paste", onPaste);
  // Coming back to the tab (e.g. after WhatsApp): pick up what others changed, unless a dialog is open.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && S.W && location.hash.startsWith("#/w/") && !modalOpen()) refresh().catch(() => {});
  });
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
}

function pickStore() {
  const demo = !S.live || sessionStorage.getItem("se-mode") === "demo";
  S.store = demo ? (S.demoStore ||= new DemoStore()) : S.live;
}
function setDemo(on) { if (on) sessionStorage.setItem("se-mode", "demo"); else sessionStorage.removeItem("se-mode"); pickStore(); }

/* ---------- Router ---------- */

export async function route() {
  if (modalOpen()) while (modalOpen()) closeTopModal();
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [r, a, b] = parts;
  window.scrollTo(0, 0);
  try {
    if (r === "b" && a) return await renderPublicBrief(app(), a);
    if (r === "sample") { setDemo(true); const ds = S.store; if (!ds.hasSample()) await ds.seedSample(); const w = (await ds.listWeddings()).find(x => x.sample); return go(`#/w/${w.id}`); }
    // Arriving from the sign-in email: Supabase reads the tokens from the address; tidy it up and carry on.
    if (/access_token=|error_description=/.test(location.hash)) {
      const err = new URLSearchParams(location.hash.slice(1)).get("error_description");
      if (err) toast(err.replace(/\+/g, " ") + ". Ask for a new sign-in email.", "err");
      await S.store.me();
      history.replaceState(null, "", location.pathname + "#/app");
      return route();
    }
    if (!r) return renderLanding();
    S.me = await S.store.me();
    // The sign-in link may open in a new tab, so a pending invite is kept in localStorage, not sessionStorage.
    if (!S.me) { if (r === "join" && a) lsSet("se-join", a); return renderSignIn(); }
    if (r === "join" && a) return await acceptInvite(a);
    if (lsGet("se-join")) { const t = lsGet("se-join"); lsSet("se-join", null); return await acceptInvite(t); }
    if (r === "new") return renderNew();
    if (r === "w" && a) return await renderWedding(a, b || "board");
    return await renderHome();
  } catch (e) {
    console.error(e);
    app().replaceChildren(el("main", { class: "page narrow center" }, el("h1", { class: "serif" }, "Something went wrong"),
      el("p", { class: "muted" }, e.message || String(e)), el("a", { class: "btn", href: "#/app" }, "Back to my weddings")));
  }
}

/* ---------- Landing ---------- */

function brand(small) { return el("a", { class: "brand" + (small ? " small" : ""), href: "#/" }, el("span", { class: "mark" }, "✦"), CONFIG.BRAND); }

function renderLanding() {
  document.title = `${CONFIG.BRAND}: plan your wedding together`;
  const start = () => go(S.live ? "#/app" : "#/app");
  const tiles = [["Haldi arch", ["#f4a300", "#fff3c4", "#e86a00"]], ["Mehendi lehenga", ["#a5d6a7", "#f1f8e9", "#81c784"]], ["Sangeet stage", ["#7e57c2", "#ede7f6", "#4527a0"]],
    ["Lake mandap", ["#ff8a65", "#fbe9e7", "#d84315"]], ["Polki set", ["#ffd54f", "#fff8e1", "#bf8f00"]], ["Reception florals", ["#e6c9a8", "#fffaf2", "#a1887f"]]];
  const fnRow = ["Haldi", "Mehendi", "Sangeet", "Wedding", "Reception"];
  const areaCol = ["Decor", "Outfits", "Jewellery", "Food"];
  const marks = [[1, 0, 2, 0], [0, 2, 1, 0], [2, 1, 0, 1], [2, 2, 1, 1], [1, 0, 0, 0]];
  const waitForm = el("form", { class: "wait", onsubmit: async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector("button");
    btn.disabled = true;
    try { await (S.live || S.store).joinWaitlist({ email: f.email.value.trim(), role: f.role.value, city: f.city.value.trim() || null }); f.replaceChildren(el("p", { class: "ok" }, "Thank you! We'll be in touch soon.")); }
    catch (err) { toast(/duplicate|unique/i.test(err.message) ? "You're already on the list." : err.message, "err"); btn.disabled = false; }
  } },
    el("input", { name: "email", type: "email", required: true, placeholder: "Work email", "aria-label": "Email" }),
    el("select", { name: "role", "aria-label": "I am a" }, ...[["vendor", "Vendor"], ["planner", "Wedding planner"], ["couple", "Couple"], ["family", "Family"]].map(([v, l]) => el("option", { value: v }, l))),
    el("input", { name: "city", placeholder: "City", "aria-label": "City" }),
    el("button", { class: "btn primary", type: "submit" }, "Get early access"));

  app().replaceChildren(
    el("header", { class: "lnav" }, brand(), el("nav", {},
      el("a", { href: "#vendors-sec", class: "hide-sm" }, "For vendors"), el("a", { href: "#faq", class: "hide-sm" }, "FAQ"),
      el("a", { class: "btn ghost small", href: "#/app" }, LIVE ? "Sign in" : "Open app"),
      el("button", { class: "btn primary small", onclick: start }, "Start free"))),
    el("main", { class: "landing" },
      el("section", { class: "hero" },
        el("div", { class: "hero-copy" },
          el("p", { class: "eyebrow" }, "The wedding planning board for Indian weddings"),
          el("h1", { class: "serif" }, "Every idea for your wedding. ", el("em", {}, "Curated, decided, together.")),
          el("p", { class: "lede" }, "Save reels, pins and photos from anywhere. Sort them by function, from Haldi to the Reception. Shortlist with family, and send vendors a brief they can reply to without an app."),
          el("div", { class: "row wrap" },
            el("button", { class: "btn primary big", onclick: start }, "Start planning free"),
            el("a", { class: "btn big", href: "#/sample" }, "See a sample wedding →")),
          el("p", { class: "fine" }, "Free while in early access · No app to install · Works on any phone")),
        el("div", { class: "hero-art", "aria-hidden": "true" },
          ...tiles.map(([t, c], k) => el("figure", { class: "tile t" + k }, el("img", { src: sampleArt(t, c, k), alt: "" }),
            k === 2 ? el("span", { class: "badge final" }, "✓ Final") : k % 2 ? el("span", { class: "badge cur" }, "★ Curated") : null)))),

      el("section", { class: "steps" },
        ...[["1", "Save from anywhere", "Share a reel straight from Instagram on Android, paste any link, or add photos and screenshots. We note whose work it is, so every save is a lead to a vendor."],
            ["2", "Curate per function", "Every idea sits under its function and what it's for: Sangeet × Stage, Wedding × Lehenga. Star the best ones and the board shows only those."],
            ["3", "Decide together", "Parents comment and vote, siblings add ideas, and you mark the finals. Then send each vendor a brief link with exactly the ideas you chose."]]
          .map(([n, h, p]) => el("div", { class: "step" }, el("span", { class: "n" }, n), el("h3", {}, h), el("p", {}, p)))),

      el("section", { class: "matrix-demo" },
        el("div", {}, el("h2", { class: "serif" }, "See your whole wedding at a glance"),
          el("p", { class: "muted" }, "Pinterest gives you a pile of pins. Here every function has a row and every decision a column. See what's still open for the Mehendi, or every outfit across all your functions, in one tap."),
          el("a", { class: "btn", href: "#/sample" }, "Open the sample wedding")),
        el("div", { class: "mini-matrix", "aria-hidden": "true" },
          el("div", { class: "mm-row head" }, el("span", {}), ...areaCol.map(a => el("span", {}, a))),
          ...fnRow.map((f, i) => el("div", { class: "mm-row" }, el("span", { class: "fn" }, f),
            ...marks[i].map(m => el("span", { class: "cell m" + m }, m === 2 ? "✓" : m === 1 ? "★" : "·")))))),

      el("section", { class: "features" },
        ...[["👪", "Made for the family", "Mummy can comment and vote without deleting anything. Both sides can join, and messages in Hindi or Gujarati are welcome."],
            ["🪷", "Your functions, your way", "Start from Gujarati, Punjabi, South Indian, Bengali, Muslim, Christian and other templates, then rename, add and reorder anything."],
            ["🔍", "As fine as you like", "Decor › Stage, Entrance, Florals. Outfits › Lehenga, Dupatta, Footwear. Filter down to exactly what you're deciding today."],
            ["📨", "Briefs vendors understand", "One link per brief shows your curated ideas for that function. Vendors reply with a quote, and you compare them side by side."],
            ["🏷️", "Vendors from your saves", "Saved three reels from the same decorator? They show up on your vendor shortlist, with their work beside them."],
            ["🔒", "Private by default", "Only people you invite can see your wedding. Vendors only see what you put in a brief."]]
          .map(([e, h, p]) => el("div", { class: "feat" }, el("span", { class: "emo" }, e), el("h3", {}, h), el("p", {}, p)))),

      el("section", { class: "vendors-cta", id: "vendors-sec" },
        el("div", {}, el("h2", { class: "serif" }, "Vendors and planners"),
          el("p", {}, "Get briefs that show exactly what a couple wants, with real references instead of \"something nice\". Reply from your phone, no login needed. Join early access to get a profile when it launches.")),
        waitForm),

      el("section", { class: "faq", id: "faq" }, el("h2", { class: "serif" }, "Questions"),
        ...[["Is it free?", "Yes, while we're in early access. Later there'll be an optional premium upgrade per wedding. Never ads."],
            ["Does my family need to install anything?", "No. Send them an invite link on WhatsApp. It opens in the browser, and they sign in with a link sent to their email. No password."],
            ["Can I save straight from Instagram?", "On Android, add the app to your home screen and it appears in Instagram's Share menu. On iPhone, copy the link and paste it into the app: it's ready the moment you open it."],
            ["Who can see our wedding?", "Only the people you invite. You choose who can edit and who can only comment. Vendors see only the ideas in the brief you send them."],
            ["How is this different from Pinterest or Canva?", "Pinterest is for discovering ideas and Canva is for designing. Shaadi Edit is for deciding: functions, shortlists, family votes, finals and vendor briefs, all in one place."]]
          .map(([q, a]) => el("details", {}, el("summary", {}, q), el("p", {}, a))))),
    el("footer", { class: "lfoot" }, brand(true), el("span", { class: "muted" }, `© ${new Date().getFullYear()} ${CONFIG.BRAND}. Made with love in India.`)));
}

/* ---------- Sign in (6-digit code) ---------- */

function renderSignIn() {
  document.title = `Sign in · ${CONFIG.BRAND}`;
  let email = "";
  const msg = el("p", { class: "err", "aria-live": "polite" });
  const box = el("div", { class: "auth-card" });
  const step1 = () => box.replaceChildren(...[
    el("h1", { class: "serif" }, "Welcome"),
    el("p", { class: "muted" }, "Enter your email and we'll send you a sign-in link. No password needed."),
    el("form", { class: "stack", onsubmit: async e => {
      e.preventDefault(); email = e.target.email.value.trim().toLowerCase();
      const b = e.target.querySelector("button"); b.disabled = true; b.textContent = "Sending…"; msg.textContent = "";
      try { await S.store.signIn(email); step2(); } catch (err) { msg.textContent = err.message; b.disabled = false; b.textContent = "Email me a sign-in link"; }
    } },
      el("input", { name: "email", type: "email", required: true, autocomplete: "email", placeholder: "you@example.com", autofocus: true, "aria-label": "Email" }),
      el("button", { class: "btn primary big", type: "submit" }, "Email me a sign-in link")), msg,
    S.live ? el("p", { class: "fine" }, "Just looking? ", el("a", { href: "#/sample" }, "Open the sample wedding"), " without signing in.") : null].filter(Boolean));
  const step2 = () => {
    const code = el("input", { name: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "6", pattern: "[0-9]{6}", placeholder: "123456", class: "code", autofocus: true, "aria-label": "6-digit code" });
    const verify = async () => {
      msg.textContent = "";
      try { await S.store.verify(email, code.value.trim()); S.me = await S.store.me(); route(); }
      catch { msg.textContent = "That code didn't work. Check the latest email, or send a new code."; code.value = ""; code.focus(); }
    };
    code.addEventListener("input", () => { code.value = code.value.replace(/\D/g, "").slice(0, 6); if (code.value.length === 6) verify(); });
    box.replaceChildren(el("h1", { class: "serif" }, "Check your email"),
      el("p", { class: "muted" }, `We emailed ${email}. Tap the sign-in link in that email, or type the 6-digit code if the email shows one. It can take a minute, and may land in spam.`),
      el("form", { class: "stack", onsubmit: e => { e.preventDefault(); verify(); } }, code, el("button", { class: "btn primary big", type: "submit" }, "Continue")), msg,
      el("button", { class: "link-btn", onclick: step1 }, "Use a different email"));
  };
  step1();
  app().replaceChildren(el("header", { class: "lnav" }, brand()), el("main", { class: "page narrow" }, box));
}

/* ---------- Home: my weddings ---------- */

async function renderHome() {
  document.title = `My weddings · ${CONFIG.BRAND}`;
  const list = await S.store.listWeddings();
  if (!list.length && !S.store.demo) return go("#/new");
  if (!list.length && S.store.demo && !S.live) return go("#/new");
  const share = sessionStorage.getItem("se-share");
  if (share && list.length === 1) return go(`#/w/${list[0].id}`);
  app().replaceChildren(topBar(),
    el("main", { class: "page" },
      share ? el("p", { class: "banner" }, "Pick a wedding to save what you shared.") : null,
      el("div", { class: "row between" }, el("h1", { class: "serif" }, "Your weddings"), el("a", { class: "btn primary", href: "#/new" }, icon("plus"), "New wedding")),
      el("div", { class: "w-grid" }, ...list.map(w => {
        const d = daysTo(w.wedding_date);
        return el("a", { class: "w-card", href: `#/w/${w.id}` },
          el("span", { class: "w-mono serif" }, w.title.split(/\s*&\s*|\s+and\s+/i).map(s => s[0]).join(" & ")),
          el("div", {}, el("h2", { class: "serif" }, w.title),
            el("p", { class: "muted" }, [w.wedding_date ? fmtDate(w.wedding_date) : "Date not set", w.city].filter(Boolean).join(" · ")),
            d != null && d >= 0 ? el("p", { class: "count" }, d === 0 ? "Today! 🎉" : `${d} days to go`) : null,
            w.sample ? el("span", { class: "pill" }, "Sample") : null));
      }))));
}

export function topBar(extra = null) {
  return el("header", { class: "topbar" }, brand(true), extra, el("span", { class: "grow" }),
    S.store.demo ? el("span", { class: "pill demo", title: "Everything is saved only in this browser" }, "Demo") : null,
    S.store.demo && S.live ? el("button", { class: "btn small", onclick: () => { setDemo(false); go("#/app"); } }, "Start your own") : null,
    !S.store.demo ? el("button", { class: "btn ghost small", onclick: async () => { await S.store.signOut(); go("#/"); } }, "Sign out") : null);
}

/* ---------- New wedding ---------- */

function renderNew() {
  document.title = `New wedding · ${CONFIG.BRAND}`;
  let style = STYLES[0], fns = [...style.functions], areaOn = new Set(AREAS.map(a => a.name));
  const fnBox = el("div", { class: "chips" }), areaBox = el("div", { class: "chips" });
  const paintFns = () => fnBox.replaceChildren(...fns.map((f, k) => el("span", { class: "chip on" }, f,
    el("button", { type: "button", class: "x", "aria-label": "Remove " + f, onclick: () => { fns.splice(k, 1); paintFns(); } }, "×"))),
    el("input", { class: "chip-input", placeholder: "+ Add a function", "aria-label": "Add a function", onkeydown: e => {
      if (e.key === "Enter" && e.target.value.trim()) { e.preventDefault(); fns.push(e.target.value.trim()); paintFns(); fnBox.querySelector("input").focus(); } } }));
  const paintAreas = () => areaBox.replaceChildren(...AREAS.map(a => el("button", { type: "button", class: "chip" + (areaOn.has(a.name) ? " on" : ""), "aria-pressed": String(areaOn.has(a.name)),
    onclick: () => { areaOn.has(a.name) ? areaOn.delete(a.name) : areaOn.add(a.name); paintAreas(); } }, a.name)));
  const styleSel = el("div", { class: "chips" }, ...STYLES.map(s => el("button", { type: "button", class: "chip" + (s === style ? " on" : ""), "data-s": s.id,
    onclick: () => { style = s; fns = [...s.functions]; styleSel.querySelectorAll(".chip").forEach(b => b.classList.toggle("on", b.dataset.s === s.id)); paintFns(); } }, s.name)));
  paintFns(); paintAreas();
  const form = el("form", { class: "stack big-gap", onsubmit: async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("[type=submit]");
    if (!fns.length) return toast("Add at least one function.", "err");
    btn.disabled = true; btn.textContent = "Creating…";
    try {
      const id = await S.store.createWedding({ title: f.title.value.trim(), date: f.date.value || null, city: f.city.value.trim(), functions: fns,
        areas: AREAS.filter(a => areaOn.has(a.name)) });
      resetFilter(); go(`#/w/${id}`);
    } catch (err) { toast(err.message, "err"); btn.disabled = false; btn.textContent = "Create our board"; }
  } },
    el("label", { class: "field" }, el("span", {}, "Whose wedding?"), el("input", { name: "title", required: true, maxlength: "120", placeholder: "Riya & Arjun", autofocus: true })),
    el("div", { class: "row2" },
      el("label", { class: "field" }, el("span", {}, "Date (optional)"), el("input", { name: "date", type: "date" })),
      el("label", { class: "field" }, el("span", {}, "City (optional)"), el("input", { name: "city", placeholder: "Udaipur" }))),
    el("div", { class: "field" }, el("span", {}, "What kind of wedding?"), styleSel),
    el("div", { class: "field" }, el("span", {}, "Your functions"), fnBox, el("small", { class: "muted" }, "Remove any you're not having, add your own. You can change these later.")),
    el("div", { class: "field" }, el("span", {}, "What are you deciding?"), areaBox, el("small", { class: "muted" }, "Each comes with finer choices (Decor › Stage, Entrance, Florals…). Edit them any time.")),
    el("button", { class: "btn primary big", type: "submit" }, "Create our board"));
  app().replaceChildren(topBar(), el("main", { class: "page narrow" }, el("h1", { class: "serif" }, "Let's set up your board"), form));
}

/* ---------- Invite ---------- */

async function acceptInvite(token) {
  try { const id = await S.store.acceptInvite(token); toast("Welcome! You've joined the wedding board."); go(`#/w/${id}`); }
  catch (e) { toast(e.message, "err"); go("#/app"); }
}

/* ---------- Wedding ---------- */

export async function loadWedding(id) { S.W = await S.store.loadWedding(id); return S.W; }

async function renderWedding(id, tab) {
  // Always load fresh: family members and vendors may have added things since.
  if (S.W?.wedding.id !== id) resetFilter();
  await loadWedding(id);
  S.tab = ["board", "vendors", "briefs", "family"].includes(tab) ? tab : "board";
  paintWedding();
  const share = sessionStorage.getItem("se-share");
  if (share && S.tab === "board") { sessionStorage.removeItem("se-share"); openAdd({ text: share }); }
}

export function paintWedding() {
  const w = S.W.wedding, d = daysTo(w.wedding_date);
  document.title = `${w.title} · ${CONFIG.BRAND}`;
  const tabs = [["board", "Board"], ["vendors", "Vendors"], ["briefs", "Briefs"], ["family", "Family"]];
  const counts = { vendors: S.W.vendors.length, briefs: S.W.replies.length, family: S.W.members.length };
  const content = el("div", { id: "tab" });
  app().replaceChildren(
    topBar(el("a", { class: "crumb", href: "#/app" }, "My weddings")),
    el("section", { class: "w-head" },
      el("div", { class: "w-title" },
        el("h1", { class: "serif" }, w.title),
        el("p", { class: "muted" }, [w.wedding_date ? fmtDate(w.wedding_date) : null, w.city, d != null && d >= 0 ? (d === 0 ? "Today! 🎉" : `${d} days to go`) : null].filter(Boolean).join(" · "))),
      el("nav", { class: "tabs", "aria-label": "Sections" }, ...tabs.map(([k, l]) => el("a", { href: `#/w/${w.id}/${k}`, class: "tab" + (S.tab === k ? " on" : ""), "aria-current": S.tab === k ? "page" : null },
        l, counts[k] ? el("span", { class: "n" }, counts[k]) : null))),
      S.tab === "board" && ["owner", "editor"].includes(S.W.role) ? el("button", { class: "btn primary add-btn", onclick: () => openAdd() }, icon("plus"), "Add idea") : null),
    content);
  ({ board: renderBoard, vendors: renderVendors, briefs: renderBriefs, family: renderFamily })[S.tab](content);
}

export async function refresh() { await loadWedding(S.W.wedding.id); paintWedding(); }

/* Paste a link or image anywhere on the board to add it. */
function onPaste(e) {
  if (!S.W || S.tab !== "board" || modalOpen() || !["owner", "editor"].includes(S.W.role)) return;
  if (e.target.closest?.("input, textarea, [contenteditable]")) return;
  const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith("image/"));
  const text = e.clipboardData?.getData("text") || "";
  if (files.length || text.trim()) { e.preventDefault(); openAdd({ text, files }); }
}

window.SE = { S, route, go };   // handy in the browser console when debugging
boot();
