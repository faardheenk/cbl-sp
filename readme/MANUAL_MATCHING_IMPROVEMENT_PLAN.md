# Manual Matching Logic Improvement Plan

## Overview
Modify `manualMatching` to properly handle deselected rows, orphaned rows, and repair `matched_insurer_indices` when moving from partial to exact match.

## Key Logic Rules

### Row Classification
When moving from partial to exact, rows are classified into three categories:

1. **Selected Rows** → **ALWAYS move to exact match**
   - These are the rows the user explicitly selected
   - Both CBL and Insurer selected rows move to exact
   - They NEVER stay in partial

2. **Deselected Rows** → **Handle based on pattern:**
   - **Balanced (both sides deselected):** REMAIN in partial with repaired `matched_insurer_indices`
   - **Unbalanced (one side only):** Move orphaned rows to no-match

3. **Non-Selected, Non-Deselected Rows** → **Stay in partial**
   - These rows remain in partial (normal case)
   - If there were balanced deselections, their `matched_insurer_indices` may also need repair

### Example Scenarios

**Scenario A: CBL-only deselection**
- 53 CBL rows in group (52 selected, 1 deselected)
- 78 Insurer rows (all selected)
- **Result:**
  - 52 CBL + 78 Insurer (selected) → Move to exact ✅
  - 1 CBL (deselected, orphaned) → Move to no-match ✅

**Scenario B: Balanced deselections**
- 53 CBL rows (52 selected, 1 deselected)
- 78 Insurer rows (77 selected, 1 deselected)
- **Result:**
  - 52 CBL + 77 Insurer (selected) → Move to exact ✅
  - 1 CBL + 1 Insurer (deselected, balanced) → REMAIN in partial with repaired `matched_insurer_indices` ✅
  - Non-selected rows (if any) → Stay in partial (normal case)

---

---

## Current State Analysis

### What We Have:
1. **Selection Tracking:**
   - CBL group selection: All rows with same `group_id` are selected together
   - Insurer auto-selection: Based on `matched_insurer_indices` from CBL rows
   - Console logs show: Total CBL rows in group, Total insurer rows auto-selected

2. **Deselection Tracking:**
   - CBL: `manuallyDeselectedRowsLocal` in `MatchableDataTable.tsx` (local state)
   - Insurer: `manuallyDeselectedRows` in `MatchableComponent.tsx` (Set<string>)
   - Both are tracked separately and NOT passed to `manualMatching`

3. **Current `manualMatching` Issues:**
   - Doesn't receive deselected rows information
   - Doesn't know about full group context
   - Doesn't handle orphaned rows (deselected on one side only)
   - Doesn't repair `matched_insurer_indices` for remaining rows

---

## Requirements

1. **Track Full Group Context:**
   - When CBL row clicked → get total CBL rows in group
   - Get total insurer rows that were auto-selected
   - Pass this context to `manualMatching`

2. **Track Deselected Rows:**
   - Track CBL deselected rows
   - Track Insurer deselected rows
   - Pass both to `manualMatching`

3. **Filter Out Deselected Rows:**
   - Remove deselected rows from original arrays before processing

4. **Handle Orphaned Rows:**
   - If only CBL side has deselected rows → move orphaned CBL rows to no-match
   - If only Insurer side has deselected rows → move orphaned Insurer rows to no-match
   - If both sides have deselected rows → keep deselected rows in partial and repair indices

5. **Repair `matched_insurer_indices`:**
   - When balanced deselected rows remain in partial
   - Update `matched_insurer_indices` to reflect only the remaining insurer rows in the group
   - Ensure auto-selection works correctly for remaining rows
   - Also repair indices for non-selected rows if they're part of the same group

---

## Implementation Plan

### Phase 1: Data Collection & Passing

#### Step 1.1: Collect Full Group Context
**Location:** `MatchableComponent.tsx` or `Reconciliation.tsx`

**Action:**
- When preparing to call `manualMatching`, collect:
  - All CBL rows in the selected groups (not just selected ones)
  - All Insurer rows that were auto-selected (from `cblSelectionMappings`)
  - Original `matched_insurer_indices` for each CBL row in the group

