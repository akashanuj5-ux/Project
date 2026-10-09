import json, urllib.request, urllib.error

BASE = "http://localhost:5000/api/master-routing"

def get(path):
    with urllib.request.urlopen(BASE + path) as r:
        return r.status, dict(r.headers), json.loads(r.read().decode("utf-8"))

def post(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return r.status, json.loads(r.read().decode("utf-8"))

def patch(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("usage: api.py get <path> | post <path> <json> | patch <path> <json>")
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "get":
        st, h, body = get(sys.argv[2])
        print("STATUS", st)
        print("HEADERS", h)
        print(json.dumps(body, indent=1)[:4000])
    elif cmd == "post":
        st, body = post(sys.argv[2], json.loads(sys.argv[3]))
        print("STATUS", st, body)
    elif cmd == "patch":
        st, body = patch(sys.argv[2], json.loads(sys.argv[3]))
        print("STATUS", st, body)
