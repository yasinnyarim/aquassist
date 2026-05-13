# AquAssist — Comprehensive Technical Analysis

**Date**: April 21, 2026  
**Project**: AI-Powered Aquarium Management System

---

## 1. PROJECT OVERVIEW

### Purpose
AquAssist is an **AI-powered aquarium management web application** that helps users maintain healthy, balanced aquariums by providing:
- Real-time tank health analysis
- Fish compatibility checking
- Bioload calculation and monitoring
- AI-generated personalized care plans
- Interactive chat assistant for aquarium-related questions

### Problem Statement
Aquarium hobbyists struggle with:
- Understanding fish compatibility requirements
- Preventing overstocking (exceeding bioload capacity)
- Identifying temperature incompatibilities
- Generating maintenance schedules tailored to their setup
- Getting expert advice without consulting professionals

### Solution Approach
AquAssist combines **rule-based analysis** (compatibility, bioload) with **LLM integration** (OpenAI API) to provide both deterministic accuracy and contextual AI insights.

---

## 2. TECH STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5, CSS3 (Glassmorphism) | UI Components, Responsive Design |
| **Frontend Logic** | Vanilla JavaScript (ES6+) | Client-side state, API integration |
| **Backend Framework** | FastAPI (Python) | RESTful API, dependency injection, auto-docs |
| **ORM** | SQLAlchemy | Database abstraction layer |
| **Database** | SQLite | Persistent data storage |
| **Validation** | Pydantic | Schema validation, type hints |
| **AI Integration** | OpenAI API (GPT-3.5-turbo) | Report generation, diagnosis, chat |
| **Charting** | Chart.js | Data visualization (water quality trends) |
| **Icons** | Font Awesome 6.4.0 | UI icons |
| **Fonts** | Google Fonts (Nunito, Outfit) | Typography |

### Key Dependencies
```
fastapi==0.104.0
uvicorn==0.24.0
sqlalchemy==2.0.0
pydantic==2.0.0
openai==1.0.0
python-dotenv (recommended, not listed)
```

---

## 3. BACKEND ARCHITECTURE

### 3.1 Database Schema (models.py)

#### Core Tables

**Tank** - The main aquarium entity
```python
class Tank(Base):
    __tablename__ = "tanks"
    id: int (Primary Key)
    name: str
    size_liters: float              # Tank capacity
    temperature: float (nullable)   # Current temp in °C
    has_filter: bool (default=True) # Filtration status
    is_planted: bool (default=False)# Has live plants
    
    Relationships:
    - fishes: List[TankFish] (one-to-many)
    - plants: List[TankPlant] (one-to-many)
```

**FishSpecies** - Reference data for all fish species
```python
class FishSpecies(Base):
    __tablename__ = "fish_species"
    id: int (PK)
    name: str (unique)
    category: str              # "saltwater", "freshwater", "monster", "peaceful"
    min_temp: float            # Minimum tolerable temperature
    max_temp: float            # Maximum tolerable temperature
    aggression_level: str      # "low", "medium", "high"
    adult_size_cm: float       # Adult size for predator-prey analysis
    bioload_factor: float      # Ammonia production multiplier
    compatibility_tags: str    # Comma-separated: "peaceful,schooling,predator,..."
    difficulty_level: str      # "easy", "medium", "hard"
    image_url: str (nullable)  # Species image
```

**TankFish** - Junction table linking tanks to fish species
```python
class TankFish(Base):
    __tablename__ = "tank_fishes"
    id: int (PK)
    tank_id: int (FK → Tank.id)
    species_id: int (FK → FishSpecies.id)
    quantity: int              # How many of this species
    added_at: datetime         # Timestamp of addition
    
    Relationships:
    - tank: Tank (many-to-one)
    - species: FishSpecies (many-to-one, lazy="joined")
```

**PlantSpecies** - Reference data for aquatic plants
```python
class PlantSpecies(Base):
    __tablename__ = "plant_species"
    id: int (PK)
    name: str (unique)
    description: str
    benefits: str              # e.g., "Nitrate reduction, Oxygenation"
    difficulty: str            # "easy", "medium", "hard"
    light_requirement: str     # "low", "medium", "high"
    image_url: str (nullable)
```

**TankPlant** - Junction table linking tanks to plants
```python
class TankPlant(Base):
    __tablename__ = "tank_plants"
    id: int (PK)
    tank_id: int (FK → Tank.id)
    plant_id: int (FK → PlantSpecies.id)
    quantity: int (default=1)
    added_at: datetime
    
    Relationships:
    - tank: Tank (many-to-one)
    - plant: PlantSpecies (many-to-one, lazy="joined")
```

**Database Relationships (ER Diagram)**
```
Tank (1) ──── (M) TankFish
 ├── is_planted, has_filter, temperature, size_liters
 └── relates to FishSpecies

Tank (1) ──── (M) TankPlant
 └── relates to PlantSpecies

TankFish (M) ──── (1) FishSpecies
 └── quantity, added_at

TankPlant (M) ──── (1) PlantSpecies
 └── quantity, added_at
```

### 3.2 API Endpoints (main.py)

