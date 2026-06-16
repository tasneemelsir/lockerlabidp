# Lab Locker System — Locker Flow Refactor

## Context
The locker assignment flow has been completely redesigned.
Previously: each component had a fixed locker_id in the database.
Now: the admin assigns ONE locker to the ENTIRE borrow request at approval time.
The locker_id column has been removed from components table.
borrow_requests now has assigned_locker_id (uuid, FK to lockers).

## Read These Files First
- src/features/admin/pages/ManageRequests.jsx
- src/features/admin/hooks/useManageRequests.js
- src/features/admin/pages/ManageComponents.jsx
- src/features/admin/hooks/useManageComponents.js
- src/features/admin/pages/ManageLockers.jsx
- src/features/admin/hooks/useManageLockers.js
- src/features/components/pages/ComponentsPage.jsx
- src/features/components/pages/ComponentDetailPage.jsx
- src/features/components/components/ComponentCard.jsx
- src/features/components/hooks/useComponents.js
- src/features/borrows/pages/MyRequestsPage.jsx
- src/features/borrows/hooks/useBorrows.js
- src/features/borrows/components/LockerQRModal.jsx
- src/features/borrows/components/ReturnRequestModal.jsx
- src/features/student/pages/StudentDashboard.jsx
- src/features/student/components/ActiveLoanCard.jsx
- src/shared/components/layout/StudentLayout.jsx

After reading all files, implement every change below exactly as described.

---

## New Borrow Flow

```
Student adds components to cart → submits request (no locker yet)
        ↓
Admin sees pending request
Admin picks ONE available locker for the whole request
Admin sets pickup date + duration
Admin approves → locker marked occupied → student notified with locker + QR
        ↓
Student scans QR at locker → locker opens → takes all items
        ↓
Student submits return request + image proof
Admin confirms return → locker marked available again
```

---

## Change 1 — Remove All Locker References from Components

### Components hooks and pages
In `useComponents.js`:
- Remove all locker joins from queries
- Old: `.select('*, lockers(locker_code)')`
- New: `.select('*')` — no locker join needed

In `ComponentCard.jsx`:
- Remove the locker location display (SVG map-pin + locker_code)
- Remove any reference to `component.lockers` or `locker_code`
- Keep: name, description, category, quantity_available, lab_name

In `ComponentDetailPage.jsx`:
- Remove the "Locker Location" card/section entirely
- Remove any reference to `component.lockers` or `locker_code`
- Keep all other details: name, description, category, quantity, lab_name

In `ManageComponents.jsx`:
- Remove the "Locker" column from the components table
- Remove the locker Select dropdown from the Add/Edit modal entirely
- Remove locker from the form fields and zod schema
- Keep all other fields: name, description, category, quantity_total,
  quantity_available, lab_name, image_url

In `useManageComponents.js`:
- Remove locker_id from all insert/update operations
- Remove useAllLockers hook entirely from this file
- Remove all locker-related imports and queries

---

## Change 2 — Admin Assigns Locker at Approval

### Update useManageRequests.js

Update the fetch query to include assigned_locker_id:
```js
const { data, error } = await supabase
  .from('borrow_requests')
  .select(`
    *,
    profiles:student_id (
      id,
      full_name,
      student_id,
      email,
      is_flagged
    ),
    borrow_request_items (
      id,
      quantity_requested,
      components (
        id,
        name,
        category,
        quantity_available
      )
    ),
    lockers:assigned_locker_id (
      id,
      locker_code,
      description,
      is_occupied
    )
  `)
  .order('created_at', { ascending: false })
```

Also fetch all lockers for the locker selector:
```js
const { data: lockersData } = await supabase
  .from('lockers')
  .select('id, locker_code, description, is_occupied')
  .order('locker_code')

return { requests, lockers: lockersData ?? [], ... }
```

Update approveRequest signature:
```js
const approveRequest = async (
  requestId,
  pickupDate,
  requestedDays,
  componentItems,
  assignedLockerId,  // NEW — single locker for whole request
  studentId,
  componentNames     // for notification message
) => {
  const dueDate = addDays(new Date(pickupDate), requestedDays)

  // 1. Update borrow request
  await supabase
    .from('borrow_requests')
    .update({
      status: 'active',
      borrowed_at: new Date().toISOString(),
      pickup_date: pickupDate,
      requested_days: requestedDays,
      due_date: dueDate.toISOString(),
      assigned_locker_id: assignedLockerId,
      qr_token: crypto.randomUUID()
    })
    .eq('id', requestId)

  // 2. Mark locker as occupied
  await supabase
    .from('lockers')
    .update({ is_occupied: true })
    .eq('id', assignedLockerId)

  // 3. Decrement quantity for each component
  for (const item of componentItems) {
    const { data: comp } = await supabase
      .from('components')
      .select('quantity_available')
      .eq('id', item.components.id)
      .single()

    await supabase
      .from('components')
      .update({
        quantity_available: comp.quantity_available - item.quantity_requested
      })
      .eq('id', item.components.id)
  }

  // 4. Get locker code for notification
  const { data: locker } = await supabase
    .from('lockers')
    .select('locker_code')
    .eq('id', assignedLockerId)
    .single()

  // 5. Notify student
  await supabase.from('notifications').insert({
    user_id: studentId,
    title: 'Request Approved',
    message: `Your request has been approved. 
      Your items will be in Locker ${locker.locker_code}. 
      Pickup date: ${formatDate(new Date(pickupDate))}. 
      Due date: ${formatDate(dueDate)}. 
      Use your QR code to open the locker.`
  })

  refetch()
}
```

