# 🐠 AquAssist — Teknik Sunum Detayları

## 📋 İçindekiler
1. [Proje Özeti](#proje-özeti)
2. [Mimarisi](#mimarisi)
3. [Teknoloji Stack](#teknoloji-stack)
4. [Veritabanı Tasarımı](#veritabanı-tasarımı)
5. [Backend Detayları](#backend-detayları)
6. [Frontend Detayları](#frontend-detayları)
7. [Temel Algoritmalar](#temel-algoritmalar)
8. [Veri Akışı](#veri-akışı)
9. [AI Entegrasyonu](#ai-entegrasyonu)
10. [Öne Çıkan Özellikler](#öne-çıkan-özellikler)

---

## 🎯 Proje Özeti

### Ne?
**AquAssist**, akvaryum yöneticilerine yardımcı olan, **yapay zeka destekli web uygulaması**

### Neden?
- Balık uyumluluğu kontrol etmek zor
- Akvaryumun sağlığını ölçmek kompleks
- Bakım planlarını otomatize etmek isteniyor

### Kime?
- Akvaryum meraklıları
- Başlangıç seviyesi balık tutucuları

---

## 🏗️ Mimarisi

```
AquAssist (Web Uygulaması)
│
├─── FRONTEND (Vanilla JavaScript)
│    ├─ app.js        → Single Page App (SPA) kontrolcüsü
│    ├─ index.html    → 5 görünüm + 6 modal dialog
│    └─ style.css     → Glassmorphism tasarımı
│
├─── BACKEND (Python FastAPI)
│    ├─ main.py       → 14 API endpoint
│    ├─ models.py     → 5 SQLAlchemy veritabanı modeli
│    ├─ services.py   → İş mantığı (algoritma)
│    ├─ schemas.py    → Pydantic veri doğrulama
│    ├─ database.py   → SQLite bağlantısı
│    └─ seed.py       → 16 balık türü yükleme
│
└─── DATABASE (SQLite)
     ├─ tanks         → Akvaryumlar
     ├─ fish_species  → Balık katalog
     ├─ tank_fishes   → Akvaryumdaki balıklar
     ├─ plant_species → Bitki katalog
     └─ tank_plants   → Akvaryumdaki bitkiler
```

---

## 💻 Teknoloji Stack

| Katman | Teknoloji | Kullanım |
|--------|-----------|---------|
| **Frontend** | HTML5, CSS3 | İnterface (Glassmorphism) |
| | Vanilla JavaScript | SPA kontrolcüsü |
| | Chart.js | Grafik çizimi |
| | FontAwesome | İkonlar |
| **Backend** | Python 3.9+ | Programlama dili |
| | FastAPI | Web framework (REST API) |
| | SQLAlchemy | ORM (veritabanı) |
| | Pydantic | Veri doğrulama |
| | OpenAI API | Yapay zeka (ChatGPT) |
| **Database** | SQLite | Dosya tabanlı DB |
| **Deployment** | Uvicorn | ASGI sunucu |
| | Python HTTP Server | Frontend sunucusu |

---

## 🗄️ Veritabanı Tasarımı

### ERD (Entity-Relationship Diagram)

```
┌─────────────────┐
│     tanks       │ ← Akvaryumlar
├─────────────────┤
│ id (PK)         │
│ name            │ "Yaşam Akvaryumu"
│ size_liters     │ 100L
│ temperature     │ 26.5°C
│ has_filter      │ TRUE
│ is_planted      │ TRUE
└────┬────────────┘
     │ 1:N
     │
     ├─────────────────────────────────────────────┐
     │                                             │
┌────▼──────────────┐                ┌────────────▼────┐
│   tank_fishes     │                │  tank_plants    │
├───────────────────┤                ├─────────────────┤
│ id (PK)           │                │ id (PK)         │
│ tank_id (FK)  ─────→ tanks         │ tank_id (FK) ──→ tanks
│ species_id (FK)───┐                │ plant_id (FK) ──┐
│ quantity      5   │                │ quantity    3   │
│ added_at      ✓   │                │ added_at    ✓   │
└───────────────────┘                └─────────────────┘
         │                                   │
         │ N:1                               │ N:1
         │                                   │
         └────────────────┬───────────────────┘
                          │
        ┌─────────────────▼───────────────────┐
        │                                     │
┌───────▼─────────┐              ┌───────────▼───┐
│ fish_species    │              │ plant_species │
├─────────────────┤              ├───────────────┤
│ id (PK)         │              │ id (PK)       │
│ name            │              │ name          │
│ min_temp        │              │ difficulty    │
│ max_temp        │              │ light_req     │
│ aggression_level│              │ benefits      │
│ adult_size_cm   │              └───────────────┘
│ bioload_factor  │
│ difficulty_level│
│ compatibility_  │
│ tags            │
└─────────────────┘
```

### Tablolar Detayı

**tanks** — Akvaryum bilgisi
- `id`: Benzersiz kimlik
- `name`: İsim ("Yaşam Akvaryumu")
- `size_liters`: Hacim (100, 200, 500 vb.)
- `temperature`: Sıcaklık (°C)
- `has_filter`: Filtre var mı?
- `is_planted`: Bitki var mı?

**fish_species** — Balık kataloğu (16 tane)
```
Örnek: Betta Fish
- id: 32
- name: "Betta"
- category: "freshwater"
- min_temp: 24.0
- max_temp: 28.0
- aggression_level: "high" ⚠️
- adult_size_cm: 7.0
- bioload_factor: 1.5 (yüksek!)
- compatibility_tags: "aggressive,solitary"
- difficulty_level: "easy"
```

**tank_fishes** — Akvaryumdaki balıklar
```
Örnek: Yaşam Akvaryumu'nda 5 adet Neon Tetra
- id: 101
- tank_id: 1 → tanks.id
- species_id: 5 → fish_species.id (Neon Tetra)
- quantity: 5
- added_at: 2024-04-21 14:30:00
```

---

## ⚙️ Backend Detayları

### Backend Mimarisi

```python
FastAPI Application
├─ Middleware: CORS (Tüm originlerden istekleri kabul et)
│
├─ Endpoints:
│  ├─ POST /tanks/                   → Yeni akvaryum oluştur
│  ├─ GET /tanks/                    → Tüm akvaryumları listele
│  ├─ GET /tanks/{id}                → Belirli akvaryum getir
│  ├─ DELETE /tanks/{id}             → Akvaryum sil
│  ├─ POST /tanks/{id}/fish          → Balık ekle
│  ├─ DELETE /tanks/{id}/fish/{fid}  → Balık çıkar
│  ├─ POST /tanks/{id}/simulate      → Tank simülasyonu
│  ├─ GET /fish_species/             → Balık kataloğu
│  ├─ GET /plants_species/           → Bitki kataloğu
│  ├─ POST /tanks/{id}/plant         → Bitki ekle
│  ├─ DELETE /tanks/{id}/plant/{pid} → Bitki çıkar
│  ├─ POST /analysis/health          → Sağlık analizi
│  ├─ POST /ai/report                → AI raporu (ChatGPT)
│  └─ POST /ai/chat                  → AI chat (ChatGPT)
│
└─ Database Layer: SQLite + SQLAlchemy ORM
```

### API Endpoint Örnekleri

#### 1️⃣ POST /tanks/ — Yeni Akvaryum Oluştur

**İstek:**
```json
{
  "name": "Yaşam Akvaryumu",
  "size_liters": 100,
  "temperature": 26.5,
  "has_filter": true,
  "is_planted": true
}
```

**Cevap (201 Created):**
```json
{
  "id": 1,
  "name": "Yaşam Akvaryumu",
  "size_liters": 100,
  "temperature": 26.5,
  "has_filter": true,
  "is_planted": true
}
```

#### 2️⃣ POST /tanks/{tank_id}/fish — Balık Ekle

**İstek:**
```json
{
  "species_id": 5,    # Neon Tetra
  "quantity": 5       # 5 adet
}
```

**Cevap:**
```json
{
  "tank_id": 1,
  "species": {
    "id": 5,
    "name": "Neon Tetra",
    "adult_size_cm": 5.0,
    "bioload_factor": 0.8
  },
  "quantity": 5
}
```

#### 3️⃣ POST /analysis/health — Sağlık Analizi

**İstek:**
```json
{
  "tank_id": 1
}
```

**Cevap:**
```json
{
  "health_score": 78,
  "status": "warning",
  "bioload": {
    "total": 45.2,
    "percent": 45.2
  },
  "compatibility_issues": [
    "Aggressive fish mixed with peaceful fish."
  ],
  "recommendations": [
    "Tür uyumsuzluğu tespit edildi. Balıkları ayırmayı planlayın."
  ]
}
```

---

## 🎨 Frontend Detayları

### Görünümler (Views)

Frontend **5 ana görünümden** oluşuyor:

| # | Görünüm | HTML ID | Fonksiyon |
|---|---------|---------|----------|
| 1 | 📊 Dashboard | `view-dashboard` | Hızlı özet, son aktiviteler |
| 2 | 🐠 Akvaryumlar | `view-aquariums` | Akvaryum listesi |
| 3 | 📈 Su Kalitesi | `view-analytics` | Grafik (pH, NH3, NH4) |
| 4 | 📚 Rehber | `view-guide` | Balık ve bitki kataloğu |
| 5 | ⚙️ Ayarlar | `view-settings` | Sistem ayarları |

### Modal Dialoglar (6 tane)

```javascript
1. Modal "Yeni Akvaryum"     → tank oluştur (isim, hacim, temp, filtre, bitki)
2. Modal "Balık Ekle"        → tank_fish ekle (tür, miktar)
3. Modal "Su Analizi"        → su parametreleri göster
4. Modal "Tank Detayları"    → tank bilgisi ve rapor
5. Modal "Balık Kataloğu"    → filtreli tür listesi
6. Modal "AI Asistan"        → ChatGPT ile sohbet
```

### Veri Akışı (Frontend)

```javascript
Uygulama Başlatma
  ↓
1. DOMContentLoaded Event
  ├─ wireModals()         → Modal dinleyicileri bağla
  ├─ preloadSpecies()     → GET /fish_species (16 balık türü)
  ├─ preloadPlants()      → GET /plants_species (bitkiler)
  └─ renderAquariumList() → GET /tanks (akvaryumları yükle)
  
Kullanıcı "Yeni Akvaryum" butonuna tıklar
  ↓
createTankModal açılır → Modal doldurur → "Kaydet" butonuna tıklar
  ↓
POST /tanks/ (JavaScript fetch)
  ↓
Backend: TankCreate → models.Tank → SQLite insert
  ↓
Response: Tank JSON (id=1)
  ↓
Frontend: renderAquariumList() → UI'ye eklenir
```

### JavaScript Ana Fonksiyonlar

```javascript
// Görünüm yönetimi
showView(name)              → Görünüm değiştir
toggleModal(id)             → Modal aç/kapat
renderAquariumList()        → Akvaryum listesini çiz

// API Çağrıları
async function apiCall(method, endpoint, data)
  POST /tanks/            → Akvaryum oluştur
  GET /tanks/{id}         → Akvaryum detayı
  POST /tanks/{id}/fish   → Balık ekle
  POST /analysis/health   → Sağlık skoru
  POST /ai/report         → AI raporu

// UI Render
renderTankDashboard(tank)   → Tank paneli çiz
updateHealthScore(score)    → Sağlık göstergesi
renderWaterChart(param)     → Su kalitesi grafik
```

---

## 🧮 Temel Algoritmalar

### 1️⃣ Bioload Hesaplama (BİO-YÜK)

**Ne:** Akvaryumdaki toplam kirlilik seviyesi

**Formula:**
```
BioLoad = Σ(Balık Sayısı × Balık Boyu × Bioload Faktörü) - Bitki İndirimi

Örnek:
- 5 adet Neon Tetra (5cm, 0.8 faktör):    5 × 5 × 0.8  = 20 bioyük
- 2 adet Oscar (20cm, 2.5 faktör):       2 × 20 × 2.5 = 100 bioyük
- 3 adet bitki (her biri 2.5 indirimi):  3 × 2.5      = 7.5 indirim
───────────────────────────────────────────────────────
TOPLAM = 20 + 100 - 7.5 = 112.5 (akvaryum 100L ise %112.5 → ⚠️ FAZLA)
```

**Kod:**
```python
def calculate_bioload(tank, fishes, plants=[]):
    total_bioload = 0.0
    
    # Her balık için: quantity × size × bioload_factor
    for tf in fishes:
        species = tf.species
        total_bioload += tf.quantity * species.adult_size_cm * species.bioload_factor
    
    # Bitkiler indirim sağlıyor (her bitki 2.5 bioyük azaltır)
    plant_reduction = len(plants) * 2.5
    total_bioload = max(0.0, total_bioload - plant_reduction)
    
    # % hesapla
    bioload_percent = (total_bioload / tank.size_liters) * 100
    
    return total_bioload, bioload_percent
```

---

### 2️⃣ Uyumluluk Kontrolü (COMPATIBILITY)

**Kontroller:**
```
❌ HATA 1: Agresif + Barışçıl balık karışımı
         "Aggressive fish mixed with peaceful fish"

❌ HATA 2: Boy farkı > 3x
         "Considerable size difference → predator-prey conflict"

❌ HATA 3: Tuzlu + Tatlısu karışımı
         "CRITICAL: Saltwater and freshwater cannot live together"

❌ HATA 4: Sıcaklık uyumsuzluğu
         "Tank temperature (25°C) outside bounds for Discus (28-31°C)"
```

**Kod:**
```python
def calculate_compatibility(tank, fishes):
    issues = []
    species_list = [tf.species for tf in fishes if tf.species]
    
    # Kontrol 1: Agresiflik
    aggression = [s.aggression_level for s in species_list]
    if "high" in aggression and "low" in aggression:
        issues.append("Aggressive fish mixed with peaceful fish.")
    
    # Kontrol 2: Boy farkı
    sizes = [s.adult_size_cm for s in species_list]
    if max(sizes) > min(sizes) * 3:
        issues.append("Size difference → predator-prey conflict")
    
    # Kontrol 3: Sıcaklık
    for s in species_list:
        if tank.temperature < s.min_temp or tank.temperature > s.max_temp:
            issues.append(f"Temperature mismatch for {s.name}")
    
    return issues
```

---

### 3️⃣ Sağlık Skoru (HEALTH SCORE)

**Formül:**
```
Score = 100
  - (bioload > 100 ? (bioload - 100) × 0.5 : 0)  # Fazla yük cezası
  - (uyumsuzluk sayısı × 15)                       # Her sorun -15
  - (filtre yoksa ? 20 : 0)                        # Filtre yok -20

Min: 0, Max: 100
```

**Örnek:**
```
Başlangıç: 100
- Bioload 150% → -25 puan
- 2 uyumsuzluk → -30 puan
- Filtre var → -0 puan
────────────────
FINAL SCORE: 45 🔴 DANGER
```

**Kod:**
```python
def calculate_health_score(bioload_percent, issues, has_filter):
    score = 100.0
    
    # Bioload cezası
    if bioload_percent > 100:
        score -= (bioload_percent - 100) * 0.5
    
    # Her sorun -15 puan
    score -= len(issues) * 15
    
    # Filtre cezası
    if not has_filter:
        score -= 20
    
    # 0-100 aralığında sınırla
    score = max(0.0, min(100.0, score))
    
    # Durum belirleme
    status = "danger" if score < 50 else "warning" if score < 80 else "good"
    
    return score, status
```

---

### 4️⃣ Tavsiye Üretme (RECOMMENDATIONS)

```python
def generate_recommendations(bioload_percent, has_filter, issues):
    actions = []
    
    # Tavsiye 1: Fazla yük
    if bioload_percent > 100:
        actions.append("Acilen su değişimi yapın ve fazla balıkları başka tanka aktarın")
    
    # Tavsiye 2: Filtre
    if not has_filter:
        actions.append("Filtre edinin ve sürekli çalıştırın")
    
    # Tavsiye 3: Sıcaklık
    if any("temperature" in i.lower() for i in issues):
        actions.append("Sıcaklığı uygun aralığa ayarlayın")
    
    # Tavsiye 4: Uyumsuzluk
    if any("aggressive" in i.lower() for i in issues):
        actions.append("Uyumsuz balıkları ayırmayı planlayın")
    
    return actions or ["Mevcut dengeyi korumaya devam edin!"]
```

---

## 🔄 Veri Akışı

### Senaryo: Yeni Akvaryum Oluşturma

```
FRONTEND (Kullanıcı)
    │
    ├─ "Yeni Akvaryum" butonunu tıkla
    │       │
    │       └─ createTankModal açılır
    │           ├─ İsim: "Yaşam Akvaryumu"
    │           ├─ Hacim: 100L
    │           ├─ Sıcaklık: 26.5°C
    │           ├─ Filtre: ✓
    │           └─ Bitki: ✓
    │
    └─ "Kaydet" butonuna tıkla
        │
        ├─ JavaScript: fetch('POST', '/tanks/', {...})
        │
        └─→ BACKEND (FastAPI)
            │
            ├─ main.py: @app.post("/tanks/")
            │   │
            │   ├─ Pydantic doğrulama (schemas.TankCreate)
            │   │
            │   ├─ models.Tank() instance oluştur
            │   │
            │   └─ SQLAlchemy: db.add() → db.commit()
            │       │
            │       └─→ DATABASE (SQLite)
            │           │
            │           ├─ INSERT INTO tanks
            │           │   (name, size_liters, temperature, has_filter, is_planted)
            │           │ VALUES
            │           │   ('Yaşam Akvaryumu', 100, 26.5, 1, 1)
            │           │
            │           └─ ✓ Veritabanında kaydedildi (ID=1)
            │
            └─ Response JSON'ı gönder
                {
                  "id": 1,
                  "name": "Yaşam Akvaryumu",
                  "size_liters": 100,
                  "temperature": 26.5,
                  "has_filter": true,
                  "is_planted": true
                }

FRONTEND
    │
    └─ renderAquariumList() çalıştır
        │
        ├─ UI'ye ekle: "Yaşam Akvaryumu (100L)"
        │
        └─ Yeni akvaryuma tıklanabilir durum
```

---

### Senaryo: Balık Ekleme ve Sağlık Analizi

```
Kullanıcı: "Yaşam Akvaryumu"'na 5 Neon Tetra eklemek istiyor
    │
    ├─ Akvaryuma tıkla → "Balık Ekle" modal
    │   ├─ Tür: Neon Tetra (id=5) seç
    │   └─ Miktar: 5 gir
    │
    ├─ POST /tanks/1/fish
    │   {
    │     "species_id": 5,
    │     "quantity": 5
    │   }
    │
    └─→ BACKEND
        │
        ├─ Tank bulundu: id=1
        ├─ Species bulundu: Neon Tetra (size=5cm, bioload=0.8)
        ├─ TankFish ekle: quantity=5
        └─ db.commit()

Ardından: POST /analysis/health {"tank_id": 1}
    │
    └─→ BACKEND (services.py)
        │
        ├─ calculate_bioload(tank, fishes, plants)
        │   └─ BioLoad = 5 × 5 × 0.8 = 20 (100L'de %20)
        │
        ├─ calculate_compatibility(tank, fishes)
        │   └─ Hiç uyumsuzluk yok (5 adet aynı tür) ✓
        │
        ├─ calculate_health_score(20%, [], true)
        │   └─ Score = 100 - 0 - 0 - 0 = 100 🟢 GOOD
        │
        └─ Response:
            {
              "health_score": 100,
              "status": "good",
              "bioload": {"total": 20, "percent": 20},
              "compatibility_issues": [],
              "recommendations": ["Mevcut dengeyi korumaya devam edin!"]
            }

FRONTEND
    │
    └─ UI Güncelle:
        ├─ 🟢 Health Score: 100/100
        ├─ 📊 Bioload: 20%
        ├─ ✓ Uyumlu
        └─ Tank görünüm başarılı
```

---

## 🤖 AI Entegrasyonu

### OpenAI ChatGPT Kullanımı

**Amacı:** Akvaryum sahibine kişiselleştirilmiş tavsiyeleri Türkçe sunmak

**İşleyiş:**

```
1. Kullanıcı: "Bu tank için ne yapmalıyım?" sorunu sorar
   │
   └─ Frontend: POST /ai/report {"tank_id": 1}
      │
      └─→ BACKEND (services.py)
          │
          ├─ Sağlık verisi topla:
          │  ├─ bioload_percent: 45%
          │  ├─ issues: ["Aggressive mix"]
          │  └─ recommendations: [...]
          │
          ├─ ChatGPT Prompt Hazırla:
          │  """
          │  Sen balık akvaryum uzmanısın.
          │  Bu tank hakkında Türkçe rapor yaz:
          │  - Sağlık Skoru: 78/100
          │  - Bioload: 45%
          │  - Sorunlar: Agresif balık uyumsuzluğu
          │  
          │  Tavsiye ve bakım planı ver.
          │  """
          │
          ├─ client = OpenAI(api_key=OPENAI_API_KEY)
          │  response = client.chat.completions.create(
          │      model="gpt-3.5-turbo",
          │      messages=[{"role": "user", "content": prompt}]
          │  )
          │
          └─ Response: ChatGPT'den AI yazısı
             "Tank sağlığı iyi durumda. Agresif balıkları..."

2. FRONTEND
   │
   └─ Rapor modal'de göster:
      ├─ 📄 AI Raporu:
      │  "Tank sağlığı iyi durumda. Agresif balıkları..."
      └─ 🔄 Yenile butonunu tıkla (yeni rapor al)
```

**API Anahtarı Ayarı (gerekli):**
```powershell
# Windows PowerShell'de
$env:OPENAI_API_KEY = "sk-..."
uvicorn main:app --reload

# Veya:
set OPENAI_API_KEY=sk-...
```

---

## ⭐ Öne Çıkan Özellikler

### 1. 🌈 Glassmorphism Tasarımı
- Kütüphanelerden bağımsız, saf CSS
- Bulanık arka plan efekti
- Renkli gradient'ler
- Mobil uyumlu

### 2. 📊 Chart.js Grafikleri
- Su kalitesi parametreleri (pH, NH3, NH4)
- Zaman serisi grafiği
- İnteraktif noktalar

### 3. 🔄 CORS Middleware
```python
# Tüm originlerden istek kabul et (Frontend ve Backend aynı makinede)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 4. 🗄️ Cascade Delete
```python
# Akvaryum silinirse, balıklar otomatik silinir
class Tank(Base):
    fishes = relationship("TankFish", cascade="all, delete-orphan")
    plants = relationship("TankPlant", cascade="all, delete-orphan")
```

### 5. 📱 Modal Dialog Sistemi
6 tane, her biri farklı görevde:
- Yeni akvaryum
- Balık ekle
- Su analizi
- Tank detayları
- Balık kataloğu
- AI asistan

### 6. 🧮 Real-Time Sağlık Skorlaması
- Bioload hesaplama (anlık)
- Uyumluluk kontrolü
- Skor rengine göre (🟢🟡🔴)

### 7. 🤖 AI Chat Asistanı
- Canlı sohbet
- Türkçe desteği
- Akvaryum danışmanı

---

## 🚀 Performans & Ölçeklenebilirlik

### Mevcut Durum
- ✅ Küçük-orta ölçekli (16 balık türü, 50 tank)
- ✅ SQLite (dosya tabanlı)
- ✅ Uvicorn (tek işçi)

### Geliştirebilecekler
- PostgreSQL'e geçiş (ölçeklenebilirlik)
- Gunicorn (multi-worker)
- Caching (Redis)
- Asynchronous celery (AI çağrıları)
- Frontend: React/Vue'ye geçiş

---

## 📝 Özet Tablosu

| Başlık | Detay |
|--------|-------|
| **Proje Adı** | AquAssist |
| **Amaç** | Akvaryum yönetimi ve AI danışmanlığı |
| **Frontend** | HTML5, CSS3, Vanilla JS, Chart.js |
| **Backend** | Python, FastAPI, SQLAlchemy |
| **DB** | SQLite (5 tablo) |
| **API** | 14 REST endpoint |
| **Balık Türü** | 16 adet |
| **Temel Algoritma** | Bioload, Compatibility, Health Score |
| **AI** | OpenAI ChatGPT (Türkçe) |
| **Port** | Frontend: 3000, Backend: 8000 |
| **Status** | ✅ Tam Fonksiyonel |

---

## 🎤 Sunum Sırası (Önerisi)

1. **Giriş** (1 dk): "Ne yapmak istedim, neden?"
2. **Canlı Demo** (3 dk): Uygulamayı çalıştır, bir tank oluştur, balık ekle
3. **Mimarisi** (2 dk): Frontend/Backend ayrımını göster
4. **Veritabanı** (1 dk): ERD çiz, ilişkileri açıkla
5. **Algoritmalar** (3 dk): Bioload, Compatibility, Health Score formülleri
6. **Kod Örnekleri** (2 dk): İmportant kod parçaları göster
7. **AI Entegrasyonu** (1 dk): ChatGPT nasıl entegre edildi?
8. **Sonuç** (1 dk): Yapılan işler, gelecek planlar

**Toplam: ~15 dakika**

---

**Hazırladığı Tarih:** 21 Nisan 2026
**Developer:** Siz 🎓
