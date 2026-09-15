# Hydrologie et ouvrages hydrauliques

Site de cours pour le génie civil : polycopié, cours interactif, exercices,
entraînements, examens et exerciseurs. Application web **statique** et PWA —
aucun framework, aucune compilation.

## Déploiement — Cloudflare Pages

| Réglage | Valeur |
|---|---|
| Framework preset | **None** |
| Build command | *(vide)* |
| Build output directory | **`/`** |
| Branche de production | `main` |

Domaine personnalisé : `hyd.ksr-infra.org`. La zone `ksr-infra.org` étant déjà chez
Cloudflare, l'enregistrement DNS et le certificat sont créés automatiquement lors de
l'ajout du domaine au projet Pages.

## Architecture

```
index.html          accueil : ressources et grille des chapitres
cours.html          cours interactif (figures, cartes, encadrés)
exerciseur.html     calculateur de débit de projet
src/app.js          navigation, rendu de l'accueil et des chapitres
src/exerciseur.js   saisie, enchaînement et affichage des motifs d'exclusion
src/solvers-hydro.js  toutes les formules et les tables régionales (pur, testé)
data/chapitres.json   plan du cours : parties, chapitres, notions
assets/             icône et cartes
docs/               polycopié (PDF)
tests/              contrôles numériques des solveurs
sw.js, manifest     installation et fonctionnement hors connexion
styles.css, enhancements.css   feuilles communes avec le site de mécanique des fluides
site.css            compléments propres à ce site
```

Pour ajouter un chapitre, le déclarer dans `data/chapitres.json` : l'accueil et le
sommaire du cours se mettent à jour seuls. Pour ajouter une méthode de calcul, écrire
la fonction dans `src/solvers-hydro.js`, son test dans `tests/`, puis la brancher dans
`src/exerciseur.js` avec **son domaine de validité et son motif d'exclusion**.

## Principes de rédaction

Une méthode qui ne s'applique pas doit dire **pourquoi** — *hors zone*, *hors domaine*
ou *hors table* : une case vide sans motif est un défaut, pas un résultat. Les domaines
de validité sont portés par le code, pas seulement par le texte.

## Développement

```text
npm test          # contrôles numériques des solveurs
npm run serve     # site en local
```

---

École Nationale d'Ingénieurs de Sfax — Dr Ahmed Ksentini
