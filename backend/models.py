from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Tank(Base):
    __tablename__ = "tanks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    size_liters = Column(Float)
    temperature = Column(Float, nullable=True)
    has_filter = Column(Boolean, default=True)
    is_planted = Column(Boolean, default=False)
    
    fishes = relationship("TankFish", back_populates="tank")

class FishSpecies(Base):
    __tablename__ = "fish_species"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    min_temp = Column(Float)
    max_temp = Column(Float)
    aggression_level = Column(String) # low, medium, high
    adult_size_cm = Column(Float)
    bioload_factor = Column(Float)
    compatibility_tags = Column(String) # comma-separated tags e.g. "peaceful,community"

class TankFish(Base):
    __tablename__ = "tank_fishes"

    id = Column(Integer, primary_key=True, index=True)
    tank_id = Column(Integer, ForeignKey("tanks.id"))
    species_id = Column(Integer, ForeignKey("fish_species.id"))
    quantity = Column(Integer)

    tank = relationship("Tank", back_populates="fishes")
    species = relationship("FishSpecies", lazy="joined")
