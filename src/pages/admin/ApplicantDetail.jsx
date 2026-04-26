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

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    toast('Generating PDF...', { icon: '📄' });
    const canvas = await html2canvas(reportRef.current, { scale: 1.5, useCORS: true });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 297));
    pdf.save(`aria-${app.students?.name?.replace(/\s+/g, '-')}-report.pdf`);
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
        <span className="text-navy font-medium">{app.students?.name}</span>
      </div>

      <div ref={reportRef} className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3">
                {app.students?.name?.charAt(0) || 'S'}
              </div>
              <h2 className="text-card-title font-semibold text-navy">{app.students?.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{app.students?.email}</p>
              {app.students?.phone && <p className="text-xs text-gray-500">{app.students?.phone}</p>}
              <p className="text-xs text-gray-500 mt-1">{app.students?.city}</p>
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

              {/* Interview */}
              {activeTab === 2 && (
                <div className="space-y-5">
                  {!interviewSession ? (
                    <p className="text-sm text-gray-400 text-center py-8">Interview not yet completed</p>
                  ) : (
                    <>
                      {/* Score header with grade & recommendation */}
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-5xl font-bold text-navy">{interviewSession.final_score ? Math.round(interviewSession.final_score) : '—'}</p>
                          <p className="text-xs text-gray-400">/ 100</p>
                        </div>
                        <div className="space-y-1">
                          {interviewSession.interview_grade && (
                            <Badge variant={GRADE_BADGE[interviewSession.interview_grade] || 'default'} className="text-sm">
                              Grade: {interviewSession.interview_grade}
                            </Badge>
                          )}
                          {interviewSession.recommendation && (
                            <Badge variant={
                              interviewSession.recommendation === 'Strong Admit' ? 'success' :
                              interviewSession.recommendation === 'Admit' ? 'info' :
                              interviewSession.recommendation === 'Waitlist' ? 'warning' : 'error'
                            } className="text-sm">
                              {interviewSession.recommendation}
                            </Badge>
                          )}
                          {interviewSession.admit_confidence != null && (
                            <p className="text-xs text-gray-500">Confidence: {Math.round(interviewSession.admit_confidence)}%</p>
                          )}
                        </div>
                      </div>

                      {/* Assessment summary */}
                      {interviewSession.final_assessment && (
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{interviewSession.final_assessment}</p>
                      )}

                      {/* 5-dimension scoring */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Evaluation Dimensions</p>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { label: 'Project Depth (30%)', value: interviewSession.project_depth_score || interviewSession.depth_score, color: '#4f46e5' },
                            { label: 'Academic Understanding (20%)', value: interviewSession.academic_understanding_score, color: '#0891b2' },
                            { label: 'Communication (15%)', value: interviewSession.communication_score, color: '#059669' },
                            { label: 'Motivation Clarity (15%)', value: interviewSession.motivation_clarity_score || interviewSession.enthusiasm_score, color: '#d97706' },
                            { label: 'Problem Solving (20%)', value: interviewSession.problem_solving_score, color: '#dc2626' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-gray-600 font-medium">{label}</p>
                                <p className="text-xs font-bold" style={{ color }}>{value ? Math.round(value) : '—'}</p>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${value || 0}%`, background: color }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Strengths & Red Flags */}
                      <div className="grid grid-cols-2 gap-3">
                        {interviewSession.key_strengths?.length > 0 && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-800 mb-2">Key Strengths</p>
                            <ul className="space-y-1">
                              {interviewSession.key_strengths.map((s, i) => (
                                <li key={i} className="text-xs text-green-700 flex items-start gap-1.5">
                                  <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />{s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {interviewSession.red_flags?.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs font-semibold text-red-800 mb-2">Red Flags</p>
                            <ul className="space-y-1">
                              {interviewSession.red_flags.map((f, i) => (
                                <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Attempt info */}
                      <div className="flex gap-2">
                        <Badge variant="default">Attempt {interviewSession.attempt_number || 1}/2</Badge>
                        <Badge variant="default">
                          {interviewSession.question_count || '?'} questions
                        </Badge>
                      </div>

                      {/* Transcript */}
                      {interviewSession.messages?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Interview Transcript</p>
                          <div className="space-y-3 max-h-80 overflow-y-auto chat-scroll">
                            {interviewSession.messages.map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-sm rounded-card px-3 py-2 text-xs ${msg.role === 'aria' ? 'bg-gray-50 border border-border text-gray-700' : 'bg-navy text-white'}`}>
                                  <p className={`text-xs font-semibold mb-1 ${msg.role === 'aria' ? 'text-navy' : 'text-blue-200'}`}>
                                    {msg.role === 'aria' ? 'Aria' : 'Student'}
                                  </p>
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Integrity Log */}
              {activeTab === 3 && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Proctoring & Integrity Events</p>
                  {testSession?.integrity_log?.length > 0 ? (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-border">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-500">#</th>
                            <th className="text-left px-3 py-2 text-gray-500">Type</th>
                            <th className="text-left px-3 py-2 text-gray-500">Detail</th>
                            <th className="text-left px-3 py-2 text-gray-500">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testSession.integrity_log.map((entry, i) => (
                            <tr key={i} className="border-b border-border last:border-0">
                              <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                              <td className="px-3 py-2">
                                <Badge variant={
                                  ['multiple_faces', 'tab_switch'].includes(entry.type) ? 'error' :
                                  ['no_face', 'looking_away', 'loud_audio'].includes(entry.type) ? 'warning' : 'default'
                                }>{entry.type}</Badge>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{entry.detail}</td>
                              <td className="px-3 py-2 text-gray-400">{entry.ts ? new Date(entry.ts).toLocaleTimeString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-8">No integrity violations recorded</p>
                  )}
                  {/* Session hash */}
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
          <span className="font-medium text-navy">{app.students?.name}</span>
          {app.admin_notes && <span className="ml-2 text-xs italic text-gray-400">Has note</span>}
        </div>
        <Button variant="success" size="sm" onClick={() => setConfirmModal({ title: 'Select Applicant', message: `Mark ${app.students?.name} as Selected?`, action: () => updateStatus('selected'), variant: 'success', confirmLabel: 'Select' })}>
          ✓ Select Applicant
        </Button>
        <Button variant="danger" size="sm" onClick={() => setConfirmModal({ title: 'Reject Applicant', message: `Reject ${app.students?.name}? This will update their status.`, action: () => updateStatus('rejected_s3'), variant: 'danger', confirmLabel: 'Reject' })}>
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
