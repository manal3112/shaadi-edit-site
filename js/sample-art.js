// Illustrations for the sample wedding (no stock photos, nothing copied from anyone).
// Each is a small SVG built from a palette and a motif: an arch, florals, a mandala, drapes or a lattice.

export function sampleArt(label, [main, light, deep], k) {
  const W = 600, H = [760, 640, 820, 700, 600][k % 5];
  const motifs = [arch, florals, mandala, drapes, lattice];
  const body = motifs[k % motifs.length](W, H, main, light, deep);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${mix(light, main, 0.35)}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>${body}
<text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="${deep}" opacity=".55" letter-spacing="2">${esc(label.toUpperCase().slice(0, 34))}</text>
</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

function arch(W, H, m, l, d) {
  const cx = W / 2, top = H * 0.16, w = W * 0.56, base = H * 0.86;
  let s = `<path d="M${cx - w / 2} ${base} V${top + w / 2} A${w / 2} ${w / 2} 0 0 1 ${cx + w / 2} ${top + w / 2} V${base}" fill="none" stroke="${d}" stroke-width="10" opacity=".35"/>`;
  for (let i = 0; i <= 26; i++) {
    const a = Math.PI * (i / 26), r = w / 2 + 6;
    const x = cx - Math.cos(a) * r, y = top + w / 2 - Math.sin(a) * r;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${16 + (i % 3) * 4}" fill="${i % 2 ? m : d}" opacity="${i % 2 ? 0.95 : 0.75}"/>`;
  }
  for (let j = 0; j < 9; j++) s += `<circle cx="${cx - w / 2 - 6}" cy="${top + w / 2 + j * 42}" r="13" fill="${j % 2 ? m : l}" stroke="${d}" stroke-opacity=".3"/><circle cx="${cx + w / 2 + 6}" cy="${top + w / 2 + j * 42}" r="13" fill="${j % 2 ? l : m}" stroke="${d}" stroke-opacity=".3"/>`;
  return s;
}
function florals(W, H, m, l, d) {
  let s = "";
  const pts = [[.25, .28], [.7, .22], [.5, .5], [.2, .66], [.78, .62], [.45, .78]];
  pts.forEach(([x, y], i) => {
    const cx = x * W, cy = y * H, r = 46 + (i % 3) * 16;
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * Math.PI * 2;
      s += `<ellipse cx="${(cx + Math.cos(a) * r * 0.55).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.55).toFixed(1)}" rx="${r * 0.42}" ry="${r * 0.24}" transform="rotate(${(a * 180) / Math.PI} ${(cx + Math.cos(a) * r * 0.55).toFixed(1)} ${(cy + Math.sin(a) * r * 0.55).toFixed(1)})" fill="${i % 2 ? m : mix(m, l, 0.4)}" opacity=".9"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="${d}" opacity=".8"/>`;
  });
  return s;
}
function mandala(W, H, m, l, d) {
  const cx = W / 2, cy = H * 0.45; let s = "";
  for (let ring = 5; ring >= 1; ring--) {
    const r = ring * 46, n = 8 + ring * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      s += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${8 + ring * 2}" fill="${ring % 2 ? m : d}" opacity="${0.35 + ring * 0.1}"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="${r - 18}" fill="none" stroke="${d}" stroke-opacity=".25" stroke-width="2"/>`;
  }
  return s + `<circle cx="${cx}" cy="${cy}" r="26" fill="${d}"/>`;
}
function drapes(W, H, m, l, d) {
  let s = "";
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * W, sway = i % 2 ? 40 : -40;
    s += `<path d="M${x - 70} 0 C ${x + sway} ${H * 0.35}, ${x - sway} ${H * 0.6}, ${x - 30} ${H} L ${x + 60} ${H} C ${x + sway} ${H * 0.6}, ${x - sway} ${H * 0.35}, ${x + 70} 0 Z" fill="${i % 2 ? m : mix(m, l, 0.5)}" opacity=".55"/>`;
  }
  for (let j = 0; j < 22; j++) s += `<circle cx="${(j / 21) * W}" cy="${40 + Math.sin(j) * 12}" r="5" fill="${d}" opacity=".6"/>`;
  return s + `<path d="M0 60 Q ${W / 2} 150 ${W} 60" stroke="${d}" stroke-width="4" fill="none" opacity=".4"/>`;
}
function lattice(W, H, m, l, d) {
  let s = "";
  const g = 60;
  for (let x = -g; x < W + g; x += g) for (let y = -g; y < H + g; y += g) {
    const odd = ((x + y) / g) % 2;
    s += `<path d="M${x} ${y + g / 2} L${x + g / 2} ${y} L${x + g} ${y + g / 2} L${x + g / 2} ${y + g} Z" fill="${odd ? m : "none"}" stroke="${d}" stroke-opacity=".3" opacity="${odd ? 0.35 : 1}"/>`;
  }
  return s + `<rect x="${W * 0.22}" y="${H * 0.22}" width="${W * 0.56}" height="${H * 0.46}" rx="20" fill="${l}" opacity=".85" stroke="${d}" stroke-opacity=".4" stroke-width="3"/>`;
}
