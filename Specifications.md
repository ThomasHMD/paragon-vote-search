# Paragon Vote Search — Spécifications techniques
# Spécifications Fonctionnelles et Techniques - Paragon Vote Search

Dernière mise à jour : 2026-06-09 (intégration cycle 2021-2024)
## 1. Présentation du projet
**Nom de l'application :** Paragon Vote Search
**Objectif :** Moteur de recherche et outil de prospection B2B ciblant les entreprises ayant organisé des élections professionnelles. L'outil permet d'identifier rapidement les entreprises dont les mandats arrivent à échéance afin de les contacter au bon moment pour des actions commerciales.
**Hébergement / URL :** GitHub Pages (https://thomashmd.github.io/paragon-vote-search/)

## Vue d'ensemble
## 2. Architecture et Sécurité
- **Architecture 100% Client :** L'intégralité de l'application fonctionne côté client dans le navigateur web. Il n'y a aucune composante backend métier exploitée en temps réel.
- **Confidentialité (Privacy by design) :** Aucune requête ou donnée de recherche n'est envoyée à un serveur tiers. Les recherches de l'utilisateur et les exports restent strictement privés.

Outil de prospection commerciale basé sur les données publiques des élections professionnelles en France (cycle 2021-2024, source data.gouv.fr). Permet de rechercher, filtrer et exporter les entreprises ayant organisé des élections, avec estimation de la date de prochaine élection par projection des mandats.
## 3. Données
- **Source primaire :** Données ouvertes issues de *data.gouv.fr*.
- **Périmètre :** Base de données couvrant ~124 400 entreprises ayant organisé des élections professionnelles sur le cycle 2021-2024. Toutes les instances sont des **CSE** (le CSE a fusionné CE/DP/DU depuis 2020).
- **Traitement des dates :** Les dates de "prochaines élections" ne sont pas des données officielles confirmées, mais des projections calculées (Date du dernier scrutin + durée du mandat).
- **Effectif estimé :** Le cycle 2021-2024 ne publie plus la colonne `effectif` (100 % vide). L'effectif affiché est donc **estimé à partir du nombre d'inscrits** (≈ électeurs ≈ salariés), signalé par `~` et le flag `effEstime`. Voir `meta.effectifProxy`.
- **Limites techniques connues :** 
  - Pas de mise à jour automatique du jeu de données (figé sur le cycle 2021-2024).
  - Obsolescence possible des informations inhérente à la vie des entreprises (fusions, liquidations, changements de structure depuis le dernier cycle d'élection).

**URL** : https://thomashmd.github.io/paragon-vote-search/
**Repo** : https://github.com/ThomasHMD/paragon-vote-search
## 4. Fonctionnalités Principales

Architecture 100% statique : HTML/CSS/JS vanilla, aucun backend, aucune dépendance npm au runtime. Les données sont pré-traitées en Python puis servies en JSON.
### 4.1. Moteur de recherche et Filtrage
- **Recherche Full-text :** Recherche multicritère immédiate via une barre de recherche unique (Nom d'entreprise, SIRET, Ville).
- **Filtres avancés (100% combinables) :**
  - Département
  - Code NAF
  - Type d'institution (CSE, CE, DP, DU) avec possibilité de multi-sélection inclusive (ex: CSE + DP simultanément).
  - Tranche d'effectif
  - Année d'élection
  - Urgence de l'élection
  - Présence syndicale

---
### 4.2. Visualisation des données (Data Viz)
- **Graphique interactif :** Affichage sous forme de barres empilées du volume d'élections mois par mois, projeté sur les 12 prochains mois.
- **Interactivité du graphique :** Le clic sur un mois spécifique filtre dynamiquement les résultats sur cette seule période. Un second clic annule le filtre et restaure la vue globale.
- **Bandeau d'urgence :** En-tête rouge "Élections imminentes" incluant un bouton "Voir les urgentes" pour afficher instantanément les entreprises dont le mandat se termine dans les 12 mois.

## Sources de données
### 4.3. Interface de consultation (Fiches Entreprises)
- **Affichage des résultats :** Liste paginée de cartes interactives (20 résultats affichés par page par défaut).
- **Fiche détaillée (Ouverture au clic) :** Contient les informations enrichies de la cible :
  - Informations légales : Adresse complète, Effectif.
  - Historique des scrutins.
  - Durée des mandats.
  - Taux de participation au dernier scrutin.
  - Syndicats présents.
  - Nombre d'élus.
- **Raccourci de qualification :** Bouton "in" (bleu) placé à côté du nom de l'entreprise qui génère et ouvre directement une recherche ciblée sur LinkedIn dans un nouvel onglet.

### Fichiers Excel d'entrée (non versionnés, dans `.gitignore`)
### 4.4. Outils de prospection (Panier et Export)
- **Sélection (Panier dynamique) :**
  - **Ajout unitaire :** Via un bouton d'action `+` situé en haut à gauche de chaque carte.
  - **Ajout groupé (Page) :** Bouton "Sélectionner la page" pour ajouter d'un clic les 20 résultats en cours de lecture.
  - **Ajout en masse :** Bouton "Tout sélectionner" pour l'intégralité des résultats répondant aux filtres actifs (attention à l'impact performance/mémoire si le volume dépasse les 50 000 entrées).
- **Tracking utilisateur :** Une barre de statut fixée en bas de l'écran comptabilise et indique en temps réel le nombre d'entreprises présentes dans le panier.
- **Export CSV :**
  - Fonction déclenchée depuis la barre de statut inférieure.
  - Format de sortie optimisé pour MS Excel : Séparateur point-virgule (`;`), encodage `UTF-8`.
  - **13 colonnes standardisées :** Nom, SIRET, Adresse, CP, Ville, Département, Code NAF, Effectif, IDCC, Prochaine élection, Urgence, Syndicats, Lien LinkedIn.

| Fichier | Contenu |
|---------|---------|
| `1-description-fichiers.xlsx` | Documentation des champs |
| `2-tour-1-avec-et-sans-ano-bloq.xlsx` (~103 Mo) | Résultats Tour 1 — toutes les lignes de vote (un par syndicat × collège × élection) |
| `3-tour-2-avec-et-sans-ano-bloq.xlsx` (~84 Mo) | Résultats Tour 2 — même structure |
| `4-syndicats-confederations.xlsx` | Table de référence `codsyndicat` → `libconfederation` |
| `5-fichier-siret-t1-1.xlsx` | SIRET associés par numéro d'élection |

Source : https://www.data.gouv.fr — Élections professionnelles (cycle 2021-2024, publié mai 2026).
Fichiers bruts dans `NewData/` (préfixe `20260327-`). Le pipeline lit ce dossier via `SOURCE_DIR` / `SRC_*` en tête de `scripts/preprocess.py`.

### Fichiers JSON générés (dans `data/`, versionnés)

| Fichier | Contenu |
|---------|---------|
| `meta.json` | Métadonnées : nombre total d'entreprises, nombre de chunks, date de génération |
| `facets.json` | Valeurs de facettes avec compteurs (départements, NAF, institutions, années, effectifs, urgences, syndicats) |
| `search-docs.json` | Documents allégés pour MiniSearch (id, nom, ville, siret, cp, dep, naf) |
| `companies-00.json` à `companies-25.json` | Chunks de 5 000 entreprises chacun (26 fichiers, ~66 Mo total) |

---

## Pipeline de données (`scripts/preprocess.py`)

### Étapes

1. **Chargement** : lecture des deux fichiers Tour 1 et Tour 2, concaténation, filtre `statut == "VAL"` uniquement
2. **Table syndicats** : chargement du mapping `codsyndicat` → `libconfederation`
3. **Agrégation par SIRET** : pour chaque entreprise identifiée par son SIRET :
   - On récupère les infos de base (raison sociale, adresse, CP, ville, NAF, IDCC)
   - L'effectif retenu est le **max** trouvé dans toutes les lignes du SIRET
   - Les élections sont groupées par **institution** (CSE, CE, DP, DU)
   - Pour chaque institution, on garde l'**élection la plus récente** (date max)
   - Inscrits/votants/élus : somme sur les collèges, dédupliquée par `elenum + titulsuppl`
   - Syndicats : collectés via `codsyndicat` → confédération
4. **Écriture JSON** : chunks de 5 000, facettes, métadonnées, documents de recherche

### Calcul de la prochaine élection

Fonction `project_next_election(scrutin_date, duree_mandat, unite)` :
- Ajoute la durée du mandat (en années ou mois) à la date du scrutin
- Répète jusqu'à obtenir une date ≥ aujourd'hui
- Sécurité : max 20 itérations

### Calcul de l'urgence

Fonction `urgency_label(next_date)` — basée sur le nombre de jours entre aujourd'hui et la prochaine élection :

| Catégorie | Condition |
|-----------|-----------|
| `imminent` | ≤ 180 jours (6 mois) |
| `proche` | ≤ 365 jours (12 mois) |
| `planifie` | ≤ 730 jours (2 ans) |
| `lointain` | > 730 jours |
| `passe` | date dépassée (< 0 jours) |
| `inconnu` | pas de date |

L'urgence d'une entreprise est déterminée par sa **prochaine élection la plus proche** (min de toutes les `next` dates de ses élections).

### Calcul du compteur "Élections imminentes" (banner)

Calculé **côté frontend** (`app.js`) en comptant les entreprises dont `urgency` est `"imminent"` ou `"proche"`. C'est le même filtre que le bouton "Voir les urgentes" pour garantir la cohérence.

---

## Architecture frontend

### Fichiers

```
index.html          Page unique
styles.css          Tout le CSS (design neo-retro pixel)
app.js              Orchestrateur principal (chargement, événements, export CSV)
js/
  data-loader.js    Chargement progressif des JSON + cache IndexedDB
  search.js         Wrapper MiniSearch (recherche full-text)
  filters.js        Gestion des facettes (state, UI, apply)
  cart.js            Panier de sélection (Set en mémoire)
  chart.js          Graphique barres empilées (12 mois)
  render.js         Rendu des cards, modale, pagination, animation pièce
```

### Flux de données au chargement

1. `DataLoader.loadAll()` charge `meta.json`, vérifie le cache IndexedDB
2. Si cache valide (même `generatedAt`) → retourne les données cachées
3. Sinon : charge `facets.json` + `search-docs.json` en parallèle, puis les chunks séquentiellement avec barre de progression
4. Résultat mis en cache IndexedDB pour les prochaines visites
5. `Render.setCompaniesMap()` crée un dictionnaire id → company
6. `SearchEngine.init()` construit l'index MiniSearch en mémoire
7. `Filters.init()` peuple les selects et toggle buttons depuis les facettes
8. `applyAndRender()` lance le premier rendu

### Cycle de mise à jour (applyAndRender)

Appelée à chaque changement de recherche, filtre, tri ou clic sur le graphique :

```
searchInput.value → SearchEngine.search() → Set<id> ou null
                                              ↓
allCompanies → [filtre par search ids] → Filters.apply() → chartResults
                                                              ↓
                                                    [filtre par bin chart si actif]
                                                              ↓
                                                    sortResults() → Render.renderResults()
                                                                     Chart.render(chartResults)
```

Le graphique reçoit les résultats **avant** le filtre de bin, pour que les barres ne disparaissent pas quand on clique dessus.

### Cache IndexedDB

- Base : `paragon-vote-search`, store : `data`
- Clé `meta` : objet meta.json (pour vérifier la fraîcheur via `generatedAt`)
- Clé `allData` : `{ meta, facets, companies, searchDocs }` — tout le jeu de données

Si `meta.generatedAt` change (nouvelle génération des données), le cache est invalidé et tout est rechargé.

---

## Modules détaillés

### SearchEngine (`js/search.js`)

- Bibliothèque : **MiniSearch 7.1.1** (CDN)
- Champs indexés : `nom` (boost ×3), `siret` (×2), `ville` (×1.5), `cp` (×1)
- Options : fuzzy 0.2, prefix activé
- `search("")` retourne `null` (= pas de filtre), sinon un `Set<id>`

### Filters (`js/filters.js`)

Le module s'appuie sur un état interne complet mis à jour à chaque interaction :

| Clé | Type | Comportement détaillé |
|-----|------|-------------|
| `dep` | `string` | Menu déroulant. Affiche le département et son volume. Filtre par stricte égalité. |
| `naf` | `string` | Menu déroulant. Filtre via `startsWith` (2 premiers caractères). Un dictionnaire interne `nafLabels` traduit les codes numériques en libellés métiers (ex: `01` -> `Agriculture`). |
| `institution` | `Set` | Toggle buttons (Multi-select). Condition : l'entreprise doit avoir au moins une élection dont le type est dans la sélection. |
| `effectif` | `Set` | Toggle buttons (Multi-select). Mapping interne vers des bornes numériques pour le filtrage (ex: `1-49` -> `[1, 49]`, `1000+` -> `[1000, Infinity]`). |
| `anneeMin` / `anneeMax` | `string` | Sélecteurs de plage d'années. **Règle de correction automatique** : si l'utilisateur saisit une année Min supérieure à l'année Max (ou inversement), le script aligne automatiquement l'autre borne. Condition : au moins une élection `next` doit tomber dans la plage spécifiée. |
| `urgence` | `Set` | Toggle buttons (Multi-select). Les libellés sont enrichis d'emojis par le frontend (`⚡ Imminent`, `📅 Proche`, `📋 Planifié`, `🔮 Lointain`). Le module expose une fonction `setUrgence(values)` pour activer ce filtre par programmation (utilisé par le bandeau rouge d'urgence). |
| `syndicats` | `string\|null` | Toggle buttons (**Mono-select**). Se comporte comme des boutons radio : `"oui"` (au moins 1 syndicat), `"non"` (aucun syndicat), ou `null` (désactivé). |

**Mécanique de combinaison :**
La méthode `Filters.apply(companies)` évalue tous les filtres actifs en **AND logique** (cascade). Dès qu'un critère n'est pas respecté, l'entreprise est ignorée des résultats.

**API du module (Révélée via IIFE) :**
- `init(facets, onChange)` : Construction dynamique du DOM des filtres à partir du fichier `facets.json`.
- `apply(companies)` : Cœur du moteur de filtrage, boucle sur le jeu de données.
- `setUrgence(values)` : Permet de manipuler le filtre externe au DOM direct (ex: clic bandeau d'alerte).
- `getState()`, `hasActiveFilters()`, `resetAll()`.

### Cart (`js/cart.js`)

- `Set<id>` en mémoire (pas de persistance)
- API : `toggle(id)`, `has(id)`, `addArray(ids)`, `clear()`, `getIds()`, `count`
- Émet `CustomEvent("cart-updated")` sur `document` à chaque modification
- L'UI réagit via l'événement : mise à jour des checkboxes, compteurs, barre flottante

### Chart (`js/chart.js`)

- 12 barres, une par mois glissant à partir du mois courant
- Segments empilés par type d'institution (CSE bleu, DP coral, CE jaune, DU navy)
- Si un filtre institution est actif, seuls les types sélectionnés sont comptés dans les barres
- Clic sur une barre → filtre les résultats sur ce mois (événement `chart-bin-click`)
- Re-clic → désactive le filtre
- Barre active : contour bleu + label en gras
- Graduation Y : 4 niveaux auto-calculés

### Render (`js/render.js`)

- **Cards** : nom + bouton LinkedIn `in` + badges institution/urgence + infos + date prochaine élection + syndicats
- **Checkbox panier** : bouton `+`/`✓` en haut à gauche, classe `.card--selected` (bordure neon-blue)
- **Animation pièce** : au clic `+`, un disque doré CSS vole vers la barre panier avec spin 3D, sparkles et "+1" pop
- **Modale** : fiche complète avec historique élections (tableau), bouton "Rechercher sur LinkedIn →"
- **Pagination** : 20 résultats par page, navigation 7 pages visibles + ellipses

### Export CSV (`app.js`)

- Généré 100% côté client : `Blob` + `URL.createObjectURL` + `<a download>`
- BOM UTF-8 (`\uFEFF`) pour compatibilité Excel
- Séparateur `;` (convention Excel FR)
- Colonnes : Nom, SIRET, Adresse, CP, Ville, Département, Code NAF, Effectif, IDCC, Prochaine élection, Urgence, Syndicats, Lien LinkedIn
- Valeurs échappées avec double-quotes et `""` pour les guillemets internes
- Nom fichier : `paragon-export-YYYY-MM-DD.csv`

### Lien LinkedIn

Le terme **« Relations sociales » est ajouté systématiquement** aux mots-clés pour cibler les interlocuteurs RH/relations sociales (09/06/2026) :
```
https://www.linkedin.com/search/results/people/?keywords={NOM + ' "Relations sociales"' URL_ENCODED}&origin=SWITCH_SEARCH_VERTICAL
(guillemets autour de la phrase = recherche exacte côté LinkedIn ; le nom reste en mots-clés larges)
```

Présent sur chaque card (bouton `in` bleu) et dans la modale (bouton texte dans le header).

---

## Design

- **Style** : Neo-retro pixel art — fond clair, bordures nettes (0 border-radius), ombres portées
- **Polices** : `Press Start 2P` (titres pixel), `Inter` (corps)
- **Header** : fond noir (#141428), grille animée, ligne néon dégradée, corners brackets
- **Scanlines** : overlay très subtil en repeating-linear-gradient
- **Couleurs** : navy (#134d71), coral (#ff6b6b), neon-blue (#00a8e8), yellow (#f59e0b), lime (#10b981), purple (#8b5cf6)
- **Barre flottante panier** : sticky bottom, fond navy, apparaît quand le panier n'est pas vide

---

## Déploiement

- **GitHub Pages** via workflow Actions (`.github/workflows/pages.yml`)
- Déploiement automatique à chaque push sur `main`
- Pas de build step : les fichiers sont servis tels quels

---

## Régénérer les données

Si les fichiers Excel source changent :

```bash
cd Paragon/data-vote
pip3 install --user --break-system-packages pandas openpyxl   # déjà présents sur la machine de Thomas
python3 scripts/preprocess.py
```

Pour brancher un nouveau cycle : déposer les fichiers data.gouv dans `NewData/` puis ajuster `CYCLE` et `SRC_*` en tête de `scripts/preprocess.py`. Cela régénère tout le dossier `data/`. Les dates d'urgence sont recalculées par rapport à la date du jour. Pousser ensuite sur GitHub pour mettre à jour le site.

---

## Limites connues

- Les dates de prochaine élection sont des **estimations** (projection du mandat), pas des dates confirmées
- Données du cycle 2021-2024, pas de mise à jour automatique depuis data.gouv.fr
- Effectif non publié sur ce cycle → estimé via le nombre d'inscrits (flag `effEstime`)
- Certaines entreprises ont pu fusionner, fermer ou changer de structure
- Le cache IndexedDB peut devenir obsolète si les données sont régénérées sans changer `generatedAt` (peu probable car c'est un timestamp)
- Les 66 Mo de JSON sont chargés intégralement au premier accès (mis en cache ensuite)
## 5. Maintenance et Évolutions futures

### Changelog
- **2026-06-09 — Migration cycle 2021-2024.** Données data.gouv.fr 2021-2024 (publiées mai 2026, plus fiables que 2017-2020). 124 396 entreprises (vs 125 191). Changements de fond du jeu source : effectif non publié (→ proxy inscrits), 100 % CSE. Côté code : `preprocess.py` repointé sur `NewData/` + coercition numérique défensive + proxy effectif ; LinkedIn « Relations sociales » systématique (initialement « DRH ») ; recherche multi-mots passée en **AND** (sinon « Naval Group » noyait 2000+ « groupe ») ; labels cycle ; bump cache `?v=4`. Validé bout-en-bout (Playwright) — recoupe la vérité terrain Eric (Naval Group = 9 sites, octobre 2026). Sauvegarde de l'app pré-migration dans `sauvegarde/2026-06-09-pre-maj-2021-2024/`.

### Pistes futures
- Fiche « établissements liés » via `5-fichier-siret-t1-1.xlsx` (`load_siret_associes()` déjà prêt, non branché).
- Mise à jour semi-automatique quand un nouveau cycle paraît sur data.gouv.fr.
