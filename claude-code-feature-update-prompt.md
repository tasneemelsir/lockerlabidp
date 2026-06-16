# Lab Locker Management System — Feature Update Prompt

## Instructions
Before implementing anything, read the following files in full:
- `src/features/borrows/pages/MyRequestsPage.jsx`
- `src/features/borrows/hooks/useBorrows.js`
- `src/features/components/pages/ComponentsPage.jsx`
- `src/features/components/pages/ComponentDetailPage.jsx`
- `src/features/components/hooks/useComponents.js`
- `src/features/admin/pages/ManageRequests.jsx`
- `src/features/admin/pages/ManageComponents.jsx`
- `src/features/admin/pages/ManageLockers.jsx`
- `src/features/admin/hooks/useManageRequests.js`
- `src/features/admin/hooks/useManageComponents.js`
- `src/features/admin/hooks/useManageLockers.js`
- `src/shared/components/ui/Modal.jsx`
- `src/shared/lib/supabase.js`
- `src/app/Router.jsx`

After reading all files, implement the following four features exactly as described.

---

## Database Changes — Run This SQL in Supabase First

```sql
-- ============================================================
-- Feature 1: Cart-based borrow requests
-- ============================================================

-- New table: borrow_request_items (one request → many components)
CREATE TABLE IF NOT EXISTS public.borrow_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrow_request_id uuid REFERENCES public.borrow_requests(id) ON DELETE CASCADE,
  component_id uuid REFERENCES public.components(id) ON DELETE CASCADE,
  quantity_requested integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add new columns to borrow_requests for cart-based flow
ALTER TABLE public.borrow_requests
  ADD COLUMN IF NOT EXISTS course_name text,
  ADD COLUMN IF NOT EXISTS course_dr_name text,
  ADD COLUMN IF NOT EXISTS pickup_date date,
  ADD COLUMN IF NOT EXISTS requested_days integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS reason text;

-- Update due_date to be calculated from pickup_date + requested_days
-- (handled in application logic, not DB)

-- RLS for borrow_request_items
ALTER TABLE public.borrow_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_select_own_request_items"
ON public.borrow_request_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.borrow_requests
    WHERE id = borrow_request_id
    AND student_id = auth.uid()
  )
);

CREATE POLICY "students_insert_own_request_items"
ON public.borrow_request_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.borrow_requests
    WHERE id = borrow_request_id
    AND student_id = auth.uid()
  )
);

CREATE POLICY "admins_all_request_items"
ON public.borrow_request_items FOR ALL
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.borrow_request_items TO authenticated;

-- ============================================================
-- Feature 2: Locker availability
-- ============================================================

-- is_occupied already exists — make it auto-update via trigger
CREATE OR REPLACE FUNCTION public.update_locker_occupancy()
RETURNS trigger AS $$
BEGIN
  -- When a component is assigned to a locker, mark locker as occupied
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.locker_id IS NOT NULL THEN
      UPDATE public.lockers
        SET is_occupied = true
        WHERE id = NEW.locker_id;
    END IF;
    -- If component was moved away from old locker, check if old locker is now free
    IF TG_OP = 'UPDATE' AND OLD.locker_id IS NOT NULL AND OLD.locker_id != NEW.locker_id THEN
      UPDATE public.lockers
        SET is_occupied = (
          EXISTS (SELECT 1 FROM public.components WHERE locker_id = OLD.locker_id)
        )
        WHERE id = OLD.locker_id;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.locker_id IS NOT NULL THEN
      UPDATE public.lockers
        SET is_occupied = (
          EXISTS (SELECT 1 FROM public.components WHERE locker_id = OLD.locker_id AND id != OLD.id)
        )
        WHERE id = OLD.locker_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_component_locker_change ON public.components;
CREATE TRIGGER on_component_locker_change
  AFTER INSERT OR UPDATE OR DELETE ON public.components
  FOR EACH ROW EXECUTE FUNCTION public.update_locker_occupancy();

-- Sync current state
UPDATE public.lockers l
SET is_occupied = (
  EXISTS (SELECT 1 FROM public.components c WHERE c.locker_id = l.id)
);

-- ============================================================
-- Feature 4: Lab association for components
-- ============================================================

ALTER TABLE public.components
  ADD COLUMN IF NOT EXISTS lab_name text;
```