**Implementation:**
```typescript
// In Reconciliation.tsx, before calling manualMatching
const collectGroupContext = () => {
  // Get all CBL rows that are part of selected groups
  const allCBLRowsInGroups = new Set<string>();
  const allInsurerRowsInGroups = new Set<string>();
  const cblRowToMatchedIndices = new Map<string, string>();
  
  selectedRowCBL.forEach((selectedCBLRow) => {
    // Find all rows with same group_id
    const groupRows = partialMatchCBL.filter(
      (row) => row.group_id === selectedCBLRow.group_id
    );
    groupRows.forEach((row) => {
      allCBLRowsInGroups.add(row.idx);
      if (row.matched_insurer_indices) {
        cblRowToMatchedIndices.set(row.idx, row.matched_insurer_indices);
      }
    });
    
    // Get corresponding insurer rows from mappings
    // (This would need to be passed from MatchableComponent)
  });
  
  return {
    allCBLRowsInGroups: Array.from(allCBLRowsInGroups),
    allInsurerRowsInGroups: Array.from(allInsurerRowsInGroups),
    cblRowToMatchedIndices,
  };
};
```

#### Step 1.2: Collect Deselected Rows
**Location:** `Reconciliation.tsx` (before calling `manualMatching`)

**Action:**
- Get deselected CBL rows from `MatchableComponent` or pass as prop
- Get deselected Insurer rows from `MatchableComponent.manuallyDeselectedRows`

**Implementation:**
```typescript
// Need to pass deselected rows from MatchableComponent to Reconciliation
// Or access them via context/state

const deselectedCBLRows = /* get from MatchableComponent or context */;
const deselectedInsurerRows = /* get from MatchableComponent.manuallyDeselectedRows */;
```

**Challenge:** Currently deselected rows are tracked in `MatchableDataTable` (local state) and `MatchableComponent` (for insurer). Need to lift this state or pass it up.

**Solution Options:**
1. **Lift state to Reconciliation context** - Add deselected rows to `ReconciliationContext`
2. **Pass as props** - Add props to `MatchableComponent` to report deselected rows
3. **Calculate from selected rows** - Infer deselected rows by comparing full group vs selected

**Recommended:** Option 3 (Calculate) - More reliable and doesn't require state changes.

#### Step 1.3: Update `manualMatching` Function Signature
**Location:** `src/utils/utils.ts`

**Action:**
- Add new parameters for deselected rows and group context

**New Signature:**
```typescript
export const manualMatching = (
  rowsCBL: any[],
  rowsInsurer: any[],
  selectedRowsCBL: any[],
  selectedRowsInsurer: any[],
  noMatchInsurer: any[],
  noMatchCBL?: any[],
  // NEW PARAMETERS:
  deselectedCBLRows?: string[],           // Array of CBL row IDs that were deselected
  deselectedInsurerRows?: string[],       // Array of Insurer row IDs that were deselected
  allCBLRowsInGroups?: string[],          // All CBL rows in selected groups (full context)
  allInsurerRowsInGroups?: string[]      // All Insurer rows in selected groups (full context)
) => {
  // ...
}
```

---

### Phase 2: Filter Orphaned Deselected Rows

#### Step 2.1: Determine Which Deselected Rows to Filter
**Location:** `src/utils/utils.ts` - `manualMatching` function

