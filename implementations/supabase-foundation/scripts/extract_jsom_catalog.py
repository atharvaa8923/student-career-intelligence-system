"""Extract only allowlisted catalog INSERT statements from the legacy seed."""
from pathlib import Path
import hashlib
import sys

ALLOW = {"departments", "programs", "courses", "program_core_courses", "concentrations", "concentration_courses"}

if len(sys.argv) != 3:
    raise SystemExit("usage: extract_jsom_catalog.py SOURCE_SQL OUTPUT_SQL")
source = Path(sys.argv[1])
output = Path(sys.argv[2])
raw = source.read_bytes()
lines = raw.decode("utf-8").splitlines()
selected = []
for line in lines:
    stripped = line.strip()
    if not stripped.startswith("INSERT INTO "):
        continue
    table = stripped.split()[2]
    if table in ALLOW:
        if not stripped.endswith(";"):
            raise SystemExit(f"refusing multiline statement for {table}")
        selected.append(stripped)
    elif table in {"users", "students", "student_courses", "audit_log"}:
        continue
    else:
        raise SystemExit(f"unreviewed INSERT target: {table}")

counts = {table: sum(1 for line in selected if line.startswith(f"INSERT INTO {table} ")) for table in sorted(ALLOW)}
expected = {"departments": 15, "programs": 39, "courses": 331, "program_core_courses": 293, "concentrations": 72, "concentration_courses": 649}
if counts != expected:
    raise SystemExit(f"source counts changed: {counts!r}")
output.write_text("\\set ON_ERROR_STOP on\nset search_path=import_stage,public;\n" + "\n".join(selected) + "\n", encoding="utf-8")
print(f"sha256={hashlib.sha256(raw).hexdigest()}")
print(" ".join(f"{k}={v}" for k, v in counts.items()))
