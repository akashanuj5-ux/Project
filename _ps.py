import subprocess, json

# find node PIDs and their command lines
try:
    import psutil
    for p in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if p.info['name'] == 'node.exe':
                print(p.info['pid'], ' | ', ' '.join(p.info['cmdline'] or []))
        except Exception:
            pass
except ImportError:
    print('no psutil')
