import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckCircle, XCircle, AlertTriangle, Download,
  User, FileText, MessageCircle, Database, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Badge, ProgressBar, Skeleton, Modal } from '../../components/ui';
import AdminLayout from './AdminLayout';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const GRADE_BADGE = { 'A+': 'success', 'A': 'success', 'B+': 'info', 'B': 'info', 'C': 'warning' };
const STATUS_BADGE = { pending: 'default', passed_s1: 'info', passed_s2: 'navy', rejected_s1: 'error', rejected_s2: 'error', s2_attempt1_failed: 'warning', rejected_s2_both_attempts: 'error', interview: 'warning', s3_attempt1_failed: 'warning', rejected_s3_both_attempts: 'error', selected: 'success', rejected_s3: 'error' };
const STATUS_LABEL = { pending: 'Pending', passed_s1: 'Passed S1', passed_s2: 'Passed S2', rejected_s1: 'Rejected S1', rejected_s2: 'Rejected S2', s2_attempt1_failed: 'S2 Retry Pending', rejected_s2_both_attempts: 'Rejected S2 (Both)', interview: 'Interview Done', s3_attempt1_failed: 'S3 Retry Pending', rejected_s3_both_attempts: 'Rejected S3 (Both)', selected: 'Selected', rejected_s3: 'Not Selected' };

const TABS = ['AI Assessment', 'Aptitude Test', 'Interview', 'Integrity Log', 'Raw Data'];

