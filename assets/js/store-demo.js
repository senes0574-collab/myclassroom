/* =====================================================================
   Myclassroom — magasin de démonstration (localStorage).
   Permet d'essayer l'application sans Supabase : mêmes données, mêmes
   écrans, persistance locale dans le navigateur.
   ===================================================================== */

const KEY = 'myclassroom.demo.v2';
const SESSION_KEY = 'myclassroom.demo.session';

const uid = () => crypto.randomUUID();
const fid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/* ------------------------------------------------------- petit PDF de démo */
function asciiTitle(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '');
}

export function buildDemoPdf(title) {
  const safe = asciiTitle(title).replace(/[()\\]/g, '');
  const stream =
    `BT /F1 20 Tf 56 760 Td (${safe}) Tj ET\n` +
    `BT /F1 11 Tf 56 726 Td (Document de demonstration - Myclassroom) Tj ET\n` +
    `BT /F1 11 Tf 56 700 Td (Ce fichier est genere par le navigateur pour la demo.) Tj ET`;
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>';
  objs[4] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objs.length; i += 1) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i += 1) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return out;
}

function svgDataUrl({ title, subtitle, color }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
  <rect width="960" height="600" fill="${color}"/>
  <rect x="40" y="40" width="880" height="520" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2" rx="18"/>
  <text x="80" y="250" font-family="Georgia, serif" font-size="44" fill="#ffffff">${asciiTitle(title)}</text>
  <text x="80" y="310" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#ffffff" fill-opacity="0.8">${asciiTitle(subtitle)}</text>
  <text x="80" y="510" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#ffffff" fill-opacity="0.6">Myclassroom - illustration de demonstration</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ------------------------------------------------------------- amorçage */
function seed() {
  const teacherId = fid(1);
  const teacher = {
    id: teacherId,
    role: 'teacher',
    username: 'prof.diallo',
    full_name: 'Aminata Diallo',
    email: 'prof.diallo@demo.myclassroom',
  };

  const classA = fid(101);
  const classB = fid(102);
  const now = Date.now();
  const iso = (offsetDays, hour = 9) => {
    const d = new Date(now + offsetDays * 86400000);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  const names = ['Fatou Ndiaye', 'Moussa Sow', 'Awa Traoré', 'Ibrahima Fall', 'Mariam Ba',
    'Cheikh Diop', 'Aïda Sy', 'Ousmane Kane', 'Sokhna Gueye', 'Abdoulaye Cissé'];

  const students = names.map((name, i) => ({
    id: fid(200 + i + 1),
    role: 'student',
    username: `eleve${String(i + 1).padStart(2, '0')}`,
    full_name: name,
    email: `eleve${String(i + 1).padStart(2, '0')}@eleves.myclassroom.app`,
    classIds: i < 8 ? [classA] : [classB],
    created_at: iso(-40),
  }));

  const classes = [
    {
      id: classA, code: '3A-MATHS-2026', name: 'Mathématiques — 3e A', level: '3e',
      subject: 'Mathématiques', school_year: '2026-2027',
      description: 'Cours de mathématiques, programme de troisième. Deux séances par semaine.',
      color: '#2C5F8D', owner_id: teacherId, created_at: iso(-42),
    },
    {
      id: classB, code: 'TS-PHYS-2026', name: 'Physique — Terminale S', level: 'Terminale',
      subject: 'Physique-chimie', school_year: '2026-2027',
      description: 'Préparation au baccalauréat, physique et chimie.',
      color: '#2E7D5B', owner_id: teacherId, created_at: iso(-30),
    },
  ];

  const contents = [
    {
      id: uid(), class_id: classA, title: 'Chapitre 1 — Nombres relatifs', chapter: 'Chapitre 1',
      description: 'Cours complet, exercices d’application et corrigés.',
      kind: 'file', file_name: 'chapitre-1-nombres-relatifs.pdf', mime_type: 'application/pdf',
      size_bytes: 184320, status: 'published', published_at: iso(-20), allow_download: true,
      created_by: teacherId, created_at: iso(-21), fileText: buildDemoPdf('Chapitre 1 - Nombres relatifs'),
    },
    {
      id: uid(), class_id: classA, title: 'Fiche de révision — calcul littéral', chapter: 'Chapitre 2',
      description: 'L’essentiel à retenir avant le contrôle.',
      kind: 'file', file_name: 'fiche-revision-calcul.pdf', mime_type: 'application/pdf',
      size_bytes: 96256, status: 'published', published_at: iso(-9), allow_download: true,
      created_by: teacherId, created_at: iso(-10), fileText: buildDemoPdf('Fiche de revision - calcul litteral'),
    },
    {
      id: uid(), class_id: classA, title: 'Schéma — repérage dans le plan', chapter: 'Chapitre 2',
      description: 'Illustration projetée en classe.',
      kind: 'file', file_name: 'schema-reperage.svg', mime_type: 'image/svg+xml',
      size_bytes: 4210, status: 'published', published_at: iso(-8), allow_download: true,
      created_by: teacherId, created_at: iso(-8),
      fileUrl: svgDataUrl({ title: 'Repérage dans le plan', subtitle: 'Abscisse, ordonnée, coordonnées', color: '#2C5F8D' }),
    },
    {
      id: uid(), class_id: classA, title: 'Exercices interactifs en ligne', chapter: 'Chapitre 2',
      description: 'Plateforme d’entraînement externe.',
      kind: 'link', link_url: 'https://www.mathsmentales.fr', status: 'published',
      published_at: iso(-7), allow_download: false, created_by: teacherId, created_at: iso(-7),
    },
    {
      id: uid(), class_id: classA, title: 'Présentation de rentrée', chapter: 'Général',
      description: 'Organisation de l’année et attentes du cours.',
      kind: 'file', file_name: 'presentation-rentree.pptx',
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size_bytes: 2411724, status: 'published', published_at: iso(-41), allow_download: true,
      created_by: teacherId, created_at: iso(-41),
    },
    {
      id: uid(), class_id: classA, title: 'Évaluation de fin de chapitre (brouillon)', chapter: 'Chapitre 2',
      description: 'Sujet en préparation, non visible des élèves.',
      kind: 'file', file_name: 'evaluation-chapitre-2.pdf', mime_type: 'application/pdf',
      size_bytes: 120832, status: 'draft', published_at: null, allow_download: true,
      created_by: teacherId, created_at: iso(-2), fileText: buildDemoPdf('Evaluation - chapitre 2'),
    },
    {
      id: uid(), class_id: classB, title: 'Programme de l’année', chapter: 'Général',
      description: 'Progression prévisionnelle.',
      kind: 'file', file_name: 'programme-terminale.pdf', mime_type: 'application/pdf',
      size_bytes: 204800, status: 'published', published_at: iso(-29), allow_download: true,
      created_by: teacherId, created_at: iso(-29), fileText: buildDemoPdf('Programme de l annee'),
    },
  ];

  const threadA = fid(301);
  const threadB = fid(302);
  const threads = [
    {
      id: threadA, class_id: classA, title: 'Bienvenue en 3e A', is_announcement: true,
      is_locked: false, created_by: teacherId, created_at: iso(-40, 8),
    },
    {
      id: threadB, class_id: classA, title: 'Question sur l’exercice 12', is_announcement: false,
      is_locked: false, created_by: students[0].id, created_at: iso(-5, 18),
    },
  ];

  const posts = [
    {
      id: uid(), thread_id: threadA, author_id: teacherId, created_at: iso(-40, 8),
      body: 'Bonjour à toutes et à tous,\n\nBienvenue dans l’espace de la classe. Vous trouverez ici les cours, les fiches et le planning des séances.\n\nÀ mardi pour notre première séance.',
    },
    {
      id: uid(), thread_id: threadB, author_id: students[0].id, created_at: iso(-5, 18),
      body: 'Bonjour madame, pour l’exercice 12 je ne comprends pas la dernière étape du calcul. Faut-il factoriser avant de réduire ?',
    },
    {
      id: uid(), thread_id: threadB, author_id: teacherId, created_at: iso(-5, 19),
      body: 'Bonne question. Oui : factorise d’abord par 3, puis réduis. Le corrigé détaillé est en ligne dans le chapitre 2.',
    },
  ];

  const events = [
    {
      id: uid(), class_id: classA, title: 'Séance — Calcul littéral', kind: 'session',
      description: 'Salle 12.', starts_at: iso(1, 8), ends_at: iso(1, 10), created_by: teacherId,
    },
    {
      id: uid(), class_id: classA, title: 'Rendu — Fiche d’exercices n°3', kind: 'deadline',
      description: 'Dépôt attendu avant la séance.', starts_at: iso(3, 23), ends_at: null, created_by: teacherId,
    },
    {
      id: uid(), class_id: classA, title: 'Contrôle — Chapitre 2', kind: 'deadline',
      description: 'Une heure, calculatrice autorisée.', starts_at: iso(8, 8), ends_at: iso(8, 10), created_by: teacherId,
    },
    {
      id: uid(), class_id: classB, title: 'Séance — Ondes mécaniques', kind: 'session',
      description: 'Laboratoire.', starts_at: iso(2, 14), ends_at: iso(2, 16), created_by: teacherId,
    },
  ];

  return { teacher, students, classes, contents, threads, posts, events };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const data = seed();
  save(data);
  return data;
}

function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Sauvegarde locale impossible (quota ?)', err);
  }
}