#### Tank Management
```
POST   /tanks/                           Create a new aquarium
GET    /tanks/                           List all aquariums
DELETE /tanks/{tank_id}                  Delete an aquarium
```

**Example: Create Tank**
```python
@app.post("/tanks/", response_model=schemas.TankResponse)
def create_tank(tank: schemas.TankCreate, db: Session = Depends(get_db)):
    """
    Payload:
    {
        "name": "Living Room Reef",
        "size_liters": 120,
        "temperature": 25.5,
        "has_filter": true,
        "is_planted": false
    }
    
    Returns: Created Tank object with ID
    """
```

#### Fish Management
```
POST   /tanks/{tank_id}/fish              Add fish to a tank
GET    /tanks/{tank_id}/fish              Get fish in a tank
POST   /fish-species/                     Create new fish species
GET    /fish-species/                     List all fish species
```

**Example: Add Fish to Tank**
```python
@app.post("/tanks/{tank_id}/fish", response_model=schemas.TankFishResponse)
def add_fish(tank_id: int, tf: schemas.TankFishCreate, db: Session = Depends(get_db)):
    """
    Payload:
    {
        "species_id": 5,    # Neon Tetra ID
        "quantity": 12      # Adding 12 tetras
    }
    
    Logic:
    1. Verify tank exists
    2. Verify species exists
    3. Check if species already in tank → increment quantity
    4. Otherwise create new TankFish entry
    """
```

#### Tank Analysis (Core Logic)
```
GET    /tanks/{tank_id}/analyze           Calculate tank health metrics
GET    /tanks/{tank_id}/report            Generate AI-powered care plan
POST   /tanks/{tank_id}/simulate          Test hypothetical stocking changes
```

**Example: Analyze Tank**
```python
@app.get("/tanks/{tank_id}/analyze", response_model=schemas.TankAnalysisResponse)
def analyze_tank(tank_id: int, db: Session = Depends(get_db)):
    """
    Returns:
    {
        "tank_id": 1,
        "total_bioload": 450.0,
        "bioload_percent": 75.5,
        "compatibility_issues": [
            "Aggressive fish mixed with peaceful fish.",
            "Tank temperature (26°C) is outside bounds for Discus (28-31°C)."
        ],
        "health_score": 65.0,
        "status": "warning",
        "recommendations": [
            "Adjust tank temperature to match fish requirements.",
            "Consider removing aggressive species or separating into dedicated tank."
        ]
    }
    """
```

#### Plant Management
```
GET    /plant-species/                    List all plant species
POST   /plant-species/                    Create new plant species
GET    /tanks/{tank_id}/plants            Get plants in a tank
POST   /tanks/{tank_id}/plants            Add plant to tank
```

#### AI Integration Endpoints
```
GET    /tanks/{tank_id}/report            LLM-generated care report
POST   /tanks/{tank_id}/chat              Chat with AI assistant
POST   /diagnose                          Problem diagnosis using LLM
```

**Example: Generate Report**
```python
@app.get("/tanks/{tank_id}/report")
def generate_report(tank_id: int, db: Session = Depends(get_db)):
    # Fetches analysis data
    # Passes to LLM with formatted prompt
    # Returns: {"report": "📋 AKVARYUM DURUM RAPORU..."}
    # Falls back to system-generated report if API unavailable
```

### 3.3 Pydantic Schemas (schemas.py)

Request/Response validation schemas:

```python
class TankCreate(BaseModel):
    name: str
    size_liters: float
    temperature: Optional[float] = None
    has_filter: bool = True
    is_planted: bool = False

class TankResponse(TankBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class TankFishCreate(BaseModel):
    species_id: int
    quantity: int

class TankAnalysisResponse(BaseModel):
    tank_id: int
    total_bioload: float
    bioload_percent: float
    compatibility_issues: List[str]
    health_score: float
    status: str  # "good", "warning", "danger"
    recommendations: List[str]
```

### 3.4 Business Logic (services.py)

#### Bioload Calculation
Bioload represents organic waste produced by fish. Higher bioload = more ammonia buildup.

```python
def calculate_bioload(tank: models.Tank, fishes: List[models.TankFish], 
                      plants: List[models.TankPlant] = []):
    """
    Formula: bioload = Σ(quantity × adult_size_cm × bioload_factor)
    
    Example:
    - 10 Neon Tetras: 10 × 4.0cm × 0.5 = 20 bioload units
    - 2 Discus: 2 × 20cm × 3.0 = 120 bioload units
    - Total: 140 units in a 100L tank = 140% bioload
    
    Plant reduction:
    - Each plant reduces bioload by 2.5 units (nitrate absorption)
    
    Result: bioload_percent = (total_bioload / tank_size_liters) × 100
    """
```

**Health Implications**:
- **< 80%**: Safe, tank is under-stocked
- **80-100%**: Optimal, mature tank fully utilized
- **> 100%**: Dangerous, water quality degrades, ammonia spike risk

#### Compatibility Analysis
Rule-based checks for fish conflicts:

