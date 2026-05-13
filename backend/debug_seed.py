import models
from database import SessionLocal, engine
import traceback

def seed():
    db = SessionLocal()
    try:
        models.Base.metadata.create_all(bind=engine)
        
        fish_list = [
            {
                "name": "Neon Tetra",
                "category": "peaceful",
                "min_temp": 22.0, "max_temp": 26.0,
                "aggression_level": "low",
                "adult_size_cm": 4.0,
                "bioload_factor": 0.5,
                "compatibility_tags": "schooling,peaceful",
                "image_url": "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=300"
            }
        ]

        for f_data in fish_list:
            print(f"Adding {f_data['name']}...")
            db.add(models.FishSpecies(**f_data))
        
        db.commit()
        print("Commit success")
    except Exception as e:
        print("FAILED")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
