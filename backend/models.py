from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class Tank(Base):
    __tablename__ = "tanks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    size_liters = Column(Float)
    temperature = Column(Float, nullable=True)
    has_filter = Column(Boolean, default=True)
    is_planted = Column(Boolean, default=False)
    
    fishes = relationship("TankFish", back_populates="tank", cascade="all, delete-orphan")
    plants = relationship("TankPlant", back_populates="tank", cascade="all, delete-orphan")

class FishSpecies(Base):
    __tablename__ = "fish_species"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    category = Column(String)              # saltwater, freshwater, monster, peaceful
    min_temp = Column(Float)
    max_temp = Column(Float)
    aggression_level = Column(String)      # low, medium, high
    adult_size_cm = Column(Float)
    bioload_factor = Column(Float)
    compatibility_tags = Column(String)    # comma-separated: peaceful,schooling,predator…
    difficulty_level = Column(String, default="medium")  # easy, medium, hard
    image_url = Column(String, nullable=True)

class TankFish(Base):
    __tablename__ = "tank_fishes"

    id = Column(Integer, primary_key=True, index=True)
    tank_id = Column(Integer, ForeignKey("tanks.id"))
    species_id = Column(Integer, ForeignKey("fish_species.id"))
    quantity = Column(Integer)
    size_cm = Column(Float, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)

    tank = relationship("Tank", back_populates="fishes")
    species = relationship("FishSpecies", lazy="joined")

class PlantSpecies(Base):
    __tablename__ = "plant_species"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    description = Column(String)
    benefits = Column(String)              # e.g. "Nitrate reduction, Oxygenation"
    difficulty = Column(String)
    light_requirement = Column(String)     # Low, Medium, High
    image_url = Column(String, nullable=True)

class TankPlant(Base):
    __tablename__ = "tank_plants"

    id = Column(Integer, primary_key=True, index=True)
    tank_id = Column(Integer, ForeignKey("tanks.id"))
    plant_id = Column(Integer, ForeignKey("plant_species.id"))
    quantity = Column(Integer, default=1)
    added_at = Column(DateTime, default=datetime.utcnow)

    tank = relationship("Tank", back_populates="plants")
    plant = relationship("PlantSpecies", lazy="joined")
