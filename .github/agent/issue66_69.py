from pathlib import Path
import re

path = Path('docs/analyser-program/04_LOCAL_RAG_DESIGN.md')
text = path.read_text(encoding='utf-8')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return source.replace(old, new)


candidate_pattern = re.compile(
    r"the §4 quota pools for `contradicts`, `coverage_basis`, and `limitation_basis` are\n"
    r"\s+reserved first, each filled with its highest-ranked qualifying rows; the remaining budget then\n"
    r"\s+takes `supports`/`contextualizes` rows in rank order\. Within every role the cap removes only\n"
    r"\s+the \*lowest-ranked\* rows of that role — never an arbitrary subset, and never a counter-evidence\n"
    r"\s+row in favour of a higher-ranked support row\."
)
candidate_replacement = """the §4 mandatory quota pools for `coverage_basis`, `limitation_basis`,
   `contradicts`, and `supports` are reserved first, each filled to its registered minimum from its
   highest-ranked qualifying rows; only after all four minima are secured may `contextualizes` or
   surplus rows consume the remaining budget in rank order. Within every role the cap removes only
   the *lowest-ranked discretionary* rows — never an arbitrary subset, never a mandatory
   counter-evidence row in favour of a support row, and never a required `supports_min` row in favour
   of contextual material."""
text, count = candidate_pattern.subn(candidate_replacement, text)
if count != 1:
    raise SystemExit(f'post-rank candidate cap: expected one block, found {count}')

ceiling_pattern = re.compile(
    r"   \*\*Eligible-set ceiling \(resource guard, still deterministic\)\.\*\*.*?(?=   \*\*Scope of that guarantee)",
    re.DOTALL,
)
ceiling_replacement = """   **Eligible-set ceiling (resource guard, still deterministic and role-aware).** If the
   eligible set exceeds a preregistered working ceiling (**R** 50,000 rows) beyond which ranking
   every row is impractical, the reader does **not** take a flat global prefix. Before distance
   ranking it assigns each eligible row one closed §4 evidence role using the same deterministic
   family registry and the fixed priority `coverage_basis → limitation_basis → contradicts →
   supports → contextualizes` for any multiply-qualified row.

   The ceiling is populated in two deterministic stages. First, each mandatory role
   (`coverage_basis`, `limitation_basis`, `contradicts`, and `supports`) receives a reservoir of up
   to the post-rank candidate cap (**R** 500) from that role, ordered by the total pre-cap key
   `(-support_count, window_start, feature_id, scope_alias, evidence_id)` ascending. The reservoirs
   are unioned and deduplicated by `evidence_id`. Second, every remaining ceiling slot is filled
   from all not-yet-admitted rows by the same total key; `contextualizes` has no reserved share
   because it has no minimum quota. `evidence_id` is unique within a pack, so the key remains an
   absolute final tie-break and physical row order cannot change the admitted working set.

   Reserving 500 rows per mandatory role costs at most 2,000 of the 50,000-row working ceiling and
   is sufficient for any final 500-row candidate pool. A support-count flood in one role therefore
   cannot erase another role before ranking, while the global second stage still uses spare capacity
   rather than partitioning the working set into fixed silos. This is a pre-rank resource guard, not
   a claim that truncation preserves full recall: whenever it binds the ordinary truncation
   limitation and per-role counts below are mandatory. **R**

"""
text, count = ceiling_pattern.subn(ceiling_replacement, text)
if count != 1:
    raise SystemExit(f'eligible-set ceiling: expected one block, found {count}')

text = replace_once(
    text,
    """carrying the eligible-row count, the
   ranked count, and the admitted count as bounded integers; `completeness` is lowered and the tier""",
    """carrying total and per-role eligible/admitted counts plus the ranked and final admitted totals
   as bounded integers; `completeness` is lowered and the tier""",
    'truncation evidence counts',
)

flow_pattern = re.compile(
    r"        ▼  §4 counter-evidence quota pools RESERVED per role from the ranked sequence\n"
    r"\s+│     \(contradicts / coverage_basis / limitation_basis filled FIRST — a global cap must\n"
    r"\s+│      never starve a role pool while qualifying counter-evidence exists; corrected\n"
    r"\s+│      2026-08-04 review round\)\n"
    r"\s+▼  candidate cap consumes the REMAINING budget from supporting rows\n"
    r"\s+│     \(RAG_CANDIDATE_POOL_TRUNCATED if it binds\)\n"
    r"\s+│\n"
    r"\s+▼  §4 counter-evidence quotas verified over the final set"
)
flow_replacement = """        ▼  §4 mandatory quota pools RESERVED per role from the ranked sequence
        │     (coverage_basis / limitation_basis / contradicts / supports minima filled FIRST —
        │      neither contextual material nor another role may starve a required pool)
        ▼  candidate cap consumes the REMAINING budget from contextual and surplus rows
        │     (RAG_CANDIDATE_POOL_TRUNCATED if it binds)
        │
        ▼  all §4 role quotas verified over the final set"""
text, count = flow_pattern.subn(flow_replacement, text)
if count != 1:
    raise SystemExit(f'retrieval flow diagram: expected one block, found {count}')

