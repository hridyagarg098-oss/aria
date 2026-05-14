import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, animate } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, GraduationCap, FileText, Download, Lock, Eye, EyeOff,
  ChevronRight, ArrowLeft, BarChart2, Target, MessageSquare, CheckCircle, XCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, Badge, Button, Skeleton } from '../components/ui';
import TopNav from '../components/layout/TopNav';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

// ── Animated Score Counter ──────────────────────────────────────────────────
function AnimatedScore({ value, suffix = '', duration = 1.5 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value == null || isNaN(value)) return;
    const controls = animate(0, Number(value), {
      duration, ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration]);
  return <span>{display}{suffix}</span>;
}

export default function Profile() {
  const { user, studentProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [testSession, setTestSession] = useState(null);
  const [interviewSession, setInterviewSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: app } = await supabase
        .from('applications')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setApplication(app || null);

      if (app) {
        const { data: ts } = await supabase
          .from('test_sessions')
          .select('*')
          .eq('application_id', app.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setTestSession(ts || null);

        const { data: iv } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('application_id', app.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setInterviewSession(iv || null);
      }
    } catch (err) {
      console.warn('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error('Failed to update password: ' + error.message);
    } else {
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!application) return;
    const fd = application.form_data || {};
    const doc = new jsPDF();

    // Header
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DDS University — Application Summary', 20, 22);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 20, 30);

    let y = 48;
    const addSection = (title) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(30, 58, 95);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 20, y);
      doc.setDrawColor(200, 150, 10);
      doc.setLineWidth(0.5);
      doc.line(20, y + 2, 190, y + 2);
      y += 10;
    };
    const addRow = (label, value) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(label, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(String(value || '—'), 80, y);
      y += 7;
    };

    // Personal Info
    addSection('Personal Information');
    addRow('Name:', fd.name);
    addRow('Email:', user?.email);
    addRow('City:', fd.city);
    addRow('State:', fd.state);
    addRow('Branch:', fd.branch || application.branch);
    y += 4;

    // Academics
    addSection('Academic Scores');
    addRow('Physics:', `${fd.physics}%`);
    addRow('Chemistry:', `${fd.chemistry}%`);
    addRow('Maths:', `${fd.maths}%`);
    addRow('PCM Average:', `${((+fd.physics + +fd.chemistry + +fd.maths) / 3).toFixed(1)}%`);
    addRow('JEE Percentile:', fd.jee);
    y += 4;

    // Stage 1 Score
    addSection('Stage 1 — AI Evaluation');
    addRow('Score:', application.ai_score ? `${Math.round(application.ai_score)}/100` : 'Pending');
    addRow('Grade:', application.ai_grade || '—');
    addRow('Status:', application.status);
    if (application.ai_feedback) {
      y += 3;
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const lines = doc.splitTextToSize(`Feedback: ${application.ai_feedback}`, 160);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 4;
    }

    // Stage 2
    if (testSession) {
      addSection('Stage 2 — Aptitude Test');
      addRow('Score:', `${Math.round(testSession.score || 0)}%`);
      addRow('Time Taken:', `${Math.round((testSession.time_taken_seconds || 0) / 60)} mins`);
      addRow('Tab Switches:', testSession.tab_switches || 0);
      y += 4;
    }

    // Stage 3
    if (interviewSession) {
      addSection('Stage 3 — AI Interview');
      addRow('Score:', interviewSession.final_assessment?.total_score ? `${interviewSession.final_assessment.total_score}/100` : '—');
      addRow('Verdict:', interviewSession.final_assessment?.verdict || '—');
      addRow('Questions:', interviewSession.question_count || '—');
      y += 4;
    }

    // Projects & Extras
    if (fd.projects || fd.extra) {
      addSection('Projects & Extracurriculars');
      if (fd.projects) {
        const pLines = doc.splitTextToSize(`Projects: ${fd.projects}`, 160);
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.text(pLines, 20, y);
        y += pLines.length * 5 + 3;
      }
      if (fd.extra) {
        const eLines = doc.splitTextToSize(`Extracurriculars: ${fd.extra}`, 160);
        doc.text(eLines, 20, y);
        y += eLines.length * 5 + 3;
      }
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text('Powered by Aria AI — DDS University Admissions', 20, 285);

    doc.save(`DDS_Application_${fd.name?.replace(/\s+/g, '_') || 'student'}.pdf`);
    toast.success('PDF downloaded!');
  };

  const name = application?.form_data?.name || studentProfile?.name || user?.email?.split('@')[0] || 'Student';
  const fd = application?.form_data || {};

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <TopNav subtitle="My Profile" showUserMenu name={name} />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  const stages = [
    {
      label: 'Stage 1 — AI Evaluation',
      score: application?.ai_score ? Math.round(application.ai_score) : null,
      max: 100,
      grade: application?.ai_grade,
      status: application?.status?.includes('s1') || application?.stage >= 2 ? (application?.status === 'rejected_s1' ? 'failed' : 'passed') : 'pending',
    },
    {
      label: 'Stage 2 — Aptitude Test',
      score: testSession?.score ? Math.round(testSession.score) : null,
      max: 100,
      suffix: '%',
      status: application?.stage >= 3 ? 'passed' : application?.status === 'rejected_s2' ? 'failed' : testSession ? 'completed' : 'locked',
    },
    {
      label: 'Stage 3 — AI Interview',
      score: interviewSession?.final_assessment?.total_score ? Math.round(interviewSession.final_assessment.total_score) : (application?.s3_best_score ? Math.round(application.s3_best_score) : null),
      max: 100,
      status: application?.status === 'selected' ? 'passed' : application?.status === 'rejected_s3' ? 'failed' : interviewSession ? 'completed' : 'locked',
    },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <TopNav subtitle="My Profile" showUserMenu name={name} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/dashboard" className="hover:text-navy transition-colors">Dashboard</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-navy font-medium">Profile</span>
        </div>

        {/* ── PROFILE HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="mb-6 overflow-hidden">
            <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5282 100%)', padding: '28px 28px 20px', color: 'white' }}>
              <div className="flex items-start gap-4">
                <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, flexShrink: 0 }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>{fd.name || name}</h1>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>{user?.email}</p>
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    {fd.city && (
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        <MapPin className="w-3 h-3" />{fd.city}{fd.state ? `, ${fd.state}` : ''}
                      </span>
                    )}
                    {application?.branch && (
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        <GraduationCap className="w-3 h-3" />{application.branch}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDownloadPDF}
                  disabled={!application}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white', fontSize: '13px', fontWeight: 600, cursor: application ? 'pointer' : 'not-allowed',
                    opacity: application ? 1 : 0.5, transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={e => { if (application) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'; }}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── SCORES AT A GLANCE ── */}
        {application && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h2 className="text-card-title font-semibold text-navy mb-3 flex items-center gap-2">
              <BarChart2 className="w-5 h-5" /> Scores at a Glance
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {stages.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                >
                  <Card className="p-5 text-center relative overflow-hidden">
                    {s.status === 'locked' && (
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        <Lock className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Stage {i + 1}</p>
                    {s.score != null ? (
                      <>
                        <p className="text-3xl font-bold text-navy">
                          <AnimatedScore value={s.score} suffix={s.suffix || ''} />
                        </p>
                        <p className="text-xs text-gray-400 mt-1">/ {s.max}</p>
                      </>
                    ) : (
                      <p className="text-2xl font-bold text-gray-300">—</p>
                    )}
                    {s.grade && <Badge className="mt-2">{s.grade}</Badge>}
                    <div className="mt-2">
                      {s.status === 'passed' && <span className="text-xs text-green-600 font-semibold flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> Passed</span>}
                      {s.status === 'failed' && <span className="text-xs text-red-500 font-semibold flex items-center justify-center gap-1"><XCircle className="w-3 h-3" /> Not Passed</span>}
                      {s.status === 'completed' && <span className="text-xs text-blue-500 font-semibold">Completed</span>}
                      {s.status === 'pending' && <span className="text-xs text-gray-400 font-semibold">Pending</span>}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── APPLICATION DETAILS ── */}
        {application && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <h2 className="text-card-title font-semibold text-navy mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Application Details
            </h2>
            <Card className="mb-6">
              <div className="p-5">
                {/* Academics Grid */}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Academic Scores</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                  {[
                    { label: 'Physics', value: fd.physics },
                    { label: 'Chemistry', value: fd.chemistry },
                    { label: 'Maths', value: fd.maths },
                    { label: 'PCM Avg', value: fd.physics && fd.chemistry && fd.maths ? ((+fd.physics + +fd.chemistry + +fd.maths) / 3).toFixed(1) : null },
                    { label: 'JEE %ile', value: fd.jee },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-navy">{s.value || '—'}{s.value && s.label !== 'JEE %ile' ? '%' : ''}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Essays */}
                {(fd.whyDDS || fd.whyBranch) && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Essays</p>
                    {fd.whyDDS && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Why DDS University?</p>
                        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3">{fd.whyDDS}</p>
                      </div>
                    )}
                    {fd.whyBranch && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Why this branch?</p>
                        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3">{fd.whyBranch}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Projects & Extras */}
                {(fd.projects || fd.extra) && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Projects & Activities</p>
                    {fd.projects && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Projects</p>
                        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3">{fd.projects}</p>
                      </div>
                    )}
                    {fd.extra && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Extracurriculars</p>
                        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-3">{fd.extra}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── AI FEEDBACK ── */}
        {application?.ai_feedback && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2 className="text-card-title font-semibold text-navy mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" /> AI Feedback
            </h2>
            <Card className="mb-6 p-5">
              <p className="text-sm text-gray-700 leading-relaxed mb-4">{application.ai_feedback}</p>
              {application.ai_strengths?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-green-700 mb-1">Strengths</p>
                  <div className="flex flex-wrap gap-1.5">
                    {application.ai_strengths.map((s, i) => (
                      <span key={i} className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-100">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {application.ai_improvements?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1">Areas to Improve</p>
                  <div className="flex flex-wrap gap-1.5">
                    {application.ai_improvements.map((s, i) => (
                      <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* ── ACCOUNT SETTINGS ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <h2 className="text-card-title font-semibold text-navy mb-3 flex items-center gap-2">
            <Lock className="w-5 h-5" /> Account Settings
          </h2>
          <Card className="mb-6 p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Email Address</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
                <Badge>Verified</Badge>
              </div>

              <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Password</p>
                    <p className="text-xs text-gray-400">Change your account password</p>
                  </div>
                  <button
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                    className="text-sm font-medium text-navy hover:text-blue-700 transition-colors"
                  >
                    {showPasswordChange ? 'Cancel' : 'Change'}
                  </button>
                </div>

                {showPasswordChange && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="New password (min 6 characters)"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                    />
                    <button
                      onClick={handlePasswordChange}
                      disabled={changingPassword || !newPassword || !confirmPassword}
                      className="px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50"
                    >
                      {changingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </motion.div>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: '#e5e7eb' }} />

              <button
                onClick={async () => { await signOut(); navigate('/'); }}
                className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
