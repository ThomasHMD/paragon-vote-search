#!/usr/bin/env python3
"""
Pipeline de prétraitement des données élections professionnelles.
Lit les fichiers Excel source (data.gouv.fr, cycle 2021-2024) et produit
des JSON optimisés pour le frontend Paragon Vote Search.
"""
import json
import math
import os
import sys
from datetime import datetime, date
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

CHUNK_SIZE = 5000
TODAY = date.today()

# ── Configuration des sources ───────────────────────────────────────────
# Cycle de données courant. Les fichiers bruts data.gouv.fr sont dans NewData/.
# Pour régénérer à partir d'un autre cycle : repointer SOURCE_DIR / SRC_* et CYCLE.
CYCLE = "2021-2024"
SOURCE_DIR = BASE_DIR / "NewData"
SRC_TOUR1     = SOURCE_DIR / "20260327-2-tour-1-avec-et-sans-ano-bloq.xlsx"
SRC_TOUR2     = SOURCE_DIR / "20260327-3-tour-2-avec-et-sans-ano-bloq.xlsx"
SRC_SYNDICATS = SOURCE_DIR / "20260327-4-syndicats-confederations.xlsx"
SRC_SIRET     = SOURCE_DIR / "20260327-5-fichier-siret-t1-1.xlsx"

# Colonnes numériques à coercer : le cycle 2021-2024 stocke certains nombres
# en texte (et des cellules vides ''). pd.to_numeric(errors="coerce") garantit
# des sommes/max corrects (sinon risque de concaténation ou de crash int('')).
NUMERIC_COLS = ["effectif", "numinscrits", "numvotants", "numsuffragesvalab",
                "numsieges", "nbelus", "dureemandat", "codsyndicat"]

# ── Helpers ──────────────────────────────────────────────────────────────

def parse_date_int(d):
    """Convertit un int YYYYMMDD en date."""
    if pd.isna(d):
        return None
    try:
        s = str(int(d))
        return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except (ValueError, IndexError):
        return None


def norm_siret(x):
    """Normalise un SIRET en 14 chiffres. None si vide/invalide."""
    if pd.isna(x):
        return None
    digits = "".join(ch for ch in str(x).split(".")[0] if ch.isdigit())
    return digits.zfill(14) if digits else None


def project_next_election(scrutin_date, duree_mandat, unite="A"):
    """Projette la prochaine date d'élection dans le futur."""
    if scrutin_date is None or pd.isna(duree_mandat) or duree_mandat <= 0:
        return None
    duree = int(duree_mandat)
    d = scrutin_date
    for _ in range(20):  # sécurité anti-boucle infinie
        try:
            if unite == "A":
                d = d.replace(year=d.year + duree)
            else:
                # mois
                m = d.month + duree
                y = d.year + (m - 1) // 12
                m = (m - 1) % 12 + 1
                d = d.replace(year=y, month=m)
        except ValueError:
            # 29 février → 28 février
            d = d.replace(year=d.year + duree, day=28)
        if d >= TODAY:
            return d
    return None


def urgency_label(next_date):
    """Retourne le niveau d'urgence basé sur la date."""
    if next_date is None:
        return "inconnu"
    delta = (next_date - TODAY).days
    if delta < 0:
        return "passe"
    if delta <= 180:
        return "imminent"
    if delta <= 365:
        return "proche"
    if delta <= 730:
        return "planifie"
    return "lointain"


# ── Lecture des fichiers ────────────────────────────────────────────────

