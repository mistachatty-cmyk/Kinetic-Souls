// Reports active play time for Kinetic Souls 2 to the GSix network so it shows in the hub's Global play time.
// The game has no Lok sign-in yet, so this only feeds the separate cookieless guest tally: just the app name and the
// seconds are sent, nothing is stored on the device, and browsers sending Global Privacy Control or Do Not Track
// are skipped. Idle when the game is framed by the GSix hub (the hub counts that minute itself).
// Uses the shared Lok project's public browser key by default; VITE_LOK_SUPABASE_URL / VITE_LOK_SUPABASE_ANON_KEY override it.
import { startPlaytimeTracker } from "./playtime";

export const PLAYTIME_APP_KEY = "kinetic-souls-2-alpha";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
// Public browser key of the shared Lok project (same one LokBook ships); an env var overrides it.
const URL_ = env.VITE_LOK_SUPABASE_URL || "https://jfavkudihasswkhkouxq.supabase.co";
const KEY_ = env.VITE_LOK_SUPABASE_ANON_KEY || "sb_publishable_ipcGPahvt2-j2YwBFBbvUQ_EJo2WJID";

let started = false;
export function startLokPlaytime(): void {
  if (started || !URL_ || !KEY_) return;
  started = true;
  startPlaytimeTracker({
    appKey: PLAYTIME_APP_KEY,
    supabaseUrl: URL_,
    publishableKey: KEY_,
    getAccessToken: () => null,
    countGuests: true,
  });
}
