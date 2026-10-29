// הלקוח של Supabase נטען רק כשצריך אותו (לוח שיאים, או שחקן מחובר), כדי שהמשחק ייפתח מהר.
import * as config from './config.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || config.SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || config.SUPABASE_PUBLISHABLE_KEY;

// בלי ההגדרות המשחק עובד כרגיל, בלי לוח שיאים
export const onlineEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

let clientPromise = null;

export function getClient() {
  if (!onlineEnabled) return Promise.reject(new Error('offline'));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY));
  return clientPromise;
}

// האם שמור בדפדפן חיבור קודם, בלי לטעון את הספרייה (Supabase שומר אותו תחת sb-<project>-auth-token)
export function hasStoredSession() {
  if (!onlineEnabled) return false;
  try {
    const project = new URL(SUPABASE_URL).hostname.split('.')[0];
    return Boolean(localStorage.getItem(`sb-${project}-auth-token`));
  } catch {
    return false;
  }
}
