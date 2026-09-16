// Socle commun à toutes les pages : dire quand ça casse, et tenir le service
// worker à jour.
//
// Deux pannes vécues, toutes deux invisibles depuis le téléphone d'un étudiant :
//
//  · un module qui jette à son niveau supérieur laisse la page en place et ses
//    figures vides. Rien ne s'affiche, rien ne se dit, et la console n'est pas
//    ouvrable sur un iPhone. D'où la bannière ci-dessous.
//  · le service worker ne s'enregistrait que depuis l'accueil. Un lecteur qui
//    ouvre le cours directement — marque-page, écran d'accueil — gardait
//    indéfiniment l'ancienne version, avec ses anciens défauts. D'où
//    l'enregistrement depuis chaque page.

const VERSION_ATTENDUE = "hyd-v17";

function banniere(titre, detail) {
  let boite = document.getElementById("bandeau-panne");
  if (!boite) {
    boite = document.createElement("div");
    boite.id = "bandeau-panne";
    boite.setAttribute("role", "alert");
    boite.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:100;"
      + "padding:12px 14px;border-radius:12px;background:#7f1d1d;color:#fff;"
      + "font:14px/1.45 Inter,-apple-system,system-ui,sans-serif;"
      + "box-shadow:0 10px 30px #0006;max-height:45vh;overflow:auto";
    boite.addEventListener("click", () => boite.remove());
    document.body.appendChild(boite);
  }
  const ligne = document.createElement("div");
  ligne.style.marginTop = boite.childElementCount ? "8px" : "0";
  ligne.innerHTML = `<strong>${titre}</strong><br>
    <span style="font-size:13px;opacity:.95">${detail}</span>`;
  boite.appendChild(ligne);
}

const echappe = (s) => String(s).replace(/[&<>]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// La version RÉELLEMENT en service, demandée au worker qui sert la page. Sans
// elle, impossible de savoir à distance si un téléphone tourne encore sur une
// version périmée — et c'est la première question à poser.
let versionServie = null;
if (navigator.serviceWorker?.controller) {
  const canal = new MessageChannel();
  canal.port1.onmessage = (e) => { versionServie = e.data?.version ?? null; };
  try {
    navigator.serviceWorker.controller.postMessage({ type: "version" }, [canal.port2]);
  } catch { /* un worker trop ancien ne répondra pas : c'est déjà une réponse */ }
}

/** Ce qu'il faut savoir pour diagnostiquer à distance, en une ligne. */
export function diagnostic() {
  const sw = navigator.serviceWorker?.controller;
  return [
    `page ${location.pathname.split("/").pop() || "index.html"}`,
    `écran ${window.innerWidth}×${window.innerHeight}`,
    sw ? `service worker ${versionServie ?? "version inconnue (ancienne)"}` : "sans service worker",
    `attendu ${VERSION_ATTENDUE}`,
  ].join(" · ");
}

window.addEventListener("error", (e) => {
  // Les erreurs de chargement de ressource portent un `target` et pas de message.
  if (e.target && e.target !== window && e.target.tagName)
    return banniere("Une ressource n'a pas pu être chargée",
      `${echappe(e.target.tagName.toLowerCase())} — ${echappe(e.target.src || e.target.href || "")}
       <br><small>${echappe(diagnostic())}</small>`);
  banniere("Une partie de la page n'a pas pu s'exécuter",
    `${echappe(e.message || "erreur inconnue")}<br><small>${echappe(diagnostic())}</small>`);
}, true);

window.addEventListener("unhandledrejection", (e) => {
  banniere("Un chargement a échoué",
    `${echappe(e.reason?.message || e.reason || "raison inconnue")}
     <br><small>${echappe(diagnostic())}</small>`);
});

// ── Service worker : l'enregistrer partout, et ne pas rester sur l'ancien ──
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      // Une version en attente signifie que le navigateur garde l'ancienne.
      // On la pousse : sans cela, un onglet iOS jamais fermé conserve des mois
      // durant un service worker qu'on a corrigé depuis longtemps.
      reg.addEventListener("updatefound", () => {
        const neuf = reg.installing;
        neuf?.addEventListener("statechange", () => {
          if (neuf.state === "installed" && navigator.serviceWorker.controller) {
            // Nouvelle version prête alors qu'une ancienne sert encore.
            neuf.postMessage({ type: "prendre-la-main" });
          }
        });
      });
      reg.update().catch(() => {});
    } catch { /* pas de service worker : le site marche quand même, en ligne */ }
  });

  // Quand une NOUVELLE version prend la main, on recharge une fois pour que la
  // page soit servie par elle. À la toute première installation il n'y a rien à
  // remplacer : recharger serait un aller-retour gratuit sous les yeux du
  // lecteur.
  const avaitUnControleur = !!navigator.serviceWorker.controller;
  let recharge = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recharge || !avaitUnControleur) return;
    recharge = true;
    location.reload();
  });
}