export default function ApplicantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [testSession, setTestSession] = useState(null);
  const [interviewSession, setInterviewSession] = useState(null);
  const [interviewSessions, setInterviewSessions] = useState([]);
  const [testQuestions, setTestQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const reportRef = useRef(null);

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    const { data: appData } = await supabase
      .from('applications')
      .select('*, students(*), universities(*)')
      .eq('id', id)
      .single();

    if (!appData) { navigate('/admin/applicants'); return; }
    setApp(appData);
    setNote(appData.admin_notes || '');

    const { data: ts } = await supabase
      .from('test_sessions')
      .select('*')
      .eq('application_id', id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    setTestSession(ts || null);

    const { data: is_ } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('application_id', id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    setInterviewSession(is_ || null);

    // Fetch ALL interview sessions for the results tab
    const { data: allSessions } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('application_id', id)
      .order('started_at', { ascending: true });
    setInterviewSessions(allSessions || []);

    const { data: test } = await supabase
      .from('aptitude_tests')
      .select('questions')
      .eq('university_id', appData.university_id)
      .single();
    setTestQuestions(test?.questions || []);

    setLoading(false);
  };

  const updateStatus = async (newStatus) => {
    await supabase.from('applications').update({ status: newStatus }).eq('id', id);
    toast.success(`Applicant status updated to: ${STATUS_LABEL[newStatus]}`);
    setApp(prev => ({ ...prev, status: newStatus }));
    setConfirmModal(null);
  };

  const saveNote = async () => {
    await supabase.from('applications').update({ admin_notes: note }).eq('id', id);
    toast.success('Note saved');
    setNoteOpen(false);
  };

  const handleAdminDecision = async (applicationId, decision) => {
    const { error } = await supabase.from('applications').update({ status: decision }).eq('id', applicationId);
    if (!error) {
      toast.success(`Applicant marked as: ${decision.replace(/_/g, ' ')}`);
      fetchData();
    } else {
      toast.error('Failed to update status');
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    toast('Generating PDF...', { icon: '📄' });
    const canvas = await html2canvas(reportRef.current, { scale: 1.5, useCORS: true });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 297));
    pdf.save(`aria-${(app.students?.name || app.form_data?.name || 'applicant').replace(/\s+/g, '-')}-report.pdf`);
    toast.success('PDF downloaded!');
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid lg:grid-cols-3 gap-6">
            <Skeleton className="h-80" />
            <div className="lg:col-span-2 space-y-4"><Skeleton className="h-80" /></div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!app) return null;

  const fd = app.form_data || {};
  const studentName = app.students?.name || fd.name || 'Unknown';
  const studentCity = app.students?.city || fd.city || '';
  const pcmAvg = fd.physics && fd.chemistry && fd.maths
    ? ((+fd.physics + +fd.chemistry + +fd.maths) / 3).toFixed(1) : null;

  const criteria = [
    { label: 'Physics', value: +fd.physics, min: 60, bar: +fd.physics },
    { label: 'Chemistry', value: +fd.chemistry, min: 60, bar: +fd.chemistry },
    { label: 'Maths', value: +fd.maths, min: 60, bar: +fd.maths },
    { label: 'PCM Avg', value: +pcmAvg, min: 75, bar: +pcmAvg },
    { label: 'JEE Percentile', value: +fd.jee, min: 90, bar: Math.min(100, +fd.jee) },
  ];

  const timeline = [
    { label: 'Applied', date: app.created_at, done: true },
    { label: `Stage 1 — Score: ${app.ai_score ? Math.round(app.ai_score) : '?'}/100`, date: app.created_at, done: !!app.ai_score },
    { label: `Stage 2 — Score: ${testSession?.score ? Math.round(testSession.score) : '?'}%`, date: testSession?.completed_at, done: !!testSession?.completed_at },
    { label: 'Interview Completed', date: interviewSession?.completed_at, done: !!interviewSession?.completed_at },
    { label: STATUS_LABEL[app.status] || app.status, date: null, done: ['selected', 'rejected_s3'].includes(app.status) },
  ];

  return (
    <AdminLayout>
      {/* Back / breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-sm">
        <Link to="/admin/applicants" className="flex items-center gap-1.5 text-gray-500 hover:text-navy transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Applicants
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-navy font-medium">{studentName}</span>
      </div>

      <div ref={reportRef} className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3">
                {studentName.charAt(0) || 'S'}
              </div>
              <h2 className="text-card-title font-semibold text-navy">{studentName}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{app.students?.email || ''}</p>
              {app.students?.phone && <p className="text-xs text-gray-500">{app.students?.phone}</p>}
              <p className="text-xs text-gray-500 mt-1">{studentCity}</p>
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Applied</span>
                <span className="font-medium">{format(new Date(app.created_at), 'dd MMM yyyy')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Branch</span>
                <Badge variant="navy" className="text-xs">{app.branch?.split(' ')[0]}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Status</span>
                <Badge variant={STATUS_BADGE[app.status]}>{STATUS_LABEL[app.status]}</Badge>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Academic Profile</p>
            <div className="space-y-3">
              {criteria.map(c => (
                <div key={c.label}>
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-gray-600 font-medium">{c.label}</span>
                    <span className={`font-bold ${c.value >= c.min + 10 ? 'text-green-600' : c.value >= c.min ? 'text-navy' : 'text-red-600'}`}>
                      {c.value}%
                    </span>
                  </div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${c.value >= c.min + 10 ? 'bg-green-500' : c.value >= c.min ? 'bg-navy' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(100, c.bar)}%` }}
                    />
                    <div className="absolute top-0 h-full w-0.5 bg-amber-400" style={{ left: `${c.min}%` }} title={`Min: ${c.min}`} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Min: {c.min}%</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Timeline</p>
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-gray-100" />
              <div className="space-y-4">
                {timeline.map((item, i) => (
                  <div key={i} className="relative flex gap-3">
                    <div className={`absolute -left-2.5 w-3 h-3 rounded-full border-2 ${item.done ? 'bg-navy border-navy' : 'bg-white border-gray-300'}`} />
                    <div className="pl-1">
                      <p className={`text-xs font-medium ${item.done ? 'text-navy' : 'text-gray-400'}`}>{item.label}</p>
                      {item.date && <p className="text-xs text-gray-400">{format(new Date(item.date), 'dd MMM · HH:mm')}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
            <div className="flex border-b border-border">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  className={`flex-1 px-3 py-3 text-xs font-semibold transition-colors ${activeTab === i ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy hover:bg-gray-50'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* AI Assessment */}
              {activeTab === 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-6xl font-bold text-navy">{app.ai_score ? Math.round(app.ai_score) : '—'}</p>
                      <p className="text-xs text-gray-400">/ 100</p>
                    </div>
                    {app.ai_grade && (
                      <Badge variant={GRADE_BADGE[app.ai_grade]} className="text-base px-4 py-1.5">{app.ai_grade}</Badge>
                    )}
                  </div>
                  {app.ai_feedback && (
                    <blockquote className="border-l-4 border-navy pl-4 text-sm text-gray-700 italic bg-gray-50 py-3 pr-3 rounded-r-lg">
                      {app.ai_feedback}
                    </blockquote>
                  )}
                  {app.ai_strengths?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Strengths</p>
                      <ul className="space-y-1.5">
                        {app.ai_strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {app.ai_improvements?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Areas to Improve</p>
                      <ul className="space-y-1.5">
                        {app.ai_improvements.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {app.ai_academic_remark && (
                    <p className="text-sm text-gray-500 italic">{app.ai_academic_remark}</p>
                  )}
                </div>
              )}

              {/* Aptitude Test */}
              {activeTab === 1 && (
                <div className="space-y-5">
                  {!testSession ? (
                    <p className="text-sm text-gray-400 text-center py-8">Stage 2 test not yet attempted</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-navy">{testSession.correct}/{testSession.total}</p>
                          <p className="text-xs text-gray-500">Correct</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-navy">{Math.round(testSession.score)}%</p>
                          <p className="text-xs text-gray-500">Score</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-navy">
                            {testSession.time_taken_seconds ? `${Math.floor(testSession.time_taken_seconds/60)}:${String(testSession.time_taken_seconds%60).padStart(2,'0')}` : '—'}
                          </p>
                          <p className="text-xs text-gray-500">Time Taken</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {testSession.tab_switches > 0 && (
                          <Badge variant="warning">{testSession.tab_switches} tab switch{testSession.tab_switches > 1 ? 'es' : ''}</Badge>
                        )}
                        <Badge variant={testSession.camera_denied ? 'error' : 'success'}>
                          Camera {testSession.camera_denied ? 'Denied' : 'Active'}
                        </Badge>
                        <Badge variant={testSession.ai_flag ? 'error' : 'success'}>
                          {testSession.ai_flag ? '⚑ AI Flagged' : '✓ No Flag'}
                        </Badge>
                      </div>

                      {testSession.ai_flag && testSession.ai_flag_reason && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-800 mb-1">Flag Reason</p>
                          <p className="text-sm text-amber-700">{testSession.ai_flag_reason}</p>
                          {testSession.ai_probability && (
                            <p className="text-xs text-amber-600 mt-1">AI probability: {(testSession.ai_probability * 100).toFixed(0)}%</p>
                          )}
                        </div>
                      )}

                      {/* Answer review table */}
                      {testQuestions.length > 0 && testSession.answers && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Answer Review</p>
                          <div className="border border-border rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b border-border">
                                <tr>
                                  <th className="text-left px-3 py-2 text-gray-500">#</th>
                                  <th className="text-left px-3 py-2 text-gray-500">Question</th>
                                  <th className="text-left px-3 py-2 text-gray-500">Answered</th>
                                  <th className="text-left px-3 py-2 text-gray-500">Correct</th>
                                  <th className="text-center px-3 py-2 text-gray-500">Result</th>
                                </tr>
                              </thead>
                              <tbody>
                                {testQuestions.map((q, i) => {
                                  const studentAns = testSession.answers?.[i];
                                  const isCorrect = studentAns === q.correct;
                                  return (
                                    <tr key={i} className={`border-b border-border last:border-0 ${isCorrect ? 'bg-green-50/50' : studentAns !== undefined ? 'bg-red-50/50' : ''}`}>
                                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                      <td className="px-3 py-2 text-gray-700 max-w-xs truncate">{q.question.slice(0, 60)}...</td>
                                      <td className="px-3 py-2 text-gray-700">{studentAns !== undefined ? q.options[studentAns] : <span className="text-gray-400">Skipped</span>}</td>
                                      <td className="px-3 py-2 text-gray-700">{q.options[q.correct]}</td>
                                      <td className="px-3 py-2 text-center">
                                        {studentAns === undefined ? <span className="text-gray-400">—</span>
                                          : isCorrect ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                                          : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Interview Results */}
              {activeTab === 2 && (
                <div>
                  {!interviewSessions || interviewSessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                      <p style={{ fontSize: '32px', marginBottom: '12px' }}>🎙</p>
                      <p style={{ fontSize: '15px', color: '#374151' }}>No interview completed yet</p>
                    </div>
                  ) : (
                    <div>
                      {interviewSessions.map((session, attemptIndex) => {
                        let scoreData = null;
                        try { scoreData = session.final_assessment ? JSON.parse(session.final_assessment) : null; } catch (e) {}

                        return (
                          <div key={session.id} style={{ marginBottom: '32px' }}>

                            {/* Attempt header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                              <span style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
                                Attempt {attemptIndex + 1}
                              </span>
                              {session.force_terminated && (
                                <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>Terminated</span>
                              )}
                              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                {session.started_at ? new Date(session.started_at).toLocaleString() : ''}
                              </span>
                            </div>

                            {/* Score overview */}
                            {scoreData && (
                              <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                  {/* Total score */}
                                  <div style={{ backgroundColor: '#1e3a5f', color: 'white', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '40px', fontWeight: 700, color: '#f5c842' }}>{scoreData.total_score}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.8 }}>Total Score / 100</div>
                                    <div style={{ marginTop: '8px', backgroundColor: scoreData.total_score >= 75 ? '#16a34a' : scoreData.total_score >= 55 ? '#d97706' : '#dc2626', borderRadius: '100px', padding: '3px 10px', fontSize: '12px', fontWeight: 600, display: 'inline-block' }}>
                                      {scoreData.grade}
                                    </div>
                                  </div>
                                  {/* Recommendation */}
                                  <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>Recommendation</div>
                                    <div style={{ fontWeight: 600, fontSize: '15px', color: scoreData.recommendation === 'Strongly Recommend' ? '#16a34a' : scoreData.recommendation === 'Recommend' ? '#2563eb' : scoreData.recommendation === 'Borderline' ? '#d97706' : '#dc2626' }}>
                                      {scoreData.recommendation}
                                    </div>
                                  </div>
                                  {/* Confidence */}
                                  <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>Admit Confidence</div>
                                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#1e3a5f' }}>{scoreData.admit_confidence}%</div>
                                  </div>
                                </div>

                                {/* Sub-scores — supports both old (subscores) and new (dimension_scores) format */}
                                <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                                  <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '16px', color: '#111827' }}>Score Breakdown — 8 Dimensions</p>
                                  {Object.entries(scoreData.dimension_scores || scoreData.subscores || {}).map(([key, val]) => (
                                    <div key={key} style={{ marginBottom: '16px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          {val.verdict && (
                                            <span style={{
                                              fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                                              backgroundColor: val.verdict === 'Strong' ? '#dcfce7' : val.verdict === 'Adequate' ? '#fef9c3' : '#fee2e2',
                                              color: val.verdict === 'Strong' ? '#15803d' : val.verdict === 'Adequate' ? '#a16207' : '#dc2626',
                                            }}>{val.verdict}</span>
                                          )}
                                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e3a5f' }}>{val.score}/{val.max}</span>
                                        </div>
                                      </div>
                                      <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '100px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${(val.score / val.max) * 100}%`, backgroundColor: (val.score / val.max) >= 0.7 ? '#16a34a' : (val.score / val.max) >= 0.5 ? '#d97706' : '#dc2626', borderRadius: '100px', transition: 'width 0.6s ease' }} />
                                      </div>
                                      {(val.evidence || val.comment) && <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>"{val.evidence || val.comment}"</p>}
                                    </div>
                                  ))}
                                </div>

                                {/* Best & Worst Moments */}
                                {(scoreData.best_moment || scoreData.worst_moment) && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                    {scoreData.best_moment && (
                                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                                        <p style={{ fontWeight: 600, fontSize: '13px', color: '#15803d', marginBottom: '8px' }}>🌟 Best Moment</p>
                                        <p style={{ fontSize: '13px', color: '#166534', fontStyle: 'italic', lineHeight: 1.6 }}>"{scoreData.best_moment}"</p>
                                      </div>
                                    )}
                                    {scoreData.worst_moment && (
                                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '16px' }}>
                                        <p style={{ fontWeight: 600, fontSize: '13px', color: '#9a3412', marginBottom: '8px' }}>⚠ Weakest Moment</p>
                                        <p style={{ fontSize: '13px', color: '#9a3412', fontStyle: 'italic', lineHeight: 1.6 }}>"{scoreData.worst_moment}"</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Project Viability + Genuineness */}
                                {(scoreData.project_viability || scoreData.genuineness_score != null) && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                    {scoreData.project_viability && (
                                      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                                        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Project Viability</p>
                                        <p style={{ fontWeight: 600, fontSize: '15px', color: scoreData.project_viability === 'High Potential' ? '#16a34a' : scoreData.project_viability === 'Moderate Potential' ? '#d97706' : '#dc2626' }}>
                                          {scoreData.project_viability}
                                        </p>
                                        {scoreData.project_viability_reason && <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{scoreData.project_viability_reason}</p>}
                                      </div>
                                    )}
                                    {scoreData.genuineness_score != null && (
                                      <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                                        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Genuineness Score</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <span style={{ fontSize: '28px', fontWeight: 700, color: scoreData.genuineness_score >= 70 ? '#16a34a' : scoreData.genuineness_score >= 50 ? '#d97706' : '#dc2626' }}>{scoreData.genuineness_score}</span>
                                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>/100</span>
                                        </div>
                                        {scoreData.scripted_answers_detected && (
                                          <span style={{ marginTop: '6px', display: 'inline-block', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px' }}>Scripted Answers Detected</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Strengths and flags */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                                    <p style={{ fontWeight: 600, fontSize: '13px', color: '#15803d', marginBottom: '10px' }}>✅ Green Flags</p>
                                    {(scoreData.green_flags || scoreData.key_strengths || []).map((s, i) => (<p key={i} style={{ fontSize: '13px', color: '#166534', marginBottom: '6px' }}>• {s}</p>))}
                                    {(!(scoreData.green_flags || scoreData.key_strengths) || (scoreData.green_flags || scoreData.key_strengths).length === 0) && <p style={{ fontSize: '13px', color: '#9ca3af' }}>None identified</p>}
                                  </div>
                                  <div style={{ backgroundColor: scoreData.red_flags?.length > 0 ? '#fef2f2' : '#f9fafb', border: `1px solid ${scoreData.red_flags?.length > 0 ? '#fecaca' : '#e5e7eb'}`, borderRadius: '12px', padding: '16px' }}>
                                    <p style={{ fontWeight: 600, fontSize: '13px', color: scoreData.red_flags?.length > 0 ? '#dc2626' : '#9ca3af', marginBottom: '10px' }}>🚩 Red Flags</p>
                                    {scoreData.red_flags?.length > 0
                                      ? scoreData.red_flags.map((f, i) => (<p key={i} style={{ fontSize: '13px', color: '#991b1b', marginBottom: '6px' }}>• {f}</p>))
                                      : <p style={{ fontSize: '13px', color: '#9ca3af' }}>None identified</p>}
                                  </div>
                                </div>

                                {/* Committee Summary + Final Verdict */}
                                {(scoreData.committee_summary || scoreData.summary) && (
                                  <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                                    <p style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '8px' }}>Committee Summary</p>
                                    <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.7 }}>{scoreData.committee_summary || scoreData.summary}</p>
                                    {scoreData.final_verdict && (
                                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                                        <p style={{ fontWeight: 600, fontSize: '13px', color: '#1e3a5f' }}>Final Verdict</p>
                                        <p style={{ fontSize: '14px', color: '#374151', fontWeight: 500, marginTop: '4px' }}>{scoreData.final_verdict}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Full transcript */}
                            <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                <p style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Full Interview Transcript</p>
                              </div>
                              <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                                {(session.messages || []).map((msg, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
                                    <div style={{ maxWidth: '75%', backgroundColor: msg.role === 'user' ? '#eef2ff' : '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, color: '#374151' }}>
                                      <span style={{ fontSize: '10px', color: '#9ca3af', display: 'block', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>
                                        {msg.role === 'user' ? 'Candidate' : 'Dr. Mehta'}
                                      </span>
                                      {msg.content}
                                    </div>
                                  </div>
                                ))}
                                {(!session.messages || session.messages.length === 0) && (
                                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '20px' }}>No transcript available</p>
                                )}
                              </div>
                            </div>

                            {/* Integrity log */}
                            {session.integrity_log?.length > 0 && (
                              <div style={{ marginTop: '16px', backgroundColor: '#fef9f0', border: '1px solid #fed7aa', borderRadius: '12px', padding: '16px' }}>
                                <p style={{ fontWeight: 600, fontSize: '13px', color: '#92400e', marginBottom: '12px' }}>⚠ Integrity Events ({session.integrity_log.length})</p>
                                {session.integrity_log.map((log, i) => (
                                  <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', flexShrink: 0, marginTop: '1px' }}>
                                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}
                                    </span>
                                    <span style={{ backgroundColor: '#fed7aa', color: '#92400e', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', flexShrink: 0 }}>
                                      {log.type?.replace(/_/g, ' ')}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{log.reason}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Admin action buttons */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                              <button onClick={() => handleAdminDecision(id, 'selected')} style={{ flex: 1, backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>✅ Select Applicant</button>
                              <button onClick={() => handleAdminDecision(id, 'rejected_final')} style={{ flex: 1, backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>✗ Reject Applicant</button>
                              <button onClick={() => handleAdminDecision(id, 'on_hold')} style={{ flex: 1, backgroundColor: '#f8f9fa', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>⏸ Hold for Review</button>
                            </div>

                            {attemptIndex < interviewSessions.length - 1 && <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '32px 0' }} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Integrity Log */}
              {activeTab === 3 && (
                <div className="space-y-4">
                  {/* Summary metric cards */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Face Warnings', value: testSession?.face_warning_count ?? 0, color: '#d97706' },
                      { label: 'Tab Switches', value: testSession?.tab_switches ?? 0, color: '#2563eb' },
                      { label: 'Audio Violations', value: (testSession?.integrity_log||[]).filter(e=>e.type?.includes('audio')).length, color: '#7c3aed' },
                      { label: 'Terminated', value: testSession?.force_terminated ? 'Yes' : 'No', color: testSession?.force_terminated ? '#dc2626' : '#16a34a' },
                    ].map(m => (
                      <div key={m.label} className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold" style={{color:m.color}}>{m.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Risk assessment */}
                  {(() => {
                    const v = testSession?.integrity_log?.length ?? 0;
                    const ft = testSession?.force_terminated;
                    const [icon,label,rec,style] = ft||v>=5
                      ? ['🔴','High Risk','Manual review required','background:#fef2f2;border:1px solid #fecaca;color:#991b1b']
                      : v>=3 ? ['🟠','Medium Risk','Review recommended','background:#fff7ed;border:1px solid #fed7aa;color:#9a3412']
                      : v>=1 ? ['🟡','Low Risk','Minor violations logged','background:#fffbeb;border:1px solid #fde68a;color:#92400e']
                      : ['🟢','Clean Session','No violations','background:#f0fdf4;border:1px solid #bbf7d0;color:#166534'];
                    return (
                      <div className="rounded-lg p-3 flex items-center gap-3" style={{...Object.fromEntries(style.split(';').map(s=>s.split(':')))}}>
                        <span className="text-2xl">{icon}</span>
                        <div><p className="font-semibold text-sm">{label}</p><p className="text-xs mt-0.5 opacity-80">{rec}</p></div>
                      </div>
                    );
                  })()}

                  {/* Violation timeline */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Violation Timeline</p>
                  {testSession?.integrity_log?.length > 0 ? (
                    <div className="border border-border rounded-lg overflow-hidden divide-y divide-gray-100">
                      {testSession.integrity_log.map((entry, i) => {
                        const ts = entry.timestamp || (entry.ts ? new Date(entry.ts).toISOString() : null);
                        const typeColor = entry.type?.includes('face')||entry.type==='gaze_deviation'||entry.type==='gaze_down'
                          ? 'background:#fef3c7;color:#92400e'
                          : entry.type?.includes('audio')||entry.type==='speaking_detected'
                          ? 'background:#eff6ff;color:#1e40af'
                          : entry.type==='test_terminated'
                          ? 'background:#fef2f2;color:#991b1b'
                          : entry.type==='tab_switch'
                          ? 'background:#f5f3ff;color:#5b21b6'
                          : 'background:#f9fafb;color:#374151';
                        return (
                          <div key={i} className="flex gap-3 px-4 py-3 items-start">
                            <span className="text-xs text-gray-400 w-20 flex-shrink-0 font-mono mt-0.5">
                              {ts ? new Date(ts).toLocaleTimeString() : '—'}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{...Object.fromEntries(typeColor.split(';').map(s=>s.split(':')))}}>
                              {entry.type?.replace(/_/g,' ')}
                            </span>
                            <span className="text-xs text-gray-600 leading-relaxed flex-1">{entry.detail||entry.reason||'—'}</span>
                            {entry.warning_number && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex-shrink-0 ml-auto">
                                Warning {entry.warning_number}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-8">No integrity violations recorded</p>
                  )}
                  {testSession?.session_hash && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Session Hash: <code className="font-mono text-navy">{testSession.session_hash}</code></p>
                    </div>
                  )}
                </div>
              )}



              {/* Raw Data */}
              {activeTab === 4 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Form Data (JSON)</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(JSON.stringify(app.form_data, null, 2)); toast.success('Copied!'); }}
                      className="text-xs text-navy hover:underline"
                    >Copy JSON</button>
                  </div>
                  <pre className="bg-gray-50 border border-border rounded-lg p-4 text-xs text-gray-700 overflow-auto max-h-96 font-mono leading-relaxed">
                    {JSON.stringify(app.form_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin notes */}
      {noteOpen && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4" onClick={() => setNoteOpen(false)}>
          <div className="bg-white rounded-card p-6 max-w-md w-full shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-navy mb-3">Admin Note</h3>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              placeholder="Add a note about this applicant..."
              className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none resize-none mb-3"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={saveNote}>Save Note</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-card p-6 max-w-sm w-full shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-navy mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-gray-500 mb-5">{confirmModal.message}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)}>Cancel</Button>
              <Button variant={confirmModal.variant || 'primary'} size="sm" onClick={confirmModal.action}>{confirmModal.confirmLabel}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-6 py-3 flex items-center gap-3 z-30">
        <div className="flex-1 text-sm text-gray-500">
          <span className="font-medium text-navy">{studentName}</span>
          {app.admin_notes && <span className="ml-2 text-xs italic text-gray-400">Has note</span>}
        </div>
        <Button variant="success" size="sm" onClick={() => setConfirmModal({ title: 'Select Applicant', message: `Mark ${studentName} as Selected?`, action: () => updateStatus('selected'), variant: 'success', confirmLabel: 'Select' })}>
          ✓ Select Applicant
        </Button>
        <Button variant="danger" size="sm" onClick={() => setConfirmModal({ title: 'Reject Applicant', message: `Reject ${studentName}? This will update their status.`, action: () => updateStatus('rejected_s3'), variant: 'danger', confirmLabel: 'Reject' })}>
          ✗ Reject
        </Button>
        <Button variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setConfirmModal({ title: 'Flag for Review', message: 'Flag this applicant for human review?', action: () => { toast('Flagged for review.', { icon: '⚑' }); setConfirmModal(null); }, confirmLabel: 'Flag' })}>
          ⚑ Flag
        </Button>
        <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>Add Note</Button>
        <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> PDF
        </Button>
      </div>

      {/* Bottom spacer for sticky bar */}
      <div className="h-20" />
    </AdminLayout>
  );
}
