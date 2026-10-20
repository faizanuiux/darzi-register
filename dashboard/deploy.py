#!/usr/bin/env python3
"""Deploy the Darzi Register admin dashboard to Vercel as a NEW project.

Pattern: upload_file per file + create_deployment (same as tailor-app/deploy.py).
Steps:
  1. create_project "darzi-dashboard" (framework: nextjs)
  2. create_project_env for each required env var (so the build sees them)
  3. upload every source file
  4. create_deployment with the file refs (target: production)
"""
import hashlib, json, os, subprocess, sys, base64

SITE = os.path.dirname(os.path.abspath(__file__))
PROJECT_NAME = "darzi-dashboard"
VERCEL = "/opt/hatch/bin/vercel"

EXCLUDE_DIRS = {"node_modules", ".next", ".git", "__pycache__"}
EXCLUDE_FILES = {".env", ".env.local", "deploy.py"}
# The vercel CLI takes file bytes as a base64 CLI arg; files much over ~100KB
# hit the OS arg-length limit. package-lock.json (268KB) is the only real
# casualty — Vercel runs `npm install` from package.json instead.
# tsconfig.tsbuildinfo is a local build cache, never deployed.
MAX_FILE_BYTES = 100_000

SUPABASE_URL = "https://zfaehmpnfsgqsfypwiip.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_-av7DTOT_yDhHVXz0eCvQw_AMQPKhL-"

with open("/tmp/ent_secret.txt") as f:
    ENTITLEMENT_SECRET = f.read().strip()

# NOTE: SUPABASE_SERVICE_ROLE_KEY is intentionally NOT set here — it lives
# only in the Supabase dashboard and must be added by the owner after deploy.


def call_tool(name, args):
    r = subprocess.run([VERCEL, "call-tool", "--name", name,
                        "--arguments-json", json.dumps(args)],
                       capture_output=True, text=True, timeout=180)
    return json.loads(r.stdout)


def sha1_of(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_files():
    out = []
    for root, dirs, files in os.walk(SITE):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fn in files:
            if fn in EXCLUDE_FILES:
                continue
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, SITE)
            if os.path.getsize(full) > MAX_FILE_BYTES:
                print(f"  skipping oversized file: {rel}", flush=True)
                continue
            out.append(rel)
    return sorted(out)


def fail(res, label):
    txt = json.dumps(res)
    if '"error"' in txt and 'isError' in txt:
        print(f"  FAILED [{label}]: {txt[:800]}")
        sys.exit(1)


# 1. create the project
print(f"creating project '{PROJECT_NAME}'...", flush=True)
res = call_tool("create_project", {
    "requestBody": {"name": PROJECT_NAME, "framework": "nextjs"},
})
out = json.dumps(res)
if "already exists" not in out and '"error"' in out and 'isError' in out:
    print(f"  create_project note: {out[:400]}")
else:
    print("  ok (project ready)")

# 2. env vars (must exist before the build runs)
ENV_VARS = [
    ("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL, "plain"),
    ("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY, "plain"),
    ("ENTITLEMENT_SECRET", ENTITLEMENT_SECRET, "sensitive"),
]
for key, value, vtype in ENV_VARS:
    print(f"setting env {key}...", flush=True)
    res = call_tool("create_project_env", {
        "idOrName": PROJECT_NAME,
        "upsert": "true",
        "requestBody": {
            "key": key,
            "value": value,
            "target": ["production", "preview"],
            "type": vtype,
        },
    })
    fail(res, f"env {key}")
    print("  ok")

# 3. upload files
files = collect_files()
print(f"uploading {len(files)} files...", flush=True)
refs = []
for rel in files:
    path = os.path.join(SITE, rel)
    size = os.path.getsize(path)
    digest = sha1_of(path)
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    res = call_tool("upload_file", {
        "requestBody": b64,
        "xVercelDigest": digest,
        "contentLength": size,
    })
    fail(res, f"upload {rel}")
    refs.append({"file": rel, "sha": digest, "size": size})
print(f"  all {len(refs)} uploaded")

# 4. create the deployment
print("creating deployment...", flush=True)
res = call_tool("create_deployment", {
    "idOrName": PROJECT_NAME,
    "requestBody": {
        "name": PROJECT_NAME,
        "files": refs,
        "target": "production",
        "projectSettings": {"framework": "nextjs"},
    },
})
print(json.dumps(res, indent=1)[:3000])
