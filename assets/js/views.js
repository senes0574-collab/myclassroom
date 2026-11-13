/* =====================================================================
   Myclassroom — vues de l'application.
   ===================================================================== */

import {
  state, el, icon, mount, toast, modal, formModal, confirmModal,
  formatDate, formatDateTime, formatTime, formatBytes, timeAgo,
  initials, colorFor, fileKind, fileExt, navigate, parseHash,
} from './core.js';

const api = () => state.api;
const isTeacher = () => state.user?.role === 'teacher';

function refresh() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/* ------------------------------------------------------------- utilitaires */
function dataUrlToBlobUrl(dataUrl) {  const [header, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(header)?.[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

async function fetchUrl(content) {
  const url = await api().contentUrl(content);
  if (url && url.startsWith('data:')) return dataUrlToBlobUrl(url);
  return url;
}

function avatar(person, size = '') {
  return el('div', {
    class: `avatar ${size}`,
    style: { background: colorFor(person.id || person.full_name) },
    text: initials(person.full_name || person.username),
  });
}

function demoBanner() {
  if (api().mode !== 'demo') return null;
  return el('div', { class: 'banner banner-demo' },
    icon('alert'),
    el('span', {}, el('b', { text: 'Mode démonstration. ' }),
      'Les données sont enregistrées dans ce navigateur. Connectez Supabase pour passer en réel.'),
  );
}

/* ================================================================ connexion */
export function renderAuth(mode = 'login') {
  const side = el('aside', { class: 'auth-side' },
    el('div', { class: 'auth-brand' },
      el('div', { class: 'mark', text: 'C' }),
      el('strong', { text: 'Myclassroom' }),
    ),
    el('div', {},
      el('h1', { class: 'auth-headline', text: 'La classe, réunie en un seul endroit.' }),
      el('p', { class: 'auth-sub', text: 'L’enseignant publie ses supports, son planning et anime les échanges. Les élèves se connectent avec les identifiants qu’il a créés.' }),
      el('ul', { class: 'auth-points' },
        li('book', 'Cours, fiches et documents, consultables sans téléchargement'),
        li('users', 'Un compte pour chaque élève, créé par l’enseignant'),
        li('calendar', 'Planning des séances, échéances et rappels'),
        li('chat', 'Un espace d’échange par classe, modéré'),
      ),
    ),
    el('p', { class: 'auth-foot', text: 'Myclassroom v1.0 — plateforme de classe virtuelle' }),
  );

  const isSignup = mode === 'signup';
  const errorBox = el('div', { class: 'form-error', hidden: true });
  const submit = el('button', { class: 'btn btn-primary', type: 'submit', style: { width: '100%', padding: '11px' } },
    isSignup ? 'Créer le compte enseignant' : 'Se connecter');

  const identifier = el('input', { class: 'input', id: 'identifier', name: 'identifier', autocomplete: 'username', placeholder: 'prof.diallo ou nom@etablissement.fr' });
  const password = el('input', { class: 'input', id: 'password', name: 'password', type: 'password', autocomplete: 'current-password', placeholder: '••••••••' });
  const fullName = el('input', { class: 'input', id: 'fullName', name: 'fullName', autocomplete: 'name', placeholder: 'Aminata Diallo' });
  const email = el('input', { class: 'input', id: 'email', name: 'email', type: 'email', autocomplete: 'email', placeholder: 'nom@etablissement.fr' });

  if (api().mode === 'demo' && !isSignup) {
    identifier.value = 'prof.diallo';
    password.value = 'demo1234';
  }

  const form = el('form', { class: 'auth-form', novalidate: true },
    errorBox,
    isSignup
      ? el('div', {},
        el('div', { class: 'field' }, el('label', { for: 'fullName', text: 'Nom complet' }), fullName),
        el('div', { class: 'field' }, el('label', { for: 'email', text: 'Adresse e-mail' }), email),
        el('div', { class: 'field' }, el('label', { for: 'password', text: 'Mot de passe' }), password,
          el('span', { class: 'hint', text: '10 caractères minimum. Vous vous connecterez avec cette adresse.' })),
      )
      : el('div', {},
        el('div', { class: 'field' },
          el('label', { for: 'identifier', text: 'Identifiant' }), identifier,
          el('span', { class: 'hint', text: 'Enseignant : votre adresse e-mail. Élève : l’identifiant fourni par votre professeur.' })),
        el('div', { class: 'field' }, el('label', { for: 'password', text: 'Mot de passe' }), password),
      ),
    submit,
  );

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errorBox.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Connexion…';
    try {
      if (isSignup) {
        if (api().mode === 'demo') throw new Error('L’inscription n’est pas disponible en démonstration.');
        await api().signUpTeacher({ email: email.value.trim(), password: password.value, fullName: fullName.value.trim() });
        toast('Compte enseignant créé.', 'ok');
      } else {
        await api().signIn({ identifier: identifier.value.trim(), password: password.value });
      }
    } catch (err) {
      errorBox.textContent = err.message || 'Connexion impossible.';
      errorBox.hidden = false;
      submit.disabled = false;
      submit.textContent = isSignup ? 'Créer le compte enseignant' : 'Se connecter';
    }
  });

  const card = el('div', { class: 'auth-card' },
    el('h2', { text: isSignup ? 'Créer un compte enseignant' : 'Connexion' }),
    el('p', { class: 'sub', text: isSignup
      ? 'Réservé aux enseignants. Les comptes élèves sont créés depuis votre classe.'
      : 'Bienvenue. Entrez vos identifiants pour accéder à vos classes.' }),
    form,
    isSignup
      ? el('p', { class: 'auth-toggle' }, 'Déjà un compte ? ', el('a', { href: '#/login', text: 'Se connecter' }))
      : el('p', { class: 'auth-toggle' }, 'Enseignant sans compte ? ', el('a', { href: '#/signup', text: 'Créer un compte' })),
    api().mode === 'demo'
      ? el('div', { class: 'auth-demo' },
        el('strong', { text: 'Démonstration sans serveur. ' }),
        'Connectez-vous avec ', el('b', { text: 'prof.diallo' }), ' (mot de passe libre) ou, en élève, avec ',
        el('b', { text: 'eleve01' }), '.')
      : null,
  );

  mount(el('div', { class: 'auth' }, side, el('main', { class: 'auth-main' }, card)));
  document.title = 'Connexion — Myclassroom';
}

function li(iconName, text) {
  return el('li', {}, icon(iconName), el('span', { text }));
}

/* ================================================================ coquille */
function sidebar(route) {
  const classes = state.classes || [];
  const link = (hash, iconName, label, active) => el('a', {
    class: `nav-item ${active ? 'active' : ''}`, href: hash,
  }, icon(iconName), el('span', { text: label }));

  return el('aside', { class: 'sidebar' },
    el('div', { class: 'side-brand' },
      el('div', { class: 'mark', text: 'C' }),
      el('strong', { text: 'Myclassroom' }),
    ),
    el('nav', { class: 'side-nav' },
      link('#/', 'home', 'Tableau de bord', route.name === 'home'),
      link('#/classes', 'book', 'Mes classes', route.name === 'classes'),
    ),
    el('div', { class: 'side-label', text: isTeacher() ? 'Mes classes' : 'Mes cours' }),
    el('div', { class: 'side-classes' },
      ...classes.map((c) => el('a', {
        class: `side-class ${route.params.classId === c.id ? 'active' : ''}`,
        href: `#/class/${c.id}`,
        title: c.name,
      }, el('span', { class: 'dot', style: { background: c.color || '#2C5F8D' } }), el('span', { text: c.name }))),
      classes.length === 0
        ? el('p', { class: 'side-label', style: { padding: '4px 10px', letterSpacing: '0', textTransform: 'none' }, text: 'Aucune classe' })
        : null,
    ),
    el('div', { class: 'side-foot' },
      el('div', { class: 'side-user' },
        avatar(state.user),
        el('div', { class: 'who' },
          el('b', { text: state.user.full_name || state.user.username }),
          el('span', { text: isTeacher() ? 'Enseignant' : 'Élève' }),
        ),
        el('button', {
          class: 'btn btn-icon side-out', title: 'Se déconnecter', 'aria-label': 'Se déconnecter',
          style: { background: 'rgba(255,255,255,.08)', color: '#dbe6f2' },
          onclick: async () => { await api().signOut(); location.hash = '#/login'; },
        }, icon('logout', 16)),
      ),
    ),
  );
}

function topbar(crumbs, actions = []) {
  const nodes = [];
  crumbs.forEach((c, i) => {
    if (i > 0) nodes.push(el('span', { class: 'sep', text: '/' }));
    nodes.push(c.href ? el('a', { href: c.href, text: c.label }) : el('b', { text: c.label }));
  });
  return el('header', { class: 'topbar' },
    el('div', { class: 'crumbs' }, ...nodes),
    el('div', { class: 'spacer' }),
    ...actions,
  );
}

export function renderShell(content, { crumbs = [], actions = [] } = {}) {
  const route = state.route;
  mount(el('div', { class: 'shell' },
    sidebar(route),
    el('main', { class: 'main' }, topbar(crumbs, actions), content),
  ));
}

/* ================================================================ accueil */
export async function renderHome() {
  const content = el('div', { class: 'content' }, el('p', { class: 'sub', text: 'Chargement…' }));
  renderShell(content, { crumbs: [{ label: 'Tableau de bord' }] });

  const [stats, classes] = await Promise.all([api().stats(), api().listClasses()]);
  state.classes = classes;
  renderShell(content, { crumbs: [{ label: 'Tableau de bord' }] });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const firstName = (state.user.full_name || '').split(' ')[0] || 'à vous';

  const head = el('div', { class: 'page-head' },
    el('div', {},
      el('h1', { text: `${greeting}, ${firstName}.` }),
      el('p', { class: 'sub', text: isTeacher()
        ? 'Voici l’activité de vos classes aujourd’hui.'
        : 'Retrouvez vos cours, vos échéances et les échanges de votre classe.' }),
    ),
    el('div', { class: 'actions' },
      isTeacher() ? el('button', { class: 'btn btn-primary', onclick: () => createClass() }, icon('plus'), 'Créer une classe') : null,
    ),
  );

  const statCards = el('div', { class: 'stats' },
    stat(classes.length, 'Classes', isTeacher() ? 'dont vous êtes propriétaire' : 'auxquelles vous êtes inscrit'),
    isTeacher() ? stat(stats.students, 'Élèves', 'inscrits dans vos classes') : null,
    stat(stats.contents, 'Contenus', 'documents publiés'),
    stat(stats.upcoming.length, 'Échéances', 'à venir cette semaine'),
  );

  const upcoming = el('section', {},
    el('div', { class: 'section-head' }, el('h2', { text: 'Prochaines échéances' }), el('div', { class: 'spacer' })),
    stats.upcoming.length === 0
      ? el('div', { class: 'empty' }, el('h3', { text: 'Rien à l’horizon' }), el('p', { text: 'Aucune séance ni échéance programmée pour le moment.' }))
      : el('div', { class: 'list' }, ...stats.upcoming.slice(0, 5).map((e) => eventRow(e, { compact: true }))),
  );

  const grid = el('section', {},
    el('div', { class: 'section-head' },
      el('h2', { text: isTeacher() ? 'Mes classes' : 'Mes cours' }),
      el('div', { class: 'spacer' }),
      el('a', { class: 'link-btn', href: '#/classes', text: 'Tout voir' }),
    ),
    classes.length === 0 ? emptyClasses() : classGrid(classes.slice(0, 6)),
  );

  content.replaceChildren(
    demoBanner() || document.createComment(''),
    head, statCards, upcoming, grid,
  );
  document.title = 'Tableau de bord — Myclassroom';
}

function stat(value, label, detail) {
  return el('div', { class: 'card stat' },
    el('span', { class: 'k', text: label }),
    el('span', { class: 'v', text: String(value) }),
    el('span', { class: 'd', text: detail }),
  );
}

function emptyClasses() {
  return el('div', { class: 'empty' },
    el('h3', { text: isTeacher() ? 'Créez votre première classe' : 'Aucune classe pour l’instant' }),
    el('p', { text: isTeacher()
      ? 'Une classe regroupe vos contenus, votre planning, vos élèves et vos échanges. La création prend moins d’une minute.'
      : 'Votre enseignant ne vous a pas encore inscrit dans une classe. Revenez plus tard ou contactez-le.' }),
    isTeacher() ? el('button', { class: 'btn btn-primary', onclick: () => createClass() }, icon('plus'), 'Créer une classe') : null,
  );
}

function classGrid(classes) {
  return el('div', { class: 'grid-classes' }, ...classes.map(classCard));
}

function classCard(cls) {
  const card = el('a', { class: 'card class-card', href: `#/class/${cls.id}` },
    el('div', { class: 'class-band', style: { background: cls.color || '#2C5F8D' } }),
    el('div', { class: 'class-body' },
      el('h3', { text: cls.name }),
      el('div', { class: 'class-meta' },
        cls.level ? el('span', { class: 'chip', text: cls.level }) : null,
        cls.subject ? el('span', { class: 'chip chip-muted', text: cls.subject }) : null,
        cls.school_year ? el('span', { class: 'chip chip-muted', text: cls.school_year }) : null,
      ),
      cls.description ? el('p', { style: { fontSize: '13px', color: 'var(--muted)' }, text: cls.description }) : null,
      el('div', { class: 'class-foot' },
        el('span', {}, icon('users', 14), ` ${cls.students_count || 0} élève${(cls.students_count || 0) > 1 ? 's' : ''}`),
        el('span', {}, icon('book', 14), ` ${cls.contents_count || 0} contenu${(cls.contents_count || 0) > 1 ? 's' : ''}`),
        el('span', { style: { marginLeft: 'auto' }, class: 'num', text: cls.code }),
      ),
    ),
  );
  return card;
}

export async function renderClasses() {
  const content = el('div', { class: 'content' }, el('p', { class: 'sub', text: 'Chargement…' }));
  renderShell(content, { crumbs: [{ label: 'Mes classes' }] });
  const classes = await api().listClasses();
  state.classes = classes;
  renderShell(content, { crumbs: [{ label: 'Mes classes' }] });

  content.replaceChildren(
    demoBanner() || document.createComment(''),
    el('div', { class: 'page-head' },
      el('div', {},
        el('h1', { text: isTeacher() ? 'Mes classes' : 'Mes cours' }),
        el('p', { class: 'sub', text: `${classes.length} classe${classes.length > 1 ? 's' : ''} au total.` }),
      ),
      el('div', { class: 'actions' },
        isTeacher() ? el('button', { class: 'btn btn-primary', onclick: () => createClass() }, icon('plus'), 'Créer une classe') : null),
    ),
    classes.length === 0 ? emptyClasses() : classGrid(classes),
  );
  document.title = 'Mes classes — Myclassroom';
}

/* ================================================================= classe */
export async function renderClass() {
  const { classId, tab = 'contents' } = state.route.params;
  const content = el('div', { class: 'content' }, el('p', { class: 'sub', text: 'Chargement…' }));
  renderShell(content, { crumbs: [{ label: 'Mes classes', href: '#/classes' }, { label: 'Classe' }] });

  let cls;
  try {
    cls = await api().getClass(classId);
  } catch (err) {
    content.replaceChildren(errorPanel(err.message));
    return;
  }
  state.currentClass = cls;
  state.classes = await api().listClasses().catch(() => state.classes || []);

  const head = el('div', { class: 'page-head', style: { alignItems: 'center' } },
    el('div', {
      style: {
        width: '10px', height: '46px', borderRadius: '6px', background: cls.color || '#2C5F8D', flex: 'none',
      },
    }),
    el('div', {},
      el('h1', { text: cls.name }),
      el('p', { class: 'sub' },
        [cls.level, cls.subject, cls.school_year].filter(Boolean).join(' · '),
        cls.code ? el('span', { class: 'chip', style: { marginLeft: '8px' }, text: `Code ${cls.code}` }) : null,
      ),
    ),
    el('div', { class: 'actions' },
      el('button', {
        class: 'btn btn-ghost',
        title: 'Copier le code de la classe',
        onclick: () => {
          navigator.clipboard?.writeText(cls.code);
          toast(`Code « ${cls.code} » copié.`, 'ok');
        },
      }, icon('copy'), 'Copier le code'),
    ),
  );

  const tabsDef = [
    ['contents', 'Contenus', 'book'],
    ['discussion', 'Discussion', 'chat'],
    ['planning', 'Planning', 'calendar'],
  ];
  if (cls.role === 'owner') tabsDef.push(['students', 'Élèves', 'users']);

  const tabs = el('div', { class: 'tabs' }, ...tabsDef.map(([key, label, iconName]) =>
    el('a', { class: `tab ${tab === key ? 'active' : ''}`, href: `#/class/${classId}/${key}` }, icon(iconName, 16), label)));

  const body = el('div', {});
  content.replaceChildren(demoBanner() || document.createComment(''), head, tabs, body);

  const crumbs = [{ label: 'Mes classes', href: '#/classes' }, { label: cls.name }];
  renderShell(content, { crumbs });
  document.title = `${cls.name} — Myclassroom`;

  if (tab === 'discussion') return renderDiscussionTab(body, cls);
  if (tab === 'planning') return renderPlanningTab(body, cls);
  if (tab === 'students' && cls.role === 'owner') return renderStudentsTab(body, cls);
  return renderContentsTab(body, cls);
}

/* ------------------------------------------------------------- contenus */
async function renderContentsTab(root, cls) {
  const owner = cls.role === 'owner';
  const items = await api().listContents(cls.id);

  const toolbar = el('div', { class: 'toolbar' });
  const search = el('input', { class: 'input', placeholder: 'Rechercher un contenu…', type: 'search' });
  const searchWrap = el('div', { class: 'search' }, icon('search'), search);
  const actions = owner
    ? [el('button', { class: 'btn btn-primary', onclick: () => createContent(cls.id).then(() => renderClass()) }, icon('plus'), 'Ajouter un contenu')]
    : [];
  toolbar.append(searchWrap, el('div', { style: { flex: '1' } }), ...actions);

  const list = el('div', {});
  root.replaceChildren(toolbar, list);

  const draw = (query = '') => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((c) =>
      !q || c.title.toLowerCase().includes(q) || (c.chapter || '').toLowerCase().includes(q)
      || (c.description || '').toLowerCase().includes(q));

    if (items.length === 0) {
      list.replaceChildren(el('div', { class: 'empty' },
        el('h3', { text: 'Aucun contenu publié' }),
        el('p', { text: owner
          ? 'Déposez un PDF, un document Word, un PowerPoint ou une image : vos élèves y auront accès immédiatement.'
          : 'Votre enseignant n’a pas encore publié de contenu dans cette classe.' }),
        owner ? el('button', { class: 'btn btn-primary', onclick: () => createContent(cls.id).then(() => renderClass()) }, icon('upload'), 'Déposer un document') : null,
      ));
      return;
    }
    if (filtered.length === 0) {
      list.replaceChildren(el('div', { class: 'empty' }, el('p', { text: `Aucun résultat pour « ${query} ».` })));
      return;
    }

    const groups = new Map();
    for (const c of filtered) {
      const key = (c.chapter || 'Sans chapitre').trim() || 'Sans chapitre';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    const rank = (label) => {
      const m = /chapitre\s*(\d+)/i.exec(label);
      if (m) return Number(m[1]);
      if (/g[ée]n[ée]ral|divers|autres/i.test(label)) return 9000;
      if (/sans chapitre/i.test(label)) return 9500;
      return 5000;
    };
    const nodes = [];
    for (const chapter of [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'fr'))) {
      const rows = groups.get(chapter);
      nodes.push(el('h3', { class: 'chapter-title', text: chapter }));
      nodes.push(el('div', { class: 'list' }, ...rows.map((c) => contentRow(c, cls))));
    }
    list.replaceChildren(...nodes);
  };

  search.addEventListener('input', () => draw(search.value));
  draw();
}