fill_pattern = re.compile(
    r"### 4\.2 Fill order \(budget safety\)\n\n.*?(?=\n### 4\.3 Shortfall → limitation → claim tier)",
    re.DOTALL,
)
fill_replacement = """### 4.2 Fill order (budget safety)

Slots are filled in the order **coverage → limitation → contradicts → supports** until every
registered minimum is met. Only then may `contextualizes` rows or surplus rows from any role consume
the remaining `total_max`. The post-rank candidate cap, `total_max`, and downstream G4 16,000-byte
input ceiling **D-charter** remove the lowest-ranked **discretionary** rows first. They never consume a
required minimum; if the available rows or byte budget cannot carry every minimum, the corresponding
§4.3 shortfall is emitted and the claim is lowered or refused. **R**

**I** This ordering is the whole mechanism. Natural relevance order can preferentially delete
counter-evidence, while a contextual flood can also consume the budget before `supports_min` is met.
Reserving every mandatory minimum makes both forms of cherry-picking structurally impossible rather
than merely policy-forbidden.
"""
text, count = fill_pattern.subn(fill_replacement, text)
if count != 1:
    raise SystemExit(f'quota fill order: expected one section, found {count}')

contradict_row = "| `contradicts` slots unfilled | `RAG_QUOTA_SHORTFALL_CONTRADICTING` | claim tier capped at `hypothesis`; a mandatory alternative `COUNTER_EVIDENCE_NOT_RETRIEVABLE` is added; deterministic-tier rendering is refused |"
support_row = "| `supports` slots unfilled | `RAG_QUOTA_SHORTFALL_SUPPORTING` | **abstention** — no claim is emitted; an ADR-24 `question` of kind `evidence_gap` records that minimum positive support was not retrievable |"
text = replace_once(text, contradict_row, support_row + '\n' + contradict_row, 'support shortfall row')

fx_pattern = re.compile(r'^\| `FX-RAG-09` degeneracy \+ scale corpus \|.*$', re.MULTILINE)
fx_replacement = '| `FX-RAG-09` degeneracy + scale corpus | feature dimensions that are constant, near-constant (`sd` ≤ ε), and single-observation by construction; an eligible set above the working ceiling where a flat support-ordered prefix would exclude each mandatory role; a post-rank contextual flood that would consume `supports_min`; and the same rows in several physical orders | degenerate-dimension guard, non-finite absence, role-aware pre-cap reservoirs, support-minimum preservation, deterministic ordering, truncation/shortfall recording |'
text, count = fx_pattern.subn(fx_replacement, text)
if count != 1:
    raise SystemExit(f'FX-RAG-09 row: expected one match, found {count}')

proof_pattern = re.compile(
    r"16\. \*\*Read-only proof\*\* — on all corpora: instrument every write path \(pack directory, snapshot,\n"
    r"\s+canonical SQLite store, findings and coverage tables\) for the duration of a retrieval task and\n"
    r"\s+assert \*\*zero\*\* writes originate from the retrieval module, including on the rejection-storm and\n"
    r"\s+hostile-pack paths where a \"record the finding\" reflex is most likely\. Binary; a write here is a\n"
    r"\s+CI-blocking defect, not a metric\."
)
proof_replacement = """16. **Read-only proof** — on all corpora: instrument every write path (pack directory, snapshot,
    canonical SQLite store, findings and coverage tables) for the duration of a retrieval task and
    assert **zero** writes originate from the retrieval module, including on the rejection-storm and
    hostile-pack paths where a "record the finding" reflex is most likely. Binary; a write here is a
    CI-blocking defect, not a metric.
17. **Role-aware eligible-ceiling proof** — on `FX-RAG-09`, place qualifying rows for each mandatory
    role below the prefix a flat `(-support_count, …)` order would admit, then flood `supports` above
    the 50,000-row ceiling. Assert the role reservoirs retain up to 500 rows per mandatory role, the
    union is independent of physical row order, per-role eligible/admitted counts are reported, and
    `RAG_CANDIDATE_POOL_TRUNCATED` is emitted. Binary.
18. **Support-minimum budget proof** — on `FX-RAG-09`, rank enough `contextualizes` rows ahead of every
    supporting row to fill both the 500-row candidate cap and the family `total_max`. Assert
    `supports_min` is reserved before contextual or surplus rows. Then remove one required supporting
    row and assert `RAG_QUOTA_SHORTFALL_SUPPORTING` plus abstention, never a quota-invalid claim. Binary."""
text, count = proof_pattern.subn(proof_replacement, text)
if count != 1:
    raise SystemExit(f'new quota proofs: expected one block, found {count}')

lines = text.splitlines()
threat_indexes = [i for i, line in enumerate(lines) if line.startswith('| **Index poisoning / ranking flooding** |')]
if len(threat_indexes) != 1:
    raise SystemExit(f'index-poisoning row: expected one match, found {len(threat_indexes)}')
lines[threat_indexes[0]] = '| **Index poisoning / ranking flooding** | Thousands of near-duplicate rows crafted to dominate top-*k*, starve counter-evidence, or let contextual rows consume the positive-support budget | (a) filter-then-rank limits ranking to the SQL-eligible set; (b) the pre-rank working ceiling reserves independent reservoirs for every mandatory role before global fill, so a support-count flood cannot erase another role; (c) duplicate collapse runs on the natural key before ranking; (d) the post-rank candidate cap reserves `coverage_basis`, `limitation_basis`, `contradicts`, and `supports` minima before any contextual or surplus row; (e) any ceiling/cap binding or role shortfall is explicit, never silent | `FX-RAG-08`, `FX-RAG-09`, §5.2 #17–18 |'
text = '\n'.join(lines) + '\n'

text = replace_once(
    text,
    """the §4.2 fill order guarantees that
shrinking a bundle to fit removes supporting evidence before counter-evidence. **R**""",
    """the §4.2 fill order guarantees that shrinking a bundle removes contextual and other
discretionary surplus before any registered role minimum. If every minimum cannot fit, retrieval
emits the matching shortfall and lowers or refuses the claim instead of truncating required evidence.
**R**""",
    'G4 bundle ordering',
)

path.write_text(text, encoding='utf-8', newline='\n')