def load_tours():
    """Charge Tour 1 et Tour 2, filtre VAL, retourne un DataFrame consolidé."""
    cols_needed = [
        "elenum", "siret", "raisonsociale", "adresse1", "codepostal",
        "libpostal", "codnaf", "effectif", "codidcc", "institution",
        "titulsuppl", "datescrutin", "dureemandat", "dureemandatunite",
        "statut", "tour", "carence", "partielcomplet",
        "numinscrits", "numvotants", "numsuffragesvalab",
        "numsieges", "nbelus",
        "codsyndicat", "libsyndicat",
        "cycle"
    ]

    print("Lecture Tour 1...")
    t1 = pd.read_excel(SRC_TOUR1, usecols=lambda c: c in cols_needed)
    print(f"  → {len(t1)} lignes")

    print("Lecture Tour 2...")
    t2 = pd.read_excel(SRC_TOUR2, usecols=lambda c: c in cols_needed)
    print(f"  → {len(t2)} lignes")

    df = pd.concat([t1, t2], ignore_index=True)
    print(f"Total brut : {len(df)} lignes")

    # Coercition numérique défensive (cycle 2021-2024 = nombres parfois en texte)
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Filtre statut validé
    df = df[df["statut"] == "VAL"].copy()
    print(f"Après filtre VAL : {len(df)} lignes")

    return df


def load_syndicats():
    """Charge la table de référence syndicats → confédérations."""
    syn = pd.read_excel(SRC_SYNDICATS)
    syn["codsyndicat"] = pd.to_numeric(syn["codsyndicat"], errors="coerce")
    syn = syn.dropna(subset=["codsyndicat"])
    return dict(zip(syn["codsyndicat"].astype(int), syn["libconfederation"].fillna("")))


def load_siret_associes():
    """Charge les SIRET associés par elenum. (Non utilisé actuellement par
    l'agrégation — conservé pour une future fiche « établissements liés ».)"""
    si = pd.read_excel(SRC_SIRET)
    si["siretassocie"] = si["siretassocie"].apply(lambda x: str(int(x)).zfill(14) if pd.notna(x) else None)
    return si.groupby("elenum")["siretassocie"].apply(list).to_dict()


# ── Agrégation par entreprise ───────────────────────────────────────────

