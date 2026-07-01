"""
Smart Locker QR Scanner — Raspberry Pi v4
==========================================
Handles 5 QR types in one file:

  1. BORROW QR     → open assigned locker, free it after student takes items
  2. RETURN QR     → open return locker, occupy it after student places items
  3. STUDENT QR    → verify student identity, check flagged status
  4. MASTER QR     → admin enters master mode (30 second window)
  5. LOCKER SELECT → admin scans specific locker QR to open it in master mode

Flow summary:
  Borrow:  scan borrow QR  → locker opens → is_occupied=false → qr_token_used=true
  Return:  scan return QR  → return locker opens → is_occupied=true → return_qr_token_used=true
           frontend polls return_qr_token_used → unlocks image upload step
  Master:  scan master QR  → 30s window opens
           scan locker QR  → that locker opens → master mode resets
"""

import json
import time
import sys
import camera

import RPi.GPIO as GPIO
from evdev import InputDevice, categorize, ecodes
from RPLCD.i2c import CharLCD
from supabase import create_client


# =============================================================
# CONFIGURATION — update to match your hardware
# =============================================================

SUPABASE_URL = "https://uenmzpinlbyonrehimys.supabase.co"
SUPABASE_KEY = "sb_secret_9Zkn--q7IIYIfrUlTA3JgQ_p-5_nNuD"

# Map locker codes to GPIO pins — update to your actual wiring
LOCKER_RELAY_MAP = {
    "A1": 22,
    "A2": 27,
    "B1": 22,
    "B2": 23,
    "C1": 24,
    "C2": 25,
}

BUZZER_PIN           = 16    # set to None if no buzzer
RELAY_OPEN_SECONDS   = 3  # how long relay stays HIGH
REPEAT_TIMES         = 3     # success screen cycle count
REPEAT_DELAY         = 2     # seconds between cycles
RESET_DELAY_SECONDS  = 2     # pause before returning to ready screen
MASTER_MODE_TIMEOUT  = 30    # seconds admin has to scan locker QR after master QR

LCD_I2C_ADDRESS = 0x27
LCD_COLS        = 20
LCD_ROWS        = 4

# PCF8574 I2C expander is slow — the HD44780 clear command takes up to
# 1.52ms but the expander + I2C bus overhead needs ~200ms to fully settle
# before the next write lands in the right place.
LCD_CLEAR_DELAY = 0.30    # seconds after lcd.clear()
LCD_WRITE_DELAY = 0.01   # seconds after writing each row

SCANNER_DEVICE = '/dev/input/event4'  # run: ls /dev/input/event*
DEBUG_SCAN     = False                # True = log every keypress


# =============================================================
# MASTER MODE STATE (global, single-instance)
# =============================================================

master_mode_active = False
master_admin_name  = ""
master_expiry      = 0.0   # unix timestamp when master mode expires


# =============================================================
# GPIO SETUP
# =============================================================

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

for _pin in LOCKER_RELAY_MAP.values():
    GPIO.setup(_pin, GPIO.OUT)
    GPIO.output(_pin, GPIO.LOW)

if BUZZER_PIN is not None:
    GPIO.setup(BUZZER_PIN, GPIO.OUT)
    GPIO.output(BUZZER_PIN, GPIO.LOW)

# =============================================================
# CAMERA SETUP
# =============================================================
cam_device = camera.init_camera('/dev/ttyUSB0', 921600)

# =============================================================
# LCD SETUP
# =============================================================

try:
    lcd = CharLCD(
        i2c_expander='PCF8574',
        address=LCD_I2C_ADDRESS,
        port=1,
        cols=LCD_COLS,
        rows=LCD_ROWS,
        charmap='A00',
        auto_linebreaks=False,
    )
except Exception:
    print("[ERROR] LCD not found. Check I2C address and wiring.")
    GPIO.cleanup()
    sys.exit(1)


# =============================================================
# SUPABASE SETUP
# =============================================================

try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    print("[ERROR] Could not connect to Supabase.")
    GPIO.cleanup()
    sys.exit(1)


# =============================================================
# SCANNER SETUP
# =============================================================

try:
    device = InputDevice(SCANNER_DEVICE)
except Exception:
    print(f"[ERROR] Scanner not found at {SCANNER_DEVICE}.")
    print("        Run: ls /dev/input/event* and update SCANNER_DEVICE.")
    GPIO.cleanup()
    sys.exit(1)


# =============================================================
# KEY MAPS
# =============================================================

