#!/usr/bin/env python3
"""Configure Antigravity CLI for the agy plugin, safely and idempotently.

  agy-setup apply              # status line (quota → ~/.agy-work/status.json) + narrow permissions
  agy-setup allow-write <dir>  # one more write_file(<dir>) grant, for a project the person approved
  agy-setup revoke-write <dir> # remove such a grant
  agy-setup show               # print the agy settings this plugin manages

Only touches ~/.gemini/antigravity-cli/settings.json, keeps every other key, and writes a .bak
next to it before the first change. Grants, all narrow:
  write_file(<AGY_WORK>)  Gemini may write only inside its own work folder
  read_url(*)             read web pages (research, scraping, URL media)
  execute_url(*)          open pages in agy's browser (design review, recordings)
Shell commands stay un-granted: headless agy cannot run them unless a task passes --yolo.
"""
import json
import os
import shutil
import sys

HOME = os.path.expanduser("~")
SETTINGS = os.path.join(HOME, ".gemini", "antigravity-cli", "settings.json")
WORK = os.environ.get("AGY_WORK") or os.path.join(HOME, ".agy-work")
HERE = os.path.dirname(os.path.abspath(__file__))
STATUSLINE = os.path.join(HERE, "agy-statusline.mjs")


def native(p):
    """Windows-native absolute path (agy.exe does not understand /c/Users/...)."""
    p = os.path.expanduser(p)
    # Git Bash style /c/Users/... → C:/Users/...
    if len(p) > 2 and p[0] == "/" and p[1].isalpha() and p[2] == "/":
        p = p[1].upper() + ":" + p[2:]
    p = os.path.abspath(p)
    if os.name == "nt":
        p = p.replace("/", "\\")
    return p


def load():
    try:
        with open(SETTINGS, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        print(f"ERROR: cannot parse {SETTINGS}: {e} — fix or remove it, then re-run")
        sys.exit(2)


def save(cfg):
    os.makedirs(os.path.dirname(SETTINGS), exist_ok=True)
    if os.path.exists(SETTINGS) and not os.path.exists(SETTINGS + ".bak"):
        shutil.copy(SETTINGS, SETTINGS + ".bak")
    tmp = SETTINGS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    os.replace(tmp, SETTINGS)


def allow(cfg, rule):
    perms = cfg.setdefault("permissions", {})
    lst = perms.setdefault("allow", [])
    if rule not in lst:
        lst.append(rule)
        return True
    return False


def apply():
    os.makedirs(WORK, exist_ok=True)
    cfg = load()
    changed = []
    # agy runs this through `cmd /c` on Windows, which mangles a command line that STARTS with a
    # quote. Use the bare `node` from PATH and quote the script only when its path has spaces.
    script = native(STATUSLINE)
    cmd = "node " + (f'"{script}"' if " " in script else script)
    sl = cfg.get("statusLine") if isinstance(cfg.get("statusLine"), dict) else None
    if not sl or sl.get("command") != cmd:
        if sl and sl.get("command") and "agy-statusline" not in sl.get("command", ""):
            print(f"note: replacing your own statusLine command: {sl.get('command')}")
        cfg["statusLine"] = {"type": "command", "command": cmd, "stack_with_default": True}
        changed.append("statusLine → quota file for the limits mod")
    for rule in (f"write_file({native(WORK)})", "read_url(*)", "execute_url(*)"):
        if allow(cfg, rule):
            changed.append(f"permissions.allow += {rule}")
    # Never spend paid AI credits silently once the plan quota is gone.
    if cfg.get("useG1Credits") is not False:
        cfg["useG1Credits"] = False
        changed.append("useG1Credits = false (no paid overage)")
    if changed:
        save(cfg)
    print("SETUP_OK " + ("; ".join(changed) if changed else "already configured"))
    print(f"work folder: {native(WORK)}")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "show"
    if cmd == "apply":
        apply()
    elif cmd in ("allow-write", "revoke-write"):
        if len(sys.argv) < 3:
            print("usage: agy-setup allow-write|revoke-write <dir>")
            return 1
        d = native(sys.argv[2])
        if not os.path.isdir(d):
            print(f"ERROR: not a folder: {d}")
            return 1
        if d.rstrip("\\/") in (native(HOME).rstrip("\\/"), "C:", "C:\\"):
            print("ERROR: refusing to grant your whole home folder or drive — pick the project folder")
            return 1
        cfg = load()
        rule = f"write_file({d})"
        lst = cfg.setdefault("permissions", {}).setdefault("allow", [])
        if cmd == "allow-write":
            if rule not in lst:
                lst.append(rule)
                save(cfg)
            print(f"GRANTED {rule}")
        else:
            if rule in lst:
                lst.remove(rule)
                save(cfg)
            print(f"REVOKED {rule}")
    else:
        cfg = load()
        print(json.dumps({k: cfg.get(k) for k in ("statusLine", "permissions", "useG1Credits", "model")}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
