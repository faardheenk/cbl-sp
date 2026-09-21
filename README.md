# City Broker — Reconciliation Interface

SharePoint Framework (SPFx) solution used by **City Brokers Limited (CBL)** to reconcile its own
premium/commission statements against the statements it receives from each insurer.

Every month CBL receives a statement from an insurer. That statement has to be lined up, transaction
by transaction, against CBL's own ledger: same placing number, same policy, same client, same amount.
Doing this by hand across thousands of rows is the problem this solution exists to solve.

The work is split in two:

| Part | Where it lives | What it does |
|---|---|---|
| **Matching engine** | Python / pandas service (**not in this repo**) | Reads the two uploaded statements and produces a first-pass match: exact / partial / no-match. |
| **Review interface** | This repo (SPFx + React + TypeScript) | Lets a human upload the statements, review what the engine produced, correct it, and teach the engine so it does not make the same mistake next month. |

The two halves never call each other. **The only handshake is SharePoint state** — files, folders,
and a `Status` column. There is no API endpoint anywhere in `src/`.

---

## Table of contents

1. [The three web parts](#1-the-three-web-parts)
2. [SharePoint storage layout](#2-sharepoint-storage-layout)
3. [Buckets](#3-buckets)
4. [Moves — the core interaction](#4-moves--the-core-interaction)
5. [Matrix — the three meanings](#5-matrix--the-three-meanings)
6. [Fingerprints](#6-fingerprints)
7. [How the Python service picks up and processes files](#7-how-the-python-service-picks-up-and-processes-files)
8. [The output.xlsx contract](#8-the-outputxlsx-contract)
9. [Saving from the interface](#9-saving-from-the-interface)
10. [Build and deploy](#10-build-and-deploy)
11. [Further reading](#11-further-reading)

---

## 1. The three web parts

### `Landing` — the work queue

`src/webparts/landing/`

A folder browser over the **Reconciliation Library**. Level one is insurers; level two is
reconciliation runs (one per upload, named `{date}_{folderId}`). Each run shows its `Status` badge,
and from here a user can:

- **Upload Statements** — the CBL file and the insurer file, into a new run folder (`UploadModal.tsx`).
- **Open** a run — deep-links to `Reconciliation.aspx?Insurance=…&Date=…`.
- **Re-run** a failed run — resets the folder and its files to `Status = Pending`, which is what puts
  it back in front of the Python service.
- **Set Matrix** — flags one run per insurer as the matrix run (see [§5](#5-matrix--the-three-meanings)).
- **View Matrix** — opens `Matrix/{INSURER}/history.xlsx` and renders every learned decision, with
  per-entry delete.

### `OnboardingInsurance` — teaching the system a new insurer

`src/webparts/onboardingInsurance/`

Every insurer sends a differently-shaped spreadsheet. Before a statement can be processed, its
columns must be mapped onto CBL's canonical field names. The user uploads a sample insurer file, the
form detects the header row, and each insurer column is mapped to one or more CBL fields.

The result is saved to the **`Mappings`** SharePoint list as
`{ Title: "INSURER NAME", ColumnMappings: "<JSON>" }`:

```json
{
  "Policy Number":  "PolicyNo_1",
  "Endorsement No": "PolicyNo_2",
  "Insured Name":   "ClientName",
  "Debit Amount":   "Amount"
}
```

Repeated `PolicyNo` mappings are auto-suffixed (`PolicyNo_1`, `PolicyNo_2`, …). Saving also creates
`Reconciliation Library/{INSURER}/` and `Matrix/{INSURER}/` if they do not exist. The row titled
`CBL` holds the mapping for CBL's own file.

### `Reconciliation` — the review screen

`src/webparts/reconciliation/`

The heart of the solution. Loads `output.xlsx` for one run and renders it as paired CBL / insurer
tables, one pair per bucket. This is where **moves** happen.

---

## 2. SharePoint storage layout

```
{site}/
├── Reconciliation Library/          ← document library, one folder per insurer
│   └── ALLIANZ/
│       └── 12 June 2026_47/         ← one reconciliation run; Status + Matrix columns live here
│           ├── cbl.xlsx             ← uploaded by the user
│           ├── insurer.xlsx         ← uploaded by the user
│           └── output.xlsx          ← written by Python, then rewritten on every Save
│
├── Matrix/                          ← document library, the learned memory
│   └── ALLIANZ/
│       └── history.xlsx             ← every manual decision ever made for this insurer
│
├── Mappings (list)                  ← Title = insurer name, ColumnMappings = JSON
└── Buckets  (list)                  ← InsuranceCompany, BucketName, BucketKey
```

Insurer names are always **uppercased and trimmed** when used as a folder name or a list key.

---

## 3. Buckets

A bucket is a category a CBL↔insurer pairing sits in. Three are fixed and always present; the rest
are configured per insurer.

| Bucket | Key | Row-id prefix | Meaning |
|---|---|---|---|
| Exact Matches | `exact` | `EM-n` | Engine matched CBL to insurer, amounts agree within tolerance. |
| Partial Matches | `partial` | `PM-n` | Engine found a relationship but amounts do not reconcile. |
| No Matches | `no-match` | `NM-n` | Nothing found. Split into two independent sheets, CBL and insurer. |
| *Dynamic* | e.g. `mise_en_demeure` | `DB{checksum}{NAME}-n` | Per-insurer custom category — "Disputed", "Write-Off", "Mise en Demeure". |

Dynamic buckets are defined in the **`Buckets`** list (`InsuranceCompany`, `BucketName`, `BucketKey`)
and travel with the workbook: the Python service writes a `_BucketConfig` sheet into `output.xlsx`
listing every bucket and its sheet name, and the frontend reads that sheet to know which extra tabs
to render (`fetchFiles.ts`). `BucketKey` must survive as an Excel sheet name — 31 characters or
fewer, no `\ / ? * : [ ]`, no leading or trailing apostrophe (`reconciliationBuckets.ts`).

Every row carries an `idx` of the form `{prefix}-{position}`. It is **positional, not stable** — it is
regenerated from scratch (`regenerateIdx`) every time a bucket's contents change. It identifies a row
within the current screen only; it is never persisted as an identity.

### Paired rows and spacer rows

In `exact`, `partial` and dynamic buckets the CBL table and the insurer table are rendered
side-by-side and **indexed in lockstep**: row *n* on the left faces row *n* on the right. A
one-to-many match (one CBL row against three insurer rows) therefore needs padding, so the shorter
side gets **blank spacer rows** — every column empty except the shared `group_id`. A row is
recognised as a spacer by `ProcessedAmount` being empty.

Spacers are presentation, not data. They are excluded from sums, excluded from fingerprints, and are
removed alongside the real row they were padding for.

### Group metadata

`group_id`, `match_group` and `match_condition` are **shared** across both sides when a merged sheet
row is split (`SHARED_ROW_METADATA` in `filterData.ts`). `group_id` comes from the engine and is what
makes selecting one row of a partial-match group select the whole group.

---

## 4. Moves — the core interaction

A **move** is a user taking a selection of rows out of one bucket and putting it into another. It is
the single unit of human correction, and it is the thing that gets remembered.

The flow is always the same (`Reconciliation.tsx`):

```
select rows  →  choose destination  →  Remarks modal  →  rows relocated in memory
                                                      →  undo entry recorded (session)
                                                      →  match-history entry recorded (durable)
```

### The move types

| Action | Destination | Recorded to `history.xlsx`? |
|---|---|---|
| **Move to Exact Match** | `exact` | Yes |
| **Move to Partial Match** | `partial` | No |
| **Unmatch** | `no-match` | No |
| **Move to &lt;dynamic bucket&gt;** | that bucket | Yes |
| **Regroup** | merge selection into an existing group | Yes (`ActionType = "regroup"`) |
| **Add Remarks** | — (stays put) | No |

Only moves into a **matched** destination are written to history
(`shouldRecordFingerprintHistory`: anything except `partial` and `no-match`). The reasoning: telling
the engine *"these rows belong together"* is durable knowledge worth replaying next month; telling it
*"this did not reconcile"* is the engine's default behaviour anyway.

### Both-sided, one-sided, and orphans

What gets moved depends on which side the user selected:

- **Both sides selected** — the CBL rows and the insurer rows move together as a new group.
- **CBL side only** — the CBL rows move. The insurer rows they were matched to (found by walking
  `matched_insurer_indices` from the CBL row's position) are left behind with no counterpart. These
  are **orphans**, and they are pushed to `no-match` rather than left dangling.
- **Insurer side only** — the mirror image: the insurer rows move, their CBL counterparts orphan to
  `no-match`.
- **Partial deselection** — a user can select a partial group and then deselect some of its rows. The
  deselected rows stay behind; `manualMatching` re-balances what remains and orphans anything that
  ends up one-sided.

A selection that spans two buckets is rejected with a warning toast — one bucket at a time.

### Regroup

Regroup is a move with a **pin**. The user pins an existing row as the regroup target, then selects
rows elsewhere and merges them into that row's group. The merged result gets one shared `group_id`
and a combined `matched_insurer_indices` covering both the moved rows and the rows already in the
target group. Anything left one-sided in the source group orphans to `no-match`.

Because regroup touches three sets of rows, its history entry carries three sets of fingerprints:
the moved rows, the **target** group's existing rows, and the orphans.

### Undo

Every move also pushes an entry onto an in-memory `actionHistory` stack with the original row objects
and their original positions. The `UndoModal` lets the user replay selected actions in reverse.
Undo is **session-scoped and pre-save only** — once Save succeeds the stack is cleared, because the
workbook and the history file have already been written.

### `move-scenarios-test.js`

`scripts/move-scenarios-test.js` runs the split / merge / spacer / orphan logic against a real
`output.xlsx` outside the browser. Useful when changing move mechanics:

```bash
node scripts/move-scenarios-test.js data/output.xlsx
```

---

## 5. Matrix — the three meanings

"Matrix" is overloaded in this codebase. The three uses are unrelated; do not conflate them.

### 5.1 The Matrix library — the learned memory *(the important one)*

`Matrix/{INSURER}/history.xlsx` is the durable record of every manual decision a human has ever made
for that insurer. One sheet, `MatchHistory`, one row per action:

| Column | Content |
|---|---|
| `ActionType` | `move`, `regroup`, or `continuation` |
| `CblFingerprints` | JSON array — fingerprints of the CBL rows moved |
| `InsurerFingerprints` | JSON array — fingerprints of the insurer rows moved |
| `TargetCblFingerprints` / `TargetInsurerFingerprints` | regroup only — the group merged **into** |
| `OrphanedCblFingerprints` / `OrphanedInsurerFingerprints` | rows left one-sided, destined for no-match |
| `CblRemarks` / `InsurerRemarks` | parallel arrays to the fingerprint arrays |
| `FromBucket` / `TargetBucket` | bucket keys |
| `Timestamp` | ISO 8601 |

This is what makes the system learn. Next month, the Python service reads this file first and
pre-places any row it recognises straight into the bucket the human chose last time — before the
matching passes even start.

**Cell-limit splitting.** Excel caps a cell at roughly 32k characters, and a large group move can
blow past that. `matchHistory.ts` splits an oversized entry across several rows: the first carries
`ActionType = "move"` (or `"regroup"`), the rest carry `ActionType = "continuation"` and are
re-concatenated onto the preceding entry when read. Individual fingerprints longer than the limit are
themselves chunked. Both reader and writer must honour this — see
`fingerprint-split-implementation-backend.md`.

### 5.2 The Matrix flag on a run folder

"Set Matrix" writes `Matrix = true` on one run folder's list item in the Reconciliation Library, and
clears it from every other run of the same insurer — exactly one matrix run per insurer. It marks
that run as the reference/baseline. Consumption of the flag happens outside this repo.

### 5.3 `MatrixKey` — legacy

`generateMatrixKeys.ts` builds a `PlacingNo#PolicyNo_1#ClientName#Amount,…|…` string describing a
CBL↔insurer pairing. It predates fingerprints, is excluded from every fingerprint, and survives only
in legacy undo paths. **New work should use fingerprints.**

---

## 6. Fingerprints

A fingerprint is a stable identity for a row derived from its **business data only**, so that the
same transaction can be recognised in next month's file even though its row number, its `idx` and all
its engine metadata are different.

```
1. take the row's column names
2. drop everything in FINGERPRINT_EXCLUDE_COLUMNS
3. sort the remaining names lexicographically
4. stringify each value:  null / undefined / "" / NaN  →  ""
                          Date                          →  DD/MM/YYYY
                          5000.0                        →  "5000"   (not "5000.0")
                          anything else                 →  String(value)
5. join with "|"
```

```
"5000|ABC Corp|PL-001|POL-12345|5000|POL-12345"
```

The exclude list (`matchHistory.ts`) drops the engine's working columns — `*_Clean`, `match_status`,
`match_pass`, `match_reason`, `matched_insurer_indices`, `group_id`, `corporate_root`,
`match_confidence`, `_fingerprint`, `MatrixKey` — plus user annotations (`Remarks`) and the
frontend's own `idx`. If a column the engine computes leaked into the fingerprint, the fingerprint
would change whenever the engine changed its mind, which defeats the point.

Insurer rows are fingerprinted with `generateInsurerFingerprint`, which strips the `_INSURER` suffix
first — so both sides fingerprint over the same column names.

**In practice the frontend prefers the canonical fingerprint the backend already wrote**:
`getCanonicalCblFingerprint` reads the `_fingerprint` column, and `getCanonicalInsurerFingerprint`
reads `_fingerprint` or `_fingerprint_INSURER`. Local recomputation is the fallback, and any drift
between the two implementations is a bug — parity notes are in
`readme/FRONTEND_FINGERPRINT_BACKEND_HANDOFF.md`.

**Fingerprints are exact-match.** One changed character in one column and the row will not be
recognised, so it goes through normal matching instead. That is by design: a row whose data changed
is not the same row.

---

## 7. How the Python service picks up and processes files

The service is a separate pandas application. It is not triggered by an HTTP call from this
frontend — it watches SharePoint.

### The handshake: the `Status` column

`Status` is a column on the run folder (and mirrored onto the files inside it) in the Reconciliation
Library. It is the entire protocol between the two halves.

```
          UploadModal writes               service claims             service finishes
                 │                               │                           │
                 ▼                               ▼                           ▼
           ┌──────────┐                  ┌─────────────┐         ┌──────────────────┐
           │ Pending  │ ───────────────▶ │ In Progress │ ──────▶ │  Manual Review   │  output.xlsx ready
           └──────────┘                  └─────────────┘         │    Completed     │  signed off
                 ▲                                               │     Failed       │  crashed
                 │                                               └──────────────────┘
                 └────────────────  "Re-run" resets to Pending  ──────────┘
```

- **Pending** — `UploadModal` creates the run folder, sets `Status = Pending`, then uploads the two
  files as `cbl.{ext}` and `insurer.{ext}`. The folder is renamed to `{date}_{folderId}` so it is
  unique per run.
- **In Progress** — the service has picked the folder up.
- **Manual Review** — `output.xlsx` exists and a human needs to look at it. This is the state in
  which the Reconciliation screen is useful.
- **Completed** / **Failed** — terminal. A failed run can be re-queued from Landing, which writes
  `Pending` back onto the folder and all its files (`updateFolderAndFilesStatus`).

### What the service reads

For a run folder `Reconciliation Library/{INSURER}/{date}_{id}/`:

1. **`cbl.xlsx`** and **`insurer.xlsx`** — the two raw statements.
2. **`Mappings` list**, rows `CBL` and `{INSURER}` — the `ColumnMappings` JSON that renames each
   file's columns onto CBL's canonical names. Everything downstream, fingerprints included, assumes
   post-mapping names.
3. **`Buckets` list**, filtered to `InsuranceCompany = {INSURER}` — the dynamic buckets to honour.
4. **`Matrix/{INSURER}/history.xlsx`** — the learned decisions. Absent on an insurer's first run;
   absence simply means no pre-placement.

### The processing pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│ 0. NORMALISE                                                           │
│    Read both files, apply column mappings, derive the *_Clean working  │
│    columns, compute _fingerprint for every row on both sides.          │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. REPLAY HISTORY          (matching/match_history.py)                 │
│    For each entry in history.xlsx, look its fingerprints up in the     │
│    freshly-computed fingerprint maps. Rows that match are pre-placed   │
│    into the entry's TargetBucket and locked in the GlobalTracker so    │
│    no pass can claim them. Each fingerprint claims at most one row.    │
│    Regroup entries additionally merge the moved rows with the target   │
│    group under one group_id, and push the orphans to no-match.         │
│    ─▶ the pre-placed rows are REMOVED from the comparison pool         │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. PASS 1 — Placing Number + Amount                                    │
│    Exact placing-number hit, else quality-controlled substring match   │
│    (10+ chars, 80%+ overlap). Then amount: single insurer row, else    │
│    combinations of 2-5 rows drawn from the 20 closest candidates.      │
│    Accepts PERFECT_MATCH / EXACT_MATCH only. ─▶ exact matches          │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. PASS 2 — Policy Number + Amount   (on what Pass 1 left)             │
│    Token-based policy matching across PolicyNo_1 / PolicyNo_2, then    │
│    the summed amount must land within tolerance. ─▶ exact matches      │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. PASS 3 — Name-based, four phases   (on what Pass 2 left)            │
│    a. exact corporate-root match  "ALTEO AGRI LTD" → "ALTEO AGRI"      │
│    b. fuzzy clustering fallback   85%+ similarity, 2+ common words     │
│    c. secondary-root loose capture for compound names (always partial) │
│    d. merge groups that share the same insurer indices                 │
│    Group totals decide the verdict: within tolerance → exact,          │
│    beyond → partial.                                                   │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. WRITE output.xlsx  →  Status = Manual Review                        │
│    Merge pre-placed + matched, re-apply the _INSURER suffix on the     │
│    paired sheets, emit Summary / Exact / Partial / No Match sheets     │
│    plus one sheet per dynamic bucket and _BucketConfig.                │
└────────────────────────────────────────────────────────────────────────┘
```

A **`GlobalMatchTracker`** runs through all of it, preventing two CBL rows from claiming the same
insurer row on an exact match while still allowing insurer rows to be shared across partial matches.
History-placed rows are registered in it up front, which is what guarantees the human's decision
wins over whatever the passes would have produced.

Pass-by-pass detail is in `readme/MATCHING_ENGINE_BREAKDOWN.md`; the history contract, with runnable
pandas snippets, is in `readme/MATCH_HISTORY_SPEC.md`.

---

## 8. The output.xlsx contract

| Sheet | Contents |
|---|---|
| `Summary` | Per-bucket transaction counts, CBL totals, insurer totals, difference. |
| `Exact Matches` | CBL and insurer columns merged on one row; insurer columns suffixed `_INSURER`. |
| `Partial Matches` | Same shape as Exact Matches. |
| `No Matches CBL` | CBL rows only, unsuffixed. |
| `No Matches Insurer` | Insurer rows only, every column suffixed `_INSURER`. |
| `{BucketKey}` | One sheet per dynamic bucket, same merged shape as Exact Matches. |
| `_BucketConfig` | `BucketName`, `BucketKey`, `SheetName` — tells the frontend which dynamic sheets exist. |

On load, `fetchFiles.ts` splits each merged sheet back into a CBL object and an insurer object
(`splitData`), strips `_INSURER`, assigns `idx`, and hides the engine's internal columns from the
table view (`columnsToExclude`) while keeping them on the row objects, because moves depend on
`matched_insurer_indices` and `group_id`.

---

## 9. Saving from the interface

**Save** (`SaveChanges.tsx`) does two writes:

1. **`output.xlsx`, overwritten in place.** Each bucket's CBL and insurer arrays are re-merged
   (`mergeData` re-applies the `_INSURER` suffix), the Summary sheet is recomputed, and the whole
   workbook is rewritten to the run folder. The file the user opens next time is the corrected one.
2. **`Matrix/{INSURER}/history.xlsx`, appended.** The session's match-history entries are appended to
   whatever is already there. This is the write that carries the human's judgement into future runs.

On success the undo stack is cleared and further undo is disabled. A common failure is the target
file being open in Excel, which SharePoint rejects with a lock — surfaced as *"Cannot save changes
because the excel file is open."*

---

## 10. Build and deploy

Node **18.17.1 – 18.x** is required (SPFx 1.20.0).

```bash
npm install
gulp serve                                  # local workbench
gulp bundle --ship && gulp package-solution --ship
```

The package lands at `sharepoint/solution/city-broker.sppkg` and is uploaded to the tenant App
Catalog. Three web parts ship in it: `Landing`, `OnboardingInsurance`, `Reconciliation`.

Before the solution works on a site, these must exist:

- Document library **Reconciliation Library**, with `Status` (choice: Pending / In Progress / Manual
  Review / Completed / Failed) and `Matrix` (yes/no) columns.
- Document library **Matrix**.
- List **Mappings** — `Title`, `ColumnMappings` (multi-line text), including a row titled `CBL`.
- List **Buckets** — `InsuranceCompany`, `BucketName`, `BucketKey`.
- A site page hosting the Reconciliation web part at `SitePages/Reconciliation.aspx`.

---

## 11. Further reading

Everything in `readme/` was written as a working contract between the frontend and the Python
service. The ones worth reading first:

| Document | Covers |
|---|---|
| `readme/MATCHING_ENGINE_BREAKDOWN.md` | Every pass and helper in `matching_engine.py`, in detail. |
| `readme/MATCH_HISTORY_SPEC.md` | The fingerprint algorithm and the full pandas replay implementation. |
| `readme/DYNAMIC_BUCKETS_PLAN.md` | Dynamic buckets end to end, list schema through output sheets. |
| `readme/REGROUP_BACKEND_SUPPORT.md` | The regroup history contract and how the backend replays it. |
| `readme/MANUAL_MATCHING_IMPROVEMENT_PLAN.md` | Move semantics, orphan handling, spacer rules. |
| `readme/BACKEND_FINGERPRINT_PROBLEM_SOLUTION.md` | Why `_fingerprint` is emitted by the backend. |
| `fingerprint-split-implementation-backend.md` | Excel cell-limit splitting and `continuation` rows. |
| `readme/SESSION_CHANGES.md` | Running changelog of recent frontend work. |
