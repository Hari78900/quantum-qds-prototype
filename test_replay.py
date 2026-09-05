import urllib.request, json

payload = json.dumps({"eigenstate": "|+〉", "attack_mode": "baseline", "nonce": "TEST_TOKEN_JUDGE_DEMO"}).encode("utf-8")

for attempt in [1, 2]:
    req = urllib.request.Request("http://localhost:8000/api/verify", data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        res = json.loads(r.read().decode())
        print(f"Pulse Attempt {attempt}: Status = {res['interlock_status']} | Nonce Audit = {res['classical_pki']['replay_check']}")
