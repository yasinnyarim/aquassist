from pydantic import BaseModel, ConfigDict
from typing import List, Optional

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
    min_temp: float
    max_temp: float
    aggression_level: str
    adult_size_cm: float
    bioload_factor: float
    compatibility_tags: str

class FishSpeciesCreate(FishSpeciesBase):
    pass

class FishSpeciesResponse(FishSpeciesBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class TankFishCreate(BaseModel):
    species_id: int
    quantity: int

class TankFishResponse(BaseModel):
    id: int
    tank_id: int
    species: FishSpeciesResponse
    quantity: int
    
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
