<p align="center">
  <img width="400" alt="Borrow request flow chart" src="https://github.com/user-attachments/assets/1425d5ac-65f6-4372-ae5d-b4211df000ab" />
  <br>
  <b>Flow Chart</b>
</p>

---

## Hardware Integration

The software exposes all necessary data through Supabase Realtime for the hardware team to integrate.

### What the Pi Needs

| Item | Value |
|---|---|
| Supabase URL | Your project URL |
| Service Role Key | Supabase → Settings → API → `service_role` secret |
| Table to watch | `borrow_requests` where `status = 'active'` |

<p align="center">
  <img width="650" alt="LCD output" src="https://github.com/user-attachments/assets/35f22ea4-ff59-4ef6-a687-a1de04654db7" />
  <br>
  <b>LCD Output</b>
</p>

### QR Code Contents

**Borrow QR** (student uses to collect item):
```json
{
  "request_id": "uuid",
  "student_id": "uuid",
  "component": "Arduino Uno R3",
  "locker": "A1",
  "qr_token": "uuid",
  "due_date": "2026-06-17T..."
}
```

**Return QR** (student uses to return item):
```json
{
  "type": "return",
  "request_id": "uuid",
  "student_id": "uuid",
  "component": "Arduino Uno R3",
  "locker": "A1",
  "return_qr_token": "uuid"
}
```

### Pi Verification Logic (Python)
```python
def verify_borrow_qr(qr_data):
    data = json.loads(qr_data)
    result = supabase.table('borrow_requests') \
        .select('status, qr_token') \
        .eq('id', data['request_id']) \
        .eq('qr_token', data['qr_token']) \
        .eq('status', 'active') \
        .single() \
        .execute()
    if result.data:
        open_locker(data['locker'])
        return True
    return False

def verify_return_qr(qr_data):
    data = json.loads(qr_data)
    result = supabase.table('borrow_requests') \
        .select('status, return_qr_token') \
        .eq('id', data['request_id']) \
        .eq('return_qr_token', data['return_qr_token']) \
        .in_('status', ['active', 'return_requested']) \
        .single() \
        .execute()
    if result.data:
        open_locker(data['locker'])
        return True
    return False
```

### Recommended Hardware Per Locker
- ESP32 (WiFi microcontroller)
- 5V Relay module
- 12V Solenoid lock
- QR/barcode scanner (TTL serial, e.g. GM65)
- One Raspberry Pi manages all lockers in the lab

---

## Project Structure