function contentRow(content, cls) {
  const owner = cls.role === 'owner';
  const kind = fileKind(content);
  const published = content.status === 'published';

  const actions = el('div', { class: 'actions' },
    el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openPreview(content) }, icon('eye'), 'Aperçu'),
    content.allow_download || content.allowDownload
      ? el('button', { class: 'btn btn-ghost btn-sm', onclick: () => downloadContent(content) }, icon('download'))
      : null,
    owner
      ? el('button', {
        class: 'btn btn-ghost btn-sm',
        title: published ? 'Repasser en brouillon' : 'Publier',
        onclick: async () => {
          await api().updateContentStatus(content.id, published ? 'draft' : 'published');
          toast(published ? 'Contenu repassé en brouillon.' : 'Contenu publié.', 'ok');
          renderClass();
        },
      }, icon(published ? 'lock' : 'check'), published ? 'Dépublier' : 'Publier')
      : null,
    owner
      ? el('button', {
        class: 'btn btn-ghost btn-sm',
        title: 'Supprimer',
        onclick: async () => {
          const ok = await confirmModal({
            title: 'Supprimer ce contenu ?',
            message: `« ${content.title} » sera définitivement retiré de la classe.`,
            confirmLabel: 'Supprimer', danger: true,
          });
          if (!ok) return;
          await api().deleteContent(content);
          toast('Contenu supprimé.', 'ok');
          renderClass();
        },
      }, icon('trash'))
      : null,
  );

  return el('div', { class: 'row' },
    el('div', { class: `fileicon ${kind}`, text: fileExt(content) }),
    el('div', { class: 'grow' },
      el('h4', { text: content.title }),
      el('div', { class: 'meta' },
        el('span', { text: content.description || (content.kind === 'link' ? 'Lien externe' : 'Document') }),
        content.sizeBytes || content.size_bytes ? el('span', { text: formatBytes(content.sizeBytes || content.size_bytes) }) : null,
        el('span', { text: timeAgo(content.created_at) }),
        published
          ? el('span', { class: 'chip chip-ok', text: 'Publié' })
          : el('span', { class: 'chip chip-warn', text: 'Brouillon' }),
      ),
    ),
    actions,
  );
}

