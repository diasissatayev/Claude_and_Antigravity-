#!/usr/bin/env python3
"""Local NotebookLM sweep, run end to end by ONE script — no Claude subagents.

The original plugin fanned out one Claude subagent per document; each subagent costs tens of
thousands of Claude tokens just to start. Here the sweep is plain Python: it lists and classifies
the folder, calls agy (through agy_task.py → agy-delegate.sh) in parallel waves, retries what the
per-minute quota throttled, writes stubs for what still failed, builds the SQLite knowledge base and
the index + master summary. Claude reads only INDEX.md and SUMMARY.md at the end.

Usage:
  python notebook_run.py <folder> <objective> [--out DIR] [--workers N] [--semantic] [--yes]

Prints progress lines and, last, `NOTEBOOK_DONE outdir=... docs=... ok=... failed=... cached=...`.
Exit 3 with `NEEDS_CONFIRM rows=N` when more than 30 documents would be processed and --yes
was not given (the caller asks the person, then re-runs with --yes).
"""
import argparse
import glob
import hashlib
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
TASK = os.path.normpath(os.path.join(HERE, "..", "agy_task.py"))
PY = sys.executable
EXTS = (".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".md")
MAXV, CHUNK, GROUP_MAX, CHAR_BUDGET = 20, 15, 4, 24000
STUB = """---
doc: {doc}
estado: no_procesado
relevancia: 0
---
Не удалось обработать после повторов (таймаут или лимит Gemini). Запусти /agy:notebook ещё раз — готовые документы повторно не обрабатываются.
"""


def log(msg):
    print(msg, flush=True)


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(s))[0].lower()).strip("-")
    return s[:60] or "doc"


def facts_of(summary_path):
    return summary_path[: -len(".resumen.md")] + ".facts.json"


def scan(folder, outdir, objective):
    """Phase 0: list, classify (text vs vision), incremental cache, pack text docs into groups.
    Writes _manifest.tsv in the format notebook_job.py / notebook_db.py read."""
    try:
        import fitz  # PyMuPDF
    except Exception:
        fitz = None
        log("note: PyMuPDF is not installed — every PDF is read by Gemini's vision (slower).")
    os.makedirs(os.path.join(outdir, "_text"), exist_ok=True)
    objhash = hashlib.sha1(objective.strip().encode("utf-8")).hexdigest()[:8]
    prev = {}
    cache_path = os.path.join(outdir, "_cache.tsv")
    if os.path.exists(cache_path):
        for ln in open(cache_path, encoding="utf-8"):
            pp = ln.rstrip("\n").split("\t")
            if len(pp) == 2:
                prev[pp[0]] = pp[1]
    files = sorted(f for f in glob.glob(os.path.join(folder, "*")) if f.lower().endswith(EXTS) and os.path.isfile(f))
    rows, small = [], []

    def cached(summ, key):
        return os.path.exists(os.path.join(outdir, summ)) and prev.get(summ) == key

    for i, f in enumerate(files, 1):
        nn, sl, st = f"{i:03d}", slug(f), os.stat(f)
        key = f"{st.st_size}:{int(st.st_mtime)}:{objhash}"
        low = f.lower()
        mode, tpath, nchars, d, pages = "vision", "-", 0, None, 0
        if low.endswith((".txt", ".md")):
            txt = open(f, encoding="utf-8", errors="ignore").read()
            mode, nchars = "text", len(txt.strip())
            tpath = os.path.join(outdir, "_text", f"{nn}-{sl}.txt")
            open(tpath, "w", encoding="utf-8").write(txt)
        elif low.endswith(".pdf") and fitz is not None:
            try:
                d = fitz.open(f)
                pages = d.page_count
                txt = "\n".join(p.get_text() for p in d)
                if pages and len(txt.strip()) / pages >= 200:
                    mode, nchars = "text", len(txt.strip())
                    tpath = os.path.join(outdir, "_text", f"{nn}-{sl}.txt")
                    open(tpath, "w", encoding="utf-8").write(txt)
            except Exception:
                mode, d = "vision", None
        if mode == "vision" and d is not None and pages > MAXV:
            os.makedirs(os.path.join(outdir, "_chunks"), exist_ok=True)
            for ci, start in enumerate(range(0, pages, CHUNK), 1):
                end = min(start + CHUNK, pages)
                cpath = os.path.join(outdir, "_chunks", f"{nn}-{sl}-p{start + 1:03d}-{end:03d}.pdf")
                sub = fitz.open()
                sub.insert_pdf(d, from_page=start, to_page=end - 1)
                sub.save(cpath)
                sub.close()
                summ = f"{nn}-{sl}-p{start + 1:03d}-{end:03d}.resumen.md"
                k = f"{key}:c{ci}"
                rows.append((nn, "cached" if cached(summ, k) else "vision", cpath, "-", summ, k))
        elif mode == "text":
            summ = f"{nn}-{sl}.resumen.md"
            if cached(summ, key):
                rows.append((nn, "cached", os.path.abspath(f), tpath, summ, key))
            else:
                small.append((nn, sl, tpath, os.path.abspath(f), key, nchars))
        else:
            summ = f"{nn}-{sl}.resumen.md"
            rows.append((nn, "cached" if cached(summ, key) else "vision", os.path.abspath(f), tpath, summ, key))
        if d is not None:
            d.close()
    batches, cur, cc = [], [], 0
    for it in small:
        if cur and (len(cur) >= GROUP_MAX or cc + it[5] > CHAR_BUDGET):
            batches.append(cur)
            cur, cc = [], 0
        cur.append(it)
        cc += it[5]
    if cur:
        batches.append(cur)
    for gi, b in enumerate(batches, 1):
        if len(b) == 1:
            nn, sl, tpath, srcabs, key, _ = b[0]
            rows.append((nn, "text", srcabs, tpath, f"{nn}-{sl}.resumen.md", key))
            continue
        rows.append((f"G{gi:02d}", "group",
                     "|".join(x[2] for x in b),
                     "|".join(f"{x[0]}-{x[1]}" for x in b),
                     "|".join(f"{x[0]}-{x[1]}.resumen.md" for x in b),
                     "|".join(x[4] for x in b)))
    rows.sort(key=lambda r: r[0])
    with open(os.path.join(outdir, "_manifest.tsv"), "w", encoding="utf-8") as m:
        for r in rows:
            m.write("\t".join(r) + "\n")
    return files, rows