---

## Feature 1 — Cart-Based Borrow Request

### Overview
Replace the single-component borrow flow with a cart system. Students add up to 5 components to a cart, then fill in request details and submit everything as one borrow request. The cart persists in React state only (no DB until submission).

### Lab List (hardcode this array wherever needed)
```js
export const UTM_LABS = [
  'Advanced Electronics Lab P19a-03-02-00',
  'Advanced Power Lab P07-114',
  'Applied Control Lab P08-414',
  'Basic Microwave Lab P03-416',
  'Basic Power Lab P07-108',
  'Bioelectronics Lab P04-213',
  'Digital Communication Lab / IOT Lab P03-516',
  'Instrumentation Lab P02-419',
  'Mechatronics Lab P19A-02-02-01',
  'Microelectronics Lab P19a-03-02-00',
  'Microprocessor Lab P04-420',
  'Optical Communication Lab P03-313',
  'Power Electronics Lab P07-222',
  'Basic Machine Lab P06-136-04',
  'VLSI - FPGA P04-315',
  'VLSI Design Lab / Synopsys P19A-02-10-01',
]
```

### Cart Context — Create `src/features/borrows/context/CartContext.jsx`
```jsx
// CartProvider wraps StudentLayout
// State: cartItems = [{ component, quantity }] max 5 items
// Exposes:
//   cartItems, cartCount
//   addToCart(component, quantity) — fails if cartCount >= 5 or same component already in cart
//   removeFromCart(componentId)
//   updateQuantity(componentId, quantity)
//   clearCart()
// Export useCart() hook
```

### Cart Icon in StudentLayout
- Add a cart icon (inline SVG shopping bag) in the navbar between nav links and notification bell
- Show a teal badge with item count when cartCount > 0
- Clicking navigates to `/cart`

### Cart Page — Create `src/features/borrows/pages/CartPage.jsx`
Route: `/cart`

**Layout — Two columns on desktop, stacked on mobile:**

**Left column — Cart Items**
- Title "Your Cart" + item count
- List of cart items, each showing:
  - Component name + category badge
  - Locker code
  - Quantity stepper (− / number / +) respecting quantity_available
  - Remove button (SVG trash icon, red ghost)
- If cart is empty: EmptyState "Your cart is empty" + "Browse Components" button
- Max 5 components notice: "You can add up to 5 components per request"
  - If cartCount = 5: show a yellow warning banner "Cart is full"

**Right column — Request Details Form**
Use react-hook-form + zod. Fields:

```
Course Name          text input, required, min 2 chars
                     placeholder "e.g. BEE 3223 Power Electronics"

Course Dr Name       text input, required, min 2 chars  
                     placeholder "e.g. Dr. Ahmad bin Abdullah"

Lab                  Select dropdown using UTM_LABS array, required

Reason               textarea, required, min 10 chars
                     placeholder "Describe why you need these components..."
                     resize-none, h-24

Pickup Date          date input, required
                     Must be at least tomorrow (validate: date > today)
                     label "Preferred Pickup Date"

Duration             number input, required, min 1, max 30
                     label "How many days do you need it?"
                     helper text "Due date will be: [calculated date shown dynamically]"
                     Update the shown due date in real time as user types
```

Zod schema:
```js
const schema = z.object({
  course_name: z.string().min(2),
  course_dr_name: z.string().min(2),
  lab_name: z.string().min(1, 'Please select a lab'),
  reason: z.string().min(10),
  pickup_date: z.string().refine(val => new Date(val) > new Date(), {
    message: 'Pickup date must be in the future'
  }),
  requested_days: z.number().min(1).max(30),
})
```

**Submit button "Submit Request"** — disabled if cart is empty.

**On submit:**
1. Create one `borrow_requests` row:
   ```js
   const { data: requestData } = await supabase
     .from('borrow_requests')
     .insert({
       student_id: user.id,
       status: 'pending',
       course_name,
       course_dr_name,
       lab_name,
       reason,
       pickup_date,
       requested_days,
       // component_id set to null (cart uses borrow_request_items instead)
       quantity_requested: cartItems.reduce((sum, i) => sum + i.quantity, 0)
     })
     .select()
     .single()
   ```
