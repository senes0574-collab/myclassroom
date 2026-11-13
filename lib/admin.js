/**
 * Helpers serveur pour les fonctions Vercel.
 * Aucune dépendance : appels HTTP directs à l'API Supabase (Node 18+).
 */

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY || '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const STUDENT_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || 'eleves.myclassroom.app';

const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function makePassword(length = 10) {
  const bytes = require('crypto').randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
  }
  return out;
}

function isConfigured() {
  return Boolean(URL_BASE && ANON && SERVICE);
}

async function api(path, { method = 'GET', token, body, service = false, headers = {} } = {}) {
  const key = service ? SERVICE : ANON;
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

/** Identifie l'appelant à partir du jeton Bearer. */
async function caller(req) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { ok, data } = await api('/auth/v1/user', { token });
  if (!ok || !data || !data.id) return null;
  return { id: data.id, email: data.email, token };
}

/** Vérifie que l'appelant est propriétaire de la classe. */
async function ownsClass(classId, userId) {
  const { ok, data } = await api(
    `/rest/v1/classes?id=eq.${encodeURIComponent(classId)}&owner_id=eq.${encodeURIComponent(userId)}&select=id`,
    { service: true },
  );
  return ok && Array.isArray(data) && data.length === 1;
}

async function usernameTaken(username) {
  const { ok, data } = await api(
    `/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id`,
    { service: true },
  );
  return ok && Array.isArray(data) && data.length > 0;
}

async function createStudent({ username, fullName, password }) {
  const email = `${username}@${STUDENT_DOMAIN}`;
  const pwd = password || makePassword(10);

  const { ok, status, data } = await api('/auth/v1/admin/users', {
    method: 'POST',
    service: true,
    body: {
      email,
      password: pwd,
      email_confirm: true,
      user_metadata: { role: 'student', username, full_name: fullName },
    },
  });

  if (!ok) {
    return { ok: false, status, error: data && (data.msg || data.message || data.error) };
  }

  const profileId = data.id;
  // Le profil est normalement créé par le trigger ; on s'assure qu'il existe.
  await api('/rest/v1/profiles', {
    method: 'POST',
    service: true,
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: [{ id: profileId, role: 'student', username, full_name: fullName }],
  });

  return { ok: true, userId: profileId, email, password: pwd };
}

async function enroll(classId, studentId) {
  return api('/rest/v1/enrollments', {
    method: 'POST',
    service: true,
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: [{ class_id: classId, student_id: studentId }],
  });
}

async function setPassword(userId, password) {
  return api(`/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    service: true,
    body: { password },
  });
}

async function findStudentByUsername(username) {
  const { ok, data } = await api(
    `/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id,role,username`,
    { service: true },
  );
  if (!ok || !Array.isArray(data) || data.length === 0) return null;
  return data[0];
}

/** Vrai si l'élève est inscrit dans au moins une classe de l'enseignant. */
async function studentBelongsToTeacher(studentId, teacherId) {
  const { ok, data } = await api(
    `/rest/v1/enrollments?student_id=eq.${encodeURIComponent(studentId)}&select=class_id,classes!inner(owner_id)`,
    { service: true },
  );
  if (!ok || !Array.isArray(data)) return false;
  return data.some((row) => row.classes && row.classes.owner_id === teacherId);
}

module.exports = {
  isConfigured,
  caller,
  ownsClass,
  usernameTaken,
  createStudent,
  enroll,
  setPassword,
  findStudentByUsername,
  studentBelongsToTeacher,
  makePassword,
  STUDENT_DOMAIN,
};
