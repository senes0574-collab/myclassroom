/**
 * POST /api/reset-password
 * Réinitialise le mot de passe d'un élève inscrit dans une classe de l'enseignant.
 * Body : { username } ou { studentId }
 */
const admin = require('../lib/admin');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });
  if (!admin.isConfigured()) {
    return res.status(503).json({ error: 'Supabase n’est pas configuré sur ce déploiement.' });
  }

  const me = await admin.caller(req);
  if (!me) return res.status(401).json({ error: 'Session invalide. Reconnectez-vous.' });

  const { username, studentId } = req.body || {};

  let target = null;
  if (studentId) {
    target = { id: studentId };
  } else if (username) {
    target = await admin.findStudentByUsername(String(username).trim().toLowerCase());
  }
  if (!target || !target.id) return res.status(404).json({ error: 'Élève introuvable.' });
  if (target.role && target.role !== 'student') {
    return res.status(400).json({ error: 'Seuls les comptes élèves peuvent être réinitialisés ici.' });
  }

  const allowed = await admin.studentBelongsToTeacher(target.id, me.id);
  if (!allowed) return res.status(403).json({ error: 'Cet élève n’appartient à aucune de vos classes.' });

  const password = admin.makePassword(10);
  const updated = await admin.setPassword(target.id, password);
  if (!updated.ok) return res.status(400).json({ error: 'Réinitialisation impossible.' });

  return res.json({ password, username: target.username || username });
};
