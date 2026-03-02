import urllib.request
import json
import random

BASE_URL = "http://localhost:3001/api"

def run_tests():
    # 1. Register
    username = f"testuser_{random.randint(1000,9999)}"
    password = "password123"

    print(f"Registering {username}...")
    req = urllib.request.Request(f"{BASE_URL}/auth/register",
                                 data=json.dumps({"username": username, "password": password}).encode('utf-8'),
                                 headers={'Content-Type': 'application/json'})

    try:
        response = urllib.request.urlopen(req)
        res_data = json.loads(response.read().decode('utf-8'))
        print("Register Success:", res_data)
        token = res_data['token']
    except Exception as e:
        print("Register failed:", e)
        return

    # 2. Update Budget
    print("\nUpdating budget...")
    budget_data = {"version": 5, "currentMonth": "2024-05", "income": 5000}
    req = urllib.request.Request(f"{BASE_URL}/budget",
                                 data=json.dumps(budget_data).encode('utf-8'),
                                 headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})

    try:
        response = urllib.request.urlopen(req)
        print("Update Success:", response.read().decode('utf-8'))
    except Exception as e:
        print("Update failed:", e)
        return

    # 3. Get Budget
    print("\nGetting budget...")
    req = urllib.request.Request(f"{BASE_URL}/budget",
                                 headers={'Authorization': f'Bearer {token}'})

    try:
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode('utf-8'))
        print("Get Success:", data)
    except Exception as e:
        print("Get failed:", e)

if __name__ == "__main__":
    run_tests()
