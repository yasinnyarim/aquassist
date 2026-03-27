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
        db_tf = existing
    else:
        db_tf = models.TankFish(tank_id=tank_id, species_id=tf.species_id, quantity=tf.quantity)
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
