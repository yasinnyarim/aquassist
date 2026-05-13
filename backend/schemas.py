from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class TankBase(BaseModel):
    name: str
    size_liters: float
    temperature: Optional[float] = None
    has_filter: bool = True
    is_planted: bool = False

class TankCreate(TankBase):
    pass

class TankResponse(TankBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class FishSpeciesBase(BaseModel):
    name: str
    category: Optional[str] = "freshwater"           # saltwater, freshwater, monster, peaceful
    min_temp: float
    max_temp: float
    aggression_level: str
    adult_size_cm: float
    bioload_factor: float
    compatibility_tags: str
    difficulty_level: str = "medium"
    image_url: Optional[str] = None

class FishSpeciesCreate(FishSpeciesBase):
    pass

class FishSpeciesResponse(FishSpeciesBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class TankFishCreate(BaseModel):
    species_id: int
    quantity: int
    size_cm: Optional[float] = None

class TankFishResponse(BaseModel):
    id: int
    tank_id: int
    species: FishSpeciesResponse
    quantity: int
    size_cm: Optional[float] = None
    added_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class PlantSpeciesBase(BaseModel):
    name: str
    description: str
    benefits: str
    difficulty: str
    light_requirement: str
    image_url: Optional[str] = None

class PlantSpeciesResponse(PlantSpeciesBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class TankPlantCreate(BaseModel):
    plant_id: int
    quantity: int

class TankPlantResponse(BaseModel):
    id: int
    tank_id: int
    plant: PlantSpeciesResponse
    quantity: int
    added_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class TankAnalysisResponse(BaseModel):
    tank_id: int
    total_bioload: float
    bioload_percent: float
    compatibility_issues: List[str]
    health_score: float
    status: str
    recommendations: List[str]
    
class ProblemDiagnosisRequest(BaseModel):
    description: str

class ChatRequest(BaseModel):
    message: str
