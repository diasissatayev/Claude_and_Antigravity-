#!/usr/bin/env python3
"""Run ONE `agy --print` call in an isolated scratch dir, then MOVE its outputs to their final paths.

WHY (validated 2026-06-26): agy snapshots every untracked file of any repo passed via `--add-dir`
on EVERY call (slow startup), and sandboxes write_file to project paths (rejection→replan round-trips).
Staging the read inputs + the writes in a neutral scratch dir gives **0 snapshots + 0 rejections**
with **byte-identical model output** — measured 15s/20snap/2rej → 9s/0/0, same extracted facts.
This generalizes the pattern the graphify integration ran in production (v1.5.1 and earlier). ZERO quality
cost: agy gets the identical prompt + identical input bytes and produces the identical output; only
the file's final location changes, and the move happens AFTER agy exits.

Usage:
  agy-task [--template NAME --var KEY=VALUE ...] [--tier flash|flash-lo|pro] [--timeout 360]
           [--in ABS_READ]... [--in-dir DIR]... [--out ABS_WRITE]... [--web] [--prompt "PROMPT"]

  --template NAME   load prompts/NAME.md and fill {{KEY}} placeholders from --var KEY=VALUE
                    (plus {{OUT}}, {{OUT2}}... = the --out paths and {{IN}}, {{IN2}}... = the --in paths)
  --web             the task needs the web (read_url / browser). Granted by /agy:setup's
                    permissions.allow rules; nothing extra is passed to agy.

The PROMPT should reference each --in path (the file agy reads) and each --out path (the file agy
writes via write_file), exactly as it would today. This helper transparently maps those absolute
paths to copies/targets inside a fresh scratch dir, runs `agy --add-dir <scratch>` ONLY, then moves
each produced --out from scratch to its final absolute path. Prints `MOVED <abs>` / `MISSING <abs>`;
exits non-zero if any --out was not produced (so the caller's existing failure handling kicks in).

Each call mints its OWN scratch dir → safe under the notebook fan-out (disjoint per concurrent call).
"""
import os, sys, shutil, subprocess, tempfile, argparse, glob

# agy plugin (merged): every call goes through scripts/agy-delegate.sh, so the Windows hang
# guard, quota/auth classification and the "limits" mod's signal file all apply here too.
# No --dangerously-skip-permissions: the scratch dir sits under AGY_WORK, which /agy:setup
# grants agy with a write_file(<AGY_WORK>) rule.
HERE = os.path.dirname(os.path.abspath(__file__))
DELEGATE = os.path.join(HERE, "agy-delegate.sh")
PROMPTS = os.path.normpath(os.path.join(HERE, "..", "prompts"))
WORK = os.environ.get("AGY_WORK") or os.path.join(os.path.expanduser("~"), ".agy-work")


