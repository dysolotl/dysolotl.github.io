// supabaseClient.js
// Safe for front-end use: the publishable key is protected by Row Level Security.

const SUPABASE_URL = 'https://gfwvhxgnozmtkjktjavv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5dN0Nxb3es-9Jqc9YRTPeQ_pCqWhWb_';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);