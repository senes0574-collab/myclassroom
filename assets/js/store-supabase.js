/* =====================================================================
   Myclassroom — magasin Supabase.
   Authentification, données et fichiers passent par Supabase ;
   la création des comptes élèves passe par les fonctions Vercel.
   ===================================================================== */

const CDN = 'https://esm.sh/@supabase/supabase-js@2.45.4';

let sb = null;
let profile = null;
let authCallback = null;

function translate(message) {
  const m = String(message || '');
  if (/Invalid login credentials/i.test(m)) return 'Identifiant ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(m)) return 'Ce compte n’est pas encore confirmé. Contactez votre enseignant.';
  if (/User already registered/i.test(m)) return 'Un compte existe déjà avec cette adresse.';
  if (/Password should be at least/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (/duplicate key value/i.test(m) && /code/i.test(m)) return 'Ce code de classe est déjà utilisé.';
  if (/duplicate key value/i.test(m)) return 'Cet identifiant est déjà utilisé.';
  if (/JWT|token/i.test(m)) return 'Session expirée. Reconnectez-vous.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion au serveur impossible. Vérifiez votre réseau.';
  if (/row-level security/i.test(m)) return 'Action non autorisée par vos droits.';
  return m || 'Une erreur est survenue.';
}

function publicName(row) {
  return {
    id: row.id,
    role: row.role,
    full_name: row.full_name || '',
    username: row.username || '',
  };
}

export const supabaseStore = {
  mode: 'supabase',

  async init() {
    if (sb) return;
    const mod = await import(/* @vite-ignore */ CDN);
    sb = mod.createClient(state_url(), state_key(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });

    const { data } = await sb.auth.getSession();
    if (data.session) {
      await this._loadProfile(data.session.user);
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        profile = null;
        if (authCallback) authCallback(null);
        return;
      }
      if (session) {
        if (!profile || profile.id !== session.user.id) {
          await this._loadProfile(session.user);
        }
        if (authCallback) authCallback(this.currentUser());
      }
    });
  },

  async _loadProfile(user) {
    if (!user) { profile = null; return null; }
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw new Error(translate(error.message));
    if (data) {
      profile = publicName(data);
    } else {
      // Filet de sécurité si le trigger n'a pas créé le profil.
      const meta = user.user_metadata || {};
      const row = {
        id: user.id,
        role: meta.role === 'teacher' ? 'teacher' : 'student',
        username: meta.username || user.email,
        full_name: meta.full_name || user.email,
      };
      await sb.from('profiles').insert(row);
      profile = publicName(row);
    }
    return profile;
  },

  onAuthChange(cb) { authCallback = cb; },

  currentUser() { return profile; },

  async signIn({ identifier, password }) {
    const key = String(identifier || '').trim();
    if (!key) throw new Error('Saisissez votre identifiant.');
    const email = key.includes('@') ? key : `${key.toLowerCase()}@${window.__MYCLASSROOM_DOMAIN__ || 'eleves.myclassroom.app'}`;
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translate(error.message));
    await this._loadProfile(data.user);
    return profile;
  },

  async signUpTeacher({ email, password, fullName }) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { role: 'teacher', full_name: fullName, username: email } },
    });
    if (error) throw new Error(translate(error.message));
    if (!data.session) {
      throw new Error('Compte créé. Vérifiez votre boîte mail pour confirmer l’adresse, puis connectez-vous.');
    }
    await this._loadProfile(data.user);
    return profile;
  },

  async signOut() {
    profile = null;
    await sb.auth.signOut();
  },

  /* ----------------------------------------------------------- classes */
  async listClasses() {
    const me = profile;
    if (!me) return [];

    if (me.role === 'teacher') {
      const { data, error } = await sb
        .from('classes')
        .select('*, enrollments(count), contents(count)')
        .eq('owner_id', me.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(translate(error.message));
      return (data || []).map((row) => ({
        ...row,
        role: 'owner',
        students_count: row.enrollments?.[0]?.count ?? 0,
        contents_count: row.contents?.[0]?.count ?? 0,
      }));
    }

    const { data: links, error: linkError } = await sb
      .from('enrollments')
      .select('class_id')
      .eq('student_id', me.id);
    if (linkError) throw new Error(translate(linkError.message));
    const ids = (links || []).map((l) => l.class_id);
    if (ids.length === 0) return [];

    const { data, error } = await sb
      .from('classes')
      .select('*, enrollments(count), contents(count)')
      .in('id', ids)
      .order('created_at', { ascending: false });
    if (error) throw new Error(translate(error.message));
    return (data || []).map((row) => ({
      ...row,
      role: 'student',
      students_count: row.enrollments?.[0]?.count ?? 0,
      contents_count: row.contents?.[0]?.count ?? 0,
    }));
  },

  async getClass(id) {
    const { data, error } = await sb.from('classes').select('*').eq('id', id).single();
    if (error) throw new Error(translate(error.message));
    const role = data.owner_id === profile.id ? 'owner' : 'student';
    return { ...data, role };
  },

  async createClass(input) {
    const payload = {
      code: String(input.code || '').trim(),
      name: input.name,
      level: input.level || '',
      subject: input.subject || '',
      school_year: input.school_year || '',
      description: input.description || '',
      color: input.color || '#2C5F8D',
      owner_id: profile.id,
    };
    if (!payload.code) {
      payload.code = `${payload.name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}-${new Date().getFullYear()}`;
    }
    const { data, error } = await sb.from('classes').insert(payload).select('*').single();
    if (error) throw new Error(translate(error.message));
    return { ...data, role: 'owner', students_count: 0, contents_count: 0 };
  },

  /* ---------------------------------------------------------- étudiants */
  async listStudents(classId) {
    const { data: rows, error } = await sb
      .from('enrollments')
      .select('student_id, created_at')
      .eq('class_id', classId);
    if (error) throw new Error(translate(error.message));
    const ids = (rows || []).map((r) => r.student_id);
    if (ids.length === 0) return [];

    const { data: profs, error: profError } = await sb
      .from('profiles')
      .select('id, full_name, username')
      .in('id', ids);
    if (profError) throw new Error(translate(profError.message));
    const byId = Object.fromEntries((profs || []).map((p) => [p.id, p]));

    return (rows || []).map((row) => ({
      id: row.student_id,
      full_name: byId[row.student_id]?.full_name || 'Élève',
      username: byId[row.student_id]?.username || '',
      created_at: row.created_at,
    }));
  },

  async addStudent({ classId, fullName, username }) {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Session expirée. Reconnectez-vous.');

    const res = await fetch('/api/create-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ classId, fullName, username }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Création du compte impossible.');
    return payload.student;
  },

  async resetStudentPassword({ studentId, username }) {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ studentId, username }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Réinitialisation impossible.');
    return payload;
  },

  async removeStudent(classId, studentId) {
    const { error } = await sb.from('enrollments').delete().eq('class_id', classId).eq('student_id', studentId);
    if (error) throw new Error(translate(error.message));
  },

  /* ----------------------------------------------------------- contenus */
  async listContents(classId) {
    const { data, error } = await sb
      .from('contents')
      .select('*')
      .eq('class_id', classId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new Error(translate(error.message));
    return (data || []).map((row) => ({
      ...row,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      allowDownload: row.allow_download,
      hasFile: Boolean(row.storage_path || row.link_url),
    }));
  },

  async createContent({ classId, file, title, description, chapter, allowDownload, status, linkUrl }) {
    const id = crypto.randomUUID();
    let storagePath = null;
    let mime = null;
    let size = null;
    let fileName = null;

    if (!linkUrl) {
      if (!file) throw new Error('Choisissez un fichier.');
      if (file.size > 50 * 1024 * 1024) throw new Error('Fichier trop volumineux : 50 Mo maximum.');
      const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 120);
      storagePath = `${classId}/${id}/${safeName}`;
      const { error: upError } = await sb.storage.from('contents').upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upError) throw new Error(`Téléversement impossible : ${translate(upError.message)}`);
      mime = file.type || 'application/octet-stream';
      size = file.size;
      fileName = file.name;
    }

    const row = {
      id,
      class_id: classId,
      title,
      description: description || '',
      chapter: chapter || '',
      kind: linkUrl ? 'link' : 'file',
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mime,
      size_bytes: size,
      link_url: linkUrl || null,
      status: status || 'published',
      published_at: (status || 'published') === 'published' ? new Date().toISOString() : null,
      allow_download: allowDownload !== false,
      created_by: profile.id,
    };

    const { data, error } = await sb.from('contents').insert(row).select('*').single();
    if (error) {
      if (storagePath) await sb.storage.from('contents').remove([storagePath]);
      throw new Error(translate(error.message));
    }
    return { ...data, fileName, mimeType: mime, sizeBytes: size, allowDownload: row.allow_download, hasFile: true };
  },

  async updateContentStatus(id, status) {
    const patch = { status, published_at: status === 'published' ? new Date().toISOString() : null };
    const { data, error } = await sb.from('contents').update(patch).eq('id', id).select('*').single();
    if (error) throw new Error(translate(error.message));
    return data;
  },

  async deleteContent(content) {
    if (content.storage_path) {
      await sb.storage.from('contents').remove([content.storage_path]);
    }
    const { error } = await sb.from('contents').delete().eq('id', content.id);
    if (error) throw new Error(translate(error.message));
  },

  async contentUrl(content) {
    if (content.link_url) return content.link_url;
    if (!content.storage_path) return null;
    const { data, error } = await sb.storage.from('contents').createSignedUrl(content.storage_path, 3600);
    if (error) throw new Error(translate(error.message));
    return data.signedUrl;
  },

  /* -------------------------------------------------------- discussion */
  async listThreads(classId) {
    const { data: threads, error } = await sb
      .from('threads')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(translate(error.message));
    if (!threads || threads.length === 0) return [];

    const ids = threads.map((t) => t.id);
    const { data: posts } = await sb.from('posts').select('thread_id, created_at').in('thread_id', ids);
    const authorIds = [...new Set(threads.map((t) => t.created_by))];
    const { data: authors } = await sb.from('profiles').select('id, full_name').in('id', authorIds);
    const nameById = Object.fromEntries((authors || []).map((a) => [a.id, a.full_name]));

    return threads
      .map((t) => {
        const mine = (posts || []).filter((p) => p.thread_id === t.id);
        const last = mine.map((p) => p.created_at).sort().pop();
        return {
          ...t,
          author_name: nameById[t.created_by] || 'Enseignant',
          posts_count: mine.length,
          last_post_at: last || t.created_at,
        };
      })
      .sort((a, b) => Number(b.is_announcement) - Number(a.is_announcement)
        || String(b.last_post_at).localeCompare(String(a.last_post_at)));
  },

  async getThread(threadId) {
    const { data: thread, error } = await sb.from('threads').select('*').eq('id', threadId).single();
    if (error) throw new Error(translate(error.message));

    const { data: posts, error: postError } = await sb
      .from('posts')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (postError) throw new Error(translate(postError.message));

    const authorIds = [...new Set((posts || []).map((p) => p.author_id))];
    let nameById = {};
    let roleById = {};
    if (authorIds.length) {
      const { data: authors } = await sb.from('profiles').select('id, full_name, role').in('id', authorIds);
      nameById = Object.fromEntries((authors || []).map((a) => [a.id, a.full_name]));
      roleById = Object.fromEntries((authors || []).map((a) => [a.id, a.role]));
    }

    return {
      thread,
      posts: (posts || []).map((p) => ({
        ...p,
        author_name: nameById[p.author_id] || 'Utilisateur',
        author_role: roleById[p.author_id] || 'student',
      })),
    };
  },

  async createThread({ classId, title, isAnnouncement }) {
    const { data, error } = await sb
      .from('threads')
      .insert({ class_id: classId, title, is_announcement: Boolean(isAnnouncement), created_by: profile.id })
      .select('*')
      .single();
    if (error) throw new Error(translate(error.message));
    return data;
  },

  async addPost({ threadId, body }) {
    const { data, error } = await sb
      .from('posts')
      .insert({ thread_id: threadId, author_id: profile.id, body })
      .select('*')
      .single();
    if (error) throw new Error(translate(error.message));
    return { ...data, author_name: profile.full_name, author_role: profile.role };
  },

  /* ----------------------------------------------------------- planning */
  async listEvents(classId) {
    const { data, error } = await sb
      .from('events')
      .select('*')
      .eq('class_id', classId)
      .order('starts_at', { ascending: true });
    if (error) throw new Error(translate(error.message));
    return data || [];
  },

  async createEvent(input) {
    const { data, error } = await sb
      .from('events')
      .insert({
        class_id: input.classId,
        title: input.title,
        description: input.description || '',
        kind: input.kind || 'session',
        starts_at: new Date(input.startsAt).toISOString(),
        ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
        location: input.location || '',
        created_by: profile.id,
      })
      .select('*')
      .single();
    if (error) throw new Error(translate(error.message));
    return data;
  },

  async deleteEvent(id) {
    const { error } = await sb.from('events').delete().eq('id', id);
    if (error) throw new Error(translate(error.message));
  },

  async stats() {
    const classes = await this.listClasses();
    const ids = new Set(classes.map((c) => c.id));
    const students = profile.role === 'teacher'
      ? classes.reduce((sum, c) => sum + (c.students_count || 0), 0)
      : 0;
    const contents = classes.reduce((sum, c) => sum + (c.contents_count || 0), 0);

    let upcoming = [];
    if (ids.size) {
      const { data } = await sb
        .from('events')
        .select('*, classes(name, color)')
        .in('class_id', [...ids])
        .gte('starts_at', new Date(Date.now() - 3600000).toISOString())
        .order('starts_at', { ascending: true })
        .limit(6);
      upcoming = data || [];
    }
    return { classes: classes.length, students, contents, upcoming };
  },
};

function state_url() { return window.__MYCLASSROOM_URL__; }
function state_key() { return window.__MYCLASSROOM_KEY__; }