2. Insert one row per cart item into `borrow_request_items`:
   ```js
   await supabase.from('borrow_request_items').insert(
     cartItems.map(item => ({
       borrow_request_id: requestData.id,
       component_id: item.component.id,
       quantity_requested: item.quantity
     }))
   )
   ```
3. Clear cart
4. Toast "Request submitted successfully!"
5. Navigate to `/my-requests`

### Update Component Cards and Detail Page
- Replace "Request" / "Borrow" button with "Add to Cart" button
- "Add to Cart" behavior:
  - If component already in cart: show "In Cart ✓" (disabled, teal bg)
  - If cart is full (5 items): show toast "Cart is full (max 5 components)"
  - If quantity_available = 0: show "Unavailable" (disabled, gray)
  - Otherwise: call addToCart(component, 1), show toast "Added to cart"
- Remove the old borrow form from ComponentDetailPage entirely

### Update My Requests Page
Update the borrow request cards to show:
- Course name + Dr name in a gray subtitle row
- Lab name badge (teal pill)
- Pickup date
- Duration: "X days"
- Components list: fetch from `borrow_request_items` joined with `components(name)`
  and show as a small bulleted list inside the card

### Update useBorrows.js
- Add `useMyBorrowRequests` that fetches borrow_requests joined with:
  ```js
  borrow_request_items ( *, components ( name, lockers ( locker_code ) ) )
  ```
- Remove `useSubmitBorrowRequest` (replaced by cart submit logic in CartPage)

---

## Feature 2 — Locker Availability (Auto-managed)

The DB trigger handles marking lockers occupied/available automatically.
The frontend changes are:

### Update ManageComponents — Locker Dropdown
In the Add/Edit Component modal, the locker Select dropdown must:
- Only show lockers where `is_occupied = false` OR the locker already assigned to this component (for edits)
- Mark occupied lockers as disabled in the dropdown with a gray "(Occupied)" label
- Show a helper text below the select: "Only available lockers are shown"

Update `useAllLockers` in `useManageComponents.js`:
```js
// Fetch all lockers with occupancy status
const { data } = await supabase
  .from('lockers')
  .select('*, components(id, name)')
  .order('locker_code')
// Return all lockers but flag which ones are occupied
```

In the Select options:
```js
options={lockers.map(l => ({
  value: l.id,
  label: l.is_occupied && l.id !== currentLockerId
    ? `${l.locker_code} — Occupied`
    : `${l.locker_code}${l.description ? ' — ' + l.description : ''}`,
  disabled: l.is_occupied && l.id !== currentLockerId
}))}
```

If `Select.jsx` doesn't support `disabled` per option, update it to support:
```jsx
<option key={opt.value} value={opt.value} disabled={opt.disabled}>
  {opt.label}
</option>
```

### Update ManageLockers Page
- Each locker card shows occupancy status:
  - Green dot + "Available" if `is_occupied = false`
  - Red dot + "Occupied" if `is_occupied = true`
  - Show which component is inside (if occupied): small gray text "Contains: Arduino Uno R3"
- Remove the manual toggle for `is_occupied` — it is now auto-managed
- Add a note on the page: "Locker availability is automatically updated when components are assigned."

---

## Feature 3 — Return Request Must Include Image

### Update ReturnRequestModal
The return flow already has two steps. Enforce that the image upload in Step 2 is **mandatory**:
- The submit button "Submit Return Proof" must be disabled until an image is selected
- Add red asterisk (*) to the image upload label
- Add helper text: "A photo is required to process your return request."
- If user tries to submit without image: show inline error "Please upload a photo of the returned item"
- Validate file type (jpeg/png only) and size (max 5MB) before enabling submit

### Update Admin Return Review
In `ManageRequests.jsx`, for `return_requested` rows:
- The "View Proof" button must always be shown (image is now guaranteed to exist)
- Remove any "No image provided" fallback — it will always have an image
- In `ReturnProofModal.jsx`: show the image prominently, full width, with a lightbox effect
  (clicking the image opens it in a new tab: `window.open(request.return_image_url, '_blank')`)

---

## Feature 4 — Components Associated with Labs