KEY_MAP = {
    'KEY_1': '1', 'KEY_2': '2', 'KEY_3': '3', 'KEY_4': '4', 'KEY_5': '5',
    'KEY_6': '6', 'KEY_7': '7', 'KEY_8': '8', 'KEY_9': '9', 'KEY_0': '0',
    'KEY_A': 'a', 'KEY_B': 'b', 'KEY_C': 'c', 'KEY_D': 'd', 'KEY_E': 'e',
    'KEY_F': 'f', 'KEY_G': 'g', 'KEY_H': 'h', 'KEY_I': 'i', 'KEY_J': 'j',
    'KEY_K': 'k', 'KEY_L': 'l', 'KEY_M': 'm', 'KEY_N': 'n', 'KEY_O': 'o',
    'KEY_P': 'p', 'KEY_Q': 'q', 'KEY_R': 'r', 'KEY_S': 's', 'KEY_T': 't',
    'KEY_U': 'u', 'KEY_V': 'v', 'KEY_W': 'w', 'KEY_X': 'x', 'KEY_Y': 'y',
    'KEY_Z': 'z',
    'KEY_SPACE':      ' ',
    'KEY_MINUS':      '-',
    'KEY_DOT':        '.',
    'KEY_SLASH':      '/',
    'KEY_SEMICOLON':  ';',
    'KEY_APOSTROPHE': "'",
    'KEY_LEFTBRACE':  '[',
    'KEY_RIGHTBRACE': ']',
    'KEY_BACKSLASH':  '\\',
    'KEY_COMMA':      ',',
    'KEY_EQUAL':      '=',
    'KEY_GRAVE':      '`',
}

KEY_MAP_SHIFTED = {
    'KEY_1': '!', 'KEY_2': '@', 'KEY_3': '#', 'KEY_4': '$', 'KEY_5': '%',
    'KEY_6': '^', 'KEY_7': '&', 'KEY_8': '*', 'KEY_9': '(', 'KEY_0': ')',
    'KEY_A': 'A', 'KEY_B': 'B', 'KEY_C': 'C', 'KEY_D': 'D', 'KEY_E': 'E',
    'KEY_F': 'F', 'KEY_G': 'G', 'KEY_H': 'H', 'KEY_I': 'I', 'KEY_J': 'J',
    'KEY_K': 'K', 'KEY_L': 'L', 'KEY_M': 'M', 'KEY_N': 'N', 'KEY_O': 'O',
    'KEY_P': 'P', 'KEY_Q': 'Q', 'KEY_R': 'R', 'KEY_S': 'S', 'KEY_T': 'T',
    'KEY_U': 'U', 'KEY_V': 'V', 'KEY_W': 'W', 'KEY_X': 'X', 'KEY_Y': 'Y',
    'KEY_Z': 'Z',
    'KEY_MINUS':      '_',
    'KEY_DOT':        '>',
    'KEY_SLASH':      '?',
    'KEY_SEMICOLON':  ':',
    'KEY_APOSTROPHE': '"',
    'KEY_LEFTBRACE':  '{',
    'KEY_RIGHTBRACE': '}',
    'KEY_BACKSLASH':  '|',
    'KEY_COMMA':      '<',
    'KEY_EQUAL':      '+',
    'KEY_GRAVE':      '~',
}


# =============================================================
# LCD HELPERS
# =============================================================

def lcd_safe(text):
    """Replace LCD-unfriendly characters and strip non-printable ASCII."""
    replacements = {
        '{': '(', '}': ')',
        '[': '(', ']': ')',
        '"': "'", '_': '-',
    }
    out = []
    for ch in str(text):
        ch = replacements.get(ch, ch)
        if 32 <= ord(ch) <= 126:
            out.append(ch)
    return ''.join(out)


def lcd_center(text, width):
    """Return text centred in a field of exactly `width` characters.
    Truncates first so padding is always correct, then pads with spaces
    on both sides so the full row is written atomically — this is what
    prevents ghost characters (no leftover bytes from the previous message).
    """

    text = str(text)
    # prevent overflow
    if len(text) > width:
        text = text[:width]
    # calculate padding
    total_padding = width - len(text)
    left_padding = total_padding // 2
    return (" " * left_padding) + text


# Tracks what is currently shown so we can skip redundant clears.
# This is critical for success screens that loop — calling lcd.clear()
# 3 times in quick succession on identical content causes garbling.
_lcd_current = ["", "", "", ""]