```python
def calculate_compatibility(tank: models.Tank, fishes: List[models.TankFish]):
    issues = []
    
    # Rule 1: Aggression-level mismatch
    if "high" in aggression_levels and "low" in aggression_levels:
        issues.append("Aggressive fish mixed with peaceful fish.")
    
    # Rule 2: Size-based predation risk
    max_size = max(sizes)
    min_size = min(sizes)
    if max_size > min_size * 3:
        issues.append("Considerable size difference detected, potential predator-prey conflict.")
    
    # Rule 3: Saltwater/Freshwater incompatibility
    if "saltwater" in categories and "freshwater" in categories:
        issues.append("CRITICAL: Saltwater and freshwater fish cannot live together.")
    
    # Rule 4: Temperature tolerance
    for species in fishes:
        if tank.temperature < species.min_temp or tank.temperature > species.max_temp:
            issues.append(f"Tank temperature ({tank.temperature}°C) is outside bounds...")
    
    return issues
```

#### Health Score Calculation
Composite metric (0-100) based on multiple factors:

```python
def calculate_health_score(bioload_percent: float, issues: List[str], has_filter: bool):
    score = 100.0
    
    # Penalty for overstocking
    if bioload_percent > 100:
        score -= (bioload_percent - 100) * 0.5  # 20% over → -10 points
    
    # Penalty for each compatibility issue
    score -= len(issues) * 15  # Each issue: -15 points
    
    # Penalty for no filter
    if not has_filter:
        score -= 20
    
    score = max(0.0, min(100.0, score))  # Clamp to [0, 100]
    
    # Status classification
    status = "good" if score >= 80 else "warning" if score >= 50 else "danger"
    
    return score, status
```

**Status Mapping**:
| Status | Score | Interpretation |
|--------|-------|-----------------|
| Good | 80-100 | Stable, healthy environment |
| Warning | 50-79 | Needs attention, risks present |
| Danger | 0-49 | Critical, immediate action needed |

#### Recommendations Generation
Contextual advice based on analysis:

```python
def generate_recommendations(bioload_percent: float, has_filter: bool, issues: List[str]):
    actions: list[str] = []
    
    if bioload_percent > 100:
        actions.append("Perform urgent water change and consider relocating excess fish.")
    
    if not has_filter:
        actions.append("URGENT: Install and continuously run an appropriately-sized filter.")
    
    if any("temperature" in i.lower() for i in issues):
        actions.append("Adjust tank temperature to match fish tolerance ranges.")
    
    if any("compatibility" in i.lower() or "aggressive" in i.lower() for i in issues):
        actions.append("Separate incompatible fish species into different tanks.")
    
    if not actions:
        actions.append("Maintain current tank conditions — all metrics optimal!")
    
    return actions
```

#### AI Report Generation
Integrates with OpenAI API for natural language insights:

```python
def generate_report_from_llm(analysis_data: dict):
    if not client:  # Fallback if API key missing
        return generate_fallback_report(analysis_data)
    
    prompt = f"""
    Act as an expert aquarist. Review the following aquarium analysis data 
    and generate a short, friendly explanation and a simple maintenance plan.
    
    Data:
    Bioload: {analysis_data['bioload_percent']}%
    Health Score: {analysis_data['health_score']}/100 ({analysis_data['status']})
    Issues: {', '.join(analysis_data['compatibility_issues'])}
    Recommendations: {', '.join(analysis_data['recommendations'])}
    """
    
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300
    )
    
    return response.choices[0].message.content
```

**Fallback Behavior**: System generates formatted report in Turkish if OpenAI API fails.

### 3.5 Data Initialization (seed.py, seed_plants.py)

**16+ Fish Species Seeded into Database:**

| Name | Category | Size | Aggression | Difficulty | Temperature | Bioload |
|------|----------|------|-----------|------------|-------------|---------|
| Neon Tetra | Peaceful | 4.0cm | Low | Easy | 20-26°C | 0.8 |
| Guppy | Peaceful | 4.5cm | Low | Easy | 22-28°C | 0.8 |
| Molly | Peaceful | 8.0cm | Low | Easy | 22-28°C | 1.1 |
| Platy | Peaceful | 6.0cm | Low | Easy | 18-28°C | 1.0 |
| Swordtail | Semi-aggr | 10.0cm | Medium | Easy | 20-28°C | 1.2 |
| Cardinal Tetra | Peaceful | 5.0cm | Low | Medium | 23-27°C | 0.8 |
| Discus | Peaceful | 20.0cm | Low | Hard | 28-31°C | 3.0 |
| Angelfish | Semi-aggr | 15.0cm | Medium | Medium | 24-30°C | 2.0 |
| Corydoras | Peaceful | 5.0cm | Low | Easy | 22-26°C | 1.2 |
| Betta | Aggressive | 7.0cm | High | Easy | 24-28°C | 1.5 |
| Oscar | Aggressive | 35.0cm | High | Medium | 23-27°C | 3.0 |
| Common Pleco | Peaceful | 45.0cm | Low | Easy | 22-28°C | 4.0 |
| Red-Belly Piranha | Aggressive | 30.0cm | High | Hard | 24-28°C | 3.5 |
| Zebra Danio | Peaceful | 5.0cm | Low | Easy | 18-26°C | 0.9 |
| Otocinclus | Peaceful | 4.5cm | Low | Medium | 21-27°C | 0.7 |
| Rummy Nose Tetra | Peaceful | 5.0cm | Low | Medium | 22-26°C | 0.8 |

