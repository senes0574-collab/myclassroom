/* =====================================================================
   Myclassroom — noyau : DOM, icônes, notifications, modales, formatage,
   état applicatif et routage.
   ===================================================================== */

export const state = {
  config: { configured: false, studentEmailDomain: 'eleves.myclassroom.app', appName: 'Myclassroom' },
  api: null,
  user: null,
  classes: [],
  currentClass: null,
  route: { name: 'home', params: {} },
  ready: false,
};

/* --------------------------------------------------------------- DOM */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (typeof value === 'boolean') { if (value) node.setAttribute(key, ''); }
    else node.setAttribute(key, value);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(node) {
  const app = document.getElementById('app');
  clear(app);
  app.append(node);
  window.scrollTo({ top: 0 });
}

/* -------------------------------------------------------------- icônes */
const ICONS = {
  home: ['M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z'],
  book: ['M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z', 'M8 2v20'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  calendar: ['M3 5h18v16H3z', 'M3 10h18', 'M8 3v4', 'M16 3v4'],
  chat: ['M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 15H6L5 6'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  check: ['M20 6L9 17l-5-5'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  link: ['M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1', 'M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  back: ['M19 12H5', 'M12 19l-7-7 7-7'],
  copy: ['M9 9h10v10H9z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.5 9a9 9 0 0 1 14.8-3.4L23 10', 'M1 14l4.7 4.4A9 9 0 0 0 20.5 15'],
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M19 8v6', 'M22 11h-6'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  external: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14 21 3'],
  cap: ['M22 10 12 5 2 10l10 5 10-5z', 'M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5'],
  pin: ['M12 17v5', 'M9 3h6l-1 6 4 4H6l4-4z'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4z'],
};

export function icon(name, size = 18) {
  const paths = ICONS[name] || ICONS.file;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

/* ------------------------------------------------------- notifications */
export function toast(message, kind = 'info', timeout = 4200) {
  const box = document.getElementById('toasts');
  const node = el('div', { class: `toast ${kind === 'ok' ? 'ok' : kind === 'err' ? 'err' : ''}`, text: message });
  box.append(node);
  setTimeout(() => {
    node.style.transition = 'opacity .25s';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 260);
  }, timeout);
}

/* ------------------------------------------------------------- modales */
let openModals = 0;

function overlay(node, onClose) {
  const back = el('div', { class: 'modal-back', role: 'dialog', 'aria-modal': 'true' }, node);
  const close = () => {
    back.remove();
    openModals = Math.max(0, openModals - 1);
    document.removeEventListener('keydown', esc);
    if (onClose) onClose();
  };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', esc);
  openModals += 1;
  document.getElementById('modal-root').append(back);
  return close;
}

export function modal({ title, body, footer, wide = false, onClose }) {
  const box = el('div', { class: `modal ${wide ? 'wide' : ''}` },
    el('div', { class: 'modal-head' },
      el('h3', { text: title }),
      el('button', { class: 'x', type: 'button', 'aria-label': 'Fermer', onclick: () => close() }, icon('x', 18)),
    ),
    el('div', { class: 'modal-body' }, body),
    footer ? el('div', { class: 'modal-foot' }, footer) : null,
  );
  const close = overlay(box, onClose);
  return { close, box };
}

/**
 * Formulaire en modale.
 * fields: [{ name, label, type, required, placeholder, hint, options, value, rows }]
 */
export function formModal({ title, fields, submitLabel = 'Enregistrer', onSubmit, wide = false, intro = null }) {
  let settle = () => {};
  const done = new Promise((resolve) => { settle = resolve; });
  const form = el('form', { class: 'form', novalidate: true });
  const errorBox = el('div', { class: 'form-error', hidden: true });

  if (intro) form.append(el('p', { class: 'hint', style: { marginBottom: '16px', color: 'var(--muted)', fontSize: '13.5px' }, text: intro }));

  const inputs = {};
  for (const f of fields) {
    const id = `f-${f.name}`;
    let input;
    if (f.type === 'textarea') {
      input = el('textarea', { class: 'textarea', id, name: f.name, placeholder: f.placeholder || '', rows: f.rows || 4 });
      if (f.value) input.value = f.value;
    } else if (f.type === 'select') {
      input = el('select', { class: 'select', id, name: f.name },
        ...(f.options || []).map((o) => el('option', { value: o.value, selected: String(o.value) === String(f.value ?? '') ? true : null, text: o.label })),
      );
    } else if (f.type === 'checkbox') {
      input = el('input', { type: 'checkbox', id, name: f.name });
      input.checked = Boolean(f.value);
    } else if (f.type === 'file') {
      input = el('input', { type: 'file', id, name: f.name, class: 'input', accept: f.accept || '' });
    } else {
      input = el('input', {
        class: 'input', id, name: f.name, type: f.type || 'text',
        placeholder: f.placeholder || '', value: f.value ?? '',
        autocomplete: f.autocomplete || 'off',
      });
    }
    inputs[f.name] = input;
    const label = el('label', { for: id, text: f.label + (f.required ? ' *' : '') });
    const field = el('div', { class: 'field' },
      f.type === 'checkbox'
        ? el('div', { class: 'checkbox' }, input, el('label', { for: id, text: f.label, style: { fontWeight: '500' } }))
        : label,
      f.type === 'checkbox' ? null : input,
      f.hint ? el('span', { class: 'hint', text: f.hint }) : null,
    );
    form.append(field);
  }

  form.prepend(errorBox);

  // Bouton de soumission masqué : permet la validation par la touche Entrée,
  // le bouton visible étant dans le pied de la modale (hors du formulaire).
  form.append(el('button', {
    type: 'submit',
    'aria-hidden': 'true',
    tabindex: '-1',
    style: { position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: '0' },
  }));

  // Le bouton du pied est hors <form> : on déclenche la soumission explicitement.
  const submitBtn = el('button', {
    class: 'btn btn-primary',
    type: 'button',
    onclick: () => form.requestSubmit(),
  }, submitLabel);
  const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => close() }, 'Annuler');

  const { close } = modal({
    title,
    wide,
    body: form,
    footer: [cancelBtn, submitBtn],
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errorBox.hidden = true;
    const values = {};
    for (const f of fields) {
      const input = inputs[f.name];
      values[f.name] = f.type === 'file' ? (input.files[0] || null) : (f.type === 'checkbox' ? input.checked : input.value.trim());
      if (f.required && (values[f.name] === null || values[f.name] === '' || values[f.name] === false)) {
        errorBox.textContent = `Le champ « ${f.label} » est obligatoire.`;
        errorBox.hidden = false;
        input.focus();
        return;
      }
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement…';
    try {
      await onSubmit(values);
      close();
      settle(true);
    } catch (err) {
      errorBox.textContent = err?.message || 'Une erreur est survenue.';
      errorBox.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  });

  setTimeout(() => {
    const first = form.querySelector('input:not([type=checkbox]), textarea, select');
    if (first) first.focus();
  }, 60);

  return done;
}

export function confirmModal({ title, message, confirmLabel = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const yes = el('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, text: confirmLabel });
    const no = el('button', { class: 'btn btn-ghost', text: 'Annuler' });
    const { close } = modal({
      title,
      body: el('p', { text: message, style: { fontSize: '14px', color: 'var(--muted)' } }),
      footer: [no, yes],
      onClose: () => { if (!settled) resolve(false); },
    });
    no.onclick = () => close();
    yes.onclick = () => { settled = true; close(); resolve(true); };
  });
}

/* ------------------------------------------------------------- formatage */
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function formatDate(value, withYear = false) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

export function formatDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${DAYS[d.getDay()]} ${formatDate(d, true)} à ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatTime(value) {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeAgo(value) {
  const d = new Date(value);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.round(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.round(diff / 86400)} j`;
  return `le ${formatDate(d, true)}`;
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

const AVATAR_COLORS = ['#2C5F8D', '#7A5B8E', '#2E7D5B', '#B4602F', '#3F6E8C', '#8A5A44', '#4A6FA5', '#6B7A2E'];
export function colorFor(seed) {
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function fileKind(content) {
  if (content.kind === 'link') return 'link';
  const mime = content.mimeType || content.mime_type || '';
  const name = content.fileName || content.file_name || '';
  if (mime.includes('pdf') || /\.pdf$/i.test(name)) return 'pdf';
  if (mime.includes('word') || /\.docx?$/i.test(name)) return 'doc';
  if (mime.includes('presentation') || mime.includes('powerpoint') || /\.pptx?$/i.test(name)) return 'ppt';
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name)) return 'img';
  return 'other';
}

export function fileExt(content) {
  const name = content.fileName || content.file_name || '';
  const m = /\.([a-z0-9]{2,5})$/i.exec(name);
  if (m) return m[1].toUpperCase();
  const map = { pdf: 'PDF', img: 'IMG', link: 'LIEN', doc: 'DOC', ppt: 'PPT' };
  return map[fileKind(content)] || 'FICHIER';
}

/* -------------------------------------------------------------- routage */
export function parseHash() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  if (parts.length === 0) return { name: 'home', params };
  if (parts[0] === 'class' && parts[1]) {
    if (parts[2] === 'thread' && parts[3]) return { name: 'thread', params: { classId: parts[1], threadId: parts[3], ...params } };
    return { name: 'class', params: { classId: parts[1], tab: parts[2] || 'contents', ...params } };
  }
  if (parts[0] === 'classes') return { name: 'classes', params };
  if (parts[0] === 'students') return { name: 'students', params };
  return { name: 'home', params };
}

export function navigate(path) {
  if (location.hash === `#${path}`) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = path;
  }
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
