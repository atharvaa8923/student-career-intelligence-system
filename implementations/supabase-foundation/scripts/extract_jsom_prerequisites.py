"""Convert allowlisted legacy prerequisite INSERTs into auditable candidates."""
from pathlib import Path
import hashlib
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: extract_jsom_prerequisites.py SOURCE_SQL OUTPUT_SQL")
source, output = Path(sys.argv[1]), Path(sys.argv[2])
raw = source.read_bytes()
pattern = re.compile(
    r"^INSERT INTO course_prerequisites .*?SELECT '([0-9a-f-]{36})', '([0-9a-f-]{36})', "
    r"'([0-9a-f-]{36})', '([a-z]+)', ([0-9]+) ", re.I
)
rows = []
for line_number, line in enumerate(raw.decode("utf-8").splitlines(), 1):
    if not line.startswith("INSERT INTO course_prerequisites "):
        continue
    match = pattern.search(line)
    if not match:
        raise SystemExit(f"unparsed prerequisite statement at line {line_number}")
    rows.append((line_number, *match.groups()))
if len(rows) != 202:
    raise SystemExit(f"expected 202 prerequisite statements, found {len(rows)}")

values = ",\n".join(
    f"({line},'{edge}','{course}','{required}','{kind}',{group_id})"
    for line, edge, course, required, kind, group_id in rows
)
output.write_text(f"""\\set ON_ERROR_STOP on
begin;
drop schema if exists import_stage cascade;
create schema import_stage;
create table import_stage.prerequisite_candidates(
 source_line int primary key, legacy_id uuid not null, course_id uuid not null,
 requires_course_id uuid not null, prerequisite_type text not null, group_id int not null
);
insert into import_stage.prerequisite_candidates values
{values};
commit;
""", encoding="utf-8")
print(f"sha256={hashlib.sha256(raw).hexdigest()}")
print(f"prerequisite_candidates={len(rows)}")