def lcd_print(line0="", line1="", line2="", line3=""):
    """Clear display and write up to 4 centred lines.

    Key design decisions:
      1. Content cache (_lcd_current): if the requested lines are identical
         to what is already on screen, skip the clear + rewrite entirely.
         This solves garbling in loops (show_borrow_success repeats 3x)
         and the show_checking() → dynamic content double-clear problem.
      2. Single lcd.clear() with a 200ms settle delay — the PCF8574 I2C
         expander needs much more time than the 50ms that was here before.
      3. cursor_pos instead of raw lcd.command() so RPLCD tracks state.
      4. Each row written as a full-width padded string — no ghost chars.
    """

    global _lcd_current

    lines = [
        str(line0),
        str(line1),
        str(line2),
        str(line3)
    ]

    # skip redraw if same content
    if lines == _lcd_current:
        return

    try:

        lcd.clear()

        time.sleep(LCD_CLEAR_DELAY)

        for row, text in enumerate(lines[:LCD_ROWS]):

            safe = lcd_safe(text)

            # cut extra characters
            safe = safe[:LCD_COLS]

            # center text
            centered = lcd_center(
                safe,
                LCD_COLS
            )

            # clear FULL row first
            lcd.cursor_pos = (row, 0)
            lcd.write_string(" " * LCD_COLS)

            # write centered text
            lcd.cursor_pos = (row, 0)
            lcd.write_string(centered)

            time.sleep(LCD_WRITE_DELAY)

        _lcd_current = lines[:]

    except Exception as e:

        print(f"[LCD] Write error: {e}")


def lcd_force_clear():
    """Force a full clear regardless of cache — call before reset_screen()
    so a fresh ready screen always actually redraws."""
    global _lcd_current
    _lcd_current = ["__FORCE__", "", "", ""]


def reset_screen():
    """Show the default ready screen.
    Always force-clears the cache first so the ready screen redraws even
    if its content happens to match what was last shown.
    """
    lcd_force_clear()
    if master_mode_active and time.time() < master_expiry:
        remaining = int(master_expiry - time.time())
        lcd_print("MASTER MODE", "Scan locker QR", f"{remaining}s remaining", "")
    else:
        lcd_print("SMART LOCKER", "", "Scan QR Code", "")
    print("[READY] Waiting for scan...")


# =============================================================
# BUZZER HELPERS
# =============================================================

def beep(times=1, duration=0.1):
    if BUZZER_PIN is None:
        return
    for _ in range(times):
        GPIO.output(BUZZER_PIN, GPIO.HIGH)
        time.sleep(duration)
        GPIO.output(BUZZER_PIN, GPIO.LOW)
        time.sleep(0.05)


def beep_success():
    beep(times=1, duration=0.3)


def beep_error():
    beep(times=3, duration=0.2)


def beep_master():
    """Distinct double-beep for master mode activation."""
    beep(times=2, duration=0.15)


# =============================================================
# RELAY HELPER
# =============================================================

def open_locker(locker_code):
    """Pulse the relay for the given locker code."""
    pin = LOCKER_RELAY_MAP.get(locker_code)
    if pin is None:
        print(f"[RELAY] No GPIO pin mapped for '{locker_code}'")
        print(f"[RELAY] Known lockers: {list(LOCKER_RELAY_MAP.keys())}")
        return False
    GPIO.output(pin, GPIO.HIGH)
    time.sleep(RELAY_OPEN_SECONDS)
    GPIO.output(pin, GPIO.LOW)
    print(f"[RELAY] Opened {locker_code} on GPIO {pin}")
    return True


# =============================================================
# DB HELPERS
# =============================================================

def free_locker_in_db(locker_id, locker_code):
    """
    Set is_occupied = false.
    Called after BORROW QR scanned — student took items, locker empty.
    """
    if not locker_id:
        return
    try:
        supabase.table("lockers") \
            .update({"is_occupied": False}) \
            .eq("id", locker_id) \
            .execute()
        print(f"[DB] Locker {locker_code} freed (is_occupied=false)")
    except Exception as e:
        print(f"[DB] free_locker error: {e}")


def occupy_locker_in_db(locker_id, locker_code):
    """
    Set is_occupied = true.
    Called after RETURN QR scanned — student placed items, locker occupied.
    """
    if not locker_id:
        return
    try:
        supabase.table("lockers") \
            .update({"is_occupied": True}) \
            .eq("id", locker_id) \
            .execute()
        print(f"[DB] Locker {locker_code} occupied (is_occupied=true)")
    except Exception as e:
        print(f"[DB] occupy_locker error: {e}")