def aggregate(df, syndicat_map):
    """Agrège les lignes par SIRET → une fiche entreprise."""
    # Normaliser SIRET
    df["siret"] = df["siret"].apply(norm_siret)
    df = df.dropna(subset=["siret"])
    df["date_parsed"] = df["datescrutin"].apply(parse_date_int)

    companies = {}

    for siret, group in df.groupby("siret"):
        first = group.iloc[0]
        cp = str(int(first["codepostal"])).zfill(5) if pd.notna(first.get("codepostal")) else ""
        dep = cp[:2] if len(cp) >= 2 else ""
        if dep == "97" and len(cp) >= 3:
            dep = cp[:3]  # DOM-TOM

        # Effectif réel (absent du cycle 2021-2024 → proxy calculé plus bas)
        effectif_reel = int(group["effectif"].max()) if group["effectif"].notna().any() else 0

        # Élections par institution
        elections = []
        for inst, igroup in group.groupby("institution"):
            if pd.isna(inst):
                continue
            # Garder l'élection la plus récente (date max)
            igroup_sorted = igroup.sort_values("datescrutin", ascending=False)
            latest = igroup_sorted.iloc[0]
            d = parse_date_int(latest["datescrutin"])
            duree = int(latest["dureemandat"]) if pd.notna(latest["dureemandat"]) else 4
            unite = latest.get("dureemandatunite", "A")
            if pd.isna(unite):
                unite = "A"
            next_d = project_next_election(d, duree, unite)

            # Syndicats présents dans cette élection
            syns_in_election = set()
            for _, row in igroup.iterrows():
                cod = row.get("codsyndicat")
                if pd.notna(cod):
                    cod_int = int(cod)
                    confederation = syndicat_map.get(cod_int, "")
                    label = row.get("libsyndicat", "")
                    if pd.notna(label) and label:
                        syns_in_election.add(confederation if confederation else str(label))

            # Inscrits/votants : prendre la somme sur les collèges (dédupliqué par elenum+titulsuppl)
            unique_pvs = igroup_sorted.drop_duplicates(subset=["elenum", "titulsuppl"])
            inscrits = int(unique_pvs["numinscrits"].sum()) if unique_pvs["numinscrits"].notna().any() else 0
            votants = int(unique_pvs["numvotants"].sum()) if unique_pvs["numvotants"].notna().any() else 0
            elus = int(unique_pvs["nbelus"].sum()) if unique_pvs["nbelus"].notna().any() else 0

            elections.append({
                "type": str(inst),
                "date": d.isoformat() if d else None,
                "next": next_d.isoformat() if next_d else None,
                "duree": duree,
                "inscrits": inscrits,
                "votants": votants,
                "syndicats": sorted(syns_in_election),
                "elus": elus
            })

        if not elections:
            continue

        # Effectif : réel si publié, sinon estimé par le max d'inscrits.
        # Le cycle 2021-2024 ne publie plus la colonne effectif (100 % vide) ;
        # on retombe sur le nb d'inscrits (≈ électeurs ≈ salariés) comme proxy.
        inscrits_max = max((e["inscrits"] for e in elections), default=0)
        if effectif_reel > 0:
            effectif, eff_estime = effectif_reel, False
        else:
            effectif, eff_estime = inscrits_max, inscrits_max > 0

        # Prochaine élection globale
        next_dates = [e["next"] for e in elections if e["next"]]
        next_election = min(next_dates) if next_dates else None
        urgency = urgency_label(date.fromisoformat(next_election)) if next_election else "inconnu"

        # Tous les syndicats de l'entreprise
        all_syndicats = set()
        for e in elections:
            all_syndicats.update(e["syndicats"])

        naf = str(first["codnaf"]) if pd.notna(first.get("codnaf")) else ""
        idcc = str(int(first["codidcc"])) if pd.notna(first.get("codidcc")) else ""

        companies[siret] = {
            "siret": siret,
            "nom": str(first["raisonsociale"]).strip() if pd.notna(first.get("raisonsociale")) else "",
            "adr": str(first["adresse1"]).strip() if pd.notna(first.get("adresse1")) else "",
            "cp": cp,
            "ville": str(first["libpostal"]).strip() if pd.notna(first.get("libpostal")) else "",
            "dep": dep,
            "naf": naf,
            "effectif": effectif,
            "effEstime": eff_estime,
            "idcc": idcc,
            "elections": elections,
            "syndicats": sorted(all_syndicats),
            "nextElection": next_election,
            "urgency": urgency
        }

    return list(companies.values())


# ── Génération des facettes ─────────────────────────────────────────────

def build_facets(companies):
    """Construit les valeurs de facettes avec compteurs."""
    deps = {}
    nafs = {}
    institutions = {}
    annees = {}
    effectif_ranges = {"1-49": 0, "50-99": 0, "100-299": 0, "300-999": 0, "1000+": 0}
    urgencies = {}
    has_syndicat = {"oui": 0, "non": 0}

    for c in companies:
        # Département
        d = c["dep"]
        if d:
            deps[d] = deps.get(d, 0) + 1

        # NAF (2 premiers car = section)
        naf = c["naf"][:2] if c["naf"] else ""
        if naf:
            nafs[naf] = nafs.get(naf, 0) + 1

        # Institutions
        for e in c["elections"]:
            t = e["type"]
            institutions[t] = institutions.get(t, 0) + 1
            if e["next"]:
                y = e["next"][:4]
                annees[y] = annees.get(y, 0) + 1

        # Effectif
        eff = c["effectif"]
        if eff < 50:
            effectif_ranges["1-49"] += 1
        elif eff < 100:
            effectif_ranges["50-99"] += 1
        elif eff < 300:
            effectif_ranges["100-299"] += 1
        elif eff < 1000:
            effectif_ranges["300-999"] += 1
        else:
            effectif_ranges["1000+"] += 1

        # Urgence
        u = c["urgency"]
        urgencies[u] = urgencies.get(u, 0) + 1

        # Syndicats
        if c["syndicats"]:
            has_syndicat["oui"] += 1
        else:
            has_syndicat["non"] += 1

    return {
        "departements": dict(sorted(deps.items())),
        "naf": dict(sorted(nafs.items())),
        "institutions": dict(sorted(institutions.items())),
        "annees": dict(sorted(annees.items())),
        "effectifs": effectif_ranges,
        "urgences": urgencies,
        "syndicats": has_syndicat
    }


