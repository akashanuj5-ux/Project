import os
base = os.path.dirname(os.path.abspath(__file__))
print(open(os.path.join(base, "src/lib/permissions.ts"), encoding="utf-8").read())