def resolve_borrow_locker_from_db(request_id):
    """Fallback: get assigned locker from borrow_requests.assigned_locker_id."""
    try:
        resp = supabase.table("borrow_requests") \
            .select("lockers:assigned_locker_id(id, locker_code)") \
            .eq("id", request_id) \
            .single() \
            .execute()
        d = resp.data.get("lockers")
        if d:
            return d.get("locker_code"), d.get("id")
        return None, None
    except Exception as e:
        print(f"[DB] resolve_borrow_locker error: {e}")
        return None, None


def resolve_return_locker_from_db(request_id):
    """Fallback: get return locker from borrow_requests.return_locker_id."""
    try:
        resp = supabase.table("borrow_requests") \
            .select("return_locker:return_locker_id(id, locker_code)") \
            .eq("id", request_id) \
            .single() \
            .execute()
        d = resp.data.get("return_locker")
        if d:
            return d.get("locker_code"), d.get("id")
        return None, None
    except Exception as e:
        print(f"[DB] resolve_return_locker error: {e}")
        return None, None


# =============================================================
# COMPONENT SUMMARY HELPER
# =============================================================

def get_component_summary(components_list):
    """
    Handles both formats:
      [{name: "Arduino", quantity: 1}, ...]  borrow QR
      ["Arduino", "Breadboard"]              return QR
    Returns short LCD-friendly string e.g. "Arduino +2"
    """
    if not components_list:
        return "Items"
    first = components_list[0]
    name  = first.get("name", "Item") if isinstance(first, dict) else str(first)
    name  = name[:12]
    count = len(components_list)
    return f"{name} +{count - 1}" if count > 1 else name


# =============================================================
# DISPLAY SCREENS
# =============================================================

def show_borrow_success(name, components_list, locker):
    beep_success()
    lcd_print("Locker Opened!", f"Locker {locker}", "Take these items:", "")
    time.sleep(3)
    show_items_paged("Take these items:", components_list)
    lcd_force_clear()
    lcd_print("Take your items", "", "and close door", "")
    time.sleep(3)


def show_return_success(name, components_list, locker):
    beep_success()
    lcd_print("Locker Opened!", f"Locker {locker}", "Place these items:", "")
    time.sleep(3)
    show_items_paged("Place these items:", components_list)
    lcd_force_clear()
    lcd_print("Place items in", "", "and close door", "")
    time.sleep(3)
    # Next step prompt (upload photo proof) — kept from original
    time.sleep(0.3)
    lcd_force_clear()
    lcd_print("NEXT STEP:", "Open the app", "Upload photo", "proof of return")
    beep(times=2, duration=0.15)
    time.sleep(6)


def show_student_success(name, student_id):
    lcd_print("Identity", "Verified!", f"{name} ({student_id})", "Access granted")
    beep_success()
    time.sleep(5)


def show_master_activated(admin_name):
    lcd_print("MASTER MODE", "ON", "Scan locker QR", "to open it")
    beep_master()
    time.sleep(3)


def show_master_open_success(locker_code, admin_name):
    lcd_print("MASTER OPEN", "", "Locker opened", "Access granted")
    beep_success()
    time.sleep(5)


def show_error(title, message="Please try again"):
    lcd_print("ERROR", title, "", message)
    beep_error()
    time.sleep(3)


def show_access_denied(reason="Try again"):
    lcd_print("ACCESS DENIED", reason, "", "See lab admin")
    beep_error()
    time.sleep(3)


def show_already_used():
    lcd_print("ALREADY USED", "This QR was", "scanned before", "Check the app")
    beep_error()
    time.sleep(3)


def show_flagged():
    lcd_print("ACCT FLAGGED", "Overdue item", "Return it or", "see admin")
    beep_error()
    time.sleep(3)


def show_checking():
    lcd_print("", "Please wait", "Checking QR...", "")


def show_master_expired():
    lcd_print("MASTER EXPIRED", "Scan master QR", "again to retry", "")
    beep_error()
    time.sleep(3)


def wrap_two(text, width):
    """Split text into two lines <= width, breaking on a space if possible."""
    text = str(text)
    if len(text) <= width:
        return text, ""
    cut = text.rfind(" ", 0, width + 1)
    if cut == -1:
        cut = width
    return text[:cut].strip(), text[cut:].strip()[:width]


