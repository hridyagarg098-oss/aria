import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle, XCircle, Lock, ChevronDown, ChevronUp,
  Clock, AlertTriangle, ArrowRight, BarChart2, Target, TrendingUp, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button, Card, Badge, Skeleton, ProgressBar, STATUS_LABELS } from '../components/ui';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// ── Retry countdown timer ──────────────────────────────────────────────────
function RetryCountdown({ availableAt, onUnlock }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(availableAt) - new Date();
      if (diff <= 0) { setTimeLeft(''); onUnlock(); clearInterval(interval); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [availableAt]);
  if (!timeLeft) return null;
  return (
    <div className="flex items-center gap-2 text-amber-600 font-mono text-sm mt-2">
      <Clock className="w-3.5 h-3.5" />
      Retry available in <span className="font-bold">{timeLeft}</span>
    </div>
  );
}

const fadeIn = { hidden: { opacity: 0, y: 16 }, visible: i => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.3 } }) };

export default function Dashboard() {
  const { user, studentProfile } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [testSession, setTestSession] = useState(null);
  const [interviewSession, setInterviewSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [comparisons, setComparisons] = useState(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Get application
      const { data: app } = await supabase
        .from('applications')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setApplication(app || null);

      if (app) {
        // Get test session
        const { data: ts } = await supabase
          .from('test_sessions')
          .select('*')
          .eq('application_id', app.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .single();
        setTestSession(ts || null);

        // Get interview session
        const { data: is_ } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('application_id', app.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .single();
        setInterviewSession(is_ || null);

        // Get comparison stats (% better than)
        if (app.ai_score) {
          const { count } = await supabase
            .from('applications')
            .select('id', { count: 'exact' })
            .lt('ai_score', app.ai_score)
            .eq('branch', app.branch);
          const { count: totalCount } = await supabase
            .from('applications')
            .select('id', { count: 'exact' })
            .eq('branch', app.branch);
          if (totalCount > 1) {
            setComparisons({ better: count, total: totalCount, pct: Math.round((count / (totalCount - 1)) * 100) });
          }
        }
      }
    } catch (err) {
      console.warn('Dashboard fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  const gradeColor = (grade) => {
    const map = { 'A+': 'success', 'A': 'success', 'B+': 'info', 'B': 'info', 'C': 'warning' };
    return map[grade] || 'default';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <DashboardNav name={studentProfile?.name} onSignOut={() => navigate('/')} />
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
          <Skeleton className="h-20" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-bg">
        <DashboardNav name={studentProfile?.name} onSignOut={() => navigate('/')} />
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-navy/5 rounded-full flex items-center justify-center mx-auto mb-5">
              <BarChart2 className="w-8 h-8 text-navy/30" />
            </div>
            <h2 className="text-section-head text-navy mb-2">No application yet</h2>
            <p className="text-gray-500 mb-6">Start your DDS University application — takes about 10 minutes.</p>
            <Link to="/apply"><Button variant="primary" size="lg">Begin Application</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const name = studentProfile?.name || application.form_data?.name || 'Student';
  const st = application.status;

  // Stage 1 flags
  const stage1Done = st !== 'pending';
  const stage1Passed = ['passed_s1','passed_s2','s2_attempt1_failed','rejected_s2_both_attempts',
    'interview','s3_attempt1_failed','rejected_s3_both_attempts','selected','rejected_s3'].includes(st);
  const stage1Rejected = st === 'rejected_s1';

  // Stage 2 flags
  const stage2Locked = !stage1Passed;
  const stage2Ready = st === 'passed_s1';
  const stage2Passed1 = st === 'passed_s2' && application.s2_attempts === 1;
  const stage2Passed2 = st === 'passed_s2' && application.s2_attempts === 2;
  const stage2Passed  = ['passed_s2','interview','s3_attempt1_failed','rejected_s3_both_attempts','selected','rejected_s3'].includes(st);
  const stage2Fail1   = st === 's2_attempt1_failed';
  const stage2BothFail= st === 'rejected_s2_both_attempts';
  const stage2Done    = (application.s2_attempts || 0) > 0;

  const s2RetryReady  = stage2Fail1 && application.s2_retry_available_at && new Date(application.s2_retry_available_at) <= new Date();
  const s2RetryWait   = stage2Fail1 && application.s2_retry_available_at && new Date(application.s2_retry_available_at) > new Date();

  // Stage 3 flags
  const stage3Locked   = !stage2Passed;
  const stage3Done     = interviewSession?.status === 'completed';
  const stage3Selected = st === 'selected';
  const stage3Fail1    = st === 's3_attempt1_failed';
  const stage3BothFail = st === 'rejected_s3_both_attempts';
  const s3RetryReady   = stage3Fail1 && application.s3_retry_available_at && new Date(application.s3_retry_available_at) <= new Date();
  const s3RetryWait    = stage3Fail1 && application.s3_retry_available_at && new Date(application.s3_retry_available_at) > new Date();

  const stage1Status = st; // keep for existing feedback block

  const pcmAvg = application.form_data
    ? ((+application.form_data.physics + +application.form_data.chemistry + +application.form_data.maths) / 3).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav name={name} onSignOut={() => navigate('/')} />

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <motion.div custom={0} variants={fadeIn} initial="hidden" animate="visible" className="mb-8">
          <h1 className="text-2xl font-bold text-navy">Welcome back, {name.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 mt-1">
            Application to DDS University for Engineering — <span className="font-medium text-navy">{application.branch}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1 font-mono">Application ID: {application.id.slice(0, 8).toUpperCase()}</p>
        </motion.div>

        {/* Percentile comparison card (enhanced feature) */}
        {comparisons && comparisons.total > 2 && (
          <motion.div custom={0.5} variants={fadeIn} initial="hidden" animate="visible" className="mb-5">
            <Card className="bg-gold-bg border-yellow-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">You scored better than {comparisons.pct}% of applicants in {application.branch.split(' ')[0]}</p>
                    <p className="text-xs text-amber-600 mt-0.5">Based on {comparisons.total} applicants in your branch so far</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-700">{comparisons.pct}%</span>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Stage 1 */}
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible" className="mb-4">
          <Card className={`border-l-4 ${stage1Rejected ? 'border-l-red-500' : stage1Passed ? 'border-l-green-500' : 'border-l-amber-400'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {stage1Passed
                  ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  : stage1Rejected
                  ? <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  : <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin flex-shrink-0" />
                }
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Stage 1</p>
                  <h3 className="text-card-title font-semibold text-navy">Application Review</h3>
                </div>
              </div>
              {application.ai_score && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-navy">{Math.round(application.ai_score)}</p>
                  <p className="text-xs text-gray-400">/ 100</p>
                </div>
              )}
            </div>

            {stage1Passed && application.ai_score && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={gradeColor(application.ai_grade)}>Grade: {application.ai_grade}</Badge>
                  <Badge variant="info">{STATUS_LABELS[application.status]}</Badge>
                </div>

                <button
                  onClick={() => setFeedbackOpen(!feedbackOpen)}
                  className="flex items-center gap-2 text-sm font-semibold text-navy hover:text-navy-light transition-colors"
                >
                  {feedbackOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {feedbackOpen ? 'Hide Feedback' : 'View AI Feedback'}
                </button>

                {feedbackOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 space-y-4">
                    {application.ai_academic_remark && (
                      <p className="text-sm text-gray-500 italic border-l-2 border-gray-200 pl-3">{application.ai_academic_remark}</p>
                    )}
                    {application.ai_feedback && (
                      <p className="text-sm text-gray-700">{application.ai_feedback}</p>
                    )}
                    {application.ai_strengths?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Strengths</p>
                        <ul className="space-y-1.5">
                          {application.ai_strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {application.ai_improvements?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Areas to Improve</p>
                        <ul className="space-y-1.5">
                          {application.ai_improvements.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                              <Target className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {application.ai_improvements && (
                      <p className="text-sm font-semibold text-amber-700 bg-gold-bg border border-yellow-200 rounded-lg px-3 py-2">
                        💡 Stage 2 tip: Focus on accuracy in Physics and Maths sections.
                      </p>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {stage1Rejected && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-gray-700">
                  Your application was reviewed. Unfortunately you do not meet the following criteria:
                </p>
                <div className="space-y-2">
                  {application.eligibility_result?.failures?.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> ✗ {f}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-3">
                  Note: Misrepresented scores are verified against official board records.
                </p>
                <div className="bg-gold-bg border border-yellow-200 rounded-card p-4 mt-2">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Next steps</p>
                  <p className="text-xs text-amber-700">Work on improving the areas listed above and reapply in the next admissions cycle. Consider coaching for subjects where you fell short.</p>
                </div>
              </div>
            )}

            {!stage1Done && (
              <p className="text-sm text-gray-500 mt-3">Aria AI is reviewing your application...</p>
            )}
          </Card>
        </motion.div>

        {/* Stage 2 */}
        <motion.div custom={2} variants={fadeIn} initial="hidden" animate="visible" className="mb-4">
          <Card className={`border-l-4 ${
            stage2Locked ? 'border-l-gray-200'
            : stage2BothFail ? 'border-l-red-500'
            : stage2Fail1 ? 'border-l-amber-400'
            : stage2Passed ? 'border-l-green-500'
            : 'border-l-amber-400'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {stage2Locked ? <Lock className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  : stage2BothFail ? <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  : stage2Passed ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  : stage2Fail1 ? <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  : <div className="w-2 h-2 rounded-full bg-amber-400 pulse-dot flex-shrink-0 mt-2" />}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Stage 2</p>
                  <h3 className={`text-card-title font-semibold ${stage2Locked ? 'text-gray-400' : 'text-navy'}`}>Aptitude Test</h3>
                </div>
              </div>
              {application.s2_best_score > 0 && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-navy">{Math.round(application.s2_best_score)}%</p>
                  <p className="text-xs text-gray-400">best score</p>
                </div>
              )}
            </div>

            {/* STATE: locked */}
            {stage2Locked && <p className="text-sm text-gray-400 mt-3">Complete Stage 1 to unlock this step.</p>}

            {/* STATE: ready (0 attempts) */}
            {stage2Ready && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  {[['Maths','7 Qs'],['Physics','5 Qs'],['Chemistry','3 Qs']].map(([sub,count]) => (
                    <div key={sub} className="bg-gray-50 border border-border rounded-lg p-2">
                      <p className="font-semibold text-navy">{sub}</p><p className="text-gray-500">{count}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Camera required · Do not switch tabs · 2 attempts available
                </p>
                <Link to="/test"><Button variant="primary" className="w-full">Begin Aptitude Test →</Button></Link>
              </div>
            )}

            {/* STATE: passed on attempt 1 */}
            {stage2Passed1 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-700">Passed — Score: {Math.round(application.s2_best_score)}% (Attempt 1)</span>
                </div>
                <Link to="/interview"><Button variant="gold" className="w-full gap-2 mt-2">Proceed to Stage 3 <ArrowRight className="w-4 h-4" /></Button></Link>
              </div>
            )}

            {/* STATE: passed on attempt 2 */}
            {stage2Passed2 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-700">Passed on 2nd attempt — Score: {Math.round(application.s2_best_score)}%</span>
                </div>
                <Link to="/interview"><Button variant="gold" className="w-full gap-2 mt-2">Proceed to Stage 3 <ArrowRight className="w-4 h-4" /></Button></Link>
              </div>
            )}

            {/* STATE: attempt 1 failed — retry pending or available */}
            {stage2Fail1 && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">Attempt 1: {Math.round(application.s2_best_score || 0)}% (Pass mark: 60%)</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">You have 1 remaining attempt</p>
                  {s2RetryWait && (
                    <RetryCountdown availableAt={application.s2_retry_available_at} onUnlock={fetchData} />
                  )}
                  {s2RetryReady && (
                    <Link to="/test" className="mt-2 block">
                      <Button variant="primary" className="w-full gap-2">
                        <RefreshCw className="w-4 h-4" /> Retry Stage 2
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* STATE: both attempts failed */}
            {stage2BothFail && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">Stage 2 closed — Both attempts used</span>
                </div>
                <p className="text-xs text-gray-500">Best score: {Math.round(application.s2_best_score || 0)}%</p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                  <p className="text-sm text-red-700">Your application to DDS University has been closed.</p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Stage 3 */}
        <motion.div custom={3} variants={fadeIn} initial="hidden" animate="visible">
          <Card className={`border-l-4 ${
            stage3Locked ? 'border-l-gray-200'
            : stage3BothFail ? 'border-l-red-500'
            : stage3Fail1 ? 'border-l-amber-400'
            : stage3Selected ? 'border-l-green-500'
            : stage3Done ? 'border-l-navy'
            : 'border-l-navy'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {stage3Locked ? <Lock className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  : stage3BothFail ? <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  : stage3Fail1 ? <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  : stage3Done ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  : <div className="w-2 h-2 rounded-full bg-navy pulse-dot flex-shrink-0 mt-2" />}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Stage 3</p>
                  <h3 className={`text-card-title font-semibold ${stage3Locked ? 'text-gray-400' : 'text-navy'}`}>AI Interview</h3>
                </div>
              </div>
              {application.s3_best_score > 0 && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-navy">{Math.round(application.s3_best_score)}</p>
                  <p className="text-xs text-gray-400">/ 100 best</p>
                </div>
              )}
            </div>

            {stage3Locked && <p className="text-sm text-gray-400 mt-3">Unlocks after you pass Stage 2.</p>}

            {/* Ready for first attempt */}
            {!stage3Locked && !stage3Done && !stage3Fail1 && !stage3BothFail && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-navy">~15 minutes · Personalized to your application.</span>{' '}
                  The AI has read your application and will ask specific questions about your projects.
                </p>
                <Link to="/interview"><Button variant="gold" className="w-full gap-2">Start AI Interview <ArrowRight className="w-4 h-4" /></Button></Link>
              </div>
            )}

            {/* Attempt 1 failed — waiting or retry ready */}
            {stage3Fail1 && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">Attempt 1: {Math.round(application.s3_best_score || 0)}/100 (Pass mark: 50)</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">You have 1 remaining interview attempt</p>
                  {s3RetryWait && (
                    <RetryCountdown availableAt={application.s3_retry_available_at} onUnlock={fetchData} />
                  )}
                  {s3RetryReady && (
                    <Link to="/interview" className="mt-2 block">
                      <Button variant="primary" className="w-full gap-2">
                        <RefreshCw className="w-4 h-4" /> Retry Stage 3 Interview
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Both attempts failed */}
            {stage3BothFail && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">Stage 3 closed — Both attempts used</span>
                </div>
                <p className="text-xs text-gray-500">Best score: {Math.round(application.s3_best_score || 0)}/100</p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                  <p className="text-sm text-red-700">Your application to DDS University has been closed.</p>
                </div>
              </div>
            )}

            {/* Interview submitted / selected */}
            {stage3Done && !stage3Fail1 && !stage3BothFail && (
              <div className="mt-3 space-y-2">
                <Badge variant={stage3Selected ? 'success' : 'navy'}>
                  {stage3Selected ? '🎉 Selected!' : 'Interview Submitted'}
                </Badge>
                <p className="text-sm text-gray-600">DDS University admissions team is reviewing your full assessment. You will hear back within 5-7 business days.</p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function DashboardNav({ name, onSignOut }) {
  const { signOut } = useAuth();
  return (
    <nav className="bg-white border-b border-border px-6 py-4 flex items-center justify-between">
      <div>
        <span className="font-bold text-navy">DDS University</span>
        <span className="text-gray-300 mx-2">·</span>
        <span className="text-sm text-gray-500">Admissions Portal</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">{name}</span>
        <Button variant="outline" size="sm" onClick={() => { signOut(); onSignOut(); }}>Sign Out</Button>
      </div>
    </nav>
  );
}
