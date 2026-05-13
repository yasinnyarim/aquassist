import urllib.request
import json

plants = [
    {"name": "Anubias Nana", "description": "Hardy, slow-growing.", "benefits": "Provides hiding spots, consumes nitrates.", "difficulty": "easy", "light_requirement": "low"},
    {"name": "Java Fern", "description": "Classic fern.", "benefits": "Reduces bioload.", "difficulty": "easy", "light_requirement": "low"},
    {"name": "Amazon Sword", "description": "Large background plant.", "benefits": "Roots remove toxins.", "difficulty": "medium", "light_requirement": "medium"}
]

for p in plants:
    req = urllib.request.Request("http://localhost:8000/plant-species/", data=json.dumps(p).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        response = urllib.request.urlopen(req)
        print("Success:", response.read().decode('utf-8'))
    except Exception as e:
        print("Error:", e)