def show_component_info(name, category):
    beep_success()
    name = str(name)
    if len(name) <= LCD_COLS:
        lcd_print("COMPONENT", name, "Category:", category)
    else:
        a, b = wrap_two(name, LCD_COLS)
        lcd_print(a, b, "Category:", category)
    time.sleep(5)




def handle_component_qr(data: dict):
    """
    Component QR format (stuck on each component):
    {
      "type":         "component",
      "component_id": "uuid",             # optional if name+category given
      "name":         "Arduino Uno",      # optional, looked up if missing
      "category":     "Microcontroller"   # optional, looked up if missing
    }
    Info only — shows the component name + category on the LCD.
    """
    name     = data.get("name")
    category = data.get("category")
    comp_id  = data.get("component_id") or data.get("id")

    # Look up missing fields from the components table
    if (not name or not category) and comp_id:
        show_checking()
        try:
            resp = supabase.table("components") \
                .select("name, category") \
                .eq("id", comp_id) \
                .single() \
                .execute()
            if resp.data:
                name     = name or resp.data.get("name")
                category = category or resp.data.get("category")
        except Exception as e:
            print(f"[COMPONENT] Lookup error: {e}")

    if not name:
        show_error("Invalid QR", "No component")
        print("[COMPONENT] Missing name and component_id")
        return

    category = category or "Uncategorised"
    print(f"[COMPONENT] {name} — {category}")
    show_component_info(name, category)


# =============================================================
# QR HANDLER — BORROW
# =============================================================

def handle_borrow_qr(data: dict):
    """
    Borrow QR format:
    {
      "request_id": "uuid",
      "student_id": "uuid",
      "locker":     "A1",
      "locker_id":  "uuid",
      "qr_token":   "uuid",
      "due_date":   "...",
      "components": [{"name": "Arduino Uno", "quantity": 1}, ...]
    }
    On success:
      - Open assigned locker
      - Set qr_token_used = true
      - Set locker is_occupied = false (student took items, locker now empty)
    """
    token      = data.get("qr_token")
    locker     = data.get("locker")
    locker_id  = data.get("locker_id")
    components = data.get("components", [])
    request_id = data.get("request_id")

    if not token or not request_id:
        show_error("Invalid QR", "Missing fields")
        print("[BORROW] Missing qr_token or request_id")
        return

    print(f"[BORROW] request={request_id} locker={locker}")
    show_checking()

    try:
        resp = supabase.table("borrow_requests") \
            .select(
                "id, status, qr_token_used, "
                "profiles:student_id(full_name, student_id)"
            ) \
            .eq("id", request_id) \
            .eq("qr_token", token) \
            .execute()

        rows = resp.data
        if not rows:
            show_access_denied("QR not found")
            print("[BORROW] No matching request in DB")
            return

        req = rows[0]

        if req["status"] not in ("active", "overdue"):
            show_access_denied(f"Status: {req['status']}")
            print(f"[BORROW] Wrong status: {req['status']}")
            return

        if req.get("qr_token_used"):
            show_already_used()
            print("[BORROW] QR already used")
            return

        # Fallback if locker missing from QR
        if not locker or not locker_id:
            locker, locker_id = resolve_borrow_locker_from_db(request_id)
            if not locker:
                show_error("No Locker", "Contact admin")
                print("[BORROW] No locker found")
                return

        profile = req.get("profiles") or {}
        name    = profile.get("full_name", "Student")
        sid     = profile.get("student_id", "")

        if not open_locker(locker):
            show_error("Locker Error", f"{locker} unmapped")
            return
        # --- CAMERA TRIGGER BLOCK ---
        camera.snapshot_burst_async(
            cam_device,
            supabase=supabase,               # We pass your existing Supabase connection
            bucket="locker_snapshots",       # Point to the new isolated bucket
            log_table="snapshot_logs",       # Point to the new isolated table
            locker_code=locker,
            request_id=request_id,
            event="borrow"                   # (Make sure this says "return" in the return function!)
        )
        # ----------------------------



        # Mark QR as used
        supabase.table("borrow_requests") \
            .update({"qr_token_used": True}) \
            .eq("id", request_id) \
            .execute()

        # Free the locker — student took items, physically empty now
        free_locker_in_db(locker_id, locker)

        summary = get_component_summary(components)
        print(f"[BORROW] SUCCESS — {name} ({sid}) — {summary} — Locker {locker}")
        show_borrow_success(name, components, locker)

    except Exception as e:
        show_error("System Error", "Try again")
        print(f"[BORROW] Exception: {e}")


