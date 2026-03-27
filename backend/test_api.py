import urllib.request
import json
import traceback

base = "http://localhost:8000"

def do_req(method, path, data=None):
    url = f"{base}{path}"
    headers = {"Content-Type": "application/json"}
    enc_data = json.dumps(data).encode() if data else None
    
    # Using Request object with distinct method to support POST/GET properly
    req = urllib.request.Request(url, data=enc_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"ERROR on {method} {url}: {e}")
        if hasattr(e, 'read'):
            print(e.read().decode())
        traceback.print_exc()
        return None

def run_tests():
    print("--- 1. Testing GET /tanks/ ---")
    tanks = do_req("GET", "/tanks/")
    print(tanks)

    print("\n--- 2. Testing POST /tanks/ ---")
    tank = do_req("POST", "/tanks/", {"name": "Test Env Tank", "size_liters": 100})
    print(tank)
    
    if tank:
        tank_id = tank.get("id")
        
        print(f"\n--- 3. Testing POST /tanks/{tank_id}/fish ---")
        fish = do_req("POST", f"/tanks/{tank_id}/fish", {"species_id": 1, "quantity": 10})
        print(fish)
        
        print(f"\n--- 4. Testing GET /tanks/{tank_id}/analyze ---")
        analysis = do_req("GET", f"/tanks/{tank_id}/analyze")
        print(analysis)
        
        print(f"\n--- 5. Testing POST /tanks/{tank_id}/simulate ---")
        sim = do_req("POST", f"/tanks/{tank_id}/simulate", [{"species_id": 2, "quantity": 1}])
        print(sim)

        print(f"\n--- 6. Testing GET /tanks/{tank_id}/report (without actual openai key) ---")
        report = do_req("GET", f"/tanks/{tank_id}/report")
        print(report)

    print("\n--- 7. Testing POST /diagnose ---")
    diag = do_req("POST", "/diagnose", {"description": "Water is green"})
    print(diag)

if __name__ == '__main__':
    run_tests()
