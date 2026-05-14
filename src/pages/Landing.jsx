import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowRight, Shield, Clock, Zap, Target, Users, FileText, MessageSquare } from 'lucide-react';
import { Button, Badge } from '../components/ui';
import { supabase } from '../lib/supabase';

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

// ── Animated Counter Component ─────────────────────────────────────────────
function AnimatedCounter({ value, duration = 2 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    if (value === 0) return;
    const controls = animate(prevValue.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayValue(Math.round(v)),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <>{displayValue.toLocaleString('en-IN')}</>;
}

// ── FAQ Collapsible Item ─────────────────────────────────────────────────────
function FAQItem({ question, answer, index }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      variants={fadeIn}
      style={{ borderBottom: '1px solid #e5e7eb', overflow: 'hidden' }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 600, color: '#1e3a5f', paddingRight: '16px' }}>{question}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ fontSize: '22px', color: '#c8960a', fontWeight: 300, flexShrink: 0, lineHeight: 1 }}
        >+</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.7, paddingBottom: '20px' }}>{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveAppCount, setLiveAppCount] = useState(0);
  const [liveStudentCount, setLiveStudentCount] = useState(0);

  // Fetch live counts from Supabase
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { count: appCount } = await supabase
          .from('applications')
          .select('id', { count: 'exact', head: true });
        setLiveAppCount(appCount || 0);

        const { count: studentCount } = await supabase
          .from('student_profiles')
          .select('id', { count: 'exact', head: true });
        setLiveStudentCount(studentCount || 0);
      } catch (err) {
        console.warn('Failed to fetch live counts:', err);
      }
    };
    fetchCounts();
    // Refresh every 30 seconds for live feel
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-bg font-sans">
      {/* ── NAV ──────────────────────────────────────────── */}
      <nav className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-navy tracking-tight">DDS University</span>
            <span className="text-gray-300 mx-2 hidden sm:inline">·</span>
            <span className="text-sm text-gray-500 font-medium hidden sm:inline">for Engineering</span>
          </div>
          {/* Desktop nav */}
          <div className="desktop-nav items-center gap-3">
            <Link to="/auth">
              <Button variant="outline" size="sm">Student Login</Button>
            </Link>
            <Link to="/admin">
              <Button variant="ghost" size="sm">Admin</Button>
            </Link>
            <button
              onClick={() => document.getElementById('for-colleges')?.scrollIntoView({behavior:'smooth'})}
              className="text-sm font-medium text-gray-600 hover:text-navy transition-colors px-2"
            >
              For Colleges
            </button>
            <Link to="/auth">
              <Button variant="primary" size="sm">Apply Now</Button>
            </Link>
          </div>
          {/* Mobile hamburger */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', flexDirection: 'column', gap: '5px' }}
            aria-label="Menu"
          >
            <span style={{ display:'block', width:'22px', height:'2px', backgroundColor:'#1e3a5f', transform: mobileMenuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none', transition:'transform 0.2s' }} />
            <span style={{ display:'block', width:'22px', height:'2px', backgroundColor:'#1e3a5f', opacity: mobileMenuOpen ? 0 : 1, transition:'opacity 0.2s' }} />
            <span style={{ display:'block', width:'22px', height:'2px', backgroundColor:'#1e3a5f', transform: mobileMenuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none', transition:'transform 0.2s' }} />
          </button>
        </div>
        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div style={{ position:'absolute', top:'64px', left:0, right:0, backgroundColor:'white', borderBottom:'1px solid #e5e7eb', padding:'16px', display:'flex', flexDirection:'column', gap:'4px', boxShadow:'0 8px 24px rgba(0,0,0,0.08)', zIndex:50 }}>
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)} style={{ padding:'12px 16px', borderRadius:'8px', color:'#1e3a5f', fontWeight:500, fontSize:'15px', textDecoration:'none', display:'block' }}>Student Login</Link>
            <Link to="/admin" onClick={() => setMobileMenuOpen(false)} style={{ padding:'12px 16px', borderRadius:'8px', color:'#1e3a5f', fontWeight:500, fontSize:'15px', textDecoration:'none', display:'block' }}>Admin Login</Link>
            <button onClick={() => { setMobileMenuOpen(false); document.getElementById('for-colleges')?.scrollIntoView({behavior:'smooth'}); }} style={{ padding:'12px 16px', borderRadius:'8px', color:'#1e3a5f', fontWeight:500, fontSize:'15px', textAlign:'left', background:'none', border:'none', cursor:'pointer' }}>For Colleges</button>
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)} style={{ padding:'12px 16px', borderRadius:'8px', backgroundColor:'#1e3a5f', color:'white', fontWeight:600, fontSize:'15px', textDecoration:'none', textAlign:'center', marginTop:'8px' }}>Apply Now →</Link>
          </div>
        )}
      </nav>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pb-24 grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
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
          <motion.div variants={fadeIn} className="mb-8 max-w-[480px]">
            <p style={{fontSize:'17px', color:'#4b5563', fontWeight:400, lineHeight:1.7}}>
              Lakhs of applications. Every student screened fairly. Every rejection explained.
            </p>
            <p style={{fontSize:'17px', color:'#1e3a5f', fontWeight:600, marginTop:'8px'}}>
              In hours — not weeks.
            </p>
          </motion.div>
          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link to="/auth">
              <Button variant="primary" size="lg" className="gap-2">
                Apply Now <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/admin">
              <Button variant="outline" size="lg">Admin Login</Button>
            </Link>
          </motion.div>
          <motion.div variants={fadeIn} className="mt-6 flex flex-wrap items-center gap-3 sm:gap-5">
            {[
              { icon: Clock, text: 'Results in hours' },
              { icon: Shield, text: 'AI-proctored tests' },
              { icon: Zap, text: 'Specific feedback' },
            ].map(({ icon: Icon, text }, i) => (
              <React.Fragment key={text}>
                <div className="flex items-center gap-1.5" style={{fontSize:'13px', color:'#6b7280'}}>
                  <Icon className="w-3.5 h-3.5" style={{color:'#6b7280'}} />
                  {text}
                </div>
                {i < 2 && <span style={{color:'#d1d5db', fontSize:'13px'}}>·</span>}
              </React.Fragment>
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
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span style={{fontSize:'11px',fontWeight:500,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.5px'}}>Live student dashboard preview</span>
          </div>
          <PipelineIllustration />
        </motion.div>
      </section>

      {/* ── SOCIAL PROOF STRIP ────────────────────────────── */}
      <div style={{background:'white',borderTop:'1px solid #e5e7eb',borderBottom:'1px solid #e5e7eb',padding:'20px 24px'}}>
        <div style={{maxWidth:'1100px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'center',gap:'24px',flexWrap:'wrap'}}>

          <div style={{borderLeft:'3px solid #c8960a',paddingLeft:'12px',maxWidth:'260px'}}>
            <p style={{fontSize:'13px',color:'#374151',fontStyle:'italic',lineHeight:1.5,margin:0}}>
              &ldquo;Finally, admissions that give students feedback.&rdquo;
            </p>
            <p style={{fontSize:'12px',color:'#9ca3af',margin:'4px 0 0'}}>&mdash; Beta tester, Engineering College, Punjab</p>
          </div>
          <div style={{width:'1px',height:'40px',background:'#e5e7eb',alignSelf:'center',flexShrink:0}} />
          <div>
            <p style={{fontSize:'15px',color:'#1e3a5f',fontWeight:600,margin:0}}>&#127470;&#127475; Built for Indian Engineering Admissions</p>
            <p style={{fontSize:'13px',color:'#6b7280',margin:'4px 0 0'}}>Designed around JEE / Board workflows</p>
          </div>
        </div>
      </div>

      {/* ── STATS BAR ──────────────────────────────────────── */}
      <section className="bg-navy py-12">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-4 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {/* Live application counter */}
            <motion.div variants={fadeIn} className="text-center">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', animation: 'pulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Live</span>
              </div>
              <p className="text-4xl font-bold text-white mb-1">
                <AnimatedCounter value={liveAppCount} duration={2.5} />
              </p>
              <p className="text-sm font-semibold text-blue-200 mb-0.5">Applications received</p>
              <p className="text-xs text-blue-300/70">on this platform</p>
            </motion.div>

            <motion.div variants={fadeIn} className="text-center">
              <p className="text-4xl font-bold text-white mb-1">40,000+</p>
              <p className="text-sm font-semibold text-blue-200 mb-0.5">Engineering colleges in India</p>
              <p className="text-xs text-blue-300/70">All screening manually</p>
            </motion.div>
            <motion.div variants={fadeIn} className="text-center">
              <p className="text-4xl font-bold text-white mb-1">24 Lakh+</p>
              <p className="text-sm font-semibold text-blue-200 mb-0.5">JEE applicants every year</p>
              <p className="text-xs text-blue-300/70">Most get zero feedback on rejection</p>
            </motion.div>
            <motion.div variants={fadeIn} className="text-center">
              <p className="text-4xl font-bold text-white mb-1">
                <AnimatedCounter value={liveStudentCount} duration={2} />
              </p>
              <p className="text-sm font-semibold text-blue-200 mb-0.5">Students registered</p>
              <p className="text-xs text-blue-300/70">and growing every day</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── PIPELINE STAGES ────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
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
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          style={{display:'grid',gap:'24px'}}
          className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[
            {
              num:'01', Icon:FileText,
              title:'AI Application Screening',
              desc:'AI scores your application against DDS criteria holistically. Academic strength, project quality, motivation — all evaluated. If you don\'t qualify, you\'ll know exactly why within minutes.',
              stageLabel:'Stage 1', stageBg:'#d1fae5', stageText:'#065f46',
            },
            {
              num:'02', Icon:Shield,
              title:'Proctored Aptitude Test',
              desc:'15 questions across Maths, Physics, Chemistry, English and Reasoning. Fullscreen locked, camera monitored, tab-switch detection active. BITSAT-level difficulty. No two students get the same question set.',
              stageLabel:'Stage 2', stageBg:'#fef3c7', stageText:'#92400e',
            },
            {
              num:'03', Icon:MessageSquare,
              title:'AI Interview Agent',
              desc:'Aria reads your actual application and asks about your specific projects, essays, and choices. Every interview is unique. It cannot be scripted. Follow-up questions go 3 levels deep.',
              stageLabel:'Stage 3', stageBg:'#1e3a5f', stageText:'#ffffff',
            },
          ].map(({ num, Icon, title, desc, stageLabel, stageBg, stageText }) => (
            <motion.div key={num} variants={fadeIn} style={{background:'white',border:'1px solid #e5e7eb',borderRadius:'16px',padding:'32px'}}>
              <p style={{fontSize:'12px',color:'#9ca3af',fontWeight:500,marginBottom:'16px'}}>{num}</p>
              <div style={{width:'48px',height:'48px',background:'#1e3a5f',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'16px'}}>
                <Icon style={{color:'white',width:'22px',height:'22px'}} />
              </div>
              <h3 style={{fontSize:'18px',color:'#1e3a5f',fontWeight:600,marginBottom:'12px'}}>{title}</h3>
              <p style={{fontSize:'14px',color:'#6b7280',lineHeight:1.7,marginBottom:'20px'}}>{desc}</p>
              <span style={{display:'inline-block',padding:'4px 12px',borderRadius:'100px',fontSize:'12px',fontWeight:500,background:stageBg,color:stageText}}>{stageLabel}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── FOR COLLEGES ────────────────────────────────── */}
      <section id="for-colleges" style={{backgroundColor:'#f8f9fa',paddingTop:'80px',paddingBottom:'0'}}>

        {/* Header */}
        <motion.div initial="hidden" whileInView="visible" viewport={{once:true,margin:'-80px'}} variants={stagger}
          style={{maxWidth:'1200px',margin:'0 auto',padding:'0 24px',textAlign:'center',paddingBottom:'56px'}}
        >
          <motion.p variants={fadeIn} style={{color:'#c8960a',fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1px',marginBottom:'16px'}}>
            For Colleges &amp; Institutions
          </motion.p>
          <motion.h2 variants={fadeIn} style={{fontSize:'36px',color:'#1e3a5f',fontWeight:700,letterSpacing:'-0.5px',marginBottom:'12px'}}>
            Your admissions team deserves better tools
          </motion.h2>
          <motion.p variants={fadeIn} style={{fontSize:'16px',color:'#6b7280',maxWidth:'560px',margin:'0 auto',lineHeight:1.7}}>
            Aria is not built for students. It's built for the institutions that evaluate them. Your team sets the criteria. Aria does the screening. You make the final call.
          </motion.p>
        </motion.div>

        {/* Metrics strip — full width */}
        <motion.div initial="hidden" whileInView="visible" viewport={{once:true}} variants={stagger}
          style={{backgroundColor:'#1e3a5f',padding:'40px 24px'}}
        >
          <div style={{maxWidth:'1200px',margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(3,1fr)'}}>
            {[
              {num:'5 min',  label:'Average Stage 1 screening time',           sub:'vs 3–6 weeks manually'},
              {num:'100%',   label:'Of rejections come with specific feedback', sub:'Zero manual emails from your team'},
              {num:'3-layer',label:'Anti-cheat protection on every test',       sub:'Face detection · Tab monitoring · AI analysis'},
            ].map((m,i) => (
              <motion.div key={m.num} variants={fadeIn}
                style={{textAlign:'center',padding:'0 32px',borderRight:i<2?'1px solid #2d5282':'none'}}
              >
                <p style={{fontSize:'40px',fontWeight:700,color:'#f5c842',lineHeight:1}}>{m.num}</p>
                <p style={{fontSize:'15px',color:'white',fontWeight:500,marginTop:'8px'}}>{m.label}</p>
                <p style={{fontSize:'12px',color:'#93c5fd',marginTop:'4px'}}>{m.sub}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Benefits + dashboard */}
        <motion.div initial="hidden" whileInView="visible" viewport={{once:true}} variants={stagger}
          style={{maxWidth:'1200px',margin:'0 auto',padding:'56px 24px 0'}}
        >
          {/* 2×2 benefit cards */}
          <motion.div variants={fadeIn}
            style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'20px',marginBottom:'40px'}}
            className="!grid-cols-1 sm:!grid-cols-2"
          >
            {[
              {e:'⏱',title:'From 6 weeks to 6 hours',       body:'Set your eligibility criteria once in the admin panel. Every application is automatically scored, ranked, and shortlisted. Your team opens a dashboard, not a pile of PDFs.'},
              {e:'📊',title:'Real-time pipeline analytics',  body:'See exactly how many students are at each stage, average scores by branch, AI flag rates, and conversion at every step. Make data-driven admission decisions, not gut-feel ones.'},
              {e:'🛡',title:'Integrity you can trust',       body:'Every aptitude session is fullscreen-locked, camera-monitored with face detection, and AI-analyzed for assisted answers. Flagged sessions are reviewed — never auto-disqualified.'},
              {e:'🎓',title:'Students leave with clarity',   body:'Every rejected student gets specific, personalised AI-generated feedback. No ambiguity, no complaints, no manual rejection emails from your admissions office.'},
            ].map(c => (
              <div key={c.title} style={{background:'white',border:'1px solid #e5e7eb',borderRadius:'16px',padding:'28px'}}>
                <div style={{width:'40px',height:'40px',background:'#eef2ff',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',marginBottom:'14px'}}>{c.e}</div>
                <h3 style={{fontSize:'16px',color:'#1e3a5f',fontWeight:600,marginBottom:'8px'}}>{c.title}</h3>
                <p style={{fontSize:'14px',color:'#6b7280',lineHeight:1.7}}>{c.body}</p>
              </div>
            ))}
          </motion.div>

          {/* Admin dashboard mockup */}
          <motion.div variants={fadeIn}>
            <p style={{fontSize:'11px',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'1px',fontWeight:500,textAlign:'center',marginBottom:'16px'}}>Admin Dashboard — Live View</p>
            <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:'16px',overflow:'hidden',maxWidth:'900px',margin:'0 auto',overflowX:'auto'}}>
              <div style={{background:'#1e3a5f',display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1.2fr 0.7fr',padding:'10px 16px',gap:'8px'}}>
                {['Applicant','Branch','S1 Score','S2 Score','Status','Action'].map(h=>(
                  <span key={h} style={{fontSize:'12px',color:'white',fontWeight:500}}>{h}</span>
                ))}
              </div>
              {[
                {name:'Aryan Mehta', branch:'CSE',s1:'88/100',s2:'76%',status:'Selected',pill:'#d1fae5',pt:'#065f46',bg:'white'},
                {name:'Priya Sharma',branch:'ECE',s1:'82/100',s2:'68%',status:'Stage 3', pill:'#fef3c7',pt:'#92400e',bg:'#f9fafb'},
                {name:'Rohan Verma', branch:'ME', s1:'74/100',s2:'—',  status:'Rejected', pill:'#fee2e2',pt:'#991b1b',bg:'white'},
                {name:'Kavya Nair',  branch:'IT', s1:'91/100',s2:'84%',status:'Selected',pill:'#d1fae5',pt:'#065f46',bg:'#f9fafb'},
              ].map(row=>(
                <div key={row.name} style={{background:row.bg,display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1.2fr 0.7fr',padding:'12px 16px',borderBottom:'1px solid #f3f4f6',alignItems:'center',gap:'8px'}}>
                  <span style={{fontSize:'13px',fontWeight:500,color:'#111827'}}>{row.name}</span>
                  <span style={{fontSize:'13px',color:'#6b7280'}}>{row.branch}</span>
                  <span style={{fontSize:'13px',color:'#6b7280'}}>{row.s1}</span>
                  <span style={{fontSize:'13px',color:'#6b7280'}}>{row.s2}</span>
                  <span style={{display:'inline-block',padding:'3px 10px',borderRadius:'100px',fontSize:'12px',fontWeight:500,background:row.pill,color:row.pt}}>{row.status}</span>
                  <span style={{fontSize:'12px',color:'#1e3a5f',fontWeight:500,cursor:'pointer',textDecoration:'underline'}}>View</span>
                </div>
              ))}
              <div style={{padding:'10px 16px',background:'#f9fafb',borderTop:'1px solid #e5e7eb'}}>
                <span style={{fontSize:'12px',color:'#9ca3af'}}>Showing 4 of 2,847 applications · Filtered: CSE AI · Sorted by: AI Score</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Gold CTA strip */}
        <motion.div initial="hidden" whileInView="visible" viewport={{once:true}} variants={fadeIn}
          style={{backgroundColor:'#f5c842',padding:'48px 24px',marginTop:'56px'}}
        >
          <div style={{maxWidth:'1200px',margin:'0 auto',display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'24px'}}>
            <div>
              <h2 style={{fontSize:'24px',color:'#1e3a5f',fontWeight:700,marginBottom:'6px'}}>Ready to modernise your admissions?</h2>

            </div>
            <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
              <Link to="/admin">
                <button style={{background:'#1e3a5f',color:'white',padding:'12px 24px',borderRadius:'8px',fontWeight:600,fontSize:'15px',cursor:'pointer',border:'none'}}>
                  Request a Demo →
                </button>
              </Link>
              <Link to="/admin">
                <button style={{background:'transparent',color:'#1e3a5f',padding:'12px 24px',borderRadius:'8px',fontWeight:600,fontSize:'15px',cursor:'pointer',border:'2px solid #1e3a5f'}}>
                  See Admin Panel
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── WHY ARIA ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
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

      {/* ── FAQ SECTION ──────────────────────────────────────── */}
      <section style={{ backgroundColor: '#f8fafc', padding: '72px 16px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeIn} style={{ textAlign: 'center', marginBottom: '40px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#c8960a', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>FAQ</p>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#1e3a5f', marginBottom: '8px' }}>Frequently Asked Questions</h2>
              <p style={{ fontSize: '15px', color: '#6b7280' }}>Everything you need to know about the admissions process</p>
            </motion.div>
            {[
              { q: 'Is my data safe?', a: 'Absolutely. All data is encrypted at rest and in transit using industry-standard AES-256 encryption. We use Supabase (built on PostgreSQL) with row-level security. Your camera feed during the interview is processed locally in your browser and never stored on our servers. We comply with Indian data protection regulations.' },
              { q: 'How does AI scoring work?', a: 'Stage 1 uses a large language model to evaluate your application holistically — academics, projects, essays, and extracurriculars. It generates a score out of 100, a grade, and personalized feedback with strengths and improvement areas. The AI is calibrated against expert admissions committee standards and scores consistently across all applicants.' },
              { q: 'What happens if my internet drops during the interview?', a: 'Your interview progress is automatically saved after every message. If your connection drops, you can rejoin from where you left off within 10 minutes. If the session expires, the system preserves your partial transcript and you may be eligible for a retry at the committee\'s discretion.' },
              { q: 'Can I retake any stage?', a: 'Stage 1 (AI Evaluation) is one-time based on your submitted application. Stage 2 (Aptitude Test) allows up to 2 attempts — your best score counts. Stage 3 (AI Interview) also allows a second attempt after a 48-hour cooldown period. Your best interview score is used for the final decision.' },
              { q: 'How long does the full process take?', a: 'Stage 1 scoring is instant — you get results immediately after submitting your application. Stage 2 is a 15-question timed test taking about 20-30 minutes. Stage 3 is a 10-question AI interview lasting 15-25 minutes. Most students complete the entire pipeline in under 2 hours across multiple sessions.' },
            ].map(({ q, a }, i) => (
              <FAQItem key={i} question={q} answer={a} index={i} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer style={{backgroundColor:'#1e3a5f',padding:'56px 16px 40px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12" style={{marginBottom:'40px'}}>

            {/* Brand */}
            <div>
              <p style={{fontSize:'22px',color:'white',fontWeight:700,margin:0}}>Aria</p>
              <p style={{fontSize:'12px',color:'#93c5fd',margin:'2px 0 0'}}>by DDS University</p>
              <p style={{fontSize:'13px',color:'#93c5fd',lineHeight:1.7,maxWidth:'240px',margin:'12px 0 0'}}>
                India's first AI-powered admissions platform. Built to make screening faster, fairer, and fully transparent for every student.
              </p>
              <a href="mailto:aria@ddsuniversity.ac.in" style={{display:'block',fontSize:'13px',color:'#93c5fd',margin:'16px 0 0',textDecoration:'none'}}>
                &#128231; aria@ddsuniversity.ac.in
              </a>
              <span style={{display:'inline-block',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.18)',padding:'4px 12px',borderRadius:'100px',fontSize:'11px',color:'white',marginTop:'16px'}}>
                Powered by Aria ✦
              </span>
            </div>

            {/* Platform */}
            <div>
              <p style={{fontSize:'13px',color:'white',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'16px'}}>Platform</p>
              {['Student Login','Admin Panel','Apply to DDS University','How it Works'].map(l => (
                <p key={l} style={{fontSize:'13px',color:'#93c5fd',margin:'0 0 10px',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.color='white'}
                  onMouseLeave={e=>e.currentTarget.style.color='#93c5fd'}>{l}</p>
              ))}
            </div>

            {/* For Institutions */}
            <div>
              <p style={{fontSize:'13px',color:'white',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'16px'}}>For Institutions</p>
              {['Request a Demo','Partner with Aria','Admin Dashboard','Pricing & Plans'].map(l => (
                <p key={l} style={{fontSize:'13px',color:'#93c5fd',margin:'0 0 10px',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.color='white'}
                  onMouseLeave={e=>e.currentTarget.style.color='#93c5fd'}>{l}</p>
              ))}
            </div>

            {/* About */}
            <div>
              <p style={{fontSize:'13px',color:'white',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'16px'}}>About</p>
              {['About Aria','Privacy Policy','Terms of Use','Contact Us'].map(l => (
                <p key={l} style={{fontSize:'13px',color:'#93c5fd',margin:'0 0 10px',cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.color='white'}
                  onMouseLeave={e=>e.currentTarget.style.color='#93c5fd'}>{l}</p>
              ))}

            </div>
          </div>

          <div style={{height:'1px',background:'#2d5282',margin:'0 0 32px'}} />

          <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'16px'}}>
            <p style={{fontSize:'12px',color:'#6b7280',margin:0}}>© 2026 Aria · DDS University for Engineering · All rights reserved</p>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              {['Privacy','Terms','Contact'].map((l,i) => (
                <React.Fragment key={l}>
                  <span style={{fontSize:'12px',color:'#6b7280',cursor:'pointer'}}>{l}</span>
                  {i < 2 && <span style={{fontSize:'12px',color:'#4b5563'}}> · </span>}
                </React.Fragment>
              ))}
            </div>
            <p style={{fontSize:'12px',color:'#6b7280',margin:0}}>Built in India &#127470;&#127475;</p>
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
