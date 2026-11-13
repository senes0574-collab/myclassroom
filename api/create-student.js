/**
 * POST /api/create-student
 * Crée un compte élève et l'inscrit dans une classe.
 * Réservé au propriétaire de la classe.
 */
const admin = require('../lib/admin');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }
  if (!admin.isConfigured()) {
    return res.status(503).json({ error: 'Supabase n’est pas configuré sur ce déploiement.' });
  }

  const me = await admin.caller(req);
  if (!me) return res.status(401).json({ error: 'Session invalide. Reconnectez-vous.' });

  const { classId, fullName, username, password } = req.body || {};

  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanName = String(fullName || '').trim();

  if (!classId) return res.status(400).json({ error: 'Classe manquante.' });
  if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(cleanUser)) {
    return res.status(400).json({
      error: 'Identifiant invalide : 3 à 24 caractères, lettres, chiffres, point, tiret ou souligné.',
    });
  }
  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'Le nom de l’élève est trop court.' });
  }
  if (password && String(password).length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  const owns = await admin.ownsClass(classId, me.id);
  if (!owns) return res.status(403).json({ error: 'Vous ne gérez pas cette classe.' });

  if (await admin.usernameTaken(cleanUser)) {
    return res.status(409).json({ error: `L’identifiant « ${cleanUser} » est déjà utilisé.` });
  }

  try {
    const created = await admin.createStudent({
      username: cleanUser,
      fullName: cleanName,
      password: password ? String(password) : undefined,
    });

    if (!created.ok) {
      return res.status(400).json({ error: created.error || 'Création du compte impossible.' });
    }

    await admin.enroll(classId, created.userId);

    return res.status(201).json({
      student: {
        id: created.userId,
        username: cleanUser,
        fullName: cleanName,
        password: created.password,
        email: created.email,
      },
    });
  } catch (err) {
    console.error('create-student', err);
    return res.status(500).json({ error: 'Erreur inattendue lors de la création du compte.' });
  }
};