async function openPreview(content) {
  const spinner = el('p', { class: 'sub', text: 'Préparation de l’aperçu…' });
  const { close } = modal({ title: content.title, body: spinner, wide: true });
  try {
    const url = await fetchUrl(content);
    if (!url) {
      spinner.replaceWith(el('div', { class: 'empty' },
        el('h3', { text: 'Aperçu indisponible' }),
        el('p', { text: 'Le fichier n’est pas encore disponible en prévisualisation. Vous pouvez le télécharger.' }),
        content.allow_download !== false ? el('button', { class: 'btn btn-primary', onclick: () => downloadContent(content) }, icon('download'), 'Télécharger') : null,
      ));
      return;
    }
    const kind = fileKind(content);
    if (kind === 'pdf') {
      spinner.replaceWith(el('iframe', { class: 'preview-frame', src: url, title: content.title }));
    } else if (kind === 'img') {
      spinner.replaceWith(el('img', { class: 'preview-img', src: url, alt: content.title }));
    } else if (content.kind === 'link') {
      spinner.replaceWith(el('div', { class: 'empty' },
        el('h3', { text: 'Ressource externe' }),
        el('p', { text: url }),
        el('a', { class: 'btn btn-primary', href: url, target: '_blank', rel: 'noopener' }, icon('external'), 'Ouvrir dans un onglet'),
      ));
    } else {
      spinner.replaceWith(el('div', { class: 'empty' },
        el('h3', { text: 'Aperçu non disponible pour ce format' }),
        el('p', { text: 'Les fichiers Word et PowerPoint ne peuvent pas être affichés dans le navigateur. Téléchargez le document pour l’ouvrir.' }),
        content.allow_download !== false ? el('button', { class: 'btn btn-primary', onclick: () => downloadContent(content) }, icon('download'), 'Télécharger le fichier') : null,
      ));
    }
  } catch (err) {
    spinner.replaceWith(errorPanel(err.message));
  }
}