# =============================================================
# QR HANDLER — RETURN
# =============================================================

def handle_return_qr(data: dict):
    """
    Return QR format (auto-assigned by system):
    {
      "type":            "return",
      "request_id":      "uuid",
      "student_id":      "uuid",
      "locker":          "B2",
      "locker_id":       "uuid",
      "return_qr_token": "uuid",
      "components":      ["Arduino Uno", "Breadboard"]
    }
    On success:
      - Open return locker
      - Set return_qr_token_used = true
        (frontend polls this → unlocks image upload step)
      - Set return locker is_occupied = true (items placed inside)
    Status at scan time is 'active' — changes to 'return_requested'
    only after student uploads image proof via the app.
    """
    token      = data.get("return_qr_token")
    locker     = data.get("locker")
    locker_id  = data.get("locker_id")
    request_id = data.get("request_id")

    raw_components = data.get("components", [])
    components = (
        [{"name": c, "quantity": 1} for c in raw_components]
        if raw_components and isinstance(raw_components[0], str)
        else raw_components
    )

    if not token or not request_id:
        show_error("Invalid QR", "Missing fields")
        print("[RETURN] Missing return_qr_token or request_id")
        return

    print(f"[RETURN] request={request_id} return_locker={locker}")
    show_checking()

    try:
        resp = supabase.table("borrow_requests") \
            .select(
                "id, status, return_qr_token_used, "
                "profiles:student_id(full_name, student_id)"
            ) \
            .eq("id", request_id) \
            .eq("return_qr_token", token) \
            .execute()

        rows = resp.data
        if not rows:
            show_access_denied("QR not found")
            print("[RETURN] No matching request in DB")
            return

        req = rows[0]

        # Accept active or return_requested (retry case)
        if req["status"] not in ("active", "overdue", "return_requested"):
            show_access_denied(f"Status: {req['status']}")
            print(f"[RETURN] Wrong status: {req['status']}")
            return

        if req.get("return_qr_token_used"):
            show_already_used()
            print("[RETURN] Return QR already used")
            return

        # Fallback if locker missing from QR
        if not locker or not locker_id:
            locker, locker_id = resolve_return_locker_from_db(request_id)
            if not locker:
                show_error("No Return Locker", "Contact admin")
                print("[RETURN] No return locker found")
                return

        profile = req.get("profiles") or {}
        name    = profile.get("full_name", "Student")
        sid     = profile.get("student_id", "")

        if not open_locker(locker):
            show_error("Locker Error", f"{locker} unmapped")
            return
       # --- CAMERA TRIGGER BLOCK ---
        camera.snapshot_burst_async(
            cam_device,
            supabase=supabase,               # We pass your existing Supabase connection
            bucket="locker_snapshots",       # Point to the new isolated bucket
            log_table="snapshot_logs",       # Point to the new isolated table
            locker_code=locker,
            request_id=request_id,
            event="return"                   # (Make sure this says "return" in the return function!)
        )
        # ----------------------------

        # Mark return QR as used — frontend polls this to unlock image upload
        supabase.table("borrow_requests") \
            .update({"return_qr_token_used": True}) \
            .eq("id", request_id) \
            .execute()

        # Occupy the return locker — student placed items inside
        occupy_locker_in_db(locker_id, locker)

        summary = get_component_summary(components)
        print(f"[RETURN] SUCCESS — {name} ({sid}) — {summary} — Return Locker {locker}")
        show_return_success(name, components, locker)

    except Exception as e:
        show_error("System Error", "Try again")
        print(f"[RETURN] Exception: {e}")


# =============================================================
# QR HANDLER — STUDENT IDENTITY
# =============================================================

def handle_student_qr(data: dict):
    """
    Student identity QR (from profile page):
    {
      "id":        "uuid",
      "name":      "Ahmed Mohamed",
      "studentId": "A23CS0286",
      "email":     "...",
      "token":     "uuid"
    }
    """
    name       = data.get("name", "Unknown")
    student_id = data.get("studentId", "")
    token      = data.get("token")

    print(f"[STUDENT] Scan — {name} ({student_id})")

    if not token:
        show_error("Invalid QR", "No token")
        return

    show_checking()

    try:
        resp = supabase.table("profiles") \
            .select("id, full_name, student_id, is_flagged") \
            .eq("qr_token", token) \
            .execute()

        rows = resp.data
        if not rows:
            show_access_denied("Not registered")
            print(f"[STUDENT] Token not found for {student_id}")
            return

        profile = rows[0]

        if profile.get("is_flagged"):
            show_flagged()
            print(f"[STUDENT] Flagged: {profile['full_name']}")
            return

        full_name = profile.get("full_name", name)
        sid       = profile.get("student_id", student_id)
        print(f"[STUDENT] Verified: {full_name} ({sid})")
        show_student_success(full_name, sid)

    except Exception as e:
        show_error("System Error", "Try again")
        print(f"[STUDENT] Exception: {e}")


