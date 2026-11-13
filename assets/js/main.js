/* =====================================================================
   Myclassroom — amorçage : configuration, choix du magasin, routage.
   ===================================================================== */

import { state, toast, parseHash } from './core.js';
import { demoStore } from './store-demo.js';
import { supabaseStore } from './store-supabase.js';
import * as views from './views.js';

window.__myclassroomToast = toast;

async function loadConfig() {
  const candidates = ['/api/config', 'config.json'];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const json = await res.json();
      if (json && json.supabaseUrl && json.supabaseAnonKey) {
        return {
          configured: true,
          supabaseUrl: json.supabaseUrl,
          supabaseAnonKey: json.supabaseAnonKey,
          studentEmailDomain: json.studentEmailDomain || 'eleves.myclassroom.app',
          appName: json.appName || 'Myclassroom',
        };
      }
    } catch {
      /* on essaie le suivant */
    }
  }
  return null;
}

async function boot() {
  const config = await loadConfig();

  if (config) {
    state.config = { ...state.config, ...config };
    window.__MYCLASSROOM_URL__ = config.supabaseUrl;
    window.__MYCLASSROOM_KEY__ = config.supabaseAnonKey;
    window.__MYCLASSROOM_DOMAIN__ = config.studentEmailDomain;
    state.api = supabaseStore;
    try {
      await supabaseStore.init();
    } catch (err) {
      console.error('Supabase indisponible', err);
      state.api = demoStore;
      setTimeout(() => toast('Supabase injoignable : mode démonstration activé.', 'err', 7000), 600);
    }
  } else {
    state.api = demoStore;
  }

  await state.api.init();
  state.api.onAuthChange(() => {
    state.user = state.api.currentUser();
    render();
  });
  state.user = state.api.currentUser();
  state.ready = true;

  // Raccourci de démonstration : ?demo=prof.diallo ou ?demo=eleve01
  const demoAs = new URLSearchParams(location.search).get('demo');
  if (demoAs && state.api.mode === 'demo' && !state.user) {
    try {
      await state.api.signIn({ identifier: demoAs, password: 'demo' });
    } catch (err) {
      console.warn('Connexion de démonstration impossible', err);
    }
  }

  document.getElementById('boot')?.remove();
  const app = document.getElementById('app');
  app.hidden = false;

  if (!location.hash) location.hash = '#/';
  window.addEventListener('hashchange', render);
  render();
}

function render() {
  const raw = (location.hash || '').replace(/^#\/?/, '');

  try {
    if (!state.user) {
      views.renderAuth(raw === 'signup' ? 'signup' : 'login');
      return;
    }
    if (raw === 'login' || raw === 'signup') {
      location.hash = '#/';
      return;
    }

    state.route = parseHash();
    const run = {
      home: views.renderHome,
      classes: views.renderClasses,
      class: views.renderClass,
      thread: views.renderThread,
    }[state.route.name] || views.renderHome;

    Promise.resolve(run()).catch((err) => {
      console.error(err);
      toast(err?.message || 'Erreur de chargement.', 'err');
    });
  } catch (err) {
    console.error(err);
    toast(err?.message || 'Erreur inattendue.', 'err');
  }
}

boot().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.innerHTML = `<div style="max-width:420px;padding:20px"><h2 style="font-family:Georgia,serif">Myclassroom</h2><p style="color:#c7d6e6">${String(err.message || err)}</p></div>`;
});