**3 Plant Species Seeded:**
- Anubias Nana (Easy, Low light, Nitrate reduction)
- Java Fern (Easy, Low light, Bioload reduction)
- Amazon Sword (Medium, Medium light, Toxin removal)

---

## 4. FRONTEND ARCHITECTURE

### 4.1 UI Structure (index.html)

**Layout:**
- **Sidebar** (fixed left): Navigation and branding
- **Main Content** (flexible): View panels that swap based on navigation
- **Chat Widget** (fixed bottom-right): AI assistant overlay

**Views/Pages:**

1. **My Aquariums** - Grid of tank cards
   - Shows tank name, volume, temperature, filter status, planted status
   - Click card to select and open Dashboard

2. **Dashboard** (Tank Details)
   - Tank stats (volume, fish count, plants)
   - Health Score (0-100) with status color coding
   - Bioload percentage meter
   - Compatibility issues list
   - Recommendations list
   - Mini sparkline chart (pH trend)
   - Relaxing ambient music player

3. **Water Analysis** - Time-series graphs
   - Switchable parameters: pH, Ammonia (NH3), Ammonium (NH4)
   - Chart.js visualization with 8-point dataset (mock data)
   - Measurement table with date, value, % change

4. **Fish Species** - Inventory and filtering
   - Category filter tabs (All, Freshwater, Saltwater, Monster, Peaceful)
   - Cards showing: Name, Quantity, Category, Added Date
   - "Add Fish" button to stock tank

5. **Plant Care** - Plant inventory
   - List of plants in tank with quantity
   - Shows plant benefits (e.g., "Nitrate reduction")
   - "Add Plant" button

6. **AI Report** - LLM-generated insights
   - Fetches from `/tanks/{id}/report` endpoint
   - Formats markdown-like text with sections, bullets
   - Shows loading state while generating

**Modals (Overlays):**
- Create Tank form
- Add Fish form
- Define New Species form
- Add Plant form
- Delete Tank confirmation

### 4.2 JavaScript State & Functions (app.js)

**Global Application State:**
```javascript
const STATE = {
    tanks: [],              // All tanks from API
    selectedTank: null,     // Currently viewing
    chart: null,            // Chart.js instance (water analysis)
    miniChart: null,        // Dashboard sparkline
    activeParam: 'ph',      // Water parameter being viewed
    fishFilter: 'all',      // Category filter
    plantSpecies: []        // Available plant species
};
```

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `showView(name)` | Switch between views (aquariums, dashboard, fish, etc) |
| `renderAquariumList()` | Fetch tanks from API, render grid |
| `selectTank(tank)` | Set STATE.selectedTank, show dashboard |
| `renderDashboard(tankId)` | Fetch analysis, render metrics |
| `handleCreateTank(e)` | POST /tanks/ with form data |
| `handleAddFish(e)` | POST /tanks/{id}/fish |
| `renderFishTracking()` | Fetch and display fish inventory |
| `renderWaterAnalysis()` | Initialize Chart.js graph |
| `renderAIReport()` | Fetch and format report |
| `handleChatSend()` | POST /tanks/{id}/chat with message |

**Data Flow Example (User creates a tank):**
```
User fills form → handleCreateTank() 
    → validates input 
    → POST to /tanks/ 
    → waits for response 
    → hideModal() 
    → renderAquariumList() 
    → fetches latest tanks
    → displays updated grid
```

### 4.3 Styling & Design (style.css)

**Design System:**

**Color Palette:**
```css
:root {
    --sidebar-bg: rgba(30, 58, 138, 0.9);    /* Deep blue */
    --primary: #2563eb;                      /* Royal blue */
    --success: #10b981;                      /* Green */
    --warning: #f59e0b;                      /* Amber */
    --danger: #ef4444;                       /* Red */
    --text-primary: #0f172a;                 /* Dark slate */
    --text-secondary: #475569;               /* Medium gray */
}
```

**Effects:**
- **Glassmorphism**: `backdrop-filter: blur(16px)` on cards
- **Responsive Grid**: `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`
- **Color-Coded Status**:
  - Green `.status-good`
  - Amber `.status-warning`
  - Red `.status-danger`

**Typography:**
- Font Family: Outfit, Nunito (Google Fonts)
- Responsive sizing: `clamp()` for fluid scaling
- Font weight hierarchy: 300-800 for emphasis

---

## 5. DATABASE SCHEMA & RELATIONSHIPS

