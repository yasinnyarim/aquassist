from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from database import engine, SessionLocal, Base
import models
import schemas
import services

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AquAssist API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/tanks/", response_model=schemas.TankResponse)
def create_tank(tank: schemas.TankCreate, db: Session = Depends(get_db)):
    db_tank = models.Tank(**tank.model_dump())
    db.add(db_tank)
    db.commit()
    db.refresh(db_tank)
    return db_tank

@app.get("/tanks/", response_model=List[schemas.TankResponse])
def get_tanks(db: Session = Depends(get_db)):
    return db.query(models.Tank).all()

@app.post("/tanks/{tank_id}/fish", response_model=schemas.TankFishResponse)
def add_fish(tank_id: int, tf: schemas.TankFishCreate, db: Session = Depends(get_db)):
    tank = db.query(models.Tank).filter(models.Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
        
    species = db.query(models.FishSpecies).filter(models.FishSpecies.id == tf.species_id).first()
    if not species:
        raise HTTPException(status_code=404, detail="Fish species not found")
        
    # Check if fish already in tank to increment, else add
    existing = db.query(models.TankFish).filter(
        models.TankFish.tank_id == tank_id, 
        models.TankFish.species_id == tf.species_id
    ).first()
    
    if existing:
        existing.quantity += tf.quantity
        if tf.size_cm is not None:
            existing.size_cm = tf.size_cm
        db_tf = existing
    else:
        db_tf = models.TankFish(
            tank_id=tank_id,
            species_id=tf.species_id,
            quantity=tf.quantity,
            size_cm=tf.size_cm,
        )
        db.add(db_tf)
        
    db.commit()
    db.refresh(db_tf)
    return db_tf

@app.get("/tanks/{tank_id}/fish", response_model=List[schemas.TankFishResponse])
def get_tank_fishes(tank_id: int, db: Session = Depends(get_db)):
    return db.query(models.TankFish).filter(models.TankFish.tank_id == tank_id).all()

@app.get("/fish-species/", response_model=List[schemas.FishSpeciesResponse])
def get_species(db: Session = Depends(get_db)):
    return db.query(models.FishSpecies).all()

@app.get("/tanks/{tank_id}/analyze", response_model=schemas.TankAnalysisResponse)
def analyze_tank(tank_id: int, db: Session = Depends(get_db)):
    try:
        tank = db.query(models.Tank).filter(models.Tank.id == tank_id).first()
        if not tank:
            raise HTTPException(status_code=404, detail=f"Tank with ID {tank_id} not found.")
            
        fishes = db.query(models.TankFish).filter(models.TankFish.tank_id == tank_id).all()
        
        total_bioload, bioload_percent = services.calculate_bioload(tank, fishes)
        issues = services.calculate_compatibility(tank, fishes)
        score, status = services.calculate_health_score(bioload_percent, issues, tank.has_filter)
        recs = services.generate_recommendations(bioload_percent, tank.has_filter, issues)
        
        return schemas.TankAnalysisResponse(
            tank_id=tank.id,
            total_bioload=total_bioload,
            bioload_percent=bioload_percent,
            compatibility_issues=issues,
            health_score=score,
            status=status,
            recommendations=recs
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze tank: {str(e)}")

@app.get("/tanks/{tank_id}/report")
def generate_report(tank_id: int, db: Session = Depends(get_db)):
    tank = db.query(models.Tank).filter(models.Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
        
    analysis = analyze_tank(tank_id, db)
    analysis_data = analysis.model_dump()
    analysis_data['has_filter'] = tank.has_filter
    
    report = services.generate_report_from_llm(analysis_data)
    return {"report": report}

@app.post("/tanks/{tank_id}/simulate")
def simulate_changes(tank_id: int, new_fishes: List[schemas.TankFishCreate], db: Session = Depends(get_db)):
    tank = db.query(models.Tank).filter(models.Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
        
    current_fishes = db.query(models.TankFish).filter(models.TankFish.tank_id == tank_id).all()
    
    simulated_fishes = list(current_fishes)
    
    for nf in new_fishes:
        species = db.query(models.FishSpecies).filter(models.FishSpecies.id == nf.species_id).first()
        if species:
            # simple mock for simulation
            dummy_tf = models.TankFish(tank_id=tank_id, species_id=nf.species_id, quantity=nf.quantity)
            dummy_tf.species = species
            simulated_fishes.append(dummy_tf)
            
    total_bioload, bioload_percent = services.calculate_bioload(tank, simulated_fishes)
    issues = services.calculate_compatibility(tank, simulated_fishes)
    score, status = services.calculate_health_score(bioload_percent, issues, tank.has_filter)
    recs = services.generate_recommendations(bioload_percent, tank.has_filter, issues)
    
    return {
        "status": "success",
        "simulated_health_score": score,
        "simulated_status": status,
        "simulated_bioload_percent": bioload_percent,
        "simulated_compatibility_issues": issues,
        "simulated_recommendations": recs
    }

@app.post("/diagnose")
def diagnose_problem(req: schemas.ProblemDiagnosisRequest):
    return {"diagnosis": services.diagnose_problem(req.description)}

@app.post("/fish-species/", response_model=schemas.FishSpeciesResponse)
def create_species(species: schemas.FishSpeciesCreate, db: Session = Depends(get_db)):
    db_species = models.FishSpecies(**species.model_dump())
    db.add(db_species)
    db.commit()
    db.refresh(db_species)
    return db_species

@app.get("/plant-species/", response_model=List[schemas.PlantSpeciesResponse])
def get_plant_species(db: Session = Depends(get_db)):
    return db.query(models.PlantSpecies).all()

@app.post("/plant-species/", response_model=schemas.PlantSpeciesResponse)
def create_plant_species(plant: schemas.PlantSpeciesBase, db: Session = Depends(get_db)):
    db_plant = models.PlantSpecies(**plant.model_dump())
    db.add(db_plant)
    db.commit()
    db.refresh(db_plant)
    return db_plant

@app.get("/tanks/{tank_id}/plants", response_model=List[schemas.TankPlantResponse])
def get_tank_plants(tank_id: int, db: Session = Depends(get_db)):
    return db.query(models.TankPlant).filter(models.TankPlant.tank_id == tank_id).all()

@app.post("/tanks/{tank_id}/plants", response_model=schemas.TankPlantResponse)
def add_tank_plant(tank_id: int, tp: schemas.TankPlantCreate, db: Session = Depends(get_db)):
    tank = db.query(models.Tank).filter(models.Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
        
    existing = db.query(models.TankPlant).filter(
        models.TankPlant.tank_id == tank_id,
        models.TankPlant.plant_id == tp.plant_id
    ).first()
    
    if existing:
        existing.quantity += tp.quantity
        db_tp = existing
    else:
        db_tp = models.TankPlant(tank_id=tank_id, plant_id=tp.plant_id, quantity=tp.quantity)
        db.add(db_tp)
        
    db.commit()
    db.refresh(db_tp)
    return db_tp

@app.delete("/tanks/{tank_id}")
def delete_tank(tank_id: int, db: Session = Depends(get_db)):
    tank = db.query(models.Tank).filter(models.Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    
    db.query(models.TankFish).filter(models.TankFish.tank_id == tank_id).delete()
    db.query(models.TankPlant).filter(models.TankPlant.tank_id == tank_id).delete()
    db.delete(tank)
    db.commit()
    return {"status": "deleted"}

@app.post("/tanks/{tank_id}/chat")
def chat_with_assistant(tank_id: int, req: schemas.ChatRequest, db: Session = Depends(get_db)):
    tank = db.query(models.Tank).filter(models.Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    
    fishes = db.query(models.TankFish).filter(models.TankFish.tank_id == tank_id).all()
    plants = db.query(models.TankPlant).filter(models.TankPlant.tank_id == tank_id).all()
    
    context = {
        "tank_name": tank.name,
        "volume": tank.size_liters,
        "temp": tank.temperature,
        "fishes": [{"name": f.species.name, "qty": f.quantity} for f in fishes if f.species],
        "plants": [{"name": p.plant.name, "qty": p.quantity} for p in plants if p.plant]
    }
    
    response = services.get_ai_chat_response(req.message, context)
    return {"response": response}
