# AquAssist

An AI-powered aquarium assistant web application that helps users analyze their aquarium health, fish compatibility, stocking levels, and generates personalized care plans using an LLM API.

## Features

- **Tank Creation**: Define your tank size, temperature, and equipment.
- **Fish Management**: Add fish species and keep track of quantities.
- **Compatibility Analysis**: Rule-based logic to detect predator/prey or aggressive behavior.
- **Bioload Calculation**: Calculate stocking density based on fish size and bioload factors.
- **Health Score**: A comprehensive 0-100 score based on various tank parameters.
- **AI-Powered Reports**: Generates customized explanations and maintenance plans using OpenAI.
- **Problem Diagnosis**: Endpoint to analyze problems described by the user.

## Tech Stack

- **Backend**: Python, FastAPI, SQLite, SQLAlchemy, Pydantic, OpenAI API
- **Frontend**: HTML5, CSS3, Vanilla JS (Interacted with via REST APIs)

## Project Structure

```
aquassist/
├── backend/
│   ├── database.py       # SQLite connection setup
│   ├── main.py           # FastAPI entrypoint and routes
│   ├── models.py         # SQLAlchemy DB models
│   ├── schemas.py        # Pydantic schemas for data validation
│   ├── seed.py           # Database seeder (populates initial fish species)
│   ├── services.py       # Core business logic (scoring, bioload, AI integration)
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── index.html        # Main dashboard UI
│   ├── style.css         # Styling (Dark mode aesthetic)
│   └── app.js            # Frontend logic and API integration
└── README.md             # Project documentation
```

## How to Run

### 1. Backend Setup

Prerequisites: Python 3.9+

Open a terminal and navigate to the project directory:

```bash
cd backend

# Install dependencies (Consider doing this in a virtual environment)
pip install -r requirements.txt

# Run the database seed to populate fish species
python seed.py

# Optional: Set your OpenAI API key for AI features
# Windows: set OPENAI_API_KEY=your_api_key_here
# macOS/Linux: export OPENAI_API_KEY="your_api_key_here"

# Start the FastAPI server
uvicorn main:app --reload
```
The FastAPI backend will run on `http://localhost:8000`. You can view the API documentation at `http://localhost:8000/docs`.

### 2. Frontend Setup

You can simply open `frontend/index.html` in your web browser, or serve it using a simple HTTP server:

```bash
cd frontend
# Run a quick python server
python -m http.server 3000
```
Then navigate to `http://localhost:3000` in your browser.