async function downloadContent(content) {
  try {
    const url = await api().contentUrl(content);
    if (!url) throw new Error('Fichier indisponible.');
    if (content.kind === 'link') {
      window.open(url, '_blank', 'noopener');
      return;
    }
    const a = el('a', { href: url, download: content.fileName || content.file_name || content.title, target: '_blank', rel: 'noopener' });
    document.body.append(a);
    a.click();
    a.remove();
  } catch (err) {
    toast(err.message, 'err');
  }
}

/* ----------------------------------------------------------- discussion */
async function renderDiscussionTab(root, cls) {
  const threads = await api().listThreads(cls.id);
  const owner = cls.role === 'owner';

  const head = el('div', { class: 'toolbar' },
    el('div', {}, el('p', { class: 'sub', text: `${threads.length} discussion${threads.length > 1 ? 's' : ''} dans cette classe.` })),
    el('div', { style: { flex: '1' } }),
    el('button', { class: 'btn btn-primary', onclick: () => createThread(cls) }, icon('plus'), owner ? 'Nouvelle annonce ou discussion' : 'Poser une question'),
  );

  const list = threads.length === 0
    ? el('div', { class: 'empty' },
      el('h3', { text: 'Aucun échange pour le moment' }),
      el('p', { text: owner ? 'Ouvrez une discussion ou publiez une annonce pour lancer les échanges.' : 'Soyez le premier à poser une question.' }))
    : el('div', { class: 'list' }, ...threads.map((t) => el('a', {
      class: `thread ${t.is_announcement ? 'annonce' : ''}`,
      href: `#/class/${cls.id}/thread/${t.id}`,
      style: { textDecoration: 'none', color: 'inherit' },
    },
    el('h4', {},
      t.is_announcement ? el('span', { class: 'chip chip-warn' }, icon('pin', 12), 'Annonce') : null,
      t.title,
      t.is_locked ? el('span', { class: 'chip chip-muted', text: 'Verrouillé' }) : null,
    ),
    el('div', { class: 'meta' },
      el('span', { text: `Par ${t.author_name}` }),
      el('span', { text: `${t.posts_count} message${t.posts_count > 1 ? 's' : ''}` }),
      el('span', { text: timeAgo(t.last_post_at) }),
    ))));

  root.replaceChildren(head, list);
}

