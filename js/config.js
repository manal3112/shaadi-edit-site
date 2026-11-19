// Fill SUPABASE_URL and SUPABASE_KEY to run live. Left empty, the whole app runs in demo mode in the browser.
export const CONFIG = {
  BRAND: "Shaadi Edit",
  TAGLINE: "Every idea for your wedding: curated, decided, together.",
  SUPABASE_URL: "https://bdtodjvkmhbrkepblbpv.supabase.co",
  SUPABASE_KEY: "sb_publishable_vzIomnItJDgHYG61f02RZA_56CD-S4T",   // the publishable (anon) key: safe in the browser, row-level security protects the data
  SUPPORT_EMAIL: "",
};
export const LIVE = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY);
