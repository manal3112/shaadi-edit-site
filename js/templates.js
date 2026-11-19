// Starting points for a new wedding. Everything is editable afterwards.

export const STYLES = [
  { id: "north", name: "North Indian", functions: ["Roka", "Haldi", "Mehendi", "Sangeet", "Wedding", "Reception"] },
  { id: "gujarati", name: "Gujarati", functions: ["Gol Dhana", "Mandvo Mahurat", "Pithi", "Mehendi", "Garba / Sangeet", "Wedding", "Reception"] },
  { id: "punjabi", name: "Punjabi", functions: ["Roka", "Chunni", "Mehendi", "Sangeet", "Jaago", "Chooda", "Anand Karaj", "Reception"] },
  { id: "marwari", name: "Marwari / Rajasthani", functions: ["Tilak", "Haldi", "Mehendi", "Sangeet", "Mayra", "Wedding", "Reception"] },
  { id: "south", name: "South Indian", functions: ["Nichayathartham", "Mehendi", "Sangeet", "Muhurtham", "Reception"] },
  { id: "bengali", name: "Bengali", functions: ["Aashirbaad", "Aiburobhat", "Gaye Holud", "Biye", "Bou Bhaat"] },
  { id: "muslim", name: "Muslim", functions: ["Mangni", "Manjha", "Mehendi", "Nikah", "Walima"] },
  { id: "christian", name: "Christian", functions: ["Engagement", "Bridal shower", "Church wedding", "Reception"] },
  { id: "simple", name: "Court wedding + party", functions: ["Registration", "Reception"] },
  { id: "custom", name: "Something else", functions: ["Pre-wedding", "Wedding", "Reception"] },
];

// Areas are what you're choosing; children are the finer cuts. Add, rename or remove any of them later.
export const AREAS = [
  { name: "Venue", children: [] },
  { name: "Decor", children: ["Stage / Mandap", "Entrance", "Florals", "Lighting", "Seating", "Tablescape"] },
  { name: "Bride's outfits", children: ["Lehenga", "Saree", "Gown", "Dupatta", "Footwear"] },
  { name: "Groom's outfits", children: ["Sherwani", "Bandhgala", "Safa", "Footwear"] },
  { name: "Family outfits", children: [] },
  { name: "Jewellery", children: ["Bride", "Groom"] },
  { name: "Makeup & hair", children: [] },
  { name: "Mehendi design", children: [] },
  { name: "Food & drinks", children: ["Menu", "Live counters", "Desserts & cake", "Bar"] },
  { name: "Photo & video", children: [] },
  { name: "Music & entertainment", children: [] },
  { name: "Invites & stationery", children: [] },
  { name: "Gifts & favours", children: [] },
];

// Function colours: soft, distinct, readable on ivory and on dark.
export const PALETTE = ["#d98e04", "#c2185b", "#2e7d32", "#6a1b9a", "#b23a2a", "#00838f", "#5d4037", "#3949ab", "#ad1457", "#558b2f"];
export const colorFor = k => PALETTE[k % PALETTE.length];