Update confirmReturn to free the locker:
```js
const confirmReturn = async (requestId, componentItems, assignedLockerId) => {
  // 1. Mark request as returned
  await supabase
    .from('borrow_requests')
    .update({
      status: 'returned',
      returned_at: new Date().toISOString()
    })
    .eq('id', requestId)

  // 2. Free the locker
  if (assignedLockerId) {
    await supabase
      .from('lockers')
      .update({ is_occupied: false })
      .eq('id', assignedLockerId)
  }

  // 3. Increment quantity back for each component
  for (const item of componentItems) {
    const { data: comp } = await supabase
      .from('components')
      .select('quantity_available')
      .eq('id', item.components.id)
      .single()

    await supabase
      .from('components')
      .update({
        quantity_available: comp.quantity_available + item.quantity_requested
      })
      .eq('id', item.components.id)
  }

  refetch()
}
```

### Update ManageRequests.jsx — Approve Modal

The Approve modal must contain:

**Section 1 — Student Info**
- Avatar circle with initial, full name, student ID

**Section 2 — Requested Items**
List each item from borrow_request_items:
- Component name + category (right aligned)
- Qty requested
- Stock check: green "X in stock" or red "Only X in stock — insufficient"
- If ANY item has quantity_available < quantity_requested:
  show red warning banner: "Some items have insufficient stock.
  Please update inventory before approving."
  AND disable the Approve button

**Section 3 — Request Details (read-only)**
Show in a gray info box:
- Course: course_name
- Lecturer: course_dr_name  
- Lab: lab_name (if exists)
- Reason: reason

**Section 4 — Locker Assignment (required)**
```jsx
<div>
  <label className="text-sm font-medium text-slate-700 mb-1 block">
    Assign Locker <span className="text-red-500">*</span>
  </label>
  <p className="text-xs text-slate-400 mb-2">
    Select one locker for all items in this request
  </p>
  <select
    value={assignedLockerId}
    onChange={e => setAssignedLockerId(e.target.value)}
    className="w-full text-sm border border-[#E2E8F0] rounded-lg 
      px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
  >
    <option value="">Select a locker...</option>
    {lockers.map(l => (
      <option
        key={l.id}
        value={l.id}
        disabled={l.is_occupied}
      >
        {l.locker_code}
        {l.description ? ` — ${l.description}` : ''}
        {l.is_occupied ? ' (Occupied)' : ' (Available)'}
      </option>
    ))}
  </select>
  {!assignedLockerId && submitAttempted && (
    <p className="text-red-500 text-xs mt-1">
      Please assign a locker before approving
    </p>
  )}
</div>
```

Track: const [assignedLockerId, setAssignedLockerId] = useState('')
Track: const [submitAttempted, setSubmitAttempted] = useState(false)

**Section 5 — Pickup Date + Duration**
Same as before:
- Date input for pickup_date
- Number input for requested_days
- Calculated due date shown below

**Approve Button logic:**
```js
const handleApprove = () => {
  setSubmitAttempted(true)
  if (!assignedLockerId) return
  if (hasInsufficientStock) return
  
  approveRequest(
    selectedRequest.id,
    pickupDate,
    loanDays,
    selectedRequest.borrow_request_items,
    assignedLockerId,
    selectedRequest.profiles?.id,
  )
}
```

Reset state when modal closes:
```js
useEffect(() => {
  if (!approveModalOpen) {
    setAssignedLockerId('')
    setSubmitAttempted(false)
  }
}, [approveModalOpen])
```

**Requests table — Component column:**
Since there's no locker per component anymore, show:
- First component name + "+X more" if multiple items
- No locker code in the table row (locker shown in modal only)

**Requests table — add Locker column:**
For active/returned/overdue requests, show the assigned locker:
- `request.lockers?.locker_code ?? '—'`

---

## Change 3 — Update QR Code to Include Assigned Locker

### Update LockerQRModal.jsx

The QR must now encode the locker from `request.lockers` (assigned at approval),
not from component data:

