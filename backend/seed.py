from sqlalchemy.orm import Session
import models
from database import engine, SessionLocal, Base

def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    if db.query(models.FishSpecies).count() == 0:
        species = [
            models.FishSpecies(name="Neon Tetra", min_temp=20, max_temp=26, aggression_level="low", adult_size_cm=4, bioload_factor=1.0, compatibility_tags="peaceful,schooling"),
            models.FishSpecies(name="Betta", min_temp=24, max_temp=28, aggression_level="high", adult_size_cm=7, bioload_factor=1.5, compatibility_tags="aggressive,solitary"),
            models.FishSpecies(name="Corydoras", min_temp=22, max_temp=26, aggression_level="low", adult_size_cm=5, bioload_factor=1.2, compatibility_tags="peaceful,bottom-dweller"),
            models.FishSpecies(name="Oscar", min_temp=23, max_temp=27, aggression_level="high", adult_size_cm=35, bioload_factor=3.0, compatibility_tags="aggressive,large")
        ]
        db.add_all(species)
        db.commit()
    db.close()

if __name__ == "__main__":
    seed_data()
    print("Database seeded!")