### Full ER Diagram
```
┌─────────────────────┐
│   FishSpecies       │
├─────────────────────┤
│ PK: id              │
│    name (unique)    │
│    category         │
│    min_temp         │
│    max_temp         │
│    bioload_factor   │
│    aggression_level │
│    difficulty_level │
└──────────┬──────────┘
           │ 1
           │
           │ M ─────────────┐
      ┌────▼────────────────┴──────────┐
      │   TankFish                     │
      ├────────────────────────────────┤
      │ PK: id                         │
      │ FK: tank_id → Tank.id          │
      │ FK: species_id → FishSpecies   │
      │    quantity                    │
      │    added_at                    │
      └────┬───────────────────────────┘
           │
           │ M
    ┌──────▼────────────┐
    │   Tank            │
    ├───────────────────┤
    │ PK: id            │
    │    name           │
    │    size_liters    │
    │    temperature    │
    │    has_filter     │
    │    is_planted     │
    └──────┬────────────┘
           │ 1
           │
           ├─────────────┐
           │ M           │ M
    ┌──────▼──────┐  ┌───▼─────────────┐
    │  TankPlant  │  │  PlantSpecies   │
    ├─────────────┤  ├─────────────────┤
    │ PK: id      │  │ PK: id          │
    │ FK: tank_id │  │    name(unique) │
    │ FK: plant_id│  │    description  │
    │    quantity │  │    benefits     │
    │    added_at │  │    difficulty   │
    └─────────────┘  │    light_req    │
                     └─────────────────┘
```

### Data Types & Constraints
```sql
CREATE TABLE tanks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR NOT NULL,
    size_liters FLOAT NOT NULL,
    temperature FLOAT,
    has_filter BOOLEAN DEFAULT 1,
    is_planted BOOLEAN DEFAULT 0
);

CREATE TABLE tank_fishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tank_id INTEGER NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    species_id INTEGER NOT NULL REFERENCES fish_species(id),
    quantity INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. KEY FEATURES & FUNCTIONALITY

### 6.1 Tank Creation Workflow
```
1. User clicks "New Aquarium"
2. Modal opens with form
3. User enters:
   - Name (e.g., "Living Room 120L")
   - Volume (e.g., 120 liters)
   - Temperature (e.g., 25°C)
   - Has Filter? (checkbox)
   - Is Planted? (checkbox)
4. Form validates input (name and volume required)
5. POST /tanks/ sends data to backend
6. Backend creates Tank record in database
7. Frontend refreshes tank list
8. New tank appears in grid
```

### 6.2 Fish Stocking with Compatibility Check
```
1. User selects tank from grid
2. Dashboard opens showing current inhabitants
3. User clicks "Add Fish"
4. Modal shows dropdown of 16+ species with size
5. User selects species and enters quantity
6. POST /tanks/{id}/fish sends request
7. Backend checks if species already exists in tank
8. If exists: increment quantity; else: create new TankFish record
9. Dashboard re-fetches analysis
10. Health score, bioload, and compatibility issues update
11. AI recommendations refresh
```

**Example Scenario:**
```
Tank: 100 liters, 25°C, has filter
Current: 10 Neon Tetras (bioload: 20 units)

User adds: 5 Oscars (bioload: 5 × 35cm × 3.0 = 525 units)

New Analysis:
- Total bioload: 545 units in 100L = 545% (DANGER!)
- Health Score: 35/100 (RED)
- Issues:
  * "Aggressive fish mixed with peaceful fish"
  * "Considerable size difference detected (Oscar 35cm vs Tetra 4cm)"
- Recommendations:
  * "Perform urgent water change and relocate excess fish"
  * "Separate incompatible species into different tanks"
```

### 6.3 Health Score Components

**Input Variables:**
- Bioload percentage (capacity usage)
- Number of compatibility issues
- Filter presence/absence

**Scoring Algorithm:**
```
base_score = 100

if bioload > 100:
    penalty = (bioload - 100) × 0.5
    score -= penalty  // e.g., 150% bioload = -25 points

score -= len(issues) × 15  // Each issue = -15 points

if no_filter:
    score -= 20  // No filter = -20 points

score = clamp(score, 0, 100)
```

**Status Determination:**
```
if score >= 80: status = "GOOD" (green)
elif score >= 50: status = "WARNING" (amber)
else: status = "DANGER" (red)
```

### 6.4 AI-Powered Features

#### Report Generation
Calls OpenAI API with analysis data:

```
Endpoint: GET /tanks/{id}/report
Flow:
1. Analyze tank (bioload, health score, issues)
2. Format analysis into LLM prompt
3. Call GPT-3.5-turbo with max_tokens=300
4. Return formatted response

Fallback (if API fails):
- System generates formatted Turkish report with fixed sections
- Includes risk assessment and maintenance schedule
```

#### Chat Assistant
```
Endpoint: POST /tanks/{id}/chat
Input: {"message": "Balıklarım harika görünüyor mu?"}
Flow:
1. Fetch tank data, current fish, plants
2. Build context object with tank info
3. Create LLM prompt with tank context
4. Call GPT-3.5-turbo in Turkish
5. Return conversational response

Example Response:
"Akvaryumunuzun hacmi 100 litre. 
Sıcaklık 25°C. Neon Tetras, Guppies var. 
Her şey dengeli görünüyor, devam edin!"
```

#### Problem Diagnosis
```
Endpoint: POST /diagnose
Input: {"description": "Balıklarım sürekli yüzeyde kalıyor"}
Flow:
1. Create diagnostic prompt
2. Ask GPT-3.5-turbo for:
   - Possible causes
   - Urgency level
   - Recommended actions
3. Return expert analysis
```

### 6.5 Simulation Feature (not fully implemented in UI)

```
Endpoint: POST /tanks/{id}/simulate
Purpose: Preview effects of adding fish without committing

