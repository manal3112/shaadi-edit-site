// Understands what was pasted or shared: an Instagram reel/post, Pinterest, YouTube, or any web page.

const TRACKING = /^(utm_.*|igsh|igshid|fbclid|si|feature|_t|_r|is_from_webapp|sender_device|img_index)$/i;

export function firstUrl(text) {
  const m = String(text || "").match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.;!?]+$/, "") : null;
}

export function parseLink(text) {
  const raw = firstUrl(text);
  if (!raw) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    const k = parts.findIndex(p => ["p", "reel", "reels", "tv"].includes(p));
    if (k >= 0 && parts[k + 1]) {
      const type = parts[k] === "p" ? "p" : "reel";
      // instagram.com/<username>/p/<id> carries the account name
      const handle = k === 1 && !["explore", "stories"].includes(parts[0]) ? parts[0] : null;
      return { url: `https://www.instagram.com/${type}/${parts[k + 1]}/`, source: "instagram", kind: "instagram", isVideo: type === "reel", handle, id: parts[k + 1] };
    }
    if (parts[0] && !["p", "reel", "explore", "stories", "accounts"].includes(parts[0])) {
      return { url: `https://www.instagram.com/${parts[0]}/`, source: "instagram", kind: "link", isVideo: false, handle: parts[0], profile: true };
    }
  }
  if (host === "youtu.be" && parts[0]) return { url: `https://www.youtube.com/watch?v=${parts[0]}`, source: "youtube", kind: "video", isVideo: true, id: parts[0] };
  if (host.endsWith("youtube.com")) {
    if (parts[0] === "shorts" && parts[1]) return { url: `https://www.youtube.com/shorts/${parts[1]}`, source: "youtube", kind: "video", isVideo: true, id: parts[1] };
    const v = u.searchParams.get("v");
    if (v) return { url: `https://www.youtube.com/watch?v=${v}`, source: "youtube", kind: "video", isVideo: true, id: v };
  }
  if (host.includes("pinterest.") || host === "pin.it") { u.search = ""; u.hash = ""; return { url: u.toString(), source: "pinterest", kind: "link", isVideo: false }; }

  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  u.hash = "";
  return { url: u.toString(), source: "web", kind: "link", isVideo: false, site: host };
}

export function embedUrl(item) {
  const p = item.url && parseLink(item.url);
  if (!p) return null;
  if (p.source === "instagram" && p.kind === "instagram") return p.url + "embed/captioned/";
  if (p.source === "youtube") return `https://www.youtube.com/embed/${p.id}`;
  return null;
}

/** An @handle typed or pasted in any form → plain username (lowercase, no @). */
export function cleanHandle(s) {
  if (!s) return "";
  const p = parseLink(s);
  if (p?.handle) return p.handle.toLowerCase();
  return String(s).trim().replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "").toLowerCase().slice(0, 30);
}