let db = null;
function data() {
  if (!db) db = load();
  return db;
}

const delay = (ms = 160) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------------------------------------- session */
function profileOf(id) {
  const d = data();
  if (d.teacher.id === id) return d.teacher;
  return d.students.find((s) => s.id === id) || null;
}

let sessionUser = null;
function readSession() {
  const id = localStorage.getItem(SESSION_KEY);
  return id ? profileOf(id) : null;
}

function currentUser() {
  if (sessionUser) return sessionUser;
  sessionUser = readSession();
  return sessionUser;
}

function classRole(cls) {
  const me = currentUser();
  if (!me) return null;
  if (cls.owner_id === me.id) return 'owner';
  const student = data().students.find((s) => s.id === me.id);
  if (student && (student.classIds || []).includes(cls.id)) return 'student';
  return null;
}

function decorate(cls) {
  const d = data();
  return {
    ...cls,
    role: classRole(cls),
    students_count: d.students.filter((s) => (s.classIds || []).includes(cls.id)).length,
    contents_count: d.contents.filter((c) => c.class_id === cls.id && c.status === 'published').length,
  };
}

/* --------------------------------------------------------------- magasin */
export const demoStore = {
  mode: 'demo',

  async init() { await delay(0); },

  onAuthChange(cb) {
    this._cb = cb;
  },

  emitAuth() {
    if (this._cb) this._cb(currentUser());
  },

  currentUser,

  async signIn({ identifier, password }) {
    await delay(320);
    const d = data();
    const key = String(identifier || '').trim().toLowerCase();
    if (!key) throw new Error('Saisissez votre identifiant.');
    if (!password) throw new Error('Saisissez votre mot de passe.');

    let found = null;
    if (key === d.teacher.username || key === d.teacher.email) found = d.teacher;
    else found = d.students.find((s) => s.username === key || s.email === key);
    if (!found) {
      throw new Error('Identifiant inconnu. En démonstration, essayez « prof.diallo » ou « eleve01 ».');
    }
    localStorage.setItem(SESSION_KEY, found.id);
    sessionUser = found;
    this.emitAuth();
    return found;
  },

  async signUpTeacher({ email, password, fullName }) {
    await delay(300);
    const d = data();
    d.teacher = { ...d.teacher, email, full_name: fullName || d.teacher.full_name };
    save(d);
    localStorage.setItem(SESSION_KEY, d.teacher.id);
    sessionUser = d.teacher;
    this.emitAuth();
    toastDemo('Compte enseignant mis à jour (démonstration).');
    return d.teacher;
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
    sessionUser = null;
    this.emitAuth();
  },

  /* ----------------------------------------------------------- classes */
  async listClasses() {
    await delay(120);
    const me = currentUser();
    const d = data();
    let rows = d.classes;
    if (me.role === 'student') {
      const student = d.students.find((s) => s.id === me.id);
      rows = d.classes.filter((c) => (student.classIds || []).includes(c.id));
    }
    return rows.map(decorate);
  },

  async getClass(id) {
    await delay(80);
    const cls = data().classes.find((c) => c.id === id);
    if (!cls) throw new Error('Classe introuvable.');
    return decorate(cls);
  },

  async createClass(input) {
    await delay(220);
    const me = currentUser();
    const d = data();
    const code = String(input.code || '').trim() || `${input.name.slice(0, 3).toUpperCase()}-${new Date().getFullYear()}`;
    if (d.classes.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
      throw new Error('Ce code de classe est déjà utilisé.');
    }
    const cls = {
      id: uid(), code, name: input.name, level: input.level || '', subject: input.subject || '',
      school_year: input.school_year || '', description: input.description || '',
      color: input.color || '#2C5F8D', owner_id: me.id, created_at: new Date().toISOString(),
    };
    d.classes.unshift(cls);
    save(d);
    return decorate(cls);
  },

  /* ---------------------------------------------------------- étudiants */
  async listStudents(classId) {
    await delay(120);
    const d = data();
    return d.students
      .filter((s) => (s.classIds || []).includes(classId))
      .map((s) => ({ id: s.id, full_name: s.full_name, username: s.username, created_at: s.created_at }));
  },

  async addStudent({ classId, fullName, username }) {
    await delay(300);
    const d = data();
    const cleanUser = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(cleanUser)) {
      throw new Error('Identifiant invalide : 3 à 24 caractères (lettres, chiffres, point, tiret, souligné).');
    }
    if (d.students.some((s) => s.username === cleanUser)) {
      throw new Error(`L’identifiant « ${cleanUser} » est déjà utilisé.`);
    }
    const password = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
    const student = {
      id: uid(), role: 'student', username: cleanUser, full_name: fullName,
      email: `${cleanUser}@eleves.myclassroom.app`, classIds: [classId],
      created_at: new Date().toISOString(),
    };
    d.students.push(student);
    save(d);
    return { id: student.id, username: cleanUser, fullName, password };
  },

  async resetStudentPassword({ studentId }) {
    await delay(240);
    const password = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
    const s = data().students.find((x) => x.id === studentId);
    return { password, username: s ? s.username : '' };
  },

  async removeStudent(classId, studentId) {
    await delay(180);
    const d = data();
    const s = d.students.find((x) => x.id === studentId);
    if (s) s.classIds = (s.classIds || []).filter((id) => id !== classId);
    save(d);
  },

  /* ----------------------------------------------------------- contenus */
  async listContents(classId) {
    await delay(140);
    const me = currentUser();
    const rows = data().contents.filter((c) => c.class_id === classId);
    const visible = me.role === 'teacher' ? rows : rows.filter((c) => c.status === 'published');
    return visible
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(({ fileText, fileUrl, ...rest }) => ({ ...rest, hasFile: Boolean(fileText || fileUrl) }));
  },

  async createContent({ classId, file, title, description, chapter, allowDownload, status, linkUrl }) {
    await delay(420);
    const me = currentUser();
    const d = data();
    const isLink = Boolean(linkUrl);
    let payload = {
      id: uid(), class_id: classId, title, description: description || '', chapter: chapter || 'Général',
      kind: isLink ? 'link' : 'file', status: status || 'published',
      published_at: (status || 'published') === 'published' ? new Date().toISOString() : null,
      allow_download: allowDownload !== false, created_by: me.id, created_at: new Date().toISOString(),
    };
    if (isLink) {
      payload.link_url = linkUrl;
    } else {
      if (!file) throw new Error('Choisissez un fichier.');
      if (file.size > 40 * 1024 * 1024) throw new Error('Fichier trop volumineux (40 Mo maximum en démonstration).');
      payload.file_name = file.name;
      payload.mime_type = file.type || 'application/octet-stream';
      payload.size_bytes = file.size;
      if (file.type === 'application/pdf') {
        const text = await file.text().catch(() => null);
        payload.fileText = text && text.startsWith('%PDF') ? text : null;
      }
      if (!payload.fileText && (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name))) {
        payload.fileUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      }
    }
    d.contents.unshift(payload);
    try { save(d); } catch { /* quota */ }
    const { fileText, fileUrl, ...rest } = payload;
    return { ...rest, hasFile: Boolean(fileText || fileUrl) };
  },

  async updateContentStatus(id, status) {
    await delay(160);
    const d = data();
    const c = d.contents.find((x) => x.id === id);
    if (!c) throw new Error('Contenu introuvable.');
    c.status = status;
    c.published_at = status === 'published' ? new Date().toISOString() : null;
    save(d);
    return c;
  },

  async deleteContent(id) {
    await delay(180);
    const d = data();
    d.contents = d.contents.filter((c) => c.id !== id);
    save(d);
  },

  async contentUrl(content) {
    const d = data();
    const row = d.contents.find((c) => c.id === content.id) || content;
    if (row.link_url) return row.link_url;
    if (row.fileUrl) return row.fileUrl;
    if (row.fileText) return `data:application/pdf;base64,${btoa(unescape(encodeURIComponent(row.fileText)))}`;
    return null;
  },

  /* -------------------------------------------------------- discussion */
  async listThreads(classId) {
    await delay(130);
    const d = data();
    return d.threads
      .filter((t) => t.class_id === classId)
      .map((t) => {
        const posts = d.posts.filter((p) => p.thread_id === t.id);
        const last = posts.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).pop();
        const author = profileOf(t.created_by);
        return {
          ...t,
          author_name: author ? author.full_name : 'Inconnu',
          posts_count: posts.length,
          last_post_at: last ? last.created_at : t.created_at,
        };
      })
      .sort((a, b) => Number(b.is_announcement) - Number(a.is_announcement)
        || String(b.last_post_at).localeCompare(String(a.last_post_at)));
  },

  async getThread(threadId) {
    await delay(120);
    const d = data();
    const thread = d.threads.find((t) => t.id === threadId);
    if (!thread) throw new Error('Discussion introuvable.');
    const posts = d.posts
      .filter((p) => p.thread_id === threadId)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((p) => {
        const author = profileOf(p.author_id);
        return { ...p, author_name: author ? author.full_name : 'Inconnu', author_role: author ? author.role : 'student' };
      });
    return { thread, posts };
  },

  async createThread({ classId, title, isAnnouncement }) {
    await delay(200);
    const me = currentUser();
    const d = data();
    const thread = {
      id: uid(), class_id: classId, title, is_announcement: Boolean(isAnnouncement),
      is_locked: false, created_by: me.id, created_at: new Date().toISOString(),
    };
    d.threads.unshift(thread);
    save(d);
    return thread;
  },

  async addPost({ threadId, body }) {
    await delay(180);
    const me = currentUser();
    const d = data();
    const post = {
      id: uid(), thread_id: threadId, author_id: me.id, body,
      created_at: new Date().toISOString(), edited_at: null,
    };
    d.posts.push(post);
    save(d);
    const author = profileOf(me.id);
    return { ...post, author_name: author.full_name, author_role: author.role };
  },

  /* ----------------------------------------------------------- planning */
  async listEvents(classId) {
    await delay(120);
    return data().events
      .filter((e) => e.class_id === classId)
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  },

  async createEvent(input) {
    await delay(200);
    const me = currentUser();
    const d = data();
    const evt = {
      id: uid(), class_id: input.classId, title: input.title, description: input.description || '',
      kind: input.kind || 'session', starts_at: new Date(input.startsAt).toISOString(),
      ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
      location: input.location || '', created_by: me.id, created_at: new Date().toISOString(),
    };
    d.events.push(evt);
    save(d);
    return evt;
  },

  async deleteEvent(id) {
    await delay(150);
    const d = data();
    d.events = d.events.filter((e) => e.id !== id);
    save(d);
  },

  async stats() {
    await delay(60);
    const classes = await this.listClasses();
    const me = currentUser();
    const d = data();
    const ids = new Set(classes.map((c) => c.id));
    const contents = d.contents.filter((c) => ids.has(c.class_id) && (me.role === 'teacher' || c.status === 'published'));
    const students = me.role === 'teacher'
      ? new Set(d.students.filter((s) => (s.classIds || []).some((id) => ids.has(id))).map((s) => s.id)).size
      : 0;
    const events = d.events
      .filter((e) => ids.has(e.class_id) && new Date(e.starts_at) >= new Date(Date.now() - 3600000))
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
    return { classes: classes.length, students, contents: contents.length, upcoming: events };
  },

  async resetDemo() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SESSION_KEY);
    db = null;
    sessionUser = null;
    this.emitAuth();
  },
};

function toastDemo(message) {
  try { window.__myclassroomToast?.(message); } catch { /* ignore */ }
}
