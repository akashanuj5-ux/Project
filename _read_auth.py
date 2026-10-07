import os
base = os.path.dirname(os.path.abspath(__file__))

def dump(name, n=9000):
    p = os.path.join(base, name)
    print("=" * 20, name, "=" * 20)
    print(open(p, encoding="utf-8").read()[:n])

dump("src/lib/auth.tsx", 7000)
dump("src/lib/api.ts", 7000)
dump("src/lib/types.ts", 9000)