def run_task(args, timeout_s):
    cmd = [PY, TASK] + args
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore",
                           timeout=timeout_s + 180)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, "timeout"


def task_for(row, outdir, objective, tier):
    nn, mode, src, tpath, summ, _ = row
    if mode == "group":
        texts, names, summs = src.split("|"), tpath.split("|"), summ.split("|")
        outs, members = [], []
        for t, n, s in zip(texts, names, summs):
            sp = os.path.join(outdir, s)
            outs += [sp, facts_of(sp)]
            members.append(f"- input: {t}\n  summary: {sp}\n  sidecar: {facts_of(sp)}\n  name: {n}")
        args = ["--template", "notebook-group", "--tier", tier, "--timeout", "360",
                "--var", f"OBJECTIVE={objective}", "--var", "MEMBERS=" + "\n".join(members)]
        for t in texts:
            args += ["--in", t]
        for o in outs:
            args += ["--out", o]
        return args, outs
    sp = os.path.join(outdir, summ)
    read = tpath if mode == "text" else src
    args = ["--template", "notebook-doc", "--tier", tier, "--timeout", "360",
            "--var", f"OBJECTIVE={objective}", "--var", f"DOC_NAME={os.path.basename(src)}",
            "--in", read, "--out", sp, "--out", facts_of(sp)]
    return args, [sp, facts_of(sp)]


