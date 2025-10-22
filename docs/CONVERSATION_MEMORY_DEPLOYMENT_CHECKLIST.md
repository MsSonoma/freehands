# Conversation Memory System - Deployment Checklist

## Pre-Deployment

- [ ] Review implementation summary (`docs/CONVERSATION_MEMORY_IMPLEMENTATION.md`)
- [ ] Review full documentation (`docs/mr-mentor-conversation-memory.md`)
- [ ] Verify environment variables are set:
  - [ ] `OPENAI_API_KEY` (for summarization)
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Database Setup

- [ ] Open Supabase SQL Editor
- [ ] Copy contents of `scripts/setup-conversation-memory.sql`
- [ ] Execute the script
- [ ] Verify tables created:
  ```sql
  SELECT * FROM conversation_updates LIMIT 1;
  SELECT * FROM conversation_history_archive LIMIT 1;
  ```
- [ ] Verify indexes created:
  ```sql
  \di conversation_*
  ```
- [ ] Verify RLS enabled:
  ```sql
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE tablename LIKE 'conversation_%';
  ```
- [ ] Verify triggers created:
  ```sql
  SELECT tgname FROM pg_trigger 
  WHERE tgname LIKE '%conversation%';
  ```

## Code Verification

- [ ] No TypeScript/ESLint errors: `npm run build`
- [ ] API endpoint exists: `src/app/api/conversation-memory/route.js`
- [ ] Mr. Mentor updated: `src/app/api/counselor/route.js`
- [ ] Client updated: `src/app/facilitator/tools/counselor/CounselorClient.jsx`

## Testing

### Automated Tests
- [ ] Start dev server: `npm run dev`
- [ ] Run test suite: `node scripts/test-conversation-memory.mjs`
- [ ] All 6 tests pass:
  - [ ] Create Memory
  - [ ] Retrieve Memory
  - [ ] Update Memory
  - [ ] Search
  - [ ] Mr. Mentor Integration
  - [ ] Cleanup

### Manual Testing
- [ ] Log into facilitator account
- [ ] Open Mr. Mentor (`/facilitator/tools/counselor`)
- [ ] Send a test message about curriculum planning
- [ ] Verify response received
- [ ] Check browser console for "Conversation memory updated"
- [ ] Check network tab for POST to `/api/conversation-memory`
- [ ] Refresh page and send another message
- [ ] Verify Mr. Mentor references previous conversation
- [ ] Try searching: "What did we discuss about curriculum?"
- [ ] Verify search results returned

### Learner Context Testing
- [ ] Select a learner from dropdown
- [ ] Send message about that learner
- [ ] Verify memory saved (check console)
- [ ] Switch to "None" (general)
- [ ] Send different message
- [ ] Switch back to learner
- [ ] Verify learner-specific context maintained

### Search Testing
- [ ] Have at least 2 different conversations
- [ ] Test search with keyword that appears in one
- [ ] Verify correct conversation returned
- [ ] Test search with keyword in both
- [ ] Verify both returned
- [ ] Test search with typo/fuzzy term
- [ ] Verify fuzzy matching works

## Database Verification

After testing, verify data saved correctly:

```sql
-- Check active memories
SELECT 
  facilitator_id,
  learner_id,
  turn_count,
  LEFT(summary, 100) as summary_preview,
  updated_at
FROM conversation_updates
ORDER BY updated_at DESC;

-- Check archives (if any)
SELECT 
  COUNT(*) as archive_count
FROM conversation_history_archive;

-- Test search functionality
SELECT 
  LEFT(summary, 50) as preview
FROM conversation_updates
WHERE to_tsvector('english', summary) @@ websearch_to_tsquery('english', 'curriculum');
```

## Performance Verification

- [ ] Memory updates complete within 5 seconds
- [ ] Memory retrieval < 200ms
- [ ] Search queries < 500ms
- [ ] No blocking of UI during updates
- [ ] No visible lag during conversations

## Security Verification

- [ ] RLS policies prevent cross-facilitator access
  ```sql
  -- Try to access another facilitator's data (should return empty)
  SELECT * FROM conversation_updates 
  WHERE facilitator_id != auth.uid();
  ```
- [ ] Learner ID validation works
- [ ] Archive access restricted to owner

## Error Handling Verification

- [ ] Test with invalid learner ID → Graceful failure
- [ ] Test with network timeout → Silent failure, no UI disruption
- [ ] Test with invalid search query → Empty results, no error
- [ ] Test with no OpenAI key → Error logged, request continues
- [ ] Test with malformed JSON → API returns 400

## Documentation Verification

- [ ] All new features documented
- [ ] API endpoints documented
- [ ] Function calling tools documented
- [ ] Setup instructions clear
- [ ] Examples provided
- [ ] Troubleshooting guide included

## Deployment

### Staging
- [ ] Deploy to staging environment
- [ ] Run automated tests on staging
- [ ] Manual smoke test on staging
- [ ] Verify no regressions in existing features

### Production
- [ ] Run database migration on production Supabase
- [ ] Deploy code to production
- [ ] Verify environment variables set in production
- [ ] Run smoke test with real account
- [ ] Monitor logs for first 24 hours
- [ ] Check for any error spikes

## Monitoring

Set up alerts for:
- [ ] High error rate in `/api/conversation-memory`
- [ ] Slow OpenAI summarization (>10s)
- [ ] Failed memory updates
- [ ] Database connection issues
- [ ] Archive table growth rate

## Rollback Plan

If issues arise:

1. **Database rollback**:
   ```sql
   DROP TRIGGER IF EXISTS trigger_archive_conversation_before_delete ON conversation_updates;
   DROP TRIGGER IF EXISTS trigger_archive_long_conversation ON conversation_updates;
   DROP TABLE IF EXISTS conversation_updates CASCADE;
   DROP TABLE IF EXISTS conversation_history_archive CASCADE;
   ```

2. **Code rollback**:
   - Revert changes to `src/app/api/counselor/route.js`
   - Revert changes to `src/app/facilitator/tools/counselor/CounselorClient.jsx`
   - Remove `src/app/api/conversation-memory/route.js`
   - Redeploy

3. **Verify rollback**:
   - Test Mr. Mentor still works
   - Verify no references to conversation memory
   - Check for no console errors

## Post-Deployment

- [ ] Monitor OpenAI API usage (summarization costs)
- [ ] Monitor database table sizes
- [ ] Track user engagement with search feature
- [ ] Collect feedback from facilitators
- [ ] Document any issues encountered
- [ ] Plan iteration based on usage patterns

## Success Criteria

✅ System is considered successfully deployed when:
- All automated tests pass
- Manual testing shows no regressions
- Memory persists across sessions
- Search returns relevant results
- No performance degradation
- No increase in error rates
- Facilitators report continuity in conversations

## Support

**For issues, refer to:**
- `docs/mr-mentor-conversation-memory.md` - Full documentation
- `docs/mr-mentor-conversation-memory-quick.md` - Quick reference
- `docs/CONVERSATION_MEMORY_IMPLEMENTATION.md` - Implementation summary

**Common issues:** See troubleshooting section in full docs

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Verified By**: _______________  
**Sign-off**: _______________