```js
const qrData = JSON.stringify({
  request_id: request.id,
  student_id: request.student_id,
  locker: request.lockers?.locker_code ?? 'Unassigned',
  locker_id: request.assigned_locker_id,
  qr_token: request.qr_token,
  due_date: request.due_date,
  components: request.borrow_request_items?.map(item => ({
    name: item.components?.name,
    quantity: item.quantity_requested
  })) ?? []
})
```

Below the QR, show:
- "Locker: [locker_code]" in large teal text
- List of components in the request
- Due date

Update the note: "Scan this QR at Locker [locker_code] to collect your items."

### Update useBorrows.js — fetch query

Add assigned_locker_id and lockers join to useMyBorrowRequests:
```js
.select(`
  *,
  lockers:assigned_locker_id (
    id,
    locker_code,
    description
  ),
  borrow_request_items (
    id,
    quantity_requested,
    components (
      id,
      name,
      category
    )
  )
`)
```

---

## Change 4 — Update Student-Facing Pages

### MyRequestsPage.jsx

Update each request card to show:
- List of components from borrow_request_items (bullet list)
- Course name + lecturer in gray subtitle
- For active requests: assigned locker in a teal info box:
  ```
  📦 Your items are in Locker A1
  ```
  (use SVG locker icon, not emoji)
- "Show Locker QR" button for active requests
- "Request Return" button for active requests (only if no pending return)
- For return_requested: yellow banner "Return pending admin review"

### StudentDashboard.jsx + ActiveLoanCard.jsx

Update ActiveLoanCard to show:
- Component list (first 2 names, "+X more" if more)
- Assigned locker in teal pill: "Locker A1"
- Due date countdown
- "View QR" button

Access locker as: `loan.lockers?.locker_code`

---

## Change 5 — Update ReturnRequestModal.jsx

The return QR in Step 1 must now encode the assigned locker:
```js
const returnQrData = JSON.stringify({
  type: 'return',
  request_id: request.id,
  student_id: request.student_id,
  locker: request.lockers?.locker_code,
  locker_id: request.assigned_locker_id,
  return_qr_token: returnQrToken,
  components: request.borrow_request_items?.map(i => i.components?.name)
})
```

Step 1 text: "Scan this QR at Locker [request.lockers?.locker_code] 
to open it and place your items back."

---

## Change 6 — Update ManageLockers.jsx

Each locker card now shows:
- Locker code (large, teal)
- Description
- is_occupied status: green "Available" or red "Occupied"
- If occupied: show which borrow request is using it:
  Fetch from borrow_requests where assigned_locker_id = locker.id
  and status IN ('active', 'return_requested')
  Show: "In use by: [student name] until [due_date]"

Add a "Sync" button in page header that calls sync_locker_occupancy RPC.

In useManageLockers.js, update fetch query:
```js
const { data } = await supabase
  .from('lockers')
  .select(`
    *,
    borrow_requests!assigned_locker_id (
      id,
      due_date,
      status,
      profiles:student_id (
        full_name,
        student_id
      )
    )
  `)
  .order('locker_code')
```

Filter active requests for display:
```js
const activeRequest = locker.borrow_requests?.find(
  r => ['active', 'return_requested'].includes(r.status)
)
```

---

## Wiring Checklist
- [ ] Components table/cards/detail show NO locker info anywhere
- [ ] ManageComponents modal has NO locker field
- [ ] Approve modal shows ONE locker selector for whole request
- [ ] Only available lockers (is_occupied = false) are selectable
- [ ] Approve button disabled if no locker selected or stock insufficient
- [ ] On approval: locker is_occupied → true, student notified with locker code
- [ ] QR code includes assigned locker_code from request.lockers
- [ ] Return QR includes assigned locker_code
- [ ] On return confirmed: locker is_occupied → false
- [ ] ManageLockers shows which student is using each occupied locker
- [ ] Student dashboard + my requests show assigned locker for active loans
- [ ] No references to component.lockers anywhere in the codebase
- [ ] No locker_id column referenced on components table anywhere

## Files to Modify
- src/features/components/hooks/useComponents.js
- src/features/components/pages/ComponentsPage.jsx
- src/features/components/pages/ComponentDetailPage.jsx
- src/features/components/components/ComponentCard.jsx
- src/features/admin/pages/ManageComponents.jsx
- src/features/admin/hooks/useManageComponents.js
- src/features/admin/pages/ManageRequests.jsx
- src/features/admin/hooks/useManageRequests.js
- src/features/admin/pages/ManageLockers.jsx
- src/features/admin/hooks/useManageLockers.js
- src/features/borrows/pages/MyRequestsPage.jsx
- src/features/borrows/hooks/useBorrows.js
- src/features/borrows/components/LockerQRModal.jsx
- src/features/borrows/components/ReturnRequestModal.jsx
- src/features/student/pages/StudentDashboard.jsx
- src/features/student/components/ActiveLoanCard.jsx

## Files to Create
None — all changes are to existing files.

Show every modified file in full after implementing.