def find_agy():
    a = os.environ.get("AGY_BIN") or shutil.which("agy") or shutil.which("agy.exe")
    if not a:
        c = os.path.expanduser("~/AppData/Local/agy/bin/agy.exe")
        if os.path.isfile(c):
            a = c
    return a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeout", default="360")
    ap.add_argument("--in", dest="ins", action="append", default=[])
    ap.add_argument("--in-dir", dest="indirs", action="append", default=[])
    ap.add_argument("--out", dest="outs", action="append", default=[])
    ap.add_argument("--prompt")
    ap.add_argument("--prompt-file")
    ap.add_argument("--tier", default=os.environ.get("AGY_TIER", "flash"))
    ap.add_argument("--template")
    ap.add_argument("--var", dest="vars", action="append", default=[])
    ap.add_argument("--web", action="store_true")
    a = ap.parse_args()

    agy = find_agy()
    if not agy:
        print("ERROR: agy not found (install https://antigravity.google or set AGY_BIN)"); return 2
    if a.template:
        tp = os.path.join(PROMPTS, a.template + ".md")
        try:
            prompt = open(tp, encoding="utf-8").read()
        except OSError:
            print(f"ERROR: no such template: {a.template} ({tp})"); return 2
        values = {}
        for i, p in enumerate(a.ins):
            values["IN" if i == 0 else f"IN{i + 1}"] = p
        for i, p in enumerate(a.outs):
            values["OUT" if i == 0 else f"OUT{i + 1}"] = p
        for kv in a.vars:
            k, _, v = kv.partition("=")
            values[k.strip()] = v
        for k, v in values.items():
            prompt = prompt.replace("{{" + k + "}}", v)
        if a.prompt:
            prompt += "\n\n" + a.prompt
    else:
        prompt = a.prompt if a.prompt is not None else (
            open(a.prompt_file, encoding="utf-8").read() if a.prompt_file else "")
    if not prompt.strip():
        print("ERROR: empty prompt"); return 1

    os.makedirs(WORK, exist_ok=True)
    scratch = tempfile.mkdtemp(prefix="scratch-", dir=WORK)
    mapping = []                       # (abs_path_in_prompt, scratch_abs) — for prompt rewrite
    for p in a.ins:
        sp = os.path.join(scratch, os.path.basename(p))
        try:
            shutil.copy(p, sp)
        except Exception as e:
            shutil.rmtree(scratch, ignore_errors=True)
            print(f"ERROR staging input {p}: {e}"); return 2
        mapping.append((p, sp))
    # --in-dir: stage every file of a directory into scratch and rewrite the dir reference to scratch
    for d in a.indirs:
        for f in glob.glob(os.path.join(d, "*")):
            if os.path.isfile(f):
                try:
                    shutil.copy(f, os.path.join(scratch, os.path.basename(f)))
                except Exception:
                    pass
        mapping.append((d.rstrip("\\/"), scratch))
    out_map = []                       # (scratch_abs, final_abs)
    for p in a.outs:
        sp = os.path.join(scratch, os.path.basename(p))
        out_map.append((sp, p)); mapping.append((p, sp))

    # rewrite the prompt's absolute paths -> scratch paths (longest first to avoid partial overlaps)
    for orig, sp in sorted(mapping, key=lambda x: -len(x[0])):
        prompt = prompt.replace(orig, sp)

    # Accept 360, 360s, 6m, 1h (commands speak minutes; agy wants a duration).
    t = str(a.timeout).strip().lower()
    mult = 3600 if t.endswith("h") else 60 if t.endswith("m") else 1
    try:
        secs = int(float(t.rstrip("hms") or "360") * mult)
    except ValueError:
        secs = 360
    to = f"{secs}s"
    bash = shutil.which("bash") or "bash"
    cmd = [bash, DELEGATE, "--tier", a.tier, "--dir", scratch, "--timeout", to, "-"]
    proc_timed_out = False
    result = None
    try:
        result = subprocess.run(cmd, input=prompt, capture_output=True, text=True, encoding="utf-8",
                                 errors="ignore", cwd=scratch,
                                 timeout=secs + 90, check=False)
    except subprocess.TimeoutExpired as e:
        proc_timed_out = True
        print(f"agy run error: timed out after {e.timeout}s (--print-timeout was {to})",
              file=sys.stderr)
    except Exception as e:
        print(f"agy run error: {e}", file=sys.stderr)

    if result is not None and (result.stdout or "").strip():
        print("AGY_REPLY_BEGIN")
        print(result.stdout.strip()[-4000:])
        print("AGY_REPLY_END")
    if result is not None and result.returncode not in (0, None):
        print(f"AGY_EXIT {result.returncode}")
        sig = [l for l in (result.stderr or "").splitlines() if l.startswith("AGY_SIGNAL")]
        if sig:
            print(sig[-1])

    missing = 0
    for sp, fp in out_map:
        if os.path.exists(sp) and os.path.getsize(sp) > 0:
            os.makedirs(os.path.dirname(fp) or ".", exist_ok=True)
            try:
                shutil.move(sp, fp)                      # atomic on same volume
            except Exception:
                try:
                    shutil.copy(sp, fp); os.remove(sp)   # cross-volume fallback
                except Exception as e:
                    print(f"MISSING {fp} (move failed: {e})"); missing += 1; continue
            print(f"MOVED {fp}")
        else:
            print(f"MISSING {fp}"); missing += 1

    if missing and not proc_timed_out:
        # agy_scratch.py's own exit-1 signal (`MISSING <path>`) gives no reason by itself —
        # surface why agy produced nothing, so a caller doesn't have to go diagnose it blind.
        if result is None:
            print("agy run reason: agy never ran (see 'agy run error' above)", file=sys.stderr)
        elif result.returncode != 0:
            print(f"agy run reason: agy exited {result.returncode}", file=sys.stderr)
        tail_err = (result.stderr or "").strip()[-2000:] if result else ""
        tail_out = (result.stdout or "").strip()[-2000:] if result else ""
        if tail_err:
            print(f"agy stderr (tail):\n{tail_err}", file=sys.stderr)
        elif tail_out:
            print(f"agy stdout (tail, no stderr):\n{tail_out}", file=sys.stderr)
        elif result is not None:
            print("agy produced no stdout/stderr at all (see agy-rescue.md 'concurrency "
                  "starvation' — likely another agy process running at the same time)",
                  file=sys.stderr)

    shutil.rmtree(scratch, ignore_errors=True)
    if not out_map:
        return result.returncode if result is not None else 2
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
