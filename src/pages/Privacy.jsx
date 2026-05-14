import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Eye, Database, Trash2, Lock, Server, ChevronRight } from 'lucide-react';

const fadeIn = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

export default function Privacy() {
  const sections = [
    {
      icon: Database,
      title: 'What Data We Collect',
      content: [
        'Personal information: Name, email address, phone number, city, and state provided during registration and application.',
        'Academic records: Board exam scores (Physics, Chemistry, Mathematics), JEE percentile, and other academic achievements you submit.',
        'Application content: Essays, project descriptions, extracurricular activities, and branch preferences.',
        'Assessment data: Aptitude test responses, scores, and time taken. Interview conversation transcripts and AI-generated evaluation scores.',
        'Technical metadata: Browser type, session timestamps, tab-switch counts, and integrity monitoring logs for anti-cheat purposes.',
      ],
    },
    {
      icon: Eye,
      title: 'Camera & Proctoring Data',
      content: [
        'During Stage 3 (AI Interview), your device camera is activated for identity verification and proctoring.',
        'Camera feed is processed entirely in your browser using local face-detection models. No video or images are transmitted to or stored on our servers.',
        'Only metadata is logged: whether a face was detected, face count, and look-away duration. These are stored as numerical values, not visual data.',
        'You can deny camera access, but the interview will proceed with reduced integrity scoring noted for the admissions committee.',
      ],
    },
    {
      icon: Shield,
      title: 'How We Use Your Data',
      content: [
        'To evaluate your application through our 3-stage admissions pipeline (AI Evaluation, Aptitude Test, AI Interview).',
        'To generate personalized feedback, scores, and recommendations for the admissions committee.',
        'To communicate with you about your application status via email notifications (if configured).',
        'To produce anonymized, aggregate analytics for institutional reporting (e.g., score distributions, pass rates by branch).',
        'We never sell, rent, or share your personal data with third parties for marketing purposes.',
      ],
    },
    {
      icon: Lock,
      title: 'AI Processing & Scoring',
      content: [
        'Your application data and interview responses are processed by large language models (LLMs) hosted by Groq to generate evaluation scores.',
        'AI scoring uses a standardized rubric across all applicants to ensure fairness and consistency.',
        'AI-generated scores are recommendations — final admissions decisions are always made by the university committee.',
        'Your data sent to the AI provider is not used to train their models. We use API-based inference only.',
        'Interview transcripts are stored in our database for committee review and are accessible to authorized administrators only.',
      ],
    },
    {
      icon: Server,
      title: 'Data Storage & Security',
      content: [
        'All data is stored in Supabase (built on PostgreSQL) with row-level security (RLS) policies ensuring students can only access their own records.',
        'Data is encrypted at rest using AES-256 and in transit using TLS 1.3.',
        'Authentication is handled through Supabase Auth with secure session tokens and password hashing (bcrypt).',
        'Admin access is restricted to verified university administrators with separate authentication credentials.',
        'Our infrastructure is hosted on enterprise-grade cloud providers with SOC 2 compliance.',
      ],
    },
    {
      icon: Trash2,
      title: 'Data Retention & Deletion',
      content: [
        'Application data is retained for the duration of the current admissions cycle plus 12 months for institutional record-keeping.',
        'After the retention period, personal data is anonymized or deleted upon request.',
        'You may request deletion of your account and all associated data by contacting the university admissions office.',
        'Anonymized aggregate data (e.g., average scores, pass rates) may be retained indefinitely for institutional analytics.',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-bg font-sans">
      {/* Header */}
      <nav style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-2">
            <Link to="/" className="font-bold text-navy text-[15px] hover:opacity-80 transition-opacity">DDS University</Link>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">Privacy Policy</span>
          </div>
          <Link to="/" className="text-sm text-gray-500 hover:text-navy transition-colors">← Back to Home</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 16px 80px' }}>
        <motion.div initial="hidden" animate="visible" variants={stagger}>
          {/* Title */}
          <motion.div variants={fadeIn} style={{ marginBottom: '40px' }}>
            <div className="flex items-center gap-3 mb-4">
              <div style={{ width: '48px', height: '48px', backgroundColor: '#1e3a5f', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1e3a5f', margin: 0 }}>Privacy & Data Policy</h1>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Last updated: May 2026</p>
              </div>
            </div>
            <p style={{ fontSize: '15px', color: '#6b7280', lineHeight: 1.7 }}>
              DDS University is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal data throughout the Aria-powered admissions process. By using this platform, you consent to the practices described below.
            </p>
          </motion.div>

          {/* Sections */}
          {sections.map((section, i) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.title}
                variants={fadeIn}
                style={{
                  backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '16px',
                  padding: '28px', marginBottom: '16px',
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div style={{ width: '36px', height: '36px', backgroundColor: '#f0f4f8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon className="w-4 h-4 text-navy" />
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e3a5f', margin: 0 }}>{section.title}</h2>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {section.content.map((item, j) => (
                    <li key={j} style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.7, paddingLeft: '20px', position: 'relative', marginBottom: '10px' }}>
                      <span style={{ position: 'absolute', left: 0, top: '8px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#c8960a' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}

          {/* Contact */}
          <motion.div
            variants={fadeIn}
            style={{
              backgroundColor: '#1e3a5f', borderRadius: '16px', padding: '28px',
              color: 'white', textAlign: 'center', marginTop: '32px',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Questions About Your Data?</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: '16px' }}>
              If you have concerns about your personal data or wish to request data deletion, please contact the DDS University Admissions Office.
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              admissions@ddsuniversity.edu · Powered by Aria AI
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