export async function renderThread() {
  const { classId, threadId } = state.route.params;
  const content = el('div', { class: 'content' }, el('p', { class: 'sub', text: 'Chargement…' }));
  renderShell(content, { crumbs: [{ label: 'Mes classes', href: '#/classes' }, { label: 'Classe', href: `#/class/${classId}` }] });

  let cls;
  let data;
  try {
    [cls, data] = await Promise.all([api().getClass(classId), api().getThread(threadId)]);
  } catch (err) {
    content.replaceChildren(errorPanel(err.message));
    return;
  }
  const { thread, posts } = data;
  const me = state.user;
  state.classes = await api().listClasses().catch(() => state.classes || []);

  const head = el('div', { class: 'page-head', style: { marginBottom: '14px' } },
    el('div', {},
      el('h1', { text: thread.title, style: { fontSize: '23px' } }),
      el('p', { class: 'sub' },
        thread.is_announcement ? el('span', { class: 'chip chip-warn', style: { marginRight: '8px' }, text: 'Annonce' }) : null,
        `${posts.length} message${posts.length > 1 ? 's' : ''} · ${cls.name}`),
    ),
    el('div', { class: 'actions' },
      el('a', { class: 'btn btn-ghost', href: `#/class/${classId}/discussion` }, icon('back'), 'Retour')),
  );

  const postList = el('div', { class: 'card pad' },
    ...posts.map((p) => el('article', { class: 'post' },
      avatar({ id: p.author_id, full_name: p.author_name }),
      el('div', { class: 'body' },
        el('div', { class: 'who' },
          el('b', { text: p.author_role === 'teacher' ? `${p.author_name} · Enseignant` : p.author_name }),
          el('time', { text: timeAgo(p.created_at) }),
        ),
        el('p', { text: p.body }),
      ),
    )),
    posts.length === 0 ? el('p', { class: 'sub', text: 'Aucun message.' }) : null,
  );

  const canPost = !thread.is_locked || cls.role === 'owner';
  const reply = canPost
    ? el('div', { class: 'card pad', style: { marginTop: '16px' } },
      el('div', { class: 'field' },
        el('label', { for: 'reply', text: 'Votre message' }),
        el('textarea', { class: 'textarea', id: 'reply', placeholder: 'Écrivez votre message…' }),
      ),
      el('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
        el('button', {
          class: 'btn btn-primary',
          onclick: async (ev) => {
            const box = ev.target.closest('.card').querySelector('#reply');
            const body = box.value.trim();
            if (!body) { toast('Le message est vide.', 'err'); return; }
            ev.target.disabled = true;
            try {
              await api().addPost({ threadId: thread.id, body });
              toast('Message publié.', 'ok');
              renderThread();
            } catch (err) {
              toast(err.message, 'err');
              ev.target.disabled = false;
            }
          },
        }, icon('send'), 'Publier'),
      ),
    )
    : el('div', { class: 'banner banner-info' }, icon('lock'), 'Cette discussion est verrouillée : seuls les enseignants peuvent écrire.');

  content.replaceChildren(
    demoBanner() || document.createComment(''),
    head, postList, reply,
  );
  renderShell(content, { crumbs: [{ label: 'Mes classes', href: '#/classes' }, { label: cls.name, href: `#/class/${classId}` }, { label: thread.title }] });
  document.title = `${thread.title} — Myclassroom`;
  void me;
}

