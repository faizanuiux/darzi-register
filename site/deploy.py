#!/usr/bin/env python3
"""Deploy tailor app (Darzi Register) to Vercel as a NEW project."""
import hashlib, json, os, subprocess, sys, base64

SITE = os.path.dirname(os.path.abspath(__file__))
PROJECT_NAME = "darzi-register"
VERCEL = "/opt/hatch/bin/vercel"
FILES = ["index.html", "app.html", "manifest.json", "sw.js", "icon.svg", "icon-512.png", "icon-192.png", "version.json", "admin.html", "config.js", "shot-hero.png", "shot-list.png", "shot-detail.png", "shot-extras.png"]
# NOTE: darzi-register.apk is intentionally NOT deployed with the site anymore
# (81MB exceeds the CLI arg limit, and the download buttons now point at the
# externally hosted APK). Local copies stay on disk as backups.

def call_tool(name, args):
    r = subprocess.run([VERCEL, "call-tool", "--name", name,
                        "--arguments-json", json.dumps(args)],
                       capture_output=True, text=True, timeout=120)
    return json.loads(r.stdout)

def sha1_of(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

refs = []
for rel in FILES:
    path = os.path.join(SITE, rel)
    size = os.path.getsize(path)
    digest = sha1_of(path)
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    print(f"uploading {rel} ({size}b, sha {digest[:8]}...)", flush=True)
    res = call_tool("upload_file", {
        "requestBody": b64,
        "xVercelDigest": digest,
        "contentLength": size,
    })
    txt = json.dumps(res)
    if '"error"' in txt and 'isError' in txt:
        print(f"  FAILED: {txt[:500]}")
        sys.exit(1)
    print(f"  ok")
    refs.append({"file": rel, "sha": digest, "size": size})

print(f"creating deployment (new project '{PROJECT_NAME}')...", flush=True)
res = call_tool("create_deployment", {
    "idOrName": PROJECT_NAME,
    "requestBody": {
        "name": PROJECT_NAME,
        "files": refs,
        "target": "production",
        "projectSettings": {"framework": None},
    },
})
out = json.dumps(res, indent=1)
print(out[:3000])
