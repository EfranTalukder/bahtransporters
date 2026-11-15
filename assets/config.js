// BAH Transporters website — public settings shared by every page.
// The publishable key is meant to be public: the database only lets visitors read flight
// dates and prices, track with a reference, and book through a protected server function.
window.BAH = {
  SUPABASE_URL: 'https://jjvfstrplqlbnoglkhgf.supabase.co',
  SUPABASE_KEY: 'sb_publishable_ecpI3ypxPUQDm3-3CGTpZQ_DsSbYRHx',
  WHATSAPP: '447982144203',
  PHONE: '+44 7982 144203',
  EMAIL: 'info@bahtransporters.com',
  UK_ADDRESS: '77 Melbourne Avenue, Newtown, Birmingham B19 2HU',
  GM_ADDRESS: 'Nusrat Junction, Tallinding, The Gambia',
  // Used only if the live prices can't load (the team changes prices in the admin app).
  FALLBACK_RATE: 11.99,
  FALLBACK_DOCUMENT: 15,
};
