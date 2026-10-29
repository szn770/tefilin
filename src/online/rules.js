// כללי לוח השיאים. הבדיקה האמיתית נעשית ב-Supabase (supabase/migrations), והערכים כאן חייבים להתאים לה.

export const NICK_MIN = 2;
export const NICK_MAX = 12;
export const PASSWORD_MIN = 6;
export const MAX_SERVED_PER_LEVEL = 100;
export const BOARD_SIZE = 20;

// Supabase דורש אימייל, אז בונים מהכינוי "אימייל פנימי" שלא שולחים אליו כלום
export const PLAYER_EMAIL_DOMAIN = 'players.mivtza-tefillin.pages.dev';