Input:
{
    "new_fishes": [
        {"species_id": 12, "quantity": 3},  // Add 3 of species 12
        {"species_id": 5, "quantity": 2}    // Add 2 of species 5
    ]
}

Output:
{
    "simulated_health_score": 72.0,
    "simulated_status": "warning",
    "simulated_bioload_percent": 92.5,
    "simulated_compatibility_issues": [...],
    "simulated_recommendations": [...]
}
```

---

## 7. DATA FLOW & INTERACTION PATTERNS

### 7.1 Complete Request/Response Lifecycle

**Example: User creates tank and adds fish**

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                   │
│                                                         │
│  User → Form Input → validateInput() → JSON Payload    │
└─────────┬───────────────────────────────────────────────┘
          │
          │ POST /tanks/
          │ Content-Type: application/json
          │ Body: {"name": "Reef", "size_liters": 120, ...}
          ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND API (FastAPI Server)               │
│                                                         │
│  Route Handler:                                         │
│  @app.post("/tanks/")                                   │
│  - Validate via Pydantic schema                         │
│  - Get DB session (dependency injection)                │
│  - Create Tank ORM object                               │
│  - db.add() and db.commit()                             │
│  - Return Tank response with ID                         │
└─────────┬───────────────────────────────────────────────┘
          │
          │ Response 200 OK
          │ Body: {"id": 15, "name": "Reef", ...}
          ▼
┌─────────────────────────────────────────────────────────┐
│              DATABASE (SQLite)                          │
│                                                         │
│  Persisted:                                             │
│  INSERT INTO tanks (name, size_liters, ...)             │
│  VALUES ('Reef', 120, ...)                              │
└─────────────────────────────────────────────────────────┘
          ▲
          │ Data stored durably
          │
┌─────────────────────────────────────────────────────────┐
│                   FRONTEND (cont'd)                     │
│                                                         │
│  - Parse JSON response                                  │
│  - hideModal()                                          │
│  - Call renderAquariumList()                            │
│  - GET /tanks/ → fetch all tanks                        │
│  - Render new tank in grid                              │
│  - User sees: "Reef 120L" card                          │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Tank Selection & Dashboard View

```
User clicks tank card
    ↓
selectTank(tank) sets STATE.selectedTank = tank
    ↓
showView('dashboard')
    ↓
renderDashboard(tankId):
    
    a) Display static tank info (name, volume)
    b) Fetch GET /tanks/{id}/fish → count total fish
    c) Fetch GET /tanks/{id}/analyze → get metrics
    d) services.calculate_bioload() → internal calculation
    e) services.calculate_compatibility() → check issues
    f) services.calculate_health_score() → derive score
    g) Update DOM with metrics
    h) renderMiniChart() → plot pH trend
```

### 7.3 Analysis & Report Generation

```
User clicks "AI Report" tab
    ↓
renderAIReport():
    
    a) Check if STATE.selectedTank exists
    b) Show loading spinner
    c) Fetch GET /tanks/{id}/report
    d) Backend: analyze_tank() → get metrics
    e) Backend: services.generate_report_from_llm() → call OpenAI
    f) If OpenAI available:
       - Format prompt with bioload, score, issues
       - Call gpt-3.5-turbo
       - Get response text
    g) If OpenAI unavailable:
       - generate_fallback_report() → static Turkish report
    h) Frontend: parse response text
    i) Frontend: format with sections, bullets, colors
    j) Render in #ai-report-content
```

### 7.4 Chat Widget Communication

```
User types message → "Balıklarım kaç beslenmelidir?"
    ↓
handleChatSend():
    
    a) Validate message not empty
    b) Append user message to chat-body
    c) Build chat context (tank, fish, plants)
    d) POST /tanks/{id}/chat with message
    e) Backend: fetch tank and relationships
    f) Backend: create context dict
    g) Backend: call services.get_ai_chat_response()
    h) LLM: receives tank context + user message
    i) LLM: generates contextual response
    j) Response sent back to frontend
    k) Append AI response to chat-body
    l) Scroll to bottom
```

---

## 8. TANK LIFECYCLE EXAMPLE

**Scenario: Beginner creates 100L community tank**

### Phase 1: Tank Creation (Day 0)
```
User Input:
- Name: "Community Tank"
- Volume: 100 liters
- Temperature: 25°C
- Has Filter: Yes
- Is Planted: Yes

Database State:
- Tank ID 1 created
- 0 fish, 0 plants
- Health Score: 100/100 (empty tank)
```

### Phase 2: Initial Stocking (Day 1)
```
User Action: Add 10 Neon Tetras (species_id = 5)

Backend Calculation:
- Bioload: 10 × 4cm × 0.8 = 32 units
- Bioload%: 32/100 = 32%
- Compatibility: All peaceful, same temp range
- Health Score: 100 - 0 - 0 = 100/100
- Status: GOOD ✓

Recommendation: "All parameters optimal!"
```

### Phase 3: Adding Medium Fish (Day 7)
```
User Action: Add 2 Angelfish (species_id = 8)

Backend Calculation:
- Additional Bioload: 2 × 15cm × 2.0 = 60 units
- Total Bioload: 32 + 60 = 92 units
- Bioload%: 92%
- Compatibility Issues: []  (Angelfish semi-aggressive but ok with Tetras)
- Health Score: 100 - 0 - 0 = 100/100
- Status: GOOD ✓

