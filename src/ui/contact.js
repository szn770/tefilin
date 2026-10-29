import { CONTACT_KEY, DONATE_URL } from '../data/links.js';

const $ = (id) => document.getElementById(id);
const GAME_NAME = 'הנחת?! – מבצע תפילין';

// מה נשלח ל-Web3Forms. null כשמלכודת הבוטים מסומנת: מודים לו ולא שולחים כלום.
export function contactPayload(data, key = CONTACT_KEY) {
  if (data.botcheck) return null;
  const topic = data.topic || 'אחר';
  return {
    name: String(data.name ?? '').trim(),
    email: String(data.email ?? '').trim(),
    topic,
    message: String(data.message ?? '').trim(),
    access_key: key,
    subject: `מבצע תפילין · ${topic}`,
    from_name: GAME_NAME,
  };
}

// "תרומה והשתתפות" ו"צור קשר" בתחתית מסך הפתיחה
export class ContactUI {
  constructor({ key = CONTACT_KEY, donateUrl = DONATE_URL } = {}) {
    this.key = key;
    if (donateUrl) {
      $('btn-donate').href = donateUrl;
      $('btn-donate').classList.remove('hidden');
    }
    if (!key) {
      $('btn-contact').classList.add('hidden');
      return;
    }
    $('btn-contact').onclick = () => {
      $('contact-status').textContent = '';
      $('screen-contact').classList.remove('hidden');
    };
    $('btn-contact-back').onclick = () => $('screen-contact').classList.add('hidden');
    $('contact-form').onsubmit = (e) => this.send(e);
  }

  async send(e) {
    e.preventDefault();
    const form = $('contact-form');
    const status = $('contact-status');
    if (!$('contact-msg').value.trim()) {
      status.className = 'contact-status err';
      status.textContent = 'כתבו הודעה לפני השליחה';
      $('contact-msg').focus();
      return;
    }
    $('contact-send').disabled = true;
    status.className = 'contact-status';
    status.textContent = 'שולח…';
    try {
      const payload = contactPayload(Object.fromEntries(new FormData(form)), this.key);
      if (payload) {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.success) throw new Error(String(res.status));
      }
      status.className = 'contact-status ok';
      status.textContent = 'תודה! ההודעה נשלחה.';
      form.reset();
    } catch {
      status.className = 'contact-status err';
      status.textContent = 'השליחה לא הצליחה. נסו שוב בעוד רגע.';
    }
    $('contact-send').disabled = false;
  }
}