# ── Écriture des fichiers JSON ──────────────────────────────────────────

def write_output(companies, facets):
    """Écrit les chunks JSON, facettes et métadonnées."""
    # Assigner des IDs
    for i, c in enumerate(companies):
        c["id"] = i

    # Chunks
    nb_chunks = math.ceil(len(companies) / CHUNK_SIZE)
    for i in range(nb_chunks):
        chunk = companies[i * CHUNK_SIZE:(i + 1) * CHUNK_SIZE]
        path = DATA_DIR / f"companies-{i:02d}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  → {path.name} ({len(chunk)} entreprises)")

    # Facettes
    with open(DATA_DIR / "facets.json", "w", encoding="utf-8") as f:
        json.dump(facets, f, ensure_ascii=False, separators=(",", ":"))
    print("  → facets.json")

    # Compteur imminent (24 mois)
    horizon = date(TODAY.year, TODAY.month, 1)
    try:
        horizon = horizon.replace(year=horizon.year + 1)
    except ValueError:
        horizon = horizon.replace(year=horizon.year + 2, day=28)
    imminent_count = sum(
        1 for c in companies
        if c["nextElection"] and date.fromisoformat(c["nextElection"]) <= horizon
    )

    # Meta
    eff_estime_count = sum(1 for c in companies if c.get("effEstime"))
    meta = {
        "totalCompanies": len(companies),
        "totalChunks": nb_chunks,
        "chunkSize": CHUNK_SIZE,
        "generatedAt": datetime.now().isoformat(),
        "dataSource": f"data.gouv.fr — Élections professionnelles (cycle {CYCLE})",
        "cycle": CYCLE,
        "imminentCount": imminent_count,
        "imminentHorizonMonths": 12,
        "effectifProxy": "numinscrits",
        "effectifEstimeCount": eff_estime_count
    }
    with open(DATA_DIR / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print("  → meta.json")

    # Index simplifié pour MiniSearch (champs légers)
    search_docs = []
    for c in companies:
        search_docs.append({
            "id": c["id"],
            "nom": c["nom"],
            "ville": c["ville"],
            "siret": c["siret"],
            "cp": c["cp"],
            "dep": c["dep"],
            "naf": c["naf"]
        })
    with open(DATA_DIR / "search-docs.json", "w", encoding="utf-8") as f:
        json.dump(search_docs, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  → search-docs.json ({len(search_docs)} docs)")


# ── Main ────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("PARAGON VOTE SEARCH — Pipeline de données")
    print("=" * 60)

    print(f"\nCycle : {CYCLE}  |  sources : {SOURCE_DIR}")

    print("\n[1/3] Chargement des tours...")
    df = load_tours()

    print("\n[2/3] Chargement table syndicats...")
    syndicat_map = load_syndicats()
    print(f"  → {len(syndicat_map)} syndicats")

    print("\n[3/3] Agrégation par entreprise...")
    companies = aggregate(df, syndicat_map)
    print(f"  → {len(companies)} entreprises uniques")

    # Trier par prochaine élection (les plus proches d'abord)
    companies.sort(key=lambda c: c["nextElection"] or "9999-99-99")

    print("\nÉcriture des fichiers JSON...")
    facets = build_facets(companies)
    write_output(companies, facets)

    # Stats
    total_size = sum(f.stat().st_size for f in DATA_DIR.glob("*.json"))
    print(f"\nTaille totale JSON : {total_size / 1024 / 1024:.1f} MB")
    print("Pipeline terminé ✓")


if __name__ == "__main__":
    main()
