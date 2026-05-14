import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { callAI, buildCheatPrompt, parseAIJson } from '../utils/ai';
import { Button, Card, Badge } from '../components/ui';
import WarningModal from '../components/ui/WarningModal';
import { FULL_QUESTION_POOL } from '../data/questionBank';
import { generateTestForStudent, generateSessionHash } from '../utils/testGenerator';
import { loadFaceModels, startFaceMonitoring, stopFaceMonitoring, startAudioMonitoring, stopAudioMonitoring, getCameraBorderColor, getCameraStatusText } from '../utils/faceMonitor';
import toast from 'react-hot-toast';

const SUBJECT_COLORS = {
  Maths: 'bg-blue-50 text-blue-700 border-blue-200',
  Physics: 'bg-purple-50 text-purple-700 border-purple-200',
  Chemistry: 'bg-green-50 text-green-700 border-green-200',
  English: 'bg-amber-50 text-amber-700 border-amber-200',
  Reasoning: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

export default function AptitudeTest() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('pretest'); // pretest | countdown | test | submitting | result
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);
  const [timeLeft, setTimeLeft] = useState(900);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [result, setResult] = useState(null);
  const [application, setApplication] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [devToolsFlag, setDevToolsFlag] = useState(false);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [faceStatus, setFaceStatus] = useState('init');
  const [faceWarnings, setFaceWarnings] = useState(0);
  const [warningReason, setWarningReason] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [integrityLog, setIntegrityLog] = useState([]);
  const [questionIds, setQuestionIds] = useState([]);

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const tabSwitchRef = useRef(0);
  const sessionIdRef = useRef(null);
  const integrityLogRef = useRef([]);
  const devToolsFlagRef = useRef(false);
  const cameraStreamRef = useRef(null);

  useEffect(() => {
    fetchApplicationAndTest();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Use ref, not state — state is stale in cleanup
      if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
      stopFaceMonitoring();
      stopAudioMonitoring();
    };
  }, [user]);

  const fetchApplicationAndTest = async () => {
    // Allow both first-timers (passed_s1) and retry candidates (s2_attempt1_failed)
    const { data: app } = await supabase
      .from('applications')
      .select('*, universities(id)')
      .eq('student_id', user.id)
      .in('status', ['passed_s1', 's2_attempt1_failed'])
      .single();

    if (!app) {
      toast.error('No eligible application found.');
      navigate('/dashboard');
      return;
    }

    // ── Server-side cooldown enforcement ──────────────────────────────────
    if (app.s2_attempts >= 2) {
      toast.error('You have used both Stage 2 attempts.');
      navigate('/dashboard');
      return;
    }

    if (app.status === 's2_attempt1_failed' && app.s2_retry_available_at) {
      const retryAt = new Date(app.s2_retry_available_at);
      if (new Date() < retryAt) {
        const diff = retryAt - new Date();
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        toast.error(`Retry not yet available. Please wait ${hrs}h ${mins}m.`);
        navigate('/dashboard');
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    setApplication(app);
    const currentAttempt = (app.s2_attempts || 0) + 1;
    setAttemptNumber(currentAttempt);

    // Load question pool — prefer DB question_pool, fallback to local bank
    const { data: test } = await supabase
      .from('aptitude_tests')
      .select('*')
      .eq('university_id', app.university_id)
      .single();

    const pool = test?.question_pool?.length > 0 ? test.question_pool : FULL_QUESTION_POOL;
    const timeLimit = test?.time_limit_seconds || 900;

    // For attempt 2, get previous question IDs to exclude
    let excludeIds = [];
    if (currentAttempt === 2) {
      const { data: prevSession } = await supabase
        .from('test_sessions')
        .select('question_ids')
        .eq('application_id', app.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      excludeIds = prevSession?.question_ids || [];
    }

    // Generate randomized test — stable per attempt, unique per student
    const { questions: genQuestions, questionIds: genIds } = generateTestForStudent(
      user.id, pool, excludeIds, currentAttempt
    );
    setQuestions(genQuestions);
    setQuestionIds(genIds);
    setTimeLeft(timeLimit);
  };

  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      cameraStreamRef.current = stream; // store in ref immediately
      setCameraStream(stream);
      setCameraEnabled(true);
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Load face detection models in background
      loadFaceModels().then(ok => {
        if (ok) {
          setFaceStatus('ok');
          toast.success('Face detection active', { duration: 2000 });
        } else {
          toast('Face detection unavailable — session still monitored.', { icon: 'ℹ️', duration: 3000 });
        }
      });
    } catch {
      setCameraError(true);
      setCameraEnabled(false);
      toast('Camera access denied. Your session will be flagged for admin review.', { icon: '⚠️' });
    }
  };

  const startTest = async () => {
    // Create test session in DB
    const { data: session, error: sessionError } = await supabase
      .from('test_sessions')
      .insert({
        application_id: application.id,
        student_id: user.id,
        camera_denied: cameraError,
        status: 'in_progress',
        attempt_number: attemptNumber,
        generated_questions: questions,
        question_ids: questionIds,
        session_hash: generateSessionHash(user.id, Date.now().toString()),
      })
      .select()
      .single();

    if (sessionError || !session) {
      toast.error('Failed to start test session. Please try again.');
      return;
    }

    setSessionId(session.id);
    sessionIdRef.current = session.id;

    // Fullscreen
    try { await document.documentElement.requestFullscreen(); } catch {}

    // Countdown
    setPhase('countdown');
    let c = 3;
    const countdownInterval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c === 0) {
        clearInterval(countdownInterval);
        setPhase('test');
        setStartTime(Date.now());
        startTimer();
        setupAntiCheat(session.id);
      }
    }, 1000);
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit('time_expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const setupAntiCheat = (sid) => {
    // Tab switch detection
    const handleVisibility = async () => {
      if (document.hidden) {
        tabSwitchRef.current += 1;
        setTabSwitches(tabSwitchRef.current);
        logViolation(sid, { type: 'tab_switch', ts: Date.now(), detail: `Tab switch #${tabSwitchRef.current}` });

        await supabase.from('test_sessions').update({ tab_switches: tabSwitchRef.current }).eq('id', sid);

        if (tabSwitchRef.current === 1) {
          toast.error('⚠️ Warning 1/2 — Return to the test immediately!', { duration: 4000 });
        } else if (tabSwitchRef.current === 2) {
          toast.error('🚨 Final warning — One more switch will submit your test!', { duration: 5000 });
        } else if (tabSwitchRef.current >= 3) {
          handleSubmit('tab_limit_exceeded');
        }
      }
    };

    // Window blur (more sensitive than visibility)
    const handleBlur = () => {
      logViolation(sid, { type: 'window_blur', ts: Date.now(), detail: 'Window lost focus' });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());
    document.addEventListener('paste', e => e.preventDefault());

    // Enhanced keyboard blocking
    document.addEventListener('keydown', e => {
      if (e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && ['c', 'v', 'a', 'x', 't', 'w'].includes(e.key.toLowerCase())) ||
        (e.altKey && e.key === 'Tab')) {
        e.preventDefault();
        setDevToolsFlag(true);
        devToolsFlagRef.current = true;
        logViolation(sid, { type: 'blocked_key', ts: Date.now(), detail: `Key: ${e.key}` });
      }
    });

    // Fullscreen exit handler
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        try { document.documentElement.requestFullscreen(); } catch {}
        toast('Please stay in fullscreen during the test.', { icon: '🖥️', duration: 3000 });
        logViolation(sid, { type: 'fullscreen_exit', ts: Date.now(), detail: 'Exited fullscreen' });
      }
    });

    // Face monitoring — use ref values (not stale state)
    if (videoRef.current && cameraStreamRef.current) {
      startFaceMonitoring(videoRef.current, (violation) => {
        setFaceStatus(violation.type);
        logViolation(sid, violation);

        if (['no_face', 'multiple_faces', 'looking_away'].includes(violation.type)) {
          setFaceWarnings(prev => {
            const newCount = prev + 1;
            if (newCount % 3 === 0) {
              const warningNum = Math.floor(newCount / 3);
              setWarningReason(getCameraStatusText(violation.type));
              setShowWarning(true);
              if (warningNum >= 3) {
                handleSubmit('face_violation');
              }
            }
            return newCount;
          });
        } else {
          setFaceStatus('ok');
        }
      });

      // Audio monitoring via stream ref
      startAudioMonitoring(cameraStreamRef.current, (violation) => {
        logViolation(sid, violation);
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      stopFaceMonitoring();
      stopAudioMonitoring();
    };
  };

  const logViolation = async (sid, violation) => {
    integrityLogRef.current = [...integrityLogRef.current, violation];
    setIntegrityLog(integrityLogRef.current);
    // Persist to DB
    await supabase.from('test_sessions').update({
      integrity_log: integrityLogRef.current
    }).eq('id', sid).catch(() => {});
  };

  const selectAnswer = async (optionIndex) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);

    const newAnswers = { ...answers, [currentQ]: optionIndex };
    setAnswers(newAnswers);

    // Save to DB immediately
    if (sessionIdRef.current) {
      await supabase.from('test_sessions').update({ answers: newAnswers }).eq('id', sessionIdRef.current);
    }

    // Auto-advance after 1.2s
    setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ(q => q + 1);
        setSelectedOption(null);
      } else {
        handleSubmit('completed');
      }
    }, 1200);
  };

  const handleSubmit = useCallback(async (reason = 'completed') => {
    if (phase === 'submitting' || phase === 'result') return;
    clearInterval(timerRef.current);

    // Use refs for reliable cleanup — state may be stale
    if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
    stopFaceMonitoring();
    stopAudioMonitoring();

    try {
      await document.exitFullscreen();
    } catch {}

    setPhase('submitting');

    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 900;
    const correct = questions.filter((q, i) => answers[i] === q.correct).length;
    const total = questions.length;
    const score = (correct / total) * 100;

    // AI cheat detection
    let aiFlag = false, aiProbability = 0, aiReason = 'Not analyzed';
    try {
      const { system, user: userMsg } = buildCheatPrompt({
        answers, score, timeTaken,
        tabSwitches: tabSwitchRef.current,
        cameraDenied: cameraError,
        total,
      });
      const cheatRes = await callAI([{ role: 'user', content: userMsg }], system);
      const parsed = parseAIJson(cheatRes);
      if (parsed) {
        aiFlag = parsed.flag;
        aiProbability = parsed.ai_probability;
        aiReason = parsed.reason;
      }
    } catch {}

    // Update session
    const sessionData = {
      answers,
      score,
      correct,
      total,
      time_taken_seconds: timeTaken,
      tab_switches: tabSwitchRef.current,
      camera_denied: cameraError,
      ai_flag: aiFlag || devToolsFlagRef.current,
      ai_flag_reason: devToolsFlagRef.current ? 'DevTools detected' : aiReason,
      ai_probability: aiProbability,
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    if (sessionIdRef.current) {
      await supabase.from('test_sessions').update(sessionData).eq('id', sessionIdRef.current);
    }

    // ── 2-Attempt logic ───────────────────────────────────────────────────
    await handleTestComplete(score, sessionIdRef.current);
    // ─────────────────────────────────────────────────────────────────────

    const subjectBreakdown = {};
    questions.forEach((q, i) => {
      if (!subjectBreakdown[q.subject]) subjectBreakdown[q.subject] = { total: 0, correct: 0 };
      subjectBreakdown[q.subject].total++;
      if (answers[i] === q.correct) subjectBreakdown[q.subject].correct++;
    });

    setResult({ score, correct, total, passed: score >= 60, aiFlag: aiFlag || devToolsFlagRef.current, aiReason, subjectBreakdown, timeTaken, attemptNumber });
    setPhase('result');
  }, [answers, questions, application, cameraStream, cameraError, phase, startTime, attemptNumber]);

  /**
   * 2-attempt handler for Stage 2.
   * Reads current app state to determine attempt number, updates DB accordingly.
   */
  const handleTestComplete = async (score, currentSessionId) => {
    const passed = score >= 60;

    const updates = {
      s2_attempts: attemptNumber,
      s2_best_score: Math.max(score, application.s2_best_score || 0),
    };

    if (attemptNumber === 1) {
      updates.s2_attempt1_session_id = currentSessionId;
    } else {
      updates.s2_attempt2_session_id = currentSessionId;
    }

    if (passed) {
      updates.status = 'passed_s2';
      updates.stage = 3;
    } else if (attemptNumber === 1) {
      // First fail — allow retry after 24 hours
      updates.status = 's2_attempt1_failed';
      updates.s2_retry_available_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } else {
      // Second fail — final rejection
      updates.status = 'rejected_s2_both_attempts';
    }

    await supabase.from('applications').update(updates).eq('id', application.id);
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── PRE-TEST ──
  if (phase === 'pretest') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-navy rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-navy">Aptitude Test — Stage 2</h1>
            <p className="text-gray-500 mt-1">DDS University for Engineering</p>
            {attemptNumber === 2 && (
              <div className="mt-3 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">Attempt 2 of 2 — Final attempt</span>
              </div>
            )}
          </div>

          <Card className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Test Rules</p>
            <div className="space-y-2">
              {[
                { ok: true, text: '15 questions across 5 subjects (Physics, Chemistry, Maths, English, Reasoning)' },
                { ok: true, text: '15 minutes total time — no extensions' },
                { ok: true, text: 'Camera must be enabled for proctoring' },
                { ok: true, text: 'Stay in the test tab at all times' },
                { ok: false, text: 'Right-click is disabled' },
                { ok: false, text: 'Copy-paste is disabled' },
                { ok: false, text: '3 tab switches = automatic submission' },
                { ok: false, text: 'Face detection monitors your presence throughout' },
              ].map((rule, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  {rule.ok
                    ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  }
                  <span className={rule.ok ? 'text-gray-700' : 'text-gray-600'}>{rule.text}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Camera Setup</p>
            {cameraEnabled ? (
              <div className="flex items-center gap-3">
                <video ref={videoRef} autoPlay muted playsInline className="w-24 h-18 rounded-lg object-cover border border-green-200" />
                <div>
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">Camera Active</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Camera feed is active and ready.</p>
                </div>
              </div>
            ) : cameraError ? (
              <div className="flex items-center gap-3 text-amber-700">
                <CameraOff className="w-5 h-5" />
                <div>
                  <p className="text-sm font-semibold">Camera access denied</p>
                  <p className="text-xs text-amber-600 mt-0.5">Your session will be flagged for admin review but you can still take the test.</p>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={enableCamera} className="w-full gap-2">
                <Camera className="w-4 h-4" /> Enable Camera
              </Button>
            )}
          </Card>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={startTest}
            disabled={questions.length === 0}
          >
            {cameraEnabled || cameraError ? 'Begin Test →' : 'Begin Test (without camera)'}
          </Button>
          <p className="text-xs text-gray-400 text-center mt-3">
            The test will open in fullscreen. Do not exit or switch tabs.
          </p>
        </motion.div>
      </div>
    );
  }

  // ── COUNTDOWN ──
  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 bg-navy flex items-center justify-center">
        <motion.div
          key={countdown}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          className="text-white text-center"
        >
          <p className="text-8xl font-bold mb-4">{countdown === 0 ? '🚀' : countdown}</p>
          <p className="text-xl opacity-70">{countdown === 0 ? 'Begin!' : 'Get ready...'}</p>
        </motion.div>
      </div>
    );
  }

  // ── SUBMITTING ──
  if (phase === 'submitting') {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-navy font-semibold text-lg">Submitting your test...</p>
          <p className="text-gray-500 text-sm mt-2">Analyzing answers and running cheat detection</p>
        </div>
      </div>
    );
  }

  // ── RESULT ──
  if (phase === 'result' && result) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full">
          <Card className="text-center mb-4">
            <motion.p
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className={`text-7xl font-bold mb-2 ${result.passed ? 'text-green-600' : 'text-red-600'}`}
            >
              {Math.round(result.score)}%
            </motion.p>
            <p className="text-gray-500 mb-4">{result.correct} / {result.total} correct</p>
            <Badge variant={result.passed ? 'success' : 'error'} className="text-sm px-4 py-1">
              {result.passed
                ? `✓ Passed — ${result.attemptNumber === 2 ? 'on 2nd attempt — ' : ''}Minimum 60% achieved`
                : `✗ Did not pass — Required 60%${result.attemptNumber === 1 ? ' (1 retry available in 24h)' : ' — both attempts used'}`}
            </Badge>
            <p className="text-xs text-gray-400 mt-3">
              Completed in {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s · Attempt {result.attemptNumber} of 2
            </p>
          </Card>

          {result.aiFlag && (
            <div className="bg-amber-50 border border-amber-200 rounded-card p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Your session has been flagged for review</p>
                  <p className="text-xs text-amber-700 mt-1">This does not automatically disqualify you. A human reviewer will assess your session before any decision is made.</p>
                </div>
              </div>
            </div>
          )}

          <Card className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Subject Breakdown</p>
            <div className="space-y-2">
              {Object.entries(result.subjectBreakdown).map(([sub, data]) => (
                <div key={sub} className="flex items-center justify-between">
                  <Badge variant={sub.toLowerCase()}>{sub}</Badge>
                  <span className="text-sm font-semibold text-navy">{data.correct}/{data.total}</span>
                </div>
              ))}
            </div>
          </Card>

          <Button variant="primary" className="w-full" onClick={() => navigate('/dashboard')}>
            {result.passed ? '→ Go to Dashboard (Interview unlocked!)' : '→ Go to Dashboard'}
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── TEST ──
  const question = questions[currentQ];
  if (!question) return null;

  return (
    <div className="fixed inset-0 bg-bg no-select flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-navy">Question {currentQ + 1} of {questions.length}</span>
          {tabSwitches > 0 && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              {tabSwitches} tab switch{tabSwitches > 1 ? 'es' : ''}
            </Badge>
          )}
          <Badge variant="default" className="text-xs">Attempt {attemptNumber}/2</Badge>
        </div>
        <div className={`text-xl font-bold font-mono ${timeLeft <= 120 ? 'timer-danger' : 'text-navy'}`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Camera preview with face detection status */}
      {cameraEnabled && cameraStream && (
        <div className="fixed top-4 right-4 z-50">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-24 h-18 rounded-lg object-cover shadow-sm"
            style={{ border: `3px solid ${getCameraBorderColor(faceStatus)}` }}
          />
          <p className="text-center mt-1" style={{ fontSize: '9px', color: getCameraBorderColor(faceStatus), fontWeight: 600 }}>
            {getCameraStatusText(faceStatus)}
          </p>
        </div>
      )}

      {/* Face detection warning modal */}
      {showWarning && (
        <WarningModal
          warningNumber={Math.floor(faceWarnings / 3)}
          maxWarnings={3}
          reason={warningReason}
          onDismiss={() => setShowWarning(false)}
        />
      )}

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-navy transition-all duration-300"
          style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-xl w-full"
        >
          <div className="mb-4">
            <Badge className={`border ${SUBJECT_COLORS[question.subject] || 'bg-gray-50 text-gray-600'}`}>
              {question.subject}
            </Badge>
          </div>
          <p className="text-lg font-medium text-gray-900 mb-6 leading-relaxed">{question.question}</p>

          <div className="space-y-3">
            {question.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const isCorrect = selectedOption !== null && i === question.correct;
              const isWrong = isSelected && i !== question.correct;

              return (
                <motion.button
                  key={i}
                  whileHover={selectedOption === null ? { scale: 1.01 } : {}}
                  onClick={() => selectAnswer(i)}
                  disabled={selectedOption !== null}
                  className={`w-full text-left px-4 py-3.5 rounded-card border transition-all text-sm font-medium flex items-center gap-3 ${
                    isCorrect
                      ? 'bg-green-50 border-green-400 text-green-800'
                      : isWrong
                      ? 'bg-red-50 border-red-400 text-red-800'
                      : isSelected
                      ? 'bg-navy border-navy text-white'
                      : 'bg-white border-border text-gray-800 hover:border-navy hover:bg-navy-50 cursor-pointer'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border ${
                    isCorrect ? 'bg-green-500 border-green-500 text-white' :
                    isWrong ? 'bg-red-500 border-red-500 text-white' :
                    isSelected ? 'bg-white border-white text-navy' :
                    'border-gray-300 text-gray-500'
                  }`}>
                    {isCorrect ? '✓' : isWrong ? '✗' : 'ABCD'[i]}
                  </span>
                  {opt}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
