import os
base = os.path.dirname(os.path.abspath(__file__))
print("=" * 20, "src/lib/auth.tsx", "=" * 20)
print(open(os.path.join(base, "src/lib/auth.tsx"), encoding="utf-8").read())
