"""
seed.py — AquAssist species database seeder.

Safe to run multiple times: each species is upserted by name,
so no duplicates are ever created.
"""
from sqlalchemy.orm import Session
import models
from database import engine, SessionLocal, Base

# ── Full species catalogue ─────────────────────────────────────────────────────
SPECIES_CATALOGUE = [

    # ── Livebearers ──────────────────────────────────────────────────────────
    {
        "name": "Guppy",
        "category": "Livebear",
        "min_temp": 22.0, "max_temp": 28.0,
        "aggression_level": "low",
        "adult_size_cm": 4.5,
        "bioload_factor": 0.8,
        "compatibility_tags": "peaceful,community,schooling,livebearer",
        "difficulty_level": "easy",
    },
    {
        "name": "Molly",
        "category": "Livebear",
        "min_temp": 22.0, "max_temp": 28.0,
        "aggression_level": "low",
        "adult_size_cm": 8.0,
        "bioload_factor": 1.1,
        "compatibility_tags": "peaceful,community,livebearer",
        "difficulty_level": "easy",
    },
    {
        "name": "Platy",
        "category": "Livebear",
        "min_temp": 18.0, "max_temp": 28.0,
        "aggression_level": "low",
        "adult_size_cm": 6.0,
        "bioload_factor": 1.0,
        "compatibility_tags": "peaceful,community,livebearer",
        "difficulty_level": "easy",
    },
    {
        "name": "Swordtail",
        "category": "Livebear",
        "min_temp": 20.0, "max_temp": 28.0,
        "aggression_level": "medium",
        "adult_size_cm": 10.0,
        "bioload_factor": 1.2,
        "compatibility_tags": "semi-aggressive,community,livebearer",
        "difficulty_level": "easy",
    },

    # ── Tetras ───────────────────────────────────────────────────────────────
    {
        "name": "Neon Tetra",
        "category": "Tetra",
        "min_temp": 20.0, "max_temp": 26.0,
        "aggression_level": "low",
        "adult_size_cm": 4.0,
        "bioload_factor": 0.8,
        "compatibility_tags": "peaceful,schooling,community",
        "difficulty_level": "easy",
    },
    {
        "name": "Cardinal Tetra",
        "category": "Tetra",
        "min_temp": 23.0, "max_temp": 27.0,
        "aggression_level": "low",
        "adult_size_cm": 5.0,
        "bioload_factor": 0.8,
        "compatibility_tags": "peaceful,schooling,community",
        "difficulty_level": "medium",
    },
    {
        "name": "Rummy Nose Tetra",
        "category": "Tetra",
        "min_temp": 22.0, "max_temp": 26.0,
        "aggression_level": "low",
        "adult_size_cm": 5.0,
        "bioload_factor": 0.8,
        "compatibility_tags": "peaceful,schooling,community",
        "difficulty_level": "medium",
    },
    {
        "name": "Glofish Tetra",
        "category": "Tetra",
        "min_temp": 20.0, "max_temp": 26.0,
        "aggression_level": "low",
        "adult_size_cm": 4.5,
        "bioload_factor": 0.8,
        "compatibility_tags": "peaceful,schooling,community",
        "difficulty_level": "easy",
    },

    # ── Cichlids ─────────────────────────────────────────────────────────────
    {
        "name": "Discus",
        "category": "Cichlid",
        "min_temp": 28.0, "max_temp": 31.0,
        "aggression_level": "low",
        "adult_size_cm": 20.0,
        "bioload_factor": 3.0,
        "compatibility_tags": "peaceful,sensitive,large,community",
        "difficulty_level": "hard",
    },
    {
        "name": "Angelfish",
        "category": "Cichlid",
        "min_temp": 24.0, "max_temp": 30.0,
        "aggression_level": "medium",
        "adult_size_cm": 15.0,
        "bioload_factor": 2.0,
        "compatibility_tags": "semi-aggressive,territorial,large",
        "difficulty_level": "medium",
    },

    # ── Danios ───────────────────────────────────────────────────────────────
    {
        "name": "Zebra Danio",
        "category": "Danio",
        "min_temp": 18.0, "max_temp": 26.0,
        "aggression_level": "low",
        "adult_size_cm": 5.0,
        "bioload_factor": 0.9,
        "compatibility_tags": "peaceful,schooling,community,hardy",
        "difficulty_level": "easy",
    },

    # ── Algae Eaters / Bottom Dwellers ───────────────────────────────────────
    {
        "name": "Common Pleco",
        "category": "Pleco",
        "min_temp": 22.0, "max_temp": 28.0,
        "aggression_level": "low",
        "adult_size_cm": 45.0,
        "bioload_factor": 4.0,
        "compatibility_tags": "peaceful,bottom-dweller,algae-eater,large",
        "difficulty_level": "easy",
    },
    {
        "name": "Otocinclus",
        "category": "Pleco",
        "min_temp": 21.0, "max_temp": 27.0,
        "aggression_level": "low",
        "adult_size_cm": 4.5,
        "bioload_factor": 0.7,
        "compatibility_tags": "peaceful,bottom-dweller,algae-eater,schooling",
        "difficulty_level": "medium",
    },

    # ── Predators ────────────────────────────────────────────────────────────
    {
        "name": "Red-Belly Piranha",
        "category": "Predator",
        "min_temp": 24.0, "max_temp": 28.0,
        "aggression_level": "high",
        "adult_size_cm": 30.0,
        "bioload_factor": 3.5,
        "compatibility_tags": "aggressive,predator,large,species-only",
        "difficulty_level": "hard",
    },

    # ── Existing legacy species (kept for backward compat) ───────────────────
    {
        "name": "Betta",
        "category": "Betta",
        "min_temp": 24.0, "max_temp": 28.0,
        "aggression_level": "high",
        "adult_size_cm": 7.0,
        "bioload_factor": 1.5,
        "compatibility_tags": "aggressive,solitary",
        "difficulty_level": "easy",
    },
    {
        "name": "Corydoras",
        "category": "Corydoras",
        "min_temp": 22.0, "max_temp": 26.0,
        "aggression_level": "low",
        "adult_size_cm": 5.0,
        "bioload_factor": 1.2,
        "compatibility_tags": "peaceful,bottom-dweller,schooling",
        "difficulty_level": "easy",
    },
    {
        "name": "Oscar",
        "category": "Cichlid",
        "min_temp": 23.0, "max_temp": 27.0,
        "aggression_level": "high",
        "adult_size_cm": 35.0,
        "bioload_factor": 3.0,
        "compatibility_tags": "aggressive,large,predator",
        "difficulty_level": "medium",
    },
]


