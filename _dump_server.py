s = open("server.js", encoding="utf-8").read().split("\n")
for start, end in [(298, 380), (736, 800), (771, 800)]:
    print("=== lines", start + 1, "to", end, "===")
    for i in range(start, min(end, len(s))):
        print(i + 1, s[i])
