from database import SessionLocal, engine
import models

# Create tables
models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    
    # Fish Species
    f1 = models.FishSpecies(
        name="Neon Tetra", category="peaceful", min_temp=22.0, max_temp=26.0,
        aggression_level="low", adult_size_cm=4.0, bioload_factor=0.5,
        compatibility_tags="schooling,peaceful", difficulty_level="easy",
        image_url="https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=300"
    )
    f2 = models.FishSpecies(
        name="Betta Fish", category="peaceful", min_temp=24.0, max_temp=28.0,
        aggression_level="high", adult_size_cm=6.0, bioload_factor=1.2,
        compatibility_tags="solitary,aggressive", difficulty_level="medium",
        image_url="https://images.unsplash.com/photo-1534073737927-85f1dfa1913c?auto=format&fit=crop&w=300"
    )
    f3 = models.FishSpecies(
        name="Oscar", category="monster", min_temp=24.0, max_temp=28.0,
        aggression_level="high", adult_size_cm=35.0, bioload_factor=5.0,
        compatibility_tags="predator,territorial", difficulty_level="hard",
        image_url="https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=300"
    )
    
    # Plant Species
    p1 = models.PlantSpecies(
        name="Anubias Nana", description="Slow-growing, hardy plant.",
        benefits="Nitrate reduction", difficulty="Easy", light_requirement="Low",
        image_url="https://images.unsplash.com/photo-1512591201662-4214fbc9671d?auto=format&fit=crop&w=300"
    )
    
    db.add_all([f1, f2, f3, p1])
    db.commit()
    db.close()
    print("✅ Seed successful")

if __name__ == "__main__":
    seed()