### Lab List
Use the same `UTM_LABS` array defined in Feature 1.
Create `src/shared/utils/constants.js` and export it from there:
```js
export const UTM_LABS = [
  'Advanced Electronics Lab P19a-03-02-00',
  // ... full list
]
```
Import from this file everywhere UTM_LABS is needed.

### Update ManageComponents — Add/Edit Modal
Add a "Associated Lab" field to the component form:
- Select dropdown populated from UTM_LABS
- Optional (not required — some components may be general use)
- Label: "Associated Lab"
- Default: "" (None / General Use)

Update the zod schema to include:
```js
lab_name: z.string().optional()
```

Update the insert/update to include `lab_name`.

### Update ComponentsPage (Student View)
Add a "Lab" filter alongside the existing category filter:
- A second row of horizontal scrollable pill buttons: "All Labs" + each unique lab_name from fetched components
- Only show labs that have at least one component assigned
- Lab filter and category filter work independently and together
- When a lab is selected: filter components to show only those with that lab_name
- Pills styling: same as existing category pills

### Update ComponentCard
- If component has a `lab_name`, show it as a small gray text below the category badge
- Format: just the lab name text, truncated if too long (max-w truncate)

### Update ComponentDetailPage
- Add a "Lab" info row in the details section showing the lab_name
- If no lab assigned: show "General Use"

### Update ManageComponents Table (Admin)
- Add a "Lab" column to the components table showing lab_name or "—"
- Add a lab filter dropdown above the table (alongside search and category filter)

---

## Files to Create
- `src/features/borrows/context/CartContext.jsx`
- `src/features/borrows/pages/CartPage.jsx`
- `src/shared/utils/constants.js`

## Files to Modify
- `src/app/Router.jsx` — add /cart route under student routes
- `src/shared/components/layout/StudentLayout.jsx` — add cart icon with badge
- `src/shared/components/ui/Select.jsx` — support disabled options
- `src/features/components/pages/ComponentsPage.jsx` — add to cart button, lab filter
- `src/features/components/pages/ComponentDetailPage.jsx` — add to cart, lab info
- `src/features/components/components/ComponentCard.jsx` — add to cart button, lab display
- `src/features/components/hooks/useComponents.js` — remove borrow submit, keep list/detail
- `src/features/borrows/pages/MyRequestsPage.jsx` — show cart request details
- `src/features/borrows/pages/CartPage.jsx` — new file
- `src/features/borrows/hooks/useBorrows.js` — update fetch query with items join
- `src/features/borrows/components/ReturnRequestModal.jsx` — enforce image required
- `src/features/admin/pages/ManageRequests.jsx` — show cart items per request
- `src/features/admin/pages/ManageComponents.jsx` — lab field, occupied locker filter
- `src/features/admin/pages/ManageLockers.jsx` — show occupancy info, remove manual toggle
- `src/features/admin/hooks/useManageRequests.js` — join borrow_request_items
- `src/features/admin/hooks/useManageComponents.js` — include lab_name in CRUD
- `src/features/admin/hooks/useManageLockers.js` — join components for occupancy display
- `src/features/admin/components/ReturnProofModal.jsx` — lightbox on image click

## Wiring Checklist
After implementing, verify:
- [ ] Cart persists across page navigation (context is in StudentLayout, not page-level)
- [ ] Cart badge updates immediately when item is added/removed
- [ ] Cart max 5 enforced — cannot add 6th item
- [ ] Same component cannot be added twice to cart
- [ ] CartPage submit creates exactly 1 borrow_request + N borrow_request_items
- [ ] Locker dropdown in ManageComponents only shows available lockers
- [ ] Adding a component to a locker automatically marks locker as occupied in DB
- [ ] Removing/reassigning a component automatically frees the old locker
- [ ] Return image upload is blocked until file is selected
- [ ] Admin can see all components in a cart request grouped together
- [ ] Lab filter on ComponentsPage works with category filter simultaneously
- [ ] UTM_LABS list is imported from constants.js everywhere — not duplicated

## Acceptance Criteria
- Student can add up to 5 components to cart, fill in details, and submit as one request
- Admin sees the full cart with all components, course info, lab, and pickup date
- Admin can approve the whole request (not individual items)
- Lockers auto-update occupancy when components are assigned
- Return requests cannot be submitted without an image
- Components can be filtered by lab on the browse page
- Each component shows its associated lab in the card and detail view
```
