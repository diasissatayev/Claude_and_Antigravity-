# shellcheck shell=bash
# Shared environment fixes, sourced by every script and hook of the agy plugin.
#
# 1. agy on PATH. The installer puts agy.exe in %LOCALAPPDATA%\agy\bin and adds that to the
#    user PATH, but a Claude Code session started before the install does not see it.
# 2. python3. On Windows `python3` is often the Microsoft Store stub that prints
#    "Python was not found" and exits 9009. When it is, route python3 to a real `python`.
# 3. AGY_WORK: the one folder agy may write to without --yolo. /agy:setup adds a
#    permissions.allow rule `write_file(<AGY_WORK>)` to agy's settings.json, so every staged
#    job (scratch dirs, transcripts, conversions) lives under it.

if ! command -v agy >/dev/null 2>&1; then
  for _agy_d in "${LOCALAPPDATA:-}/agy/bin" "${HOME:-}/AppData/Local/agy/bin"; do
    if [ -n "$_agy_d" ] && { [ -x "$_agy_d/agy.exe" ] || [ -x "$_agy_d/agy" ]; }; then
      PATH="$_agy_d:$PATH"; export PATH; break
    fi
  done
  unset _agy_d
fi

# AGY_PY is the interpreter for `exec` (a function cannot be exec'd).
AGY_PY=python3
if ! command python3 -c "" >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1 && python -c "import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)" >/dev/null 2>&1; then
    AGY_PY=python
    python3() { python "$@"; }
    export -f python3 2>/dev/null || true
  fi
fi
export AGY_PY
# Windows consoles default to cp1252; the scripts print Russian text and arrows.
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8

: "${AGY_WORK:=${HOME:-}/.agy-work}"
export AGY_WORK
# Every agy run appends "<epoch> AGY_USAGE {...}" here; the limits mod sums the last 5h / week.
: "${AGY_USAGE_LOG:=$AGY_WORK/usage.log}"
export AGY_USAGE_LOG