# =============================================================
# QR HANDLER — MASTER (admin activates master mode)
# =============================================================

def handle_master_qr(data: dict):
    """
    Master QR format (from admin profile page):
    {
      "type":            "master",
      "admin_id":        "uuid",
      "admin_name":      "Ahmed Mohamed",
      "master_qr_token": "uuid"
    }
    On success:
      - Verifies admin identity against Supabase
      - Activates master mode for MASTER_MODE_TIMEOUT seconds
      - Next locker_select QR scanned will open that locker
    """
    global master_mode_active, master_admin_name, master_expiry

    token      = data.get("master_qr_token")
    admin_id   = data.get("admin_id")
    admin_name = data.get("admin_name", "Admin")

    if not token or not admin_id:
        show_error("Invalid QR", "Missing fields")
        print("[MASTER] Missing master_qr_token or admin_id")
        return

    print(f"[MASTER] Activation attempt by {admin_name}")
    show_checking()

    try:
        resp = supabase.table("profiles") \
            .select("id, full_name, role, master_qr_token") \
            .eq("id", admin_id) \
            .eq("master_qr_token", token) \
            .eq("role", "admin") \
            .execute()

        if not resp.data:
            show_access_denied("Not authorised")
            print(f"[MASTER] Verification failed for {admin_name}")
            return

        # Activate master mode
        master_mode_active = True
        master_admin_name  = admin_name
        master_expiry      = time.time() + MASTER_MODE_TIMEOUT

        print(f"[MASTER] ACTIVATED by {admin_name} — {MASTER_MODE_TIMEOUT}s window")
        show_master_activated(admin_name)

    except Exception as e:
        show_error("System Error", "Try again")
        print(f"[MASTER] Exception: {e}")



def format_component_lines(components_list):
    """Turn a component list into LCD-ready 'Name xN' strings.
    Accepts [{name, quantity}, ...] or ["Name", ...]."""
    lines = []
    for c in components_list or []:
        if isinstance(c, dict):
            name = str(c.get("name", "Item"))
            qty  = c.get("quantity", 1) or 1
        else:
            name = str(c)
            qty  = 1
        name = name[:16]
        lines.append(f"{name} x{qty}" if qty > 1 else name)
    return lines or ["Items"]


def show_items_paged(action, components_list):
    """Page through the component list two-at-a-time on the lower rows."""
    for i in range(0, len(format_component_lines(components_list)), 2):
        item_lines = format_component_lines(components_list)
        l2 = item_lines[i]
        l3 = item_lines[i + 1] if i + 1 < len(item_lines) else ""
        lcd_force_clear()
        lcd_print(action, "", l2, l3)
        time.sleep(3)

## =============================================================
# QR HANDLER — ADMIN LOCKER MASTER KEY (Instant Open)
# =============================================================

def handle_locker_select(data: dict):
    """
    Locker master QR format (generated per locker on admin side):
    {
      "type":        "locker_select",
      "locker_id":   "uuid",
      "locker_code": "A1"
    }
    On success:
      - Instantly opens the specified locker.
      - Bypasses all database checks and timers.
    """
    locker_code = data.get("locker_code")

    if not locker_code:
        show_error("Invalid QR", "No locker code")
        print("[ADMIN KEY] Missing locker_code")
        return

    print(f"[ADMIN KEY] Override scanned! Instantly opening locker {locker_code}")
    show_checking()

    # Pulse the relay immediately
    if not open_locker(locker_code):
        show_error("Locker Error", f"{locker_code} unmapped")
        return

    # Show success on the LCD
    lcd_print("ADMIN OVERRIDE", f"Locker {locker_code}", "Opened", "")
    beep_success()
    time.sleep(3)
    time.sleep(RESET_DELAY_SECONDS)


# =============================================================
# QR DISPATCHER
# =============================================================


