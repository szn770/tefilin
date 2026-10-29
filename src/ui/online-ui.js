import { onlineEnabled, getClient, hasStoredSession } from '../online/client.js';
import { createOnlineApi } from '../online/api.js';
import { errorCode, errorMessage } from '../online/messages.js';
import { boardRows, needsMyRankLine } from '../online/board.js';
import { validateNickname, validatePassword } from '../online/nickname.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const HINTS = {
  signup: 'בלי שם אמיתי! רק כינוי, עד 12 תווים. הסיסמה: לפחות 6 תווים.',
  signin: 'הכינוי והסיסמה שבחרתם בהרשמה.',
};

// לוח השיאים, הרשמה וכניסה, והשורה של לוח השיאים במסך סוף השלב
export class OnlineUI {
  constructor({ enabled = onlineEnabled, api = createOnlineApi(getClient), storedSession = hasStoredSession } = {}) {
    this.enabled = enabled;
    this.api = api;
    this.storedSession = storedSession;
    this.player = null; // השחקן המחובר, כשכבר בדקנו
    this.pending = null; // תוצאת השלב האחרון, שתישלח אחרי הרשמה ממסך סוף השלב
    if (!enabled) return;

    $('btn-board').classList.remove('hidden');
    $('btn-board').onclick = () => this.openBoard();
    $('btn-board-close').onclick = () => $('screen-board').classList.add('hidden');
    $('btn-auth-close').onclick = () => this.closeAuth();
    for (const tab of document.querySelectorAll('.auth-tab')) tab.onclick = () => this.setAuthMode(tab.dataset.mode);
    $('auth-form').onsubmit = (e) => this.submitAuth(e);
    $('auth-eye').onclick = () => {
      const input = $('auth-pass');
      input.type = input.type === 'password' ? 'text' : 'password';
      $('auth-eye').textContent = input.type === 'password' ? '👁️' : '🙈';
    };

    // מי שכבר התחבר בעבר: מבררים ברקע מי הוא
    if (this.storedSession()) this.refreshPlayer();
  }

  async refreshPlayer() {
    try {
      this.player = this.storedSession() ? await this.api.currentPlayer() : null;
    } catch { /* אין חיבור: ננסה שוב בפעם הבאה */ }
    return this.player;
  }

  // ---------- סוף שלב ----------
  levelEnded({ levelIndex, served }) {
    if (!this.enabled) return;
    $('result-online').classList.remove('hidden');
    this.pending = served > 0 ? { levelIndex, served } : null;
    if (!this.storedSession()) return this.renderInvite();
    if (!this.pending) return this.renderResult('🏆');
    this.renderResult('🏆 שומר בלוח השיאים…');
    return this.submitPending();
  }

  async submitPending() {
    const p = this.pending;
    if (!p) return this.renderResult('🏆');
    try {
      const player = this.player ?? (await this.refreshPlayer());
      if (!player?.nickname) return this.renderInvite();
      const r = await this.api.submitLevel(p.levelIndex, p.served);
      this.pending = null;
      this.player = { ...player, total: r.total, level: r.level };
      this.renderResult(`🏆 נשמר בלוח! יש לך <b>${r.total}</b> הנחות · מקום <b>${r.rank}</b>`);
    } catch (err) {
      const code = errorCode(err);
      if (code === 'not_signed_in' || code === 'no_profile') return this.renderInvite();
      this.pending = null;
      this.renderResult(`🏆 ${esc(errorMessage(err))}`);
    }
  }

  renderResult(html) {
    const box = $('result-online');
    box.innerHTML = `<span>${html}</span> <button class="link-btn" data-board>ללוח השיאים</button>`;
    box.querySelector('[data-board]').onclick = () => this.openBoard();
  }

  renderInvite() {
    const box = $('result-online');
    box.innerHTML = `
      <div>🏆 רוצה להופיע בלוח השיאים?</div>
      <button class="small-btn" data-auth>הרשמה / כניסה</button>
      <small>מהרגע שנרשמים, כל הנחה נספרת!</small>`;
    box.querySelector('[data-auth]').onclick = () => this.openAuth({ after: () => this.submitPending() });
  }

