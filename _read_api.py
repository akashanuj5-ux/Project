import os
base = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(base, "src/lib/api.ts")
print(open(p, encoding="utf-8").read())
