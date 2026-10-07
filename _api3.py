import json, os, urllib.request, urllib.error

BASE = "http://localhost:5000"
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_TOKEN_FILE = os.path.join(_BASE_DIR, "_token.txt")

def read_token():
    try:
        with open(_TOKEN_FILE) as f:
            return f.read().strip()
    except Exception:
        return None

def write_token(t):
    with open(_TOKEN_FILE, "w") as f:
        f.write(t)

def request(path, method="GET", body=None, token=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except urllib.error.URLError as e:
        return None, "URL error: " + str(e.reason)

def post_json(path, body, token=None):
    st, txt = request(path, "POST", body, token)
    try:
        return st, json.loads(txt) if txt else None
    except Exception:
        return st, {"raw": txt}

def get_json(path, token=None):
    st, txt = request(path, "GET", None, token)
    try:
        return st, (json.loads(txt) if txt else None)
    except Exception:
        return st, {"raw": txt}

if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    cmd = args[0]
    token = None
    if cmd == "token":
        token = args[1]
        write_token(token)
        print("token set")
        sys.exit(0)
    if cmd == "signup":
        st, body = post_json("/api/auth/signup", {"email": args[1], "password": args[2], "full_name": args[3] if len(args) > 3 else "Test Admin"})
        print("SIGNUP", st, json.dumps(body))
        sys.exit(0)
    if cmd == "get":
        st, body = get_json(args[1], read_token())
        print("STATUS", st)
        print(json.dumps(body, indent=1)[:6000])
    elif cmd == "post":
        with open(args[2]) as f:
            body = json.load(f)
        st, out = post_json(args[1], body, read_token())
        print("STATUS", st, json.dumps(out)[:4000])
    elif cmd == "patch":
        with open(args[2]) as f:
            body = json.load(f)
        st, txt = request(args[1], "PATCH", body, read_token())
        print("STATUS", st, txt[:4000])
