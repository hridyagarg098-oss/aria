Aria: AI-Powered Admission Platform
Aria is a comprehensive, three-stage admission ecosystem designed to automate, secure, and personalize the university enrollment process. It replaces traditional, manual evaluations with an intelligent pipeline consisting of data-driven applications, automated aptitude testing, and generative AI interviews.

🚀 Live Demo
https://aria-dds-university.netlify.app


🛠 Tech Stack
 React, Tailwind CSS, Supabase, Groq API with Claude as fallback, face-api.js for proctoring.

Hosting: Netlify

🌟 Key Features
1. Three-Stage Admission Pipeline
Stage 1: Smart Application: Captures academic history, extracurriculars, and project portfolios.

Stage 2: Dynamic Aptitude: A customizable testing engine with adjustable difficulty and timing.

Stage 3: AI Interviewer: A "Context-Aware" AI that reads the student's bio and conducts a unique 1-on-1 interview.

2. The Evaluation Engine (8 Dimensions)
The AI evaluates candidates across eight specific human and technical metrics:

Confidence & Motivation

Self-Awareness

Subject Matter Expertise

Project Authenticity (Verifying if the student actually built what they claimed)

future vision 

case study thinking 

3. Advanced Anti-Cheating Suite
Face Monitoring: Real-time tracking to ensure the applicant remains present.

Tab-Switch Detection: Immediate flagging if the user attempts to search for answers.

Full-Screen Enforcement: Disqualifies users who exit the dedicated exam environment.

4. Secure Admin Dashboard
Data Visualization: Charts and analytics for student distribution across stages.

Granular Filtering: Admins can sort by branch, score, or application status.

Automated Feedback: Students receive instant, constructive feedback upon decision finalization.

🔒 Security & Architecture
Aria is built with a "Security First" approach:

PostgreSQL Row-Level Security (RLS): Policies are enforced at the database level so students can only access their own data, preventing unauthorized API access.

Atomic Transactions: Ensures data integrity during the multi-stage transition.


🛠 Installation & Setup
Clone the repository:

Bash
git clone https://github.com/hridyagarg098-oss/aria.git
Install dependencies:

Bash
npm install
Environment Variables:
Create a .env file and add your Supabase and AI credentials:

Code snippet
    VITE_SUPABASE_URL=your_url
    VITE_SUPABASE_ANON_KEY=your_key
    VITE_AI_API_KEY=your_key
    ```
4.  **Run locally:**
    ```bash
    npm run dev
    ```

---

## 💡 Why Aria?
Aria was built to solve the "Human Bottleneck" in education. By providing instant feedback and reducing manpower costs, it creates a "win-win" for both universities and students, ensuring that talent is identified through logic and innovation rather than just marks.

---
