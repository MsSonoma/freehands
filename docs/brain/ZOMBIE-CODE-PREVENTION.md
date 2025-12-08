# Zombie Code Prevention Protocol

**Created**: 2025-12-08  
**Purpose**: Prevent incomplete removals that create zombie code causing recurring breakage

---

## What Happened (Dec 2-8, 2025)

**Changelog claimed:**
- Dec 2: "POOLS ELIMINATED - Removed compPool/exercisePool state"
- Dec 5: "removed zombie pool fallback"

**Reality:**
- compPool/exercisePool state still existed (lines 1217-1218)
- Pool fallback logic still ran (lines 5751-5759, 5924-5933)
- Pool persistence still saved empty arrays (line 4306)

**Result:**
- Dual architecture: new array-based system fell back to old empty pools
- Exercise phase ran out of questions at Q8 repeatedly
- Opening actions buttons appeared during Q&A phases repeatedly
- Every "fix" only addressed symptoms, not root cause

---

## Zombie Code Definition

**Zombie code** = Code that changelog claims was removed but still exists and executes

**Why it's dangerous:**
1. Creates dual architectures (new + old systems coexist)
2. Produces unpredictable behavior (falls back to broken legacy code)
3. Breaks repeatedly (symptom fixes don't address root cause)
4. Wastes development time (same bugs resurface)

---

## Prevention Protocol

### RULE 1: Grep Before Claiming Removal

Before writing changelog entry claiming code was removed:
```powershell
# Search for the supposedly removed code
rg "compPool" src/
rg "exercisePool" src/
```

If search returns results, **the code is NOT removed** - changelog must not claim it is.

### RULE 2: Complete Removal Checklist

When removing a system (like pools), verify ALL these are removed:

- [ ] State declarations (`useState`)
- [ ] State setters passed to hooks
- [ ] References in dependencies arrays
- [ ] Fallback logic that uses the state
- [ ] Persistence (saving to localStorage/database)
- [ ] Comments mentioning the removed system
- [ ] Documentation claiming the system still exists

**Do NOT commit until ALL checkboxes verified.**

### RULE 3: Build + Test After Removal

After claiming to remove code:
```powershell
npm run build  # Must pass
# Manual test: Does the removed system's behavior still occur?
```

If removed pool fallback, test: Does exercise run out of questions?
If yes, pool fallback still runs (not actually removed).

### RULE 4: Changelog Honesty

**Never write:**
> "Removed compPool/exercisePool state"

**When only some references were removed.**

**Instead write:**
> "Removed pool fallback from handleGoComprehension (lines 82-103)"

Be specific about WHAT was removed WHERE, not aspirational claims.

### RULE 5: Tag Before Large Removals

Before removing any system:
```powershell
git tag before-removal-YYYYMMDD-HHMM
```

If removal incomplete, revert and try again:
```powershell
git reset --hard before-removal-YYYYMMDD-HHMM
```

---

## How Complete Removal Was Actually Done (Dec 8)

**Step 1: Research** - Grep found all pool references
**Step 2: List every location:**
- Line 1217-1218: State declarations
- Line 1896-1903: Dependencies in useEffect
- Line 4306: Persistence
- Lines 5751-5759: Comprehension fallback
- Lines 5924-5933: Exercise fallback

**Step 3: Remove ALL in one atomic commit**
**Step 4: Add defensive handling** (array exhaustion completes phase instead of showing buttons)
**Step 5: Build test** (passed)
**Step 6: Update changelog** with what was ACTUALLY done

---

## Red Flags of Zombie Code

1. **Bug resurfaces after being "fixed"** → Incomplete removal
2. **Changelog claims removal but code still found in grep** → Zombie code
3. **System has TWO ways to do same thing** (arrays + pools) → Dual architecture
4. **Fallback logic to "deprecated" system** → Zombie fallback
5. **Multiple changelog entries fixing "same" bug** → Root cause not addressed

---

## Emergency Zombie Hunting

If bug keeps recurring despite fixes:

```powershell
# 1. Check what changelog claims was removed
cat docs/brain/changelog.md | Select-String "REMOVED"

# 2. Grep for supposedly removed code
rg "compPool|exercisePool" src/

# 3. If found, zombie code exists - do complete removal
```

---

## Commitment

**Future removals will:**
- Grep before claiming removal
- Use complete removal checklist
- Test that removed behavior actually gone
- Write honest changelog (specific locations, not aspirational claims)
- Tag before removal for safe revert

**This prevents:**
- Recurring bugs from incomplete removals
- Dual architectures from zombie fallback
- Wasted time re-fixing "solved" issues
- Changelog lying about what was done