/* ------------------------------------------------------------- planning */
async function renderPlanningTab(root, cls) {
  const events = await api().listEvents(cls.id);
  const owner = cls.role === 'owner';
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at || e.startsAt).getTime() >= now - 86400000);
  const past = events.filter((e) => new Date(e.starts_at || e.startsAt).getTime() < now - 86400000).reverse();

  const head = el('div', { class: 'toolbar' },
    el('p', { class: 'sub', text: 'Séances et échéances de la classe.' }),
    el('div', { style: { flex: '1' } }),
    owner ? el('button', { class: 'btn btn-primary', onclick: () => createEvent(cls).then(() => renderClass()) }, icon('plus'), 'Ajouter une séance ou une échéance') : null,
  );

  const section = (title, rows, emptyText) => el('section', {},
    el('div', { class: 'section-head' }, el('h2', { text: title })),
    rows.length === 0
      ? el('div', { class: 'empty' }, el('p', { text: emptyText }))
      : el('div', { class: 'list' }, ...rows.map((e) => eventRow(e, { owner }))),
  );

  root.replaceChildren(head,
    section('À venir', upcoming, 'Aucune séance ni échéance à venir.'),
    past.length ? section('Passées', past.slice(0, 10), '') : el('div', {}),
  );
}

function eventRow(evt, { owner = false, compact = false } = {}) {
  const start = evt.starts_at || evt.startsAt;
  const d = new Date(start);
  const isDeadline = (evt.kind || evt._kind) === 'deadline';
  const clsName = evt.classes?.name || evt.className;

  return el('div', { class: 'evt' },
    el('time', { class: isDeadline ? 'deadline' : '' },
      el('b', { text: String(d.getDate()) }),
      el('span', { text: formatDate(d).split(' ')[1].slice(0, 3).toUpperCase() }),
    ),
    el('div', { class: 'grow' },
      el('h4', {}, evt.title),
      el('div', { class: 'meta' },
        evt.kind === 'deadline' ? el('span', { text: `À rendre avant ${formatTime(start)}` }) : el('span', { text: `De ${formatTime(start)}${evt.ends_at || evt.endsAt ? ` à ${formatTime(evt.ends_at || evt.endsAt)}` : ''}` }),
        compact && clsName ? el('span', { text: clsName }) : null,
        evt.location ? el('span', { text: evt.location }) : null,
        evt.description ? el('span', { text: evt.description }) : null,
      ),
    ),
    owner && !compact
      ? el('button', {
        class: 'btn btn-ghost btn-sm', title: 'Supprimer',
        onclick: async () => {
          const ok = await confirmModal({ title: 'Supprimer cet élément ?', message: `« ${evt.title} » sera retiré du planning.`, confirmLabel: 'Supprimer', danger: true });
          if (!ok) return;
          await api().deleteEvent(evt.id);
          toast('Élément supprimé.', 'ok');
          renderClass();
        },
      }, icon('trash'))
      : el('span', { class: 'chip ' + (isDeadline ? 'chip-warn' : 'chip'), text: isDeadline ? 'Échéance' : 'Séance' }),
  );
}

