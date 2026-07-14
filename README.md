# LabLocker — Smart Lab Component Management System

A full-stack web application for managing lab component borrowing in a university environment. Students can browse, request, and return lab components stored in physical smart lockers. Lab assistants manage inventory, approve requests, handle overdues, and monitor the system through a dedicated admin dashboard.

Built as a Capstone Project at Universiti Teknologi Malaysia (UTM), Faculty of Electrical and Computer.

<p align="center">
  <img width="400" alt="LabLocker final prototype" src="https://github.com/user-attachments/assets/6ec04e24-6cf9-408f-b14b-03b29deb3b09" />
  <br>
  <b>Final Prototype</b>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Hardware Integration](#hardware-integration)
- [Project Structure](#project-structure)
- [Team](#team)

---

## Overview

LabLocker solves the problem of untracked lab component borrowing in university settings. Instead of manual logbooks and unsupervised access, the system provides:

- A digital catalog of all lab components and their locker locations
- A structured borrow/return workflow with admin oversight
- Automated deadline tracking with in-app and email reminders
- QR-code-based locker access tied to approved borrow requests
- Image proof submission for returns
- Overdue flagging and penalty management

The software communicates with physical smart lockers via Supabase Realtime. A Raspberry Pi connected to ESP32 microcontrollers listens for approved requests and triggers the correct locker to open when the student's QR is scanned.

---

## Features

### Student
- Register and log in with student ID and email
- Browse and search lab components by name and category
- View component details including locker location and availability
- Submit borrow requests for components
- Receive a unique QR code per approved request to open the assigned locker
- Track all active loans with due date countdowns
- Submit return requests with image proof and a return QR to open the locker
- Request new components not yet in the system
- Receive in-app notifications for approvals, reminders, and overdues
- View personal profile with a unique identity QR code

<p align="center">
  <img width="600" alt="Student interface — mobile app" src="https://github.com/user-attachments/assets/09d3656b-463c-413f-a792-79d3543ebbfb" />
  <br>
  <b>Student Interface (Mobile App)</b>
</p>

### Admin (Lab Assistant)
- Dashboard with live stats: active borrows, pending requests, overdues, flagged students
- Full CRUD management for components and lockers
- Approve or reject borrow requests with automatic quantity management
- Generate QR codes for any component for physical labeling
- Review return requests with image proof
- Manage overdue items, add penalty notes, and resolve penalties
- Review and respond to new item requests
- View all registered students and their full borrow history

<p align="center">
  <img width="700" alt="Admin interface — website" src="https://github.com/user-attachments/assets/0ce2292b-91a5-4772-933e-b098e609b491" />
  <br>
  <b>Admin Interface (Website)</b>
</p>

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router v6 |
| Backend / Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Realtime | Supabase Realtime |
| File Storage | Supabase Storage |
| Forms | React Hook Form + Zod |
| QR Generation | qrcode (npm) |
| Date Utilities | date-fns |
| Toasts | react-hot-toast |
| Error Handling | react-error-boundary |
| Hosting | Vercel |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│         (Student Dashboard + Admin Dashboard)            │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS (REST + Realtime WebSocket)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                      Supabase                            │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐    │
│  │   Auth   │  │PostgREST │  │Realtime  │  │Storage │    │
│  │  Server  │  │   API    │  │ Server   │  │Bucket  │    │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘    │
│                        │                                 │
│                        ▼                                 │
│                  PostgreSQL DB                           │
└───────────────────────┬─────────────────────────────────┘
                        │ Realtime subscription (Python)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Raspberry Pi                            │
│         (Lab — connected to all lockers)                 │
│                                                          │
│   Pi ←── QR Scanner / Camera                             │
│   Pi ←→── ESP32 #1 ──→ Relay ──→ Locker A1                │
│   Pi ←→── ESP32 #2 ──→ Relay ──→ Locker A2                │
│   Pi ←→── ESP32 #3 ──→ Relay ──→ Locker B1                │
└─────────────────────────────────────────────────────────┘
```

<p align="center">
  <img width="700" alt="Connection schematic" src="https://github.com/user-attachments/assets/988c3088-d997-427c-ba98-8ba01c7cbbf9" />
  <br>
  <b>Connection Schematic</b>
</p>

<p align="center">
  <img width="450" alt="Real hardware connection" src="https://github.com/user-attachments/assets/51586f04-a3ff-4178-9269-15a056aca5ef" />
  <br>
  <b>Real Connection (matching the schematic above)</b>
</p>

### How the Frontend Connects to the Database

There is no custom backend server. The React app communicates directly with Supabase using the Supabase JavaScript client. Every database operation goes through the auto-generated PostgREST API. Row Level Security (RLS) policies on PostgreSQL enforce that:
- Students can only read and modify their own data
- Admins have full access to all tables
- Unauthenticated users have no access

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- A Supabase account (free tier is sufficient)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/lab-locker.git
cd lab-locker

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Fill in your Supabase URL and anon key (see Environment Variables below)

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Database Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full schema SQL (see `supabase/schema.sql` in this repo)
3. Go to **Authentication → Providers → Email** and disable email confirmation for development
4. Copy your project URL and anon key into `.env`

### Creating an Admin Account

1. Register a new account through the app UI
2. Go to **Supabase → Table Editor → profiles**
3. Find your row and change the `role` column from `student` to `admin`
4. Sign out and sign back in — you will be redirected to the admin dashboard

---

## Environment Variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Both values are found in **Supabase → Project Settings → API**.

> Never use the `service_role` key in the frontend. The `anon` key is safe for client-side use because RLS policies restrict what each user can access.

---

## Database Schema

| Table | Description |
|---|---|
| `profiles` | Extended user data (full name, student ID, role, flagged status, QR token) |
| `lockers` | Physical lockers (locker code, description, occupied status) |
| `components` | Lab components (name, category, quantity, locker assignment) |
| `borrow_requests` | Borrow lifecycle (status, dates, QR tokens, return proof image) |
| `penalties` | Overdue penalties (admin notes, student reasons, resolved status) |
| `new_item_requests` | Student requests for new components (reason, lab, needed by date) |
| `notifications` | In-app notifications (title, message, read status) |

<p align="center">
  <img width="700" alt="Database structure" src="https://github.com/user-attachments/assets/2769e1a7-2f30-4950-841a-0e917b8d6b09" />
  <br>
  <b>Database Structure</b>
</p>

### Borrow Request Status Flow

```
pending → active → return_requested → returned
       ↘ rejected
active  → overdue
```

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

```
src/
├── app/
│   ├── App.jsx               # Root component, providers
│   ├── Router.jsx            # All route definitions
│   └── main.jsx              # Entry point
│
├── features/
│   ├── auth/                 # Login, Register
│   ├── components/           # Browse lab components
│   ├── borrows/              # Borrow requests, return flow, QR modals
│   ├── notifications/        # In-app notification center
│   ├── item-requests/        # Request new items
│   ├── student/               # Student dashboard, profile, active loans
│   └── admin/                # All admin pages and hooks
│
└── shared/
    ├── components/
    │   ├── ui/               # Button, Card, Badge, Modal, Table, Input...
    │   └── layout/           # StudentLayout, AdminLayout, ProtectedRoute
    ├── context/
    │   └── AuthContext.jsx   # Global auth state
    ├── hooks/
    │   └── useSupabase.js
    ├── lib/
    │   └── supabase.js       # Supabase client
    └── utils/
        ├── dates.js          # Date helpers
        └── cn.js             # Tailwind class merge
```

Architecture follows **Features-First** — each feature is self-contained with its own components, hooks, and pages. Shared utilities live in `shared/`.

---

## Team

Tasneem ELsir Hussain Abdelrahman

## License

This project was developed as project for Integrated Design Project (IDP) at UTM. All rights reserved.
