import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight, Shield, Clock, Zap, BookOpen, Award, Target, Users } from 'lucide-react';
import { Button, Badge } from '../components/ui';

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

export default function Landing() {

  return (
    <div className="min-h-screen bg-bg font-sans">
      {/* ── NAV ──────────────────────────────────────────── */}
      <nav className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-navy tracking-tight">DDS University</span>
            <span className="text-gray-300 mx-2">·</span>
            <span className="text-sm text-gray-500 font-medium">for Engineering</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="gold" className="text-xs">Powered by Aria</Badge>
            <Link to="/auth">
              <Button variant="outline" size="sm">Student Login</Button>
            </Link>
            <Link to="/admin">
              <Button variant="ghost" size="sm">Admin</Button>
            </Link>
            <Link to="/auth">
              <Button variant="primary" size="sm">Apply Now</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.p variants={fadeIn} className="text-label text-gold uppercase tracking-widest mb-4">
            India's first AI admissions platform
          </motion.p>
          <motion.h1 variants={fadeIn} className="text-hero text-navy mb-6 leading-none">
            Admissions that actually<br />understand students
          </motion.h1>
          <motion.p variants={fadeIn} className="text-lg text-gray-500 mb-8 leading-relaxed max-w-lg">
            DDS University processes applications in hours, not weeks. Every student knows exactly where they stand — and why.
          </motion.p>
          <motion.div variants={fadeIn} className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="primary" size="lg" className="gap-2">
                Apply Now <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/admin">
              <Button variant="outline" size="lg">Admin Login</Button>
            </Link>
          </motion.div>
          <motion.div variants={fadeIn} className="mt-8 flex items-center gap-6">
            {[
              { icon: Clock, text: 'Results in hours' },
              { icon: Shield, text: 'AI-proctored tests' },
              { icon: Zap, text: 'Specific feedback' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-gray-500">
                <Icon className="w-4 h-4 text-navy" />
                {text}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Pipeline SVG Illustration */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="hidden lg:block"
        >
          <PipelineIllustration />
        </motion.div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────── */}
      <section className="bg-navy py-12">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            className="grid grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {[
              { stat: '40,000+', label: 'Engineering colleges in India', sub: 'All screening manually' },
              { stat: '24 Lakh+', label: 'JEE applicants every year', sub: 'Most get zero feedback on rejection' },
              { stat: '0', label: 'Average feedback given to rejected students', sub: 'Aria changes this' },
            ].map(({ stat, label, sub }) => (
              <motion.div key={stat} variants={fadeIn} className="text-center">
                <p className="text-4xl font-bold text-white mb-1">{stat}</p>
                <p className="text-sm font-semibold text-blue-200 mb-0.5">{label}</p>
                <p className="text-xs text-blue-300/70">{sub}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PIPELINE STAGES ────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center mb-12"
        >
          <motion.p variants={fadeIn} className="text-label text-gold uppercase tracking-widest mb-3">How it works</motion.p>
          <motion.h2 variants={fadeIn} className="text-section-head text-navy">Three stages. Complete clarity.</motion.h2>
          <motion.p variants={fadeIn} className="text-gray-500 mt-2 max-w-lg mx-auto">Every step is transparent. Every decision is explained. No black boxes.</motion.p>
        </motion.div>

        <motion.div
          className="grid lg:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          {[
            {
              num: '01',
              title: 'AI Application Screening',
              desc: 'AI scores your application against DDS criteria holistically. If you don\'t qualify, you\'ll know exactly why — and what to improve.',
              highlight: 'Specific feedback, not a generic rejection',
              icon: '📋',
            },
            {
              num: '02',
              title: 'Proctored Aptitude Test',
              desc: '15 questions across Maths, Physics, and Chemistry. Fullscreen locked, camera monitored, tab-switch detected. Fair for everyone.',
              highlight: '15 minutes · Anti-cheat built in',
              icon: '🛡️',
            },
            {
              num: '03',
              title: 'AI Interview Agent',
              desc: 'Aria reads your actual application and asks about your specific projects. It can\'t be scripted. It can\'t be fooled.',
              highlight: 'Personalized to you — every time',
              icon: '🤖',
            },
          ].map((stage, i) => (
            <motion.div
              key={stage.num}
              variants={fadeIn}
              className="bg-white border border-border rounded-card p-6 shadow-sm hover:border-navy/30 transition-colors relative"
            >
              <div className="text-3xl mb-4">{stage.icon}</div>
              <p className="text-label text-navy/40 uppercase tracking-widest mb-2">{stage.num}</p>
              <h3 className="text-card-title text-navy mb-2">{stage.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{stage.desc}</p>
              <div className="bg-gold-bg border border-yellow-200 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-yellow-800">{stage.highlight}</p>
              </div>
              {i < 2 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 bg-white border border-border rounded-full p-1.5 shadow-sm">
                  <ChevronRight className="w-4 h-4 text-navy" />
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── ACADEMIC STANDARDS ────────────────────────────── */}
      <section className="bg-navy/5 border-y border-border py-24">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div variants={fadeIn} className="text-center mb-10">
              <p className="text-label text-gold uppercase tracking-widest mb-3">Academic Standards</p>
              <h2 className="text-section-head text-navy mb-2">What we look for</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                DDS University evaluates every applicant holistically. We consider academic performance, aptitude, and genuine motivation.
              </p>
            </motion.div>

            <motion.div variants={fadeIn} className="grid md:grid-cols-2 gap-4">
              {[
                { icon: BookOpen, title: 'Strong PCM Foundation', desc: 'Competitive marks in Physics, Chemistry, and Mathematics from a recognised board.' },
                { icon: Target, title: 'National-Level Aptitude', desc: 'A valid JEE Main score that demonstrates engineering readiness.' },
                { icon: Award, title: 'Holistic Profile', desc: 'Projects, competitions, and extracurriculars that show genuine passion for engineering.' },
                { icon: Users, title: 'AI-Evaluated Fit', desc: 'Every application is scored by Aria for academic strength, motivation, and potential.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white border border-border rounded-card p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-navy/5 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4.5 h-4.5 text-navy" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-navy mb-1">{title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeIn} className="mt-6 text-center">
              <p className="text-sm text-gray-500 mb-4">Unsure if you qualify? Apply anyway — you'll receive specific feedback within minutes.</p>
              <Link to="/auth">
                <Button variant="primary" size="md" className="gap-2">
                  Start Your Application <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── WHY ARIA ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <motion.div
          className="grid lg:grid-cols-2 gap-16 items-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.div variants={fadeIn}>
            <p className="text-label text-gold uppercase tracking-widest mb-3">Why Aria exists</p>
            <h2 className="text-section-head text-navy mb-4">The problem with Indian admissions</h2>
            <div className="space-y-4">
              {[
                { problem: 'Manual screening takes 3-6 weeks', solution: 'Aria completes Stage 1 in under 5 minutes' },
                { problem: 'Rejected students get no explanation', solution: 'Every student gets specific, actionable feedback' },
                { problem: 'Interviews are generic and scriptable', solution: 'AI reads your application — every interview is unique' },
                { problem: 'Admission decisions feel arbitrary', solution: 'Full data trail — score, grade, reasoning, transcript' },
              ].map(({ problem, solution }) => (
                <div key={problem} className="bg-white border border-border rounded-card p-4 shadow-sm">
                  <p className="text-xs text-red-600 font-semibold mb-1">BEFORE: {problem}</p>
                  <p className="text-sm font-semibold text-navy">✓ ARIA: {solution}</p>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div variants={fadeIn} className="bg-white border border-border rounded-card p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center text-white font-bold text-sm">A</div>
              <div>
                <p className="font-semibold text-navy">Aria</p>
                <p className="text-xs text-gray-500">AI Interview Agent · DDS University</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full pulse-dot" />
                <span className="text-xs text-gray-500">Live</span>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div className="bg-gray-50 border border-border rounded-lg p-3 max-w-xs">
                <p className="text-sm text-gray-700">You mentioned building a crop disease detection model — what dataset did you train it on, and how did you handle class imbalance?</p>
              </div>
              <div className="bg-navy text-white rounded-lg p-3 max-w-xs ml-auto">
                <p className="text-sm">I used the PlantVillage dataset with 54,000 images. For class imbalance I applied SMOTE and also used weighted cross-entropy loss...</p>
              </div>
              <div className="bg-gray-50 border border-border rounded-lg p-3 max-w-xs">
                <p className="text-sm text-gray-700">That's a sophisticated approach. How did you validate your model performed well on real field conditions vs lab images?</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">This interview is personalized to Rahul's actual application</p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-navy">DDS University for Engineering</p>
            <p className="text-xs text-gray-400 mt-0.5">Powered by Aria · Built for Indian Engineering Admissions</p>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span className="cursor-pointer hover:text-navy transition-colors">For Colleges</span>
            <span className="cursor-pointer hover:text-navy transition-colors">For Students</span>
            <span className="cursor-pointer hover:text-navy transition-colors">Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Animated Pipeline Illustration
function PipelineIllustration() {
  return (
    <div className="relative bg-white border border-border rounded-card p-6 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6 text-center">Application Pipeline — Live View</p>
      <div className="space-y-3">
        {[
          { stage: 'Stage 1 — Application Review', status: 'AI Scoring Complete', score: '78/100', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
          { stage: 'Stage 2 — Aptitude Test', status: 'In Progress', score: '11 min left', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { stage: 'Stage 3 — AI Interview', status: 'Unlocks after Stage 2', score: 'Locked', color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' },
        ].map((s, i) => (
          <motion.div
            key={s.stage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.15 }}
            className={`border ${s.border} ${s.bg} rounded-lg p-3 flex items-center justify-between`}
          >
            <div>
              <p className="text-xs font-semibold text-navy">{s.stage}</p>
              <p className={`text-xs mt-0.5 ${s.color}`}>{s.status}</p>
            </div>
            <span className={`text-xs font-bold ${s.color}`}>{s.score}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-5 pt-5 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Application by Rahul Sharma · CSE</span>
          <Badge variant="info">Stage 2</Badge>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <motion.div
            className="bg-navy h-2 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '55%' }}
            transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-right">55% through admissions pipeline</p>
      </div>
    </div>
  );
}
