import re
s = open("server.js", encoding="utf-8").read().split("\n")
for i, x in enumerate(s):
    if "master-routing" in x:
        print(i + 1, x)