Recommendation: "Monitor for aggression, tank at ~90% capacity"
```

### Phase 4: Plant Addition (Day 10)
```
User Action: Add 3 Anubias Nana plants

Database Update:
- TankPlant records created for 3 plants
- Each plant reduces bioload by 2.5 units

Adjusted Bioload:
- Before: 92 units
- Plant reduction: 3 × 2.5 = 7.5 units
- After: 84.5 units (84.5% of tank)
- Health Score: Still 100/100 ✓
```

### Phase 5: Overstocking Crisis (Day 20)
```
User Action: Adds 5 Oscars (species_id = 14)

Backend Calculation:
- Additional Bioload: 5 × 35cm × 3.0 = 525 units
- Total Bioload: 84.5 + 525 = 609.5 units
- Bioload%: 609.5%
- Compatibility Issues:
  * "Aggressive fish mixed with peaceful fish" (-15 points)
  * "Considerable size difference detected" (-15 points)
  * "Oscar temp 23-27°C overlaps but Discus temp issues" (-15 points)
- Health Score: 
  * Base: 100
  * Bioload penalty: (609.5 - 100) × 0.5 = -254.75
  * Issues penalty: 3 × 15 = -45
  * Result: 100 - 254.75 - 45 = -199.75 → clamped to 0
  * Score: 0/100
- Status: DANGER ❌

Recommendations:
1. "Perform urgent water change and relocate excess fish"
2. "Separate incompatible species into different tanks"
3. "Immediate action required - aquarium ecosystem in crisis"

AI Report (LLM):
"⚠️ KRITIK DURUM
Akvaryumunuz fazla dolu! 609% biyolojik yük.
Oscar balıkları Neon Tetras'ı avlayacak. 
Hemen çoğu balığı başka tanka taşıyın!"
```

---

## 9. KEY CALCULATIONS & ALGORITHMS

### Bioload Calculation Algorithm
```
Input: Tank object, List of TankFish, List of TankPlant

total_bioload ← 0

for each fish in fishes:
    total_bioload += fish.quantity × species.adult_size_cm × species.bioload_factor

plant_reduction ← 0
for each plant in plants:
    plant_reduction += plant.quantity × 2.5

total_bioload ← max(0, total_bioload - plant_reduction)

if tank.size_liters > 0:
    bioload_percent ← (total_bioload / tank.size_liters) × 100
else:
    bioload_percent ← 0

return (total_bioload, bioload_percent)
```

### Compatibility Algorithm
```
Input: Tank object, List of TankFish

issues ← []

Extract species properties:
  aggression_levels ← [species.aggression_level for each species]
  sizes ← [species.adult_size_cm for each species]
  categories ← [species.category for each species]

Check Rules:

RULE 1: Aggression Mismatch
  if "high" in aggression_levels AND "low" in aggression_levels:
      issues.append("Aggressive fish mixed with peaceful fish")

RULE 2: Size-Based Predation
  max_size ← max(sizes)
  min_size ← min(sizes)
  if max_size > min_size × 3:
      issues.append("Size difference detected, predator-prey risk")

RULE 3: Environment Incompatibility
  if "saltwater" in categories AND "freshwater" in categories:
      issues.append("CRITICAL: Cannot mix saltwater and freshwater")

RULE 4: Temperature Tolerance
  for each species:
      if tank.temperature < species.min_temp OR tank.temperature > species.max_temp:
          issues.append(f"Temperature outside {species.name} tolerance range")

return issues
```

### Health Score Algorithm
```
Input: bioload_percent, issues list, has_filter boolean

score ← 100

// Bioload penalty: 0.5 points per percentage point over 100%
if bioload_percent > 100:
    overage ← bioload_percent - 100
    score -= overage × 0.5

// Issue penalty: 15 points per issue
score -= len(issues) × 15

// Filter penalty
if NOT has_filter:
    score -= 20

// Clamp to valid range
score ← max(0, min(100, score))

// Status classification
if score >= 80:
    status ← "good"
else if score >= 50:
    status ← "warning"
else:
    status ← "danger"

return (score, status)
```

---

## 10. AI INTEGRATION ARCHITECTURE

### OpenAI API Usage

**Model**: GPT-3.5-turbo
**Temperature**: Default (0.7, balanced creativity)
**Max Tokens**: 300 (concise responses)

**Endpoints Utilizing AI:**

| Endpoint | Purpose | Fallback |
|----------|---------|----------|
| `/tanks/{id}/report` | Multi-paragraph care plan | Formatted Turkish template |
| `/tanks/{id}/chat` | Contextual Q&A | Simple keyword matching |
| `/diagnose` | Problem diagnosis | Generic advice |

**Error Handling:**
```python
try:
    response = client.chat.completions.create(...)
    return response.choices[0].message.content
except Exception as e:
    log(f"OpenAI API failed: {e}")
    return generate_fallback_response()  # Use template