**Action:**
- **CRITICAL:** Only filter out ORPHANED deselected rows (one-sided deselections)
- **DO NOT filter out balanced deselected rows** - they stay in partial with repaired indices
- Before processing, identify and filter out only orphaned rows from:
  - `rowsCBL` (partial match CBL array) - only if CBL-only deselection
  - `rowsInsurer` (partial match Insurer array) - only if Insurer-only deselection
  - `selectedRowsCBL` - remove deselected rows (they shouldn't be in selected)
  - `selectedRowsInsurer` - remove deselected rows (they shouldn't be in selected)

**Implementation:**
```typescript
// At the start of manualMatching (after early return for no-match)
const deselectedCBLSet = new Set(deselectedCBLRows || []);
const deselectedInsurerSet = new Set(deselectedInsurerRows || []);

// Determine deselection type first
const hasCBLDeselections = deselectedCBLRows && deselectedCBLRows.length > 0;
const hasInsurerDeselections = deselectedInsurerRows && deselectedInsurerRows.length > 0;
const isBalanced = hasCBLDeselections && hasInsurerDeselections;
const isCBLOnly = hasCBLDeselections && !hasInsurerDeselections;
const isInsurerOnly = !hasCBLDeselections && hasInsurerDeselections;

// Filter out orphaned deselected rows (one-sided only)
// Balanced deselected rows are NOT filtered - they stay in partial
let filteredRowsCBL = rowsCBL;
let filteredRowsInsurer = rowsInsurer;

if (isCBLOnly) {
  // Filter out orphaned CBL deselected rows
  filteredRowsCBL = rowsCBL.filter(
    (row) => !deselectedCBLSet.has(row.idx)
  );
}

if (isInsurerOnly) {
  // Filter out orphaned Insurer deselected rows
  filteredRowsInsurer = rowsInsurer.filter(
    (row) => !deselectedInsurerSet.has(row.idx)
  );
}

// Always filter deselected rows from selected arrays (they shouldn't be selected)
const filteredSelectedRowsCBL = selectedRowsCBL.filter(
  (row) => !deselectedCBLSet.has(row.idx)
);
const filteredSelectedRowsInsurer = selectedRowsInsurer.filter(
  (row) => !deselectedInsurerSet.has(row.idx)
);

// Use filtered arrays for rest of processing
// Note: For balanced deselections, filteredRowsCBL and filteredRowsInsurer
// still contain the deselected rows (they're not filtered out)
```

---

### Phase 3: Determine Deselection Pattern

#### Step 3.1: Classify Deselection Type
**Location:** `src/utils/utils.ts` - `manualMatching` function

**Action:**
- Determine if deselections are:
  - **Balanced:** Both CBL and Insurer have deselected rows
  - **CBL-only:** Only CBL has deselected rows
  - **Insurer-only:** Only Insurer has deselected rows
  - **None:** No deselections

**Implementation:**
```typescript
const hasCBLDeselections = deselectedCBLRows && deselectedCBLRows.length > 0;
const hasInsurerDeselections = deselectedInsurerRows && deselectedInsurerRows.length > 0;

const deselectionType = 
  hasCBLDeselections && hasInsurerDeselections ? 'balanced' :
  hasCBLDeselections ? 'cbl-only' :
  hasInsurerDeselections ? 'insurer-only' :
  'none';
```

---

### Phase 4: Handle Orphaned Rows

#### Step 4.1: Identify Orphaned Rows
**Location:** `src/utils/utils.ts` - `manualMatching` function

**Action:**
- For **CBL-only deselections:**
  - Find CBL rows that were deselected
  - These are orphaned (no corresponding insurer deselection)
  - Move to `noMatchCBL`

- For **Insurer-only deselections:**
  - Find Insurer rows that were deselected
  - These are orphaned (no corresponding CBL deselection)
  - Move to `noMatchInsurer`

**Implementation:**
```typescript
const orphanedCBLRows: any[] = [];
const orphanedInsurerRows: any[] = [];

if (deselectionType === 'cbl-only') {
  // Find deselected CBL rows in the original array
  deselectedCBLRows.forEach((deselectedIdx) => {
    const row = rowsCBL.find((r) => r.idx === deselectedIdx);
    if (row) {
      orphanedCBLRows.push(row);
    }
  });
}

if (deselectionType === 'insurer-only') {
  // Find deselected Insurer rows in the original array
  deselectedInsurerRows.forEach((deselectedIdx) => {
    const row = rowsInsurer.find((r) => r.idx === deselectedIdx);
    if (row) {
      orphanedInsurerRows.push(row);
    }
  });
}
```

#### Step 4.2: Handle Orphaned vs Balanced Deselected Rows
**Location:** `src/utils/utils.ts` - `manualMatching` function

**Action:**
- **Orphaned rows (unbalanced):** Add to no-match arrays, remove from partial
- **Balanced deselected rows:** Keep in partial (will repair indices in Phase 5)

**Implementation:**
```typescript
// Add orphaned rows to no-match (only for unbalanced deselections)
const updatedNoMatchCBL = noMatchCBL 
  ? [...(noMatchCBL || []), ...orphanedCBLRows]
  : undefined;
const updatedNoMatchInsurer = [...noMatchInsurer, ...orphanedInsurerRows];

// For balanced deselections, deselected rows are NOT removed from partial
// They will be included in filteredRowsCBL and filteredRowsInsurer
// and will have their matched_insurer_indices repaired in Phase 5

// For unbalanced deselections, orphaned rows are already filtered out in Step 2.1
// So filteredRowsCBL and filteredRowsInsurer exclude orphaned rows
```

---

### Phase 5: Repair `matched_insurer_indices` for Balanced Deselections

#### Step 5.1: Separate Selected vs Deselected vs Remaining Rows
**Location:** `src/utils/utils.ts` - `manualMatching` function

**Action:**
- **CRITICAL:** Selected rows ALWAYS move to exact match (never stay in partial)
- **Balanced deselected rows:** Stay in partial with repaired `matched_insurer_indices`
- **Non-selected, non-deselected rows:** Stay in partial (normal case, may also need index repair)

**Implementation:**
```typescript
// Separate rows into categories:
// 1. Selected rows → Move to exact match
// 2. Balanced deselected rows → Stay in partial (with repaired indices)
// 3. Orphaned deselected rows → Already moved to no-match in Phase 4
// 4. Non-selected, non-deselected rows → Stay in partial (normal case)

const selectedCBLSet = new Set(selectedRowsCBL.map((r) => r.idx));
const selectedInsurerSet = new Set(selectedRowsInsurer.map((r) => r.idx));
const deselectedCBLSet = new Set(deselectedCBLRows || []);
const deselectedInsurerSet = new Set(deselectedInsurerRows || []);

// Rows to move to exact match (selected rows, excluding deselected)
const exactMatchCBLRows = filteredRowsCBL.filter(
  (row) => selectedCBLSet.has(row.idx) && !deselectedCBLSet.has(row.idx)
);
const exactMatchInsurerRows = filteredRowsInsurer.filter(
  (row) => selectedInsurerSet.has(row.idx) && !deselectedInsurerSet.has(row.idx)
);

// Rows staying in partial:
// - Balanced deselected rows (both sides deselected)
// - Non-selected, non-deselected rows
const remainingPartialCBLRows = filteredRowsCBL.filter(
  (row) => !selectedCBLSet.has(row.idx) // Not selected (includes deselected and non-selected)
);
const remainingPartialInsurerRows = filteredRowsInsurer.filter(
  (row) => !selectedInsurerSet.has(row.idx) // Not selected (includes deselected and non-selected)
);
```

#### Step 5.2: Repair `matched_insurer_indices` for Balanced Deselected Rows
**Location:** `src/utils/utils.ts` - `manualMatching` function

**Action:**
- For balanced deselections, repair `matched_insurer_indices` for deselected rows that are staying in partial
  - The deselected CBL row should have `matched_insurer_indices` reflecting only the deselected Insurer row(s)
  - Group remaining CBL rows by `group_id` or original `matched_insurer_indices`
  - Count remaining Insurer rows per group (including deselected ones)
  - Calculate new `matched_insurer_indices` for each group
  - Update all rows staying in partial (both deselected and non-selected)

**Implementation:**
```typescript
if (deselectionType === 'balanced' && remainingPartialCBLRows.length > 0) {
  // Group remaining CBL rows by their original matched_insurer_indices or group_id
  const groupToCBLRows = new Map<string, any[]>();
  
  remainingPartialCBLRows.forEach((cblRow) => {
    // Use group_id if available, otherwise use matched_insurer_indices as group key
    const groupKey = cblRow.group_id || cblRow.matched_insurer_indices || 'default';
    if (!groupToCBLRows.has(groupKey)) {
      groupToCBLRows.set(groupKey, []);
    }
    groupToCBLRows.get(groupKey)!.push(cblRow);
  });
  
  // For each group, find corresponding remaining insurer rows
  groupToCBLRows.forEach((cblRows, groupKey) => {
    // Find corresponding insurer rows that are also staying in partial
    // This includes both deselected and non-selected insurer rows
    // Use original matched_insurer_indices and array positions to map relationships
    
    // Get the first CBL row's original matched_insurer_indices to understand the group
    const firstCBLRow = cblRows[0];
    let originalMatchedIndices: number[] = [];
    if (firstCBLRow.matched_insurer_indices) {
      try {
        originalMatchedIndices = JSON.parse(firstCBLRow.matched_insurer_indices);
      } catch (e) {
        console.warn("Failed to parse matched_insurer_indices:", e);
      }
    }
    
    // Find corresponding insurer rows by matching positions or relationships
    // This is complex - may need to use allInsurerRowsInGroups context
    const correspondingInsurerRows = remainingPartialInsurerRows.filter(/* match logic */);
    
    // Count remaining insurer rows for this group (including deselected ones)
    const remainingInsurerCount = correspondingInsurerRows.length;
    
    // Update matched_insurer_indices for all CBL rows in this group
    // This repairs the indices to reflect only the remaining insurer rows
    const newMatchedIndices = Array.from({ length: remainingInsurerCount }, (_, i) => i);
    cblRows.forEach((cblRow) => {
      cblRow.matched_insurer_indices = JSON.stringify(newMatchedIndices);
    });
  });
}
```

**Challenge:** Mapping insurer rows to groups is complex. Need to track original relationships.

**Solution:** Use original `matched_insurer_indices` and array positions to determine which insurer rows belong to which CBL group. May need `allInsurerRowsInGroups` context to properly map relationships.

#### Step 5.3: Return Rows to Correct Destinations
**Location:** `src/utils/utils.ts` - `manualMatching` function

**Action:**
- **Selected rows** → Return in a way that they get moved to exact match (caller handles this)
- **Remaining partial rows** → Return as `updatedRowsCBL` and `updatedRowsInsurer` (includes balanced deselected rows with repaired indices + non-selected rows)
- **Orphaned rows** → Return as `updatedNoMatchCBL` and `updatedNoMatchInsurer`

**Implementation:**
```typescript
// Return structure:
return {
  // Rows staying in partial:
  // - Balanced deselected rows (with repaired matched_insurer_indices)
  // - Non-selected, non-deselected rows (normal case)
  updatedRowsCBL: remainingPartialCBLRows,  // Already has repaired indices if balanced
  updatedRowsInsurer: remainingPartialInsurerRows,
  
  // Rows to move to exact match (selected rows, excluding deselected)
  exactMatchCBLRows,  // NEW: Need to add this to return type
  exactMatchInsurerRows,  // NEW: Need to add this to return type
  
  // Orphaned rows (one-sided deselections)
  updatedNoMatchCBL: orphanedCBLRows.length > 0 ? [...(noMatchCBL || []), ...orphanedCBLRows] : noMatchCBL,
  updatedNoMatchInsurer: [...noMatchInsurer, ...orphanedInsurerRows],
};
```

**Note:** 
- This requires updating the return type to include `exactMatchCBLRows` and `exactMatchInsurerRows`
- `remainingPartialCBLRows` includes both balanced deselected rows (with repaired indices) and non-selected rows

---

### Phase 6: Update Call Site

#### Step 6.1: Calculate Deselected Rows in Reconciliation
**Location:** `Reconciliation.tsx` - `moveRows` function (before calling `manualMatching`)

**Action:**
- Calculate deselected rows by comparing:
  - Full group context (all rows that should be selected)
  - Actually selected rows
  - Difference = deselected rows

**Implementation:**
```typescript
// Before calling manualMatching in the partial→exact path

// Get full group context
const allCBLRowsInSelectedGroups = new Set<string>();
const allInsurerRowsInSelectedGroups = new Set<string>();

selectedRowCBL.forEach((selectedCBLRow) => {
  // Find all CBL rows with same group_id
  const groupRows = partialMatchCBL.filter(
    (row) => row.group_id === selectedCBLRow.group_id
  );
  groupRows.forEach((row) => allCBLRowsInSelectedGroups.add(row.idx));
  
  // Get corresponding insurer rows from cblSelectionMappings
  // This needs to be passed from MatchableComponent or calculated
});

// Calculate deselected rows
const deselectedCBLRows = Array.from(allCBLRowsInSelectedGroups).filter(
  (idx) => !selectedRowCBL.some((selected) => selected.idx === idx)
);

// For insurer, need to get from MatchableComponent's manuallyDeselectedRows
// Or calculate from auto-selected vs actually selected
const deselectedInsurerRows = /* get from MatchableComponent or calculate */;

// Call manualMatching with new parameters
const { 
  updatedRowsCBL, 
  updatedRowsInsurer, 
  exactMatchCBLRows,      // NEW: Selected CBL rows to move to exact
  exactMatchInsurerRows,  // NEW: Selected Insurer rows to move to exact
  updatedNoMatchInsurer, 
  updatedNoMatchCBL 
} = manualMatching(
  partialMatchCBL,
  partialMatchInsurer,
  selectedRowCBL,
  selectedRowInsurer,
  noMatchInsurer,
  noMatchCBL,
  deselectedCBLRows,
  deselectedInsurerRows,
  Array.from(allCBLRowsInSelectedGroups),
  Array.from(allInsurerRowsInSelectedGroups)
);

// Handle selected rows - move to exact match
// (This replaces the old logic that used rowsToMoveCBL and rowsToMoveInsurer)
// exactMatchCBLRows and exactMatchInsurerRows should be added to exact match section
```

**Challenge:** Getting insurer group context requires access to `cblSelectionMappings` from `MatchableComponent`.

**Solution Options:**
1. **Lift `cblSelectionMappings` to Reconciliation context**
2. **Pass as parameter** through component hierarchy
3. **Recalculate** from `selectedRowCBL` and their `matched_insurer_indices`

**Recommended:** Option 3 (Recalculate) - More self-contained.

#### Step 6.2: Handle Return Values
**Location:** `Reconciliation.tsx` - `moveRows` function

**Action:**
- Handle `exactMatchCBLRows` and `exactMatchInsurerRows` - add to exact match section
- Handle `updatedNoMatchCBL` - update no-match CBL if orphaned rows exist
- Handle `updatedNoMatchInsurer` - update no-match Insurer
- Handle `updatedRowsCBL` and `updatedRowsInsurer` - update partial match (rows staying in partial)

**Implementation:**
```typescript
// After manualMatching call

// 1. Add selected rows to exact match (replaces old rowsToMoveCBL/rowsToMoveInsurer logic)
const nextMatchGroup = getNextMatchGroup(
  exactMatchCBL,
  exactMatchInsurer
);

const exactMatchRowsWithGroupCBL = addGroupAndCondition(
  exactMatchCBLRows,
  nextMatchGroup
);
const exactMatchRowsWithGroupInsurer = addGroupAndCondition(
  exactMatchInsurerRows,
  nextMatchGroup
);

// Add to exact match destination
const newExactMatchCBL = [...exactMatchCBL, ...exactMatchRowsWithGroupCBL];
const newExactMatchInsurer = [...exactMatchInsurer, ...exactMatchRowsWithGroupInsurer];

// Re-equalize exact match tables
const [equalizedExactCBL, equalizedExactInsurer] = equalizeWorksheetLengths(
  newExactMatchCBL,
  newExactMatchInsurer,
  nextMatchGroup
);

setExactMatchCBL(regenerateIdx(equalizedExactCBL, "exact"));
setExactMatchInsurer(regenerateIdx(equalizedExactInsurer, "exact"));

// 2. Update partial match (rows staying in partial)
// ... (existing logic for updatedRowsCBL and updatedRowsInsurer)

// 3. Update no-match (orphaned rows)
if (updatedNoMatchCBL) {
  setNoMatchCBL(regenerateIdx(updatedNoMatchCBL, "no-match"));
}
setNoMatchInsurer(regenerateIdx(updatedNoMatchInsurer, "no-match"));
```

---

### Phase 7: Update Return Type

#### Step 7.1: Extend Return Type
**Location:** `src/utils/utils.ts` - `manualMatching` function

**Action:**
- Add `updatedNoMatchCBL` for orphaned CBL rows
- Add `exactMatchCBLRows` and `exactMatchInsurerRows` for selected rows that should move to exact

**New Return Type:**
```typescript
return {
  // Rows staying in partial (non-selected, non-deselected, with repaired indices if balanced)
  updatedRowsCBL,
  updatedRowsInsurer,
  
  // Rows to move to exact match (selected rows, excluding deselected)
  exactMatchCBLRows: any[],      // NEW: Selected CBL rows
  exactMatchInsurerRows: any[],   // NEW: Selected Insurer rows
  
  // Orphaned rows (one-sided deselections)
  updatedNoMatchInsurer,
  updatedNoMatchCBL?: any[],      // NEW: For orphaned CBL rows
};
```

**Note:** The caller (`Reconciliation.tsx`) will need to handle `exactMatchCBLRows` and `exactMatchInsurerRows` separately to add them to the exact match section.

---

## Implementation Order

### Recommended Sequence:

1. **Phase 1.3** - Update `manualMatching` signature (add optional parameters)
   - Non-breaking change, allows gradual implementation

2. **Phase 7.1** - Update return type
   - Add `updatedNoMatchCBL` to return

3. **Phase 2** - Filter deselected rows
   - Core functionality, needed for all other phases

4. **Phase 3** - Determine deselection pattern
   - Classification logic, needed for branching

5. **Phase 6.1** - Calculate deselected rows in Reconciliation
   - Data preparation at call site

6. **Phase 4** - Handle orphaned rows
   - Simpler case (one-sided deselections)

7. **Phase 5** - Repair `matched_insurer_indices`
   - Most complex case (balanced deselections)

8. **Phase 6.2** - Handle return values
   - Final integration

9. **Phase 1.1 & 1.2** - Collect full group context
   - Optimization/improvement (can be done later if needed)

---

## Testing Scenarios

### Scenario 1: No Deselections
- **Input:** Selected rows, no deselections
- **Expected:** Normal behavior (existing logic)

### Scenario 2: CBL-Only Deselections
- **Input:** 53 CBL rows in group (52 selected, 1 deselected), 78 insurer rows (all selected)
- **Expected:** 
  - **Selected rows:** 52 CBL + 78 Insurer rows → Move to exact match
  - **Orphaned row:** 1 deselected CBL row → Move to no-match (no corresponding insurer deselection)
  - **Remaining in partial:** None (all selected rows moved to exact)

### Scenario 3: Insurer-Only Deselections
- **Input:** 53 CBL rows (all selected), 78 insurer rows (77 selected, 1 deselected)
- **Expected:**
  - **Selected rows:** 53 CBL + 77 Insurer rows → Move to exact match
  - **Orphaned row:** 1 deselected Insurer row → Move to no-match (no corresponding CBL deselection)
  - **Remaining in partial:** None (all selected rows moved to exact)

### Scenario 4: Balanced Deselections
- **Input:** 53 CBL rows (52 selected, 1 deselected), 78 insurer rows (77 selected, 1 deselected)
- **Expected:**
  - **Selected rows:** 52 CBL + 77 Insurer rows → Move to exact match
  - **Deselected rows:** 1 CBL + 1 Insurer → REMAIN in partial with repaired `matched_insurer_indices` (reflecting 1:1 relationship instead of original group size)
  - **Remaining in partial:** 1 CBL + 1 Insurer (the deselected rows stay in partial)

### Scenario 4b: Balanced Deselections with Non-Selected Rows
- **Input:** 100 CBL rows (50 selected, 1 deselected, 49 non-selected), 150 insurer rows (75 selected, 1 deselected, 74 non-selected)
- **Expected:**
  - **Selected rows:** 50 CBL + 75 Insurer rows → Move to exact match
  - **Deselected rows:** 1 CBL + 1 Insurer → REMAIN in partial with repaired `matched_insurer_indices` (reflecting 1:1 relationship)
  - **Non-selected rows:** 49 CBL + 74 Insurer rows → Stay in partial (normal case, may also need index repair if they're part of the same group)

### Scenario 5: Multiple Groups with Mixed Deselections
- **Input:** Multiple CBL groups, some with deselections, some without
- **Expected:** Each group handled independently

---

## Edge Cases to Consider

1. **All rows in group deselected:** Should entire group move to no-match?
2. **Deselected rows not in selected groups:** How to handle?
3. **Circular dependencies:** Deselected CBL row's insurer rows also deselected?
4. **Blank rows:** How to handle deselected blank rows?
5. **One-to-many relationships:** Complex `matched_insurer_indices` scenarios

---

## Dependencies

### Required Changes:
1. **Reconciliation.tsx:** Update `moveRows` to calculate and pass deselected rows
2. **utils.ts:** Update `manualMatching` function
3. **MatchableComponent.tsx:** May need to expose `manuallyDeselectedRows` or `cblSelectionMappings`

### Optional Improvements:
1. **ReconciliationContext:** Add deselected rows tracking (if lifting state)
2. **MatchableDataTable.tsx:** Expose deselected rows (if needed)

---

## Risk Assessment

### Low Risk:
- Adding optional parameters to `manualMatching`
- Filtering deselected rows
- Moving orphaned rows to no-match

### Medium Risk:
- Calculating deselected rows from group context
- Determining deselection pattern

### High Risk:
- Repairing `matched_insurer_indices` for balanced deselections
- Mapping insurer rows to CBL groups correctly
- Ensuring auto-selection works after repair

---

## Rollout Strategy

1. **Phase 1:** Implement filtering and orphaned row handling (Phases 2, 3, 4)
2. **Phase 2:** Add balanced deselection handling with `matched_insurer_indices` repair (Phase 5)
3. **Phase 3:** Optimize with full group context collection (Phase 1.1, 1.2)

This allows incremental testing and validation.

---

## End of Plan