def seed_data():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    inserted = 0
    updated  = 0

    for sp_data in SPECIES_CATALOGUE:
        existing = db.query(models.FishSpecies).filter_by(name=sp_data["name"]).first()
        if existing:
            # Update all fields so re-running the seed refreshes data
            for key, val in sp_data.items():
                setattr(existing, key, val)
            updated += 1
        else:
            db.add(models.FishSpecies(**sp_data))
            inserted += 1

    db.commit()

    # ── Print summary ─────────────────────────────────────────────────────────
    all_species = db.query(models.FishSpecies).order_by(models.FishSpecies.id).all()
    db.close()

    print(f"\n✅  Seed complete — {inserted} inserted, {updated} updated.\n")
    print(f"{'ID':<4} {'Name':<25} {'Temp (°C)':<12} {'Aggression':<12} {'Size(cm)':<10} "
          f"{'Bioload':<9} {'Difficulty':<10} {'Tags'}")
    print("─" * 120)
    for s in all_species:
        temp_range = f"{s.min_temp}–{s.max_temp}"
        print(f"{s.id:<4} {s.name:<25} {temp_range:<12} {s.aggression_level:<12} "
              f"{s.adult_size_cm:<10} {s.bioload_factor:<9} "
              f"{(s.difficulty_level or 'medium'):<10} {s.compatibility_tags}")


if __name__ == "__main__":
    seed_data()
