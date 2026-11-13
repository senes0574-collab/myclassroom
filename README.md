# Myclassroom — plateforme de classe virtuelle

Application web où un enseignant crée ses classes, publie ses supports (PDF, Word,
PowerPoint, images), tient son planning et anime les échanges. Les élèves se connectent avec
les identifiants créés par l'enseignant et accèdent uniquement aux classes où ils sont inscrits.

- **Front** : HTML/CSS/JavaScript natifs (modules ES), aucune étape de build.
- **Hébergement** : Vercel (site statique + fonctions serverless dans `api/`).
- **Base et authentification** : Supabase (PostgreSQL, Auth, Storage) avec sécurité RLS.
- **Code** : pensez à le publier sur GitHub, puis à connecter le dépôt à Vercel.

---

## 1. Essayer en local, sans rien configurer

L'application bascule automatiquement en **mode démonstration** lorsque Supabase n'est pas
configuré : les données sont alors stockées dans le navigateur (`localStorage`), avec deux
classes, dix élèves, des contenus et des échanges prêts à l'emploi.

```bash
node scripts/serve.mjs        # http://127.0.0.1:4173
```

Comptes de démonstration :

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Enseignant | `prof.diallo` | n'importe lequel |
| Élève | `eleve01` … `eleve08` | n'importe lequel |

Raccourcis : `?demo=prof.diallo` ou `?demo=eleve01` ouvrent directement la session.

---

## 2. Mettre en production

### 2.1 Créer la base Supabase

1. Créez un projet sur [supabase.com](https://supabase.com) (choisissez une région UE).
2. Ouvrez **SQL Editor**, collez le contenu de [`supabase/schema.sql`](supabase/schema.sql)
   et exécutez-le. Le script crée les tables, les règles de sécurité (RLS), le bucket de
   stockage privé `contents`, les fonctions d'aide et le trigger de création de profil.
3. Récupérez dans **Project Settings → API** :
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` *(secret absolu, jamais dans le navigateur)*

### 2.2 Déployer sur Vercel

1. Poussez ce dossier sur un dépôt GitHub.
2. Sur Vercel : **Add New → Project**, importez le dépôt.
3. Framework preset : **Other**. Aucune commande de build n'est nécessaire.
4. Ajoutez les variables d'environnement (Production + Preview) :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `SUPABASE_URL` | oui | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | oui | Clé publique, utilisée par le navigateur |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | Création des comptes élèves (fonctions `api/`) |
| `STUDENT_EMAIL_DOMAIN` | non | Domaine technique des élèves (`eleves.myclassroom.app` par défaut) |
| `APP_NAME` | non | Nom affiché (`Myclassroom` par défaut) |

5. Redéployez. Le site est en ligne ; `/api/config` expose au navigateur l'URL et la clé
   publique, jamais la clé de service.

### 2.3 Créer le premier enseignant

Sur la page de connexion, cliquez sur **Créer un compte**. Le compte est créé via Supabase
Auth avec le rôle `teacher`.

> En production, pensez à désactiver les inscriptions publiques
> (**Authentication → Providers → Email → Disable signup**) une fois les enseignants créés,
> puis à créer les comptes suivants depuis le tableau de bord Supabase.

---

## 3. Ce que fait l'application

| Module | Enseignant | Élève |
|---|---|---|
| Connexion | e-mail + mot de passe | identifiant court + mot de passe |
| Classes | crée, code unique, couleur, année | voit ses classes |
| Contenus | dépose PDF/Word/PPT/images ou liens, chapitre, brouillon ou publié, autorise ou non le téléchargement | consulte, prévisualise, télécharge si autorisé |
| Discussion | ouvre des fils, publie des annonces épinglées, modère | répond, pose des questions |
| Planning | crée séances et échéances, supprime | consulte |
| Élèves | crée les comptes, réinitialise les mots de passe, retire un élève, exporte en CSV | — |

La règle structurante du cahier des charges est appliquée **en base**, pas seulement dans
l'interface : un contenu ne peut être créé, modifié ou supprimé que par le propriétaire de la
classe (politiques RLS de `supabase/schema.sql`).

---

## 4. Structure du projet

```
index.html                 coquille de l'application (SPA à routage par ancre)
assets/css/styles.css      design system complet
assets/js/core.js          DOM, icônes, modales, formatage, routage
assets/js/views.js         écrans : connexion, tableau de bord, classe, discussion
assets/js/store-demo.js    magasin local (démonstration, sans serveur)
assets/js/store-supabase.js magasin Supabase (Auth, REST, Storage)
assets/js/main.js          amorçage et choix du magasin
api/config.js              configuration publique (URL + clé anon)
api/create-student.js      création d'un compte élève (clé de service)
api/reset-password.js      réinitialisation d'un mot de passe élève
lib/admin.js               appels HTTP à l'API Supabase, contrôle des droits
supabase/schema.sql        tables, RLS, stockage, trigger de profil
scripts/serve.mjs          serveur statique local (sans dépendance)
scripts/test-demo-pdf.mjs  validateur du PDF généré en démonstration
docs/                      cahier des charges (PDF) et captures
```

---

## 5. Sécurité

- La clé `service_role` n'est utilisée que dans `api/` et `lib/`, côté serveur ; elle n'est
  jamais envoyée au navigateur ni exposée par `/api/config`.
- Chaque fonction `api/` vérifie le jeton de l'appelant auprès de Supabase, puis que
  l'appelant est bien propriétaire de la classe concernée.
- Les mots de passe élèves sont générés aléatoirement (10 caractères, alphabet sans
  ambiguïté) et affichés une seule fois.
- Le bucket `contents` est privé : les fichiers sont servis par URL signée d'une heure.
- Toutes les entrées sont échappées à l'affichage (construction DOM, pas de `innerHTML`
  avec des données utilisateur).
- En-têtes de sécurité définis dans `vercel.json`.

---

## 6. Limites connues de cette version

- **Word et PowerPoint** ne sont pas prévisualisables dans un navigateur : la fiche propose
  le téléchargement. Une conversion serveur (LibreOffice headless, CloudConvert) est la
  suite logique ; elle n'est pas disponible sur Vercel en plan standard.
- **Devoirs et notes** ne sont pas encore développés (voir cahier des charges, module M6).
- Les notifications par e-mail et les rappels automatiques ne sont pas branchés.
- Pas de messagerie temps réel : la discussion est asynchrone, conformément à la v1 du
  cahier des charges.

---

## 7. Scripts utiles

```bash
node scripts/serve.mjs           # serveur local
node scripts/test-demo-pdf.mjs   # vérifie le PDF de démonstration
```

Aucune dépendance à installer : le projet n'utilise que des modules natifs du navigateur et
de Node 18+.
