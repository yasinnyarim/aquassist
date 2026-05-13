"""cleanup.py — remove the old 'Pleco (Common)' row now replaced by 'Common Pleco'."""
from database import SessionLocal
import models

db = SessionLocal()
old = db.query(models.FishSpecies).filter_by(name="Pleco (Common)").first()
if old:
    db.delete(old)
    db.commit()
    print(f"✅  Deleted stale entry: 'Pleco (Common)' (id={old.id})")
else:
    print("ℹ️   No stale 'Pleco (Common)' entry found.")
db.close()