def dispatch(raw: str):
    """Parse raw scanner input and route to the correct handler."""
    global master_mode_active, master_expiry

    raw = raw.strip()
    print(f"[SCAN] {len(raw)} chars: {raw!r}")

    if not raw:
        return

    # Auto-expire master mode silently
    if master_mode_active and time.time() > master_expiry:
        master_mode_active = False
        print("[MASTER] Mode expired (auto-reset)")

    try:
        data    = json.loads(raw)
        qr_type = data.get("type", "")

        if qr_type == "master":
            # Admin master QR — activates master mode
            handle_master_qr(data)

        elif qr_type == "locker_select":
            # Admin locker selection QR — opens specific locker in master mode
            handle_locker_select(data)

        elif qr_type == "return":
            # Student return QR — open return locker
            handle_return_qr(data)

        elif "qr_token" in data and "request_id" in data:
            # Student borrow QR — open assigned locker
            handle_borrow_qr(data)

        elif "token" in data and "studentId" in data:
            # Student identity QR — verify identity
            handle_student_qr(data)

        elif qr_type == "component":
            # Component info QR — show name + category
            handle_component_qr(data)

        else:
            show_error("Unknown QR", "Use lab app")
            print("[SCAN] Unknown QR keys:", list(data.keys()))

        return

    except (json.JSONDecodeError, ValueError) as e:
        print(f"[SCAN] JSON parse failed: {e}")

    # Legacy barcode fallback
    upper = raw.upper()
    if "MATRIC NUM:" in upper:
        start      = upper.find("MATRIC NUM:") + len("MATRIC NUM:")
        matric_num = upper[start:start + 9].strip()
        lcd_print("Old Barcode", f"ID: {matric_num}", "Use new QR", "from the app")
        beep_error()
        time.sleep(3)
        print(f"[SCAN] Legacy barcode — matric={matric_num}")
        return

    show_error("Invalid Code", "Cannot read")
    print("[SCAN] Could not parse content")


# =============================================================
# MAIN LOOP
# =============================================================

def main():
    reset_screen()
    print("[BOOT] Smart Locker v4 ready")
    print(f"[BOOT] Scanner       : {SCANNER_DEVICE}")
    print(f"[BOOT] Lockers       : {list(LOCKER_RELAY_MAP.keys())}")
    print(f"[BOOT] Buzzer        : GPIO {BUZZER_PIN}")
    print(f"[BOOT] LCD           : {LCD_COLS}x{LCD_ROWS}")
    print(f"[BOOT] Master timeout: {MASTER_MODE_TIMEOUT}s")
    print(f"[BOOT] Debug keys    : {DEBUG_SCAN}")
    print()
    print("[BOOT] QR types handled:")
    print("       master       → activate master mode")
    print("       locker_select→ open specific locker (master mode only)")
    print("       return       → open return locker, occupy it")
    print("       borrow QR    → open assigned locker, free it")
    print("       student QR   → verify identity")

    raw_input  = ""
    shift_held = False

    try:
        for event in device.read_loop():
            if event.type != ecodes.EV_KEY:
                continue

            key_event = categorize(event)
            key_raw   = key_event.keycode
            key       = key_raw[0] if isinstance(key_raw, list) else key_raw
            state     = key_event.keystate

            if key in ("KEY_LEFTSHIFT", "KEY_RIGHTSHIFT"):
                shift_held = (state != 0)
                continue

            if state != 1:
                continue

            if DEBUG_SCAN:
                print(f"[KEY] {key} shift={shift_held}")

            if key == "KEY_ENTER":
                if raw_input.strip():
                    dispatch(raw_input)
                    reset_screen()
                raw_input  = ""
                shift_held = False
            else:
                char_map = KEY_MAP_SHIFTED if shift_held else KEY_MAP
                ch = char_map.get(key)
                if ch:
                    raw_input += ch
                elif DEBUG_SCAN:
                    print(f"[KEY] Unmapped: {key}")

    except KeyboardInterrupt:
        print("\n[STOP] Shutting down...")

    finally:
        for pin in LOCKER_RELAY_MAP.values():
            GPIO.output(pin, GPIO.LOW)
        if BUZZER_PIN is not None:
            GPIO.output(BUZZER_PIN, GPIO.LOW)
        GPIO.cleanup()
        lcd_print("System Offline", "Goodbye!", "", "")
        print("[DONE] Cleaned up")


if __name__ == "__main__":
    main()