/**
 * GET /api/config
 * Expose la configuration publique nécessaire au navigateur.
 * La clé « anon » est publique par conception ; la clé de service n'est jamais exposée.
 */
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';

  res.status(200).json({
    configured: Boolean(url && anonKey),
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    studentEmailDomain: process.env.STUDENT_EMAIL_DOMAIN || 'eleves.myclassroom.app',
    appName: process.env.APP_NAME || 'Myclassroom',
  });
};
