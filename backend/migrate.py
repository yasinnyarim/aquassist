"""migrate.py — add difficulty_level column to fish_species if missing."""
from database import engine
from sqlalchemy import text, inspect as sa_inspect

insp = sa_inspect(engine)
cols = [c["name"] for c in insp.get_columns("fish_species")]
print("Existing columns:", cols)

migrations_applied = False

if "difficulty_level" not in cols:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE fish_species ADD COLUMN difficulty_level VARCHAR DEFAULT 'medium'"))
    print("✅  Migration applied: difficulty_level added.")
    migrations_applied = True
else:
    print("ℹ️   Column already exists — no migration needed.")

if "size_cm" not in [c["name"] for c in insp.get_columns("tank_fishes")]:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE tank_fishes ADD COLUMN size_cm FLOAT"))
    print("✅  Migration applied: size_cm added to tank_fishes.")
    migrations_applied = True
else:
    print("ℹ️   tank_fishes.size_cm already exists — no migration needed.")

if not migrations_applied:
    print("✅  No migrations were necessary.")