/* -------------------------------------------------------------- élèves */
async function renderStudentsTab(root, cls) {
  const students = await api().listStudents(cls.id);

  const head = el('div', { class: 'toolbar' },
    el('p', { class: 'sub', text: `${students.length} élève${students.length > 1 ? 's' : ''} inscrit${students.length > 1 ? 's' : ''}. Les comptes sont créés par vos soins.` }),
    el('div', { style: { flex: '1' } }),
    el('button', { class: 'btn btn-ghost', onclick: () => exportCsv(students, cls) }, icon('download'), 'Exporter la liste'),
    el('button', { class: 'btn btn-primary', onclick: () => addStudent(cls).then(() => renderClass()) }, icon('userPlus'), 'Créer un compte élève'),
  );

  const table = students.length === 0
    ? el('div', { class: 'empty' },
      el('h3', { text: 'Aucun élève inscrit' }),
      el('p', { text: 'Créez un compte pour chaque élève : vous lui remettez ensuite son identifiant et son mot de passe.' }),
      el('button', { class: 'btn btn-primary', onclick: () => addStudent(cls).then(() => renderClass()) }, icon('userPlus'), 'Créer un compte élève'))
    : el('div', { class: 'table-wrap' },
      el('table', { class: 'table' },
        el('thead', {}, el('tr', {},
          el('th', { text: 'Élève' }),
          el('th', { text: 'Identifiant' }),
          el('th', { text: 'Inscrit le' }),
          el('th', { text: '', style: { width: '190px' } }),
        )),
        el('tbody', {}, ...students.map((s) => el('tr', {},
          el('td', {}, el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            avatar({ id: s.id, full_name: s.full_name }),
            el('span', { text: s.full_name }))),
          el('td', {}, el('span', { class: 'num', text: s.username })),
          el('td', { text: formatDate(s.created_at, true) }),
          el('td', {},
            el('div', { style: { display: 'flex', gap: '6px', justifyContent: 'flex-end' } },
              el('button', {
                class: 'btn btn-ghost btn-sm', title: 'Réinitialiser le mot de passe',
                onclick: async () => {
                  const ok = await confirmModal({
                    title: 'Réinitialiser le mot de passe ?',
                    message: `Un nouveau mot de passe sera généré pour ${s.full_name}. L’ancien ne fonctionnera plus.`,
                    confirmLabel: 'Réinitialiser',
                  });
                  if (!ok) return;
                  try {
                    const res = await api().resetStudentPassword({ studentId: s.id, username: s.username });
                    credentialsModal({ fullName: s.full_name, username: s.username, password: res.password, title: 'Nouveau mot de passe' });
                  } catch (err) { toast(err.message, 'err'); }
                },
              }, icon('refresh')),
              el('button', {
                class: 'btn btn-ghost btn-sm', title: 'Retirer de la classe',
                onclick: async () => {
                  const ok = await confirmModal({
                    title: 'Retirer cet élève ?', message: `${s.full_name} n’aura plus accès à cette classe. Son compte n’est pas supprimé.`,
                    confirmLabel: 'Retirer', danger: true,
                  });
                  if (!ok) return;
                  await api().removeStudent(cls.id, s.id);
                  toast('Élève retiré de la classe.', 'ok');
                  renderClass();
                },
              }, icon('x')),
            )),
        ))),
      ));

  root.replaceChildren(head, table);
}

function exportCsv(students, cls) {
  const lines = ['nom;identifiant'];
  for (const s of students) lines.push(`${s.full_name};${s.username}`);
  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `eleves-${cls.code || 'classe'}.csv` });
  document.body.append(a); a.click(); a.remove();
  toast('Liste exportée.', 'ok');
}

/* ================================================================ modales */
function createClass() {
  return formModal({
    title: 'Créer une classe',
    submitLabel: 'Créer la classe',
    intro: 'Une classe regroupe les contenus, le planning, les élèves et les discussions.',
    fields: [
      { name: 'name', label: 'Nom de la classe', required: true, placeholder: 'Mathématiques — 3e A' },
      { name: 'level', label: 'Niveau', placeholder: '3e, Terminale…' },
      { name: 'subject', label: 'Matière', placeholder: 'Mathématiques' },
      { name: 'school_year', label: 'Année scolaire', placeholder: '2026-2027' },
      { name: 'code', label: 'Code de classe', placeholder: '3A-MATHS-2026', hint: 'Laissez vide pour le générer automatiquement.' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 3, placeholder: 'Présentation courte de la classe.' },
      {
        name: 'color', label: 'Couleur', type: 'select', value: '#2C5F8D',
        options: [
          { value: '#2C5F8D', label: 'Bleu' }, { value: '#2E7D5B', label: 'Vert' },
          { value: '#C0803C', label: 'Ocre' }, { value: '#7A5B8E', label: 'Violet' },
          { value: '#B42318', label: 'Rouge' },
        ],
      },
    ],
    onSubmit: async (values) => {
      const cls = await api().createClass(values);
      toast('Classe créée.', 'ok');
      state.classes = await api().listClasses();
      navigate(`/class/${cls.id}`);
    },
  });
}