def missing_outputs(outs):
    return [o for o in outs if o.endswith(".resumen.md") and not (os.path.exists(o) and os.path.getsize(o) > 0)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("objective")
    ap.add_argument("--out")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--semantic", action="store_true")
    ap.add_argument("--yes", action="store_true")
    a = ap.parse_args()

    folder = os.path.abspath(a.folder)
    if not os.path.isdir(folder):
        log(f"ERROR: not a folder: {folder}")
        return 2
    outdir = os.path.abspath(a.out or os.path.join(folder, "_notebook"))
    os.makedirs(outdir, exist_ok=True)
    objective = a.objective.strip()

    files, rows = scan(folder, outdir, objective)
    todo = [r for r in rows if r[1] != "cached"]
    ncached = sum(1 for r in rows if r[1] == "cached")
    log(f"SCAN docs={len(files)} rows={len(rows)} cached={ncached} to_process={len(todo)} outdir={outdir}")
    if not files:
        log("NOTEBOOK_EMPTY: no supported documents (pdf, docx, doc, images, txt, md)")
        return 4
    if len(todo) > 30 and not a.yes:
        log(f"NEEDS_CONFIRM rows={len(todo)} (about {max(1, len(todo) // max(1, a.workers))} waves)")
        return 3

    job = os.path.join(HERE, "notebook_job.py")
    subprocess.run([PY, job, "init", outdir, objective], capture_output=True)

    # Phase 1: sweep in waves, two retry rounds for what the per-minute quota throttled.
    pending = todo
    for rnd in range(3):
        if not pending:
            break
        if rnd:
            log(f"retry round {rnd}: {len(pending)} left, waiting 60s for the per-minute quota")
            time.sleep(60)
        failed = []
        with ThreadPoolExecutor(max_workers=max(1, a.workers)) as pool:
            futs = {}
            for r in pending:
                tier = "flash"
                args, outs = task_for(r, outdir, objective, tier)
                futs[pool.submit(run_task, args, 360)] = (r, outs)
            for fut in as_completed(futs):
                r, outs = futs[fut]
                rc, out = fut.result()
                miss = missing_outputs(outs)
                if miss:
                    failed.append(r)
                    reason = next((l for l in out.splitlines() if l.startswith("AGY_SIGNAL")), "")
                    log(f"  miss {r[0]} ({len(miss)} file(s)) {reason}")
                    if "QUOTA_EXHAUSTED" in reason or "AUTH_REQUIRED" in reason:
                        log("STOP: " + ("Gemini quota exhausted" if "QUOTA" in reason else "agy is signed out — run agy and sign in"))
                        pool.shutdown(cancel_futures=True)
                        subprocess.run([PY, job, "sync", outdir], capture_output=True)
                        return 10 if "QUOTA" in reason else 11
                else:
                    log(f"  done {r[0]}")
        subprocess.run([PY, job, "sync", outdir], capture_output=True)
        pending = failed

    # Stubs for what still failed, so the index marks them and the next run retries them.
    nfailed = 0
    for r in pending:
        for s in r[4].split("|"):
            p = os.path.join(outdir, s)
            if not (os.path.exists(p) and os.path.getsize(p) > 0):
                open(p, "w", encoding="utf-8").write(STUB.format(doc=s.replace(".resumen.md", "")))
                nfailed += 1

    # Cache: every member whose summary exists and is not a stub.
    cache = []
    for r in rows:
        for s, k in zip(r[4].split("|"), r[5].split("|")):
            p = os.path.join(outdir, s)
            if os.path.exists(p) and os.path.getsize(p) > 0 and "estado: no_procesado" not in open(p, encoding="utf-8", errors="ignore").read(300):
                cache.append(f"{s}\t{k}")
    open(os.path.join(outdir, "_cache.tsv"), "w", encoding="utf-8").write("\n".join(cache) + ("\n" if cache else ""))

    # Knowledge base (SQLite) + optional semantic layer.
    db = subprocess.run([PY, os.path.join(HERE, "notebook_db.py"), outdir, objective], capture_output=True, text=True, encoding="utf-8", errors="ignore")
    log((db.stdout or db.stderr or "").strip().splitlines()[-1:] and (db.stdout or db.stderr).strip().splitlines()[-1] or "db: no output")
    if a.semantic:
        em = subprocess.run([PY, os.path.join(HERE, "notebook_embed.py"), outdir], capture_output=True, text=True, encoding="utf-8", errors="ignore")
        log((em.stdout or em.stderr or "").strip()[-300:])

    # Phase 2: index + master summary (Pro tier: the reasoning step).
    names = ["INDEX.md", "SUMMARY.md", "TIMELINE.md", "ENTITIES.md"]
    outs = [os.path.join(outdir, n) for n in names]
    args = ["--template", "notebook-index", "--tier", "pro", "--timeout", "600",
            "--var", f"OBJECTIVE={objective}", "--var", f"SUMMARIES_DIR={outdir}", "--in-dir", outdir]
    for o in outs:
        args += ["--out", o]
    rc, out = run_task(args, 600)
    miss = [o for o in outs if not (os.path.exists(o) and os.path.getsize(o) > 0)]
    if miss:
        log("index: missing " + ", ".join(os.path.basename(m) for m in miss))
    ok = sum(1 for r in rows for s in r[4].split("|")) - nfailed
    log(f"NOTEBOOK_DONE outdir={outdir} docs={len(files)} ok={ok} failed={nfailed} cached={ncached}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
