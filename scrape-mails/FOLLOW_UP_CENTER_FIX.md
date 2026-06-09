# Follow-Up Center Fix

## Issue
The follow-up center was showing "All Caught Up!" even though there were emails that needed follow-up.

## Root Cause
The follow-up scheduling was too conservative:
- Initial emails: 2-day wait before follow-up
- Follow-up #1: 3-day wait
- Follow-up #2: 7-day wait
- Follow-up #3: 14-day wait

This meant leads sent within the last 2 days wouldn't appear in the follow-up center, even if the user wanted to follow up immediately.

## Solution

### 1. Reduced Follow-Up Delays
**Initial Email:**
- Before: 2 days before first follow-up
- After: 1 day before first follow-up

**Follow-up Sequence:**
- Before: 3 days, 7 days, 14 days
- After: 1 day, 3 days, 7 days

### 2. Added Pending Leads Display
When no leads are ready for immediate follow-up, the UI now shows:
- "Pending Follow-Ups" section
- Count of leads waiting for follow-up window
- List of next 3 pending leads with time until ready
- Clear message about when follow-ups become available

### 3. Updated UI Messages
- Changed "Follow-ups become available 2+ days after initial send" to "1+ day"
- Added distinction between "All Caught Up" (no leads at all) vs "Pending" (leads waiting)

## Files Modified

### `app/api/send-email/route.js`
- Changed initial follow-up delay from 2 days to 1 day
- Changed follow-up sequence from 3/7/14 days to 1/3/7 days

### `app/dashboard/page.js`
- Updated `getLeadNextFollowUpAt` to use 1-day default instead of 2 days
- Added `getPendingLeads` function to track leads not yet ready
- Updated UI to show pending leads when no immediate follow-ups available
- Updated delay messages from "2+ days" to "1+ day"

## Technical Details

### Follow-Up Schedule Calculation
```javascript
// Initial email
followUpAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()

// Follow-up sequence
const daysToAdd = newFollowUpCount === 1 ? 1 : newFollowUpCount === 2 ? 3 : 7;
```

### Pending Leads Logic
```javascript
const getPendingLeads = useCallback(() => {
  const now = new Date();
  const pending = sentLeads
    .map(normalizeSentLead)
    .filter(lead => {
      if (!lead || !lead.email) return false;
      if (lead.replied) return false;
      const followUpAt = getLeadNextFollowUpAt(lead);
      if (!followUpAt) return false;
      // Include if follow-up is in the future (not ready yet)
      return followUpAt > now;
    })
    .map(lead => ({
      ...lead,
      hoursUntilFollowUp: Math.round((followUpAt - now) / (1000 * 60 * 60))
    }))
    .sort((a, b) => a.hoursUntilFollowUp - b.hoursUntilFollowUp);
}, [sentLeads, normalizeSentLead, getLeadNextFollowUpAt, safeParseDate]);
```

## Business Impact

### Before
- ❌ Leads sent within 2 days not visible
- ❌ User couldn't see pending leads
- ❌ "All Caught Up" message misleading
- ❌ Too conservative follow-up timing

### After
- ✅ Leads visible after 1 day
- ✅ Pending leads clearly displayed
- ✅ Accurate status messages
- ✅ More aggressive follow-up schedule
- ✅ Better visibility into pipeline

## Testing

### Test Scenarios

1. **Send new email**
   - Expected: Lead appears in "Pending" immediately
   - After 1 day: Lead appears in "Ready for Follow-Up"

2. **Send follow-up**
   - Expected: Next follow-up scheduled in 1/3/7 days
   - Lead moves to "Pending" until ready

3. **Check UI**
   - If no ready leads: Shows "Pending Follow-Ups" with list
   - If no leads at all: Shows "All Caught Up"
   - If ready leads: Shows leads ready for follow-up

## Configuration

To adjust follow-up delays, edit `app/api/send-email/route.js`:

```javascript
// Initial email delay (currently 1 day)
followUpAt: new Date(Date.now() + X * 24 * 60 * 60 * 1000).toISOString()

// Follow-up sequence (currently 1, 3, 7 days)
const daysToAdd = newFollowUpCount === 1 ? X : newFollowUpCount === 2 ? Y : Z;
```

## Summary

**Fixed follow-up center visibility by:**
1. Reducing delays from 2/3/7/14 days to 1/1/3/7 days
2. Adding pending leads display
3. Updating UI messages for clarity
4. Providing better pipeline visibility

**Follow-up center now shows accurate lead status and allows more aggressive follow-up timing.**