function createContent(classId) {
  return formModal({
    title: 'Ajouter un contenu',
    submitLabel: 'Publier',
    wide: false,
    fields: [
      { name: 'title', label: 'Titre', required: true, placeholder: 'Chapitre 1 — Nombres relatifs' },
      { name: 'chapter', label: 'Chapitre / dossier', placeholder: 'Chapitre 1', hint: 'Sert à regrouper les contenus dans la classe.' },
      { name: 'description', label: 'Description', type: 'textarea', rows: 2, placeholder: 'À quoi sert ce document ?' },
      {
        name: 'type', label: 'Type de contenu', type: 'select', value: 'file',
        options: [{ value: 'file', label: 'Fichier (PDF, Word, PowerPoint, image)' }, { value: 'link', label: 'Lien externe' }],
      },
      {
        name: 'file', label: 'Fichier', type: 'file',
        accept: '.pdf,.doc,.docx,.ppt,.pptx,.odt,.odp,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif',
        hint: '50 Mo maximum. PDF et images sont prévisualisables en ligne.',
      },
      { name: 'linkUrl', label: 'Adresse du lien', placeholder: 'https://…', hint: 'Uniquement pour un contenu de type lien.' },
      { name: 'allowDownload', label: 'Autoriser le téléchargement par les élèves', type: 'checkbox', value: true },
      {
        name: 'status', label: 'Publication', type: 'select', value: 'published',
        options: [{ value: 'published', label: 'Publier immédiatement' }, { value: 'draft', label: 'Garder en brouillon' }],
      },
    ],
    onSubmit: async (values) => {
      if (values.type === 'link') {
        if (!values.linkUrl) throw new Error('Indiquez l’adresse du lien.');
        if (!/^https?:\/\//i.test(values.linkUrl)) throw new Error('L’adresse doit commencer par http:// ou https://.');
        await api().createContent({
          classId, linkUrl: values.linkUrl, title: values.title, description: values.description,
          chapter: values.chapter, allowDownload: values.allowDownload, status: values.status,
        });
      } else {
        if (!values.file) throw new Error('Choisissez un fichier à déposer.');
        await api().createContent({
          classId, file: values.file, title: values.title || values.file.name,
          description: values.description, chapter: values.chapter,
          allowDownload: values.allowDownload, status: values.status,
        });
      }
      toast('Contenu ajouté.', 'ok');
    },
  });
}

function createThread(cls) {
  const owner = cls.role === 'owner';
  return formModal({
    title: owner ? 'Nouvelle discussion' : 'Poser une question',
    submitLabel: 'Ouvrir la discussion',
    fields: [
      { name: 'title', label: 'Sujet', required: true, placeholder: owner ? 'Consignes du contrôle' : 'Question sur l’exercice 12' },
      owner ? { name: 'announcement', label: 'Épingler comme annonce', type: 'checkbox', value: false } : null,
      { name: 'body', label: 'Premier message', type: 'textarea', rows: 4, placeholder: 'Écrivez votre message…' },
    ].filter(Boolean),
    onSubmit: async (values) => {
      const thread = await api().createThread({
        classId: cls.id, title: values.title, isAnnouncement: Boolean(values.announcement),
      });
      if (values.body) await api().addPost({ threadId: thread.id, body: values.body });
      toast('Discussion créée.', 'ok');
      navigate(`/class/${cls.id}/thread/${thread.id}`);
    },
  });
}

function createEvent(cls) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date(Date.now() + 86400000);
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;

  return formModal({
    title: 'Ajouter au planning',
    submitLabel: 'Enregistrer',
    fields: [
      { name: 'title', label: 'Intitulé', required: true, placeholder: 'Séance — Calcul littéral' },
      {
        name: 'kind', label: 'Type', type: 'select', value: 'session',
        options: [{ value: 'session', label: 'Séance de cours' }, { value: 'deadline', label: 'Échéance / rendu' }],
      },
      { name: 'startsAt', label: 'Date et heure', type: 'datetime-local', required: true, value: local },
      { name: 'endsAt', label: 'Fin (facultatif)', type: 'datetime-local' },
      { name: 'location', label: 'Lieu ou lien', placeholder: 'Salle 12' },
      { name: 'description', label: 'Précisions', type: 'textarea', rows: 2 },
    ],
    onSubmit: async (values) => {
      await api().createEvent({
        classId: cls.id, title: values.title, kind: values.kind,
        startsAt: values.startsAt, endsAt: values.endsAt || null,
        location: values.location, description: values.description,
      });
      toast('Ajouté au planning.', 'ok');
    },
  });
}

function addStudent(cls) {
  return formModal({
    title: 'Créer un compte élève',
    submitLabel: 'Créer le compte',
    intro: 'Un identifiant et un mot de passe temporaire sont générés. L’élève les utilisera pour sa première connexion.',
    fields: [
      { name: 'fullName', label: 'Nom complet', required: true, placeholder: 'Fatou Ndiaye' },
      {
        name: 'username', label: 'Identifiant', required: true, placeholder: 'f.ndiaye',
        hint: '3 à 24 caractères : lettres minuscules, chiffres, point, tiret, souligné.',
      },
    ],
    onSubmit: async (values) => {
      const student = await api().addStudent({ classId: cls.id, fullName: values.fullName, username: values.username });
      credentialsModal({
        fullName: values.fullName, username: student.username, password: student.password,
        title: 'Compte créé',
      });
    },
  });
}

function credentialsModal({ fullName, username, password, title }) {
  let handle = null;
  const done = el('button', { class: 'btn btn-primary', onclick: () => { handle?.close(); refresh(); } }, 'Terminé');
  handle = modal({
    title,
    body: el('div', {},
      el('p', { style: { fontSize: '14px', color: 'var(--muted)', marginBottom: '10px' },
        text: `Identifiants de ${fullName}. Notez-les ou remettez-les à l’élève : le mot de passe ne sera plus affiché.` }),
      el('div', { class: 'creds' },
        el('div', { class: 'line' }, el('b', { text: 'Identifiant' }), el('code', { text: username })),
        el('div', { class: 'line' }, el('b', { text: 'Mot de passe' }), el('code', { text: password })),
      ),
    ),
    footer: [
      el('button', {
        class: 'btn btn-ghost',
        onclick: () => {
          navigator.clipboard?.writeText(`${fullName}\nIdentifiant : ${username}\nMot de passe : ${password}`);
          toast('Identifiants copiés.', 'ok');
        },
      }, icon('copy'), 'Copier'),
      done,
    ],
  });
}

function errorPanel(message) {
  return el('div', { class: 'empty', style: { marginTop: '40px' } },
    el('h3', { text: 'Une erreur est survenue' }),
    el('p', { text: message }),
    el('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Recharger la page'),
  );
}
