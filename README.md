# Aria — AI Admissions Platform
### DDS University for Engineering · 2025

---

## ✅ Build Complete

The full-stack platform is running at **http://localhost:5173**

---

## 🗄️ STEP 1 — Initialize Database (Supabase SQL Editor)

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/arlxnjafyospxjbjkpey/sql)  
2. Paste and run the entire contents of **`schema.sql`**  
3. This creates all 7 tables + RLS policies + seeds DDS University + 15 aptitude questions

---

## 👤 STEP 2 — Create Admin Account

1. In Supabase Dashboard → **Authentication → Users → Invite User**
2. Email: `admin@dds.edu` | Password: `DDSAdmin2025`
3. Copy the generated User ID (UUID)
4. In SQL Editor, run:

```sql
insert into admins (id, university_id, name, email)
select 'PASTE-USER-ID-HERE', id, 'DDS Admin', 'admin@dds.edu'
from universities where slug = 'dds-university';
```

---

## 🔑 STEP 3 — Add Your Groq API Key

Edit `.env.local`:
```
VITE_GROQ_API_KEY=gsk_your_actual_key_here
```

Get your free key at [console.groq.com](https://console.groq.com) → API Keys

---

## 🧪 STEP 4 — Test the Full Flow

| Path | Description |
|------|-------------|
| `/` | Landing page + eligibility checker |
| `/auth` | Student magic link login |
| `/apply` | 3-step application form |
| `/dashboard` | Student pipeline dashboard |
| `/test` | Anti-cheat aptitude test |
| `/interview` | AI streaming interview |
| `/admin` | Admin login (admin@dds.edu) |
| `/admin/dashboard` | Realtime stats + charts |
| `/admin/applicants` | Filterable applicant table |
| `/admin/applicant/:id` | Full detail with action bar |
| `/admin/analytics` | Funnel, radar, scatter charts |
| `/admin/test-builder` | Edit aptitude questions |

---

## 🏗️ Architecture Overview

```
src/
├── pages/
│   ├── Landing.jsx          ← Hero + eligibility checker
│   ├── Auth.jsx             ← Magic link auth
│   ├── Apply.jsx            ← 3-step form + AI scoring
│   ├── Dashboard.jsx        ← Student pipeline view
│   ├── AptitudeTest.jsx     ← Anti-cheat test (fullscreen)
│   ├── Interview.jsx        ← AI streaming interview
│   └── admin/
│       ├── AdminLogin.jsx
│       ├── AdminDashboard.jsx
│       ├── Applicants.jsx
│       ├── ApplicantDetail.jsx
│       ├── Analytics.jsx
│       └── TestBuilder.jsx
├── components/
│   ├── ui/index.jsx         ← Button, Card, Badge, Input...
│   └── layout/
│       └── ProtectedRoute.jsx
├── contexts/
│   └── AuthContext.jsx      ← Student + Admin auth
├── lib/
│   └── supabase.js
└── utils/
    └── ai.js               ← Groq streaming + prompts
```

---

## 🔒 Anti-Cheat Mechanisms

- ✅ Fullscreen lock (exits → forced back in)
- ✅ Tab visibility detection (3 strikes = auto-submit)
- ✅ Right-click & copy-paste disabled
- ✅ DevTools keypress detection
- ✅ Camera presence monitoring
- ✅ AI cheating probability score (Groq analysis)
- ✅ Human review always required before disqualification

---

## 🤖 AI Pipeline

1. **Stage 1** — Application scoring via Groq (llama-3.3-70b)  
2. **Stage 2** — Cheat detection analysis  
3. **Stage 3** — Streaming interview (personalized to application)  
4. **Stage 3 end** — Automatic interview scoring (communication, depth, enthusiasm)
