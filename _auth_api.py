import json, urllib.request, urllib.error, sys

BASE = "http://localhost:5000"

def request(path, method="GET", body=None, token=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except urllib.error.URLError as e:
        return None, f"URL error: {e.reason}"

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
    args = [a for a in sys.argv[1:]]
    cmd = args[0]
    token = None
    if cmd == "signup":
        st, body = post_json("/api/auth/signup", {"email": args[1], "password": args[2], "full_name": args[3] if len(args) > 3 else "Test Admin"})
        print("SIGNUP", st, json.dumps(body))
        sys.exit(0)
    if cmd == "settoken":
        token = args[1]
    elif cmd == "get":
        st, body = get_json(args[1], token)
        print("GET", st, json.dumps(body)[:6000])
    elif cmd == "post":
        with open(args[2]) as f:
            body = json.load(f)
        st, out = post_json(args[1], body, token)
        print("POST", st, json.dumps(out)[:4000])
    elif cmd == "patch":
        with open(args[2]) as f:
            body = json.load(f)
        st, txt = request(args[1], "PATCH", body, token)
        print("PATCH", st, txt[:4000])