  // ---------- לוח השיאים ----------
  async openBoard() {
    $('screen-board').classList.remove('hidden');
    const list = $('board-list');
    const me = $('board-me');
    list.innerHTML = '<li class="board-msg">טוען…</li>';
    me.classList.add('hidden');
    this.renderAccount();
    try {
      const [rows, player] = await Promise.all([this.api.fetchBoard(), this.refreshPlayer()]);
      const shown = boardRows(rows, player?.id);
      list.innerHTML = shown.length
        ? shown.map((r) => `
            <li class="${r.isMe ? 'me' : ''}">
              <span class="b-rank">${r.label}</span>
              <span class="b-nick">${esc(r.nickname)}</span>
              <span class="b-total">📿 ${r.total}</span>
              <span class="b-level">שלב ${r.level}</span>
            </li>`).join('')
        : '<li class="board-msg">עוד אין אף אחד בלוח. אולי תהיו הראשונים? 😊</li>';
      if (needsMyRankLine(shown, player)) {
        me.innerHTML = `אתם במקום <b>${await this.api.rankOf(player.total)}</b>, עם <b>${player.total}</b> הנחות`;
        me.classList.remove('hidden');
      }
      this.renderAccount();
    } catch (err) {
      list.innerHTML = `<li class="board-msg">${esc(errorMessage(err))}</li>`;
    }
  }

  renderAccount() {
    const el = $('board-account');
    if (this.player?.nickname) {
      el.innerHTML = `מחוברים בתור <b>${esc(this.player.nickname)}</b> · <button class="link-btn" data-out>התנתקות</button>`;
      el.querySelector('[data-out]').onclick = async () => {
        try { await this.api.signOut(); } catch { /* גם בלי חיבור: החיבור המקומי נמחק */ }
        this.player = null;
        this.openBoard();
      };
    } else {
      el.innerHTML = '<button class="small-btn" data-auth>הרשמה / כניסה</button><small>כדי להופיע בלוח</small>';
      el.querySelector('[data-auth]').onclick = () => this.openAuth({ after: () => this.openBoard() });
    }
  }

  // ---------- הרשמה וכניסה ----------
  openAuth({ after } = {}) {
    this.afterAuth = after;
    this.setAuthMode('signup');
    $('screen-auth').classList.remove('hidden');
    $('auth-nick').focus();
  }

  closeAuth() {
    $('screen-auth').classList.add('hidden');
    $('auth-pass').value = '';
  }

  setAuthMode(mode) {
    this.authMode = mode;
    for (const tab of document.querySelectorAll('.auth-tab')) tab.classList.toggle('active', tab.dataset.mode === mode);
    $('auth-submit').textContent = mode === 'signup' ? 'להירשם' : 'להיכנס';
    $('auth-pass').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('auth-hint').textContent = HINTS[mode];
    $('auth-error').textContent = '';
  }

  async submitAuth(e) {
    e.preventDefault();
    if (this.busy) return;
    const nick = $('auth-nick').value;
    const pass = $('auth-pass').value;
    const signup = this.authMode === 'signup';
    // בדיקה במחשב לפני שפונים ל-Supabase
    const bad = signup ? validateNickname(nick) ?? validatePassword(pass) : null;
    if (bad) {
      $('auth-error').textContent = errorMessage(bad);
      return;
    }
    const btn = $('auth-submit');
    this.busy = true;
    btn.disabled = true;
    btn.textContent = '…';
    $('auth-error').textContent = '';
    try {
      this.player = signup ? await this.api.signUp(nick, pass) : await this.api.signIn(nick, pass);
      this.closeAuth();
      await this.afterAuth?.();
    } catch (err) {
      $('auth-error').textContent = errorMessage(err);
    } finally {
      this.busy = false;
      btn.disabled = false;
      btn.textContent = signup ? 'להירשם' : 'להיכנס';
    }
  }
}
