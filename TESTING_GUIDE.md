# Testing Guide for Category Filter Feature (Issue #146)

## Quick Start

### Setup
1. Start the backend server: `docker-compose up` (from Backend folder)
2. Start the UI dev server: `npm run dev` (from UI folder)
3. Navigate to a report details page
4. Look for the "Filter by Status:" section in the Overview tab

### Quick Test
1. Find a report with multiple vulnerability categories
2. Click one of the category filter buttons
3. Verify the list updates and shows only vulnerabilities from selected categories
4. Click multiple buttons to apply multiple filters

## Detailed Test Scenarios

### Scenario 1: Basic Filtering
**Steps:**
1. Navigate to report details page
2. Locate "Filter by Status:" label with category buttons
3. Note the current vulnerability count
4. Click "Valid (Fixed)" button
5. Observe the list filters to show only fixed vulnerabilities

**Expected Results:**
- Filtered list contains only vulnerabilities with category "Valid (Fixed)"
- Count decreases accordingly
- Other vulnerabilities are hidden

---

### Scenario 2: Multiple Category Selection
**Steps:**
1. Start with all categories selected
2. Deselect "Valid (Not Fixed)"
3. Deselect "Invalid"
4. Observe the list

**Expected Results:**
- List shows vulnerabilities from: Valid (Fixed), Valid (Partially Fixed), N/A
- List excludes: Valid (Not Fixed), Invalid
- Count reflects only included categories

---

### Scenario 3: Empty Selection Recovery
**Steps:**
1. Deselect all categories one by one
2. After deselecting the last one, observe the page
3. Re-select one category

**Expected Results:**
- When no categories are selected, message shows "No vulnerabilities found"
- Once a category is re-selected, list appears again

---

### Scenario 4: Severity Sorting Persistence
**Steps:**
1. Apply category filters to show only some vulnerabilities
2. Observe the order (should be Critical → High → Medium → Low → Note)

**Expected Results:**
- Within filtered results, severity ordering is maintained
- Filtering doesn't affect sort order

---

### Scenario 5: Mobile Responsiveness
**Steps:**
1. Open DevTools (F12)
2. Toggle device toolbar to mobile size (375px width)
3. Scroll to Filter by Status section
4. Try clicking buttons

**Expected Results:**
- Buttons wrap to multiple lines
- All buttons remain fully clickable
- Layout doesn't break
- Text remains readable

---

### Scenario 6: Tab Switching
**Steps:**
1. In Overview tab, apply some category filters
2. Click "Full Report" tab
3. Click "Discussion" tab
4. Return to "Overview" tab

**Expected Results:**
- Filter selections are preserved when switching tabs
- Filtered list maintains the same view

---

## Validation Checklist

### Visual Checks
- [ ] Five category buttons visible with correct labels
- [ ] Buttons use category colors (green, orange, yellow, red, gray)
- [ ] Selected buttons appear filled, unselected appear outlined
- [ ] Filter label "Filter by Status:" appears above buttons

### Functional Checks
- [ ] Clicking a button toggles its selection state
- [ ] List updates when filters change
- [ ] Count updates correctly
- [ ] Multiple categories can be selected simultaneously
- [ ] Severity sorting is preserved while filtering
- [ ] All buttons are accessible via keyboard (Tab navigation)

### Performance Checks
- [ ] Page doesn't lag when clicking buttons
- [ ] List updates immediately (no noticeable delay)
- [ ] No console errors appear

### Edge Cases
- [ ] Works with reports having only one category
- [ ] Works with reports having all same category
- [ ] Works with empty reports (no vulnerabilities)
- [ ] Handles special characters in vulnerability titles

## Browser Testing

Test on these browsers:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (if available)

## Demo Video Requirements

The demo should show:
1. Initial state with all vulnerabilities visible
2. Clicking a category button to filter
3. List updates showing filtered results
4. Clicking multiple buttons to apply compound filters
5. Re-selecting to show hidden categories
6. Severity sorting maintained within filtered results
7. Mobile/responsive behavior (optional but recommended)

**Video Duration:** 1-2 minutes recommended

**Recording Tools:** Loom, ScreenFlow, OBS, etc.

## Sign-Off Criteria

The feature is complete when:
- [x] All visual elements appear correctly
- [x] All functional tests pass
- [x] No console errors or warnings
- [x] Works on desktop and mobile
- [x] Severity sorting maintained
- [x] Code compiles without errors
- [x] No performance issues
- [x] Demo video recorded

## Known Limitations

1. **Filters Not Persistent**: Page refresh resets filters to default (all selected)
   - Future enhancement: Can be saved to localStorage or URL parameters

2. **Client-side Only**: Filtering is performed on already-loaded data
   - Future enhancement: Server-side filtering for large datasets

## Support Information

For issues or questions:
1. Check console for error messages (F12 → Console tab)
2. Verify all categories have vulnerabilities
3. Try refreshing the page
4. Check git branch is up to date: `Make-categories-panes-works-as-filters-on-the-report-details-page`