```

**Cost Estimation:**
- GPT-3.5-turbo: ~$0.0005 per 1K tokens
- Avg response: 200-300 tokens
- Per report: ~$0.0001-0.00015
- Per 1000 tanks: ~$0.10-0.15

---

## 11. PERFORMANCE & SCALABILITY CONSIDERATIONS

### Current Limitations

| Area | Limitation | Impact |
|------|-----------|--------|
| **Database** | SQLite (single-file) | Not suitable for > 100 concurrent users |
| **Bioload Calc** | O(n) fish iteration | Fast enough for typical tanks (5-20 fish) |
| **API Latency** | No caching | Report generation waits for OpenAI (2-5 sec) |
| **Chart.js** | Mock data hardcoded | Water quality not tracked over time |
| **Auth** | None implemented | Public API, no user isolation |

### Optimization Opportunities

1. **Database**: Migrate to PostgreSQL for concurrency
2. **Caching**: Redis for frequently accessed species data
3. **Async**: Use FastAPI `BackgroundTasks` for report generation
4. **Chart Data**: Implement telemetry collection and time-series storage
5. **Auth**: Add JWT authentication + per-user tank isolation
6. **Frontend**: Lazy load plant/species images

---

## 12. SUMMARY & ARCHITECTURE DIAGRAM

### Component Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (Browser)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ HTML/CSS/JS SPA                                            │ │
│  │ - Views: Aquariums, Dashboard, Fish, Plants, Analysis     │ │
│  │ - State: selectedTank, tanks[], charts                    │ │
│  │ - Chart.js: Water analysis visualization                  │ │
│  └──────────┬─────────────────────────────────────────────────┘ │
└─────────────┼──────────────────────────────────────────────────┘
              │
              │ HTTP REST (CORS enabled)
              │
┌─────────────▼──────────────────────────────────────────────────┐
│                   API LAYER (FastAPI)                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Routes & Endpoints                                         │ │
│  │ - Tank CRUD: POST /tanks/, GET /tanks/, DELETE /tanks/    │ │
│  │ - Fish Mgmt: POST /tanks/{id}/fish, GET /fish-species/    │ │
│  │ - Analysis: GET /tanks/{id}/analyze, /simulate            │ │
│  │ - AI: GET /tanks/{id}/report, POST /tanks/{id}/chat       │ │
│  │ - Plants: GET /plant-species/, POST /tanks/{id}/plants    │ │
│  └──────────┬────────────────────────────────────────────────┘ │
│  ┌──────────▼────────────────────────────────────────────────┐ │
│  │ Business Logic Layer (services.py)                         │ │
│  │ - calculate_bioload()  → Σ(qty × size × bioload_factor)   │ │
│  │ - calculate_compatibility() → Rule-based checks            │ │
│  │ - calculate_health_score() → Composite metric              │ │
│  │ - generate_report_from_llm() → OpenAI integration          │ │
│  │ - get_ai_chat_response() → Contextual chatbot              │ │
│  └──────────┬────────────────────────────────────────────────┘ │
└─────────────┼──────────────────────────────────────────────────┘
              │
              │ SQLAlchemy ORM
              │
┌─────────────▼──────────────────────────────────────────────────┐
│                  DATA LAYER (SQLAlchemy)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Models: Tank, FishSpecies, PlantSpecies, TankFish, TankPlant
│  │ - Relationships: Tank →[1:M] TankFish →[M:1] FishSpecies   │ │
│  │ - Cascade delete: Tank deleted → TankFish deleted          │ │
│  │ - Lazy loading: FishSpecies loaded with TankFish (joined)  │ │
│  └──────────┬────────────────────────────────────────────────┘ │
└─────────────┼──────────────────────────────────────────────────┘
              │
              │ CRUD Operations
              │
┌─────────────▼──────────────────────────────────────────────────┐
│                  DATABASE (SQLite)                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Tables:                                                    │ │
│  │ - tanks (id, name, size_liters, temperature, ...)         │ │
│  │ - fish_species (id, name, bioload_factor, ...)            │ │
│  │ - plant_species (id, name, benefits, ...)                 │ │
│  │ - tank_fishes (id, tank_id, species_id, quantity)         │ │
│  │ - tank_plants (id, tank_id, plant_id, quantity)           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
              │
              │ (External)
              │
┌─────────────▼──────────────────────────────────────────────────┐
│           EXTERNAL SERVICES (Optional)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ OpenAI API (gpt-3.5-turbo)                                 │ │
│  │ - For: Report generation, chat, diagnosis                  │ │
│  │ - Fallback: Hardcoded Turkish templates if unavailable     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. CONCLUSION

AquAssist is a **full-stack web application** that combines:

✅ **Data-driven analysis** (bioload calculations, compatibility rules)  
✅ **AI-powered insights** (OpenAI integration for reports & chat)  
✅ **Real-time dashboards** (Chart.js visualizations)  
✅ **Responsive UI** (Glassmorphism design, mobile-friendly)  
✅ **Extensible architecture** (clear separation of concerns)

**Key Strengths:**
- Comprehensive aquarium health assessment
- User-friendly interface for beginners
- AI assistance reduces learning curve
- Modular backend allows easy feature additions

**Future Enhancements:**
- User authentication & multi-user support
- Water quality time-series tracking
- Mobile app (React Native)
- Advanced simulations (biofilter maturation curves)
- Plant species growth calculator
- Community tank sharing & ratings

