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
import { loadFaceModels, stopFaceMonitoring, stopAudioMonitoring } from '../utils/faceMonitor';
import toast from 'react-hot-toast';

const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'English', 'Reasoning'];
const SUBJECT_COLORS = {
  Maths: 'bg-blue-50 text-blue-700 border-blue-200',
  Physics: 'bg-purple-50 text-purple-700 border-purple-200',
  Chemistry: 'bg-green-50 text-green-700 border-green-200',
  English: 'bg-amber-50 text-amber-700 border-amber-200',
  Reasoning: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};
const STATUS_COLORS = {
  not_visited: 'bg-gray-100 text-gray-500 border border-gray-300',
  not_answered: 'bg-red-500 text-white',
  answered: 'bg-green-500 text-white',
  marked_review: 'bg-purple-500 text-white',
  answered_marked: 'bg-purple-700 text-white',
};
export default function AptitudeTest() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Phases ─────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('pretest');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ── JEE-style answer/status state ──────────────────────────────────────
  const [answers, setAnswers] = useState({});
  const [questionStatuses, setQuestionStatuses] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);

  // ── Anti-cheat / proctoring state ──────────────────────────────────────
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
  // ── New proctoring state ────────────────────────────────────────────────
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsLoadingMsg, setModelsLoadingMsg] = useState('Initializing proctoring...');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('loading');
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveWarning, setLiveWarning] = useState(null);
  const [formalWarning, setFormalWarning] = useState(null);
  const [timerPaused, setTimerPaused] = useState(false);
  const [testTerminated, setTestTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);
  const [testStarted, setTestStarted] = useState(false);

  // ── UI-only state ───────────────────────────────────────────────────────
  const [activePaletteSubject, setActivePaletteSubject] = useState('Physics');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showNoCameraModal, setShowNoCameraModal] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const pretestVideoRef = useRef(null); // separate ref for pretest preview
  const timerRef = useRef(null);
  const tabSwitchRef = useRef(0);
  const sessionIdRef = useRef(null);
  const integrityLogRef = useRef([]);
  const devToolsFlagRef = useRef(false);
  const cameraStreamRef = useRef(null);
  const answersRef = useRef({});
  const questionStatusesRef = useRef({});
  const timerPausedRef = useRef(false);
  const detectionIntervalRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const noFaceSecondsRef = useRef(0);
  const lookAwaySecondsRef = useRef(0);
  const multipleFaceCountRef = useRef(0);
  const lipMoveCountRef = useRef(0);
  const warningCountRef = useRef(0);
  const lastViolationRef = useRef('');

  useEffect(() => {
    // Dynamically load face-api.js only on this page (not globally)
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js';
    script.async = true;
    script.onload = async () => {
      console.log('face-api.js loaded dynamically');
      const faceapi = window.faceapi;
      if (faceapi) {
        try {
          const ok = await loadFaceModels((msg) => setModelsLoadingMsg(msg));
          setModelsLoaded(ok);
        } catch { setModelsLoaded(false); }
      }
      setModelsLoading(false);
    };
    script.onerror = () => {
      console.warn('face-api.js failed to load');
      setModelsLoaded(false);
      setModelsLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(detectionIntervalRef.current);
      clearInterval(audioIntervalRef.current);
      if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
      try { document.head.removeChild(script); } catch {}
    };
  }, []);

  useEffect(() => { if (user) fetchApplicationAndTest(); }, [user]);

  // Keep refs in sync with state
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionStatusesRef.current = questionStatuses; }, [questionStatuses]);

  // Attach camera stream to the test-phase camera indicator when phase becomes 'test'
  useEffect(() => {
    if (phase === 'test' && cameraStreamRef.current) {
      const t = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = cameraStreamRef.current;
          videoRef.current.play().catch(() => {});
        }
      }, 150);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Attach camera stream to the pretest preview video when camera is enabled
  useEffect(() => {
    if (cameraEnabled && phase === 'pretest' && cameraStreamRef.current) {
      const t = setTimeout(() => {
        if (pretestVideoRef.current) {
          pretestVideoRef.current.srcObject = cameraStreamRef.current;
          pretestVideoRef.current.play().catch(() => {});
        }
      }, 100);
      return () => clearTimeout(t);
    }
  }, [cameraEnabled, phase]);


  const fetchApplicationAndTest = async () => {
    const { data: app } = await supabase
      .from('applications')
      .select('*, universities(id)')
      .eq('student_id', user.id)
      .in('status', ['passed_s1', 's2_attempt1_failed'])
      .single();
    if (!app) { toast.error('No eligible application found.'); navigate('/dashboard'); return; }
    if (app.s2_attempts >= 2) { toast.error('You have used both Stage 2 attempts.'); navigate('/dashboard'); return; }
    if (app.status === 's2_attempt1_failed' && app.s2_retry_available_at) {
      const retryAt = new Date(app.s2_retry_available_at);
      if (new Date() < retryAt) {
        const diff = retryAt - new Date();
        const hrs = Math.floor(diff / 3600000); const mins = Math.floor((diff % 3600000) / 60000);
        toast.error(`Retry not yet available. Please wait ${hrs}h ${mins}m.`); navigate('/dashboard'); return;
      }
    }
    setApplication(app);
    const currentAttempt = (app.s2_attempts || 0) + 1;
    setAttemptNumber(currentAttempt);
    const { data: test } = await supabase.from('aptitude_tests').select('*').eq('university_id', app.university_id).single();
    const pool = test?.question_pool?.length > 0 ? test.question_pool : FULL_QUESTION_POOL;
    const timeLimit = test?.time_limit_seconds || 900;
    let excludeIds = [];
    if (currentAttempt === 2) {
      const { data: prevSession } = await supabase.from('test_sessions').select('question_ids').eq('application_id', app.id).order('started_at', { ascending: false }).limit(1).single();
      excludeIds = prevSession?.question_ids || [];
    }
    const { questions: genQuestions, questionIds: genIds } = generateTestForStudent(user.id, pool, excludeIds, currentAttempt);
    const SUBJECT_ORDER = ['Physics', 'Chemistry', 'Maths', 'English', 'Reasoning'];
    const sortedQuestions = [...genQuestions].sort(
      (a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject)
    );
    const sortedIds = sortedQuestions.map(q => q.id);
    setQuestions(sortedQuestions);
    setQuestionIds(sortedIds);
    setTimeLeft(timeLimit);
    // Init question statuses
    const initStatuses = sortedQuestions.reduce((acc, q) => ({ ...acc, [q.id]: 'not_visited' }), {});
    setQuestionStatuses(initStatuses);
    questionStatusesRef.current = initStatuses;
    if (sortedQuestions.length > 0) setActivePaletteSubject(sortedQuestions[0].subject);
  };

  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 15 } },
        audio: true
      });
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setCameraEnabled(true);
      toast.success('Camera ready — click "Begin Test" to start', { duration: 3000 });
      // Video element will mount on next render via cameraEnabled state,
      // then the useEffect on phase will attach the stream
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError(true); setCameraEnabled(false);
      toast('Camera access denied. Your session will be flagged for admin review.', { icon: '⚠️' });
    }
  };

  const handleEnableAndBegin = async () => {
    // Step 1: If camera not yet enabled, enable it first and stop here
    if (!cameraEnabled && !cameraError) {
      await enableCamera();
      return; // Don't auto-start test — let user click again to begin
    }
    // Step 2: Camera is already enabled (or denied) — start the test
    startTest();
  };

  const startTest = async () => {
    const { data: session, error: sessionError } = await supabase.from('test_sessions').insert({
      application_id: application.id, student_id: user.id, camera_denied: cameraError,
      status: 'in_progress', attempt_number: attemptNumber, generated_questions: questions,
      question_ids: questionIds, session_hash: generateSessionHash(user.id, Date.now().toString()),
    }).select().single();
    if (sessionError || !session) { toast.error('Failed to start test session. Please try again.'); return; }
    setSessionId(session.id); sessionIdRef.current = session.id;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) { try { await document.documentElement.requestFullscreen(); } catch {} }
    setPhase('countdown');
    let c = 3;
    const ci = setInterval(() => { c--; setCountdown(c); if (c === 0) { clearInterval(ci); setPhase('test'); setTestStarted(true); setStartTime(Date.now()); startTimer(); } }, 1000);
    // Mark first question as not_answered
    if (questions.length > 0) updateStatus(questions[0].id, 'not_answered');
    // Start new proctoring engine
    if (cameraStreamRef.current) startProctoringEngine(cameraStreamRef.current);
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      if (timerPausedRef.current) return;
      setTimeLeft(prev => { if (prev <= 1) { clearInterval(timerRef.current); handleSubmit('time_expired'); return 0; } return prev - 1; });
    }, 1000);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ANTI-CHEAT useEffect #1 — Tab switch + window blur detection
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!testStarted) return;
    let switchCount = 0;
    let cooldown = false;
    const handleSwitch = (source) => {
      if (cooldown) return;
      cooldown = true;
      setTimeout(() => { cooldown = false; }, 2000);
      switchCount += 1;
      tabSwitchRef.current = switchCount;
      setTabSwitches(switchCount);
      console.log('[ANTI-CHEAT] TAB SWITCH #' + switchCount, source);
      const entry = { timestamp: new Date().toISOString(), type: 'tab_switch', detail: `Switch #${switchCount} (${source})` };
      integrityLogRef.current = [...integrityLogRef.current, entry];
      if (sessionIdRef.current) {
        supabase.from('test_sessions').update({ tab_switches: switchCount, integrity_log: integrityLogRef.current }).eq('id', sessionIdRef.current).catch(() => {});
      }
      if (switchCount === 1) {
        toast.error('⚠️ Warning 1/3 — Tab switch detected! Return immediately.', { duration: 5000 });
      } else if (switchCount === 2) {
        warningCountRef.current += 1;
        timerPausedRef.current = true; setTimerPaused(true);
        setFormalWarning({ type: 'tab_switch', reason: 'You switched tabs again. This is your FINAL warning. One more will terminate your test.', warningNumber: warningCountRef.current });
      } else {
        clearInterval(detectionIntervalRef.current); clearInterval(audioIntervalRef.current); clearInterval(timerRef.current);
        cameraStreamRef.current?.getTracks().forEach(t => t.stop());
        try { document.exitFullscreen(); } catch {}
        if (sessionIdRef.current) {
          supabase.from('test_sessions').update({ force_terminated: true, termination_reason: 'Repeated tab switching', status: 'terminated', integrity_log: integrityLogRef.current, completed_at: new Date().toISOString() }).eq('id', sessionIdRef.current).catch(() => {});
        }
        setTestTerminated(true); setTerminationReason('Test terminated: repeated tab switching detected.');
      }
    };
    const onVis = () => { if (document.hidden) handleSwitch('visibility'); };
    const onBlur = () => handleSwitch('blur');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    console.log('[ANTI-CHEAT] Tab detection ACTIVE');
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur); };
  }, [testStarted]);

  // ═══════════════════════════════════════════════════════════════════════
  // ANTI-CHEAT useEffect #2 — Keyboard, clipboard, context menu blocking
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!testStarted) return;
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      const blocked = e.key === 'F12' || e.key === 'F11' || e.key === 'Escape' ||
        (e.altKey && (e.key === 'Tab' || e.key === 'F4')) ||
        (ctrl && e.shiftKey && ['i','j','c','k'].includes(k)) ||
        (ctrl && ['c','v','a','x','t','w','p','s','u','f'].includes(k));
      if (blocked) { e.preventDefault(); e.stopPropagation(); devToolsFlagRef.current = true; setDevToolsFlag(true); }
    };
    const onKeyUp = (e) => {
      if (e.key === 'PrintScreen') { navigator.clipboard?.writeText('').catch(() => {}); toast.error('Screenshots blocked.', { duration: 2000 }); }
    };
    const block = (e) => e.preventDefault();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    document.addEventListener('cut', block);
    console.log('[ANTI-CHEAT] Keyboard blocking ACTIVE');
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('cut', block);
    };
  }, [testStarted]);

  // ═══════════════════════════════════════════════════════════════════════
  // ANTI-CHEAT useEffect #3 — Fullscreen enforcement
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!testStarted) return;
    const onFS = () => {
      if (!document.fullscreenElement) {
        console.log('[ANTI-CHEAT] FULLSCREEN EXIT');
        const entry = { timestamp: new Date().toISOString(), type: 'fullscreen_exit', detail: 'Student exited fullscreen' };
        integrityLogRef.current = [...integrityLogRef.current, entry];
        timerPausedRef.current = true; setTimerPaused(true);
        setShowFullscreenModal(true);
        if (sessionIdRef.current) {
          supabase.from('test_sessions').update({ integrity_log: integrityLogRef.current }).eq('id', sessionIdRef.current).catch(() => {});
        }
      }
    };
    document.addEventListener('fullscreenchange', onFS);
    document.addEventListener('webkitfullscreenchange', onFS);
    console.log('[ANTI-CHEAT] Fullscreen monitoring ACTIVE');
    return () => { document.removeEventListener('fullscreenchange', onFS); document.removeEventListener('webkitfullscreenchange', onFS); };
  }, [testStarted]);

  const logViolation = useCallback(async (type, detail, warningNumber = null) => {
    const entry = { timestamp: new Date().toISOString(), type, detail, warning_number: warningNumber };
    integrityLogRef.current = [...integrityLogRef.current, entry];
    setIntegrityLog(integrityLogRef.current);
    if (sessionIdRef.current) {
      await supabase.from('test_sessions').update({
        integrity_log: integrityLogRef.current,
        face_warning_count: warningCountRef.current,
      }).eq('id', sessionIdRef.current).catch(() => {});
    }
  }, []);

  // ── Screen-share detection (active only during test) ─────────────────────
  useEffect(() => {
    if (!testStarted) return;
    const original = navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);
    if (original) {
      navigator.mediaDevices.getDisplayMedia = async (...args) => {
        console.log('SCREEN SHARE ATTEMPT BLOCKED');
        logViolation('screen_share_attempt', 'Student attempted screen sharing');
        triggerFormalWarning('screen_share_attempt',
          'You attempted to share your screen during the test. This is not permitted.');
        throw new Error('Screen sharing is blocked during the test');
      };
    }
    const checkScreenShare = () => {
      const stream = cameraStreamRef.current;
      if (!stream) return;
      stream.getVideoTracks().forEach(track => {
        if (track.getSettings().displaySurface) {
          triggerFormalWarning('screen_share', 'Screen sharing was detected during the test.');
        }
      });
    };
    const ssInterval = setInterval(checkScreenShare, 5000);
    return () => {
      clearInterval(ssInterval);
      if (original) navigator.mediaDevices.getDisplayMedia = original;
    };
  }, [testStarted]);

  // ── Status helpers ─────────────────────────────────────────────────────
  const updateStatus = (qId, status) => {
    setQuestionStatuses(prev => { const n = { ...prev, [qId]: status }; questionStatusesRef.current = n; return n; });
  };

  const goToQuestion = (index) => {
    const currentQ = questions[currentIndex];
    if (currentQ && questionStatusesRef.current[currentQ.id] === 'not_visited') {
      updateStatus(currentQ.id, 'not_answered');
    }
    setCurrentIndex(index);
    const nextQ = questions[index];
    if (nextQ && questionStatusesRef.current[nextQ.id] === 'not_visited') {
      updateStatus(nextQ.id, 'not_answered');
    }
    setSelectedOption(answersRef.current[questions[index]?.id] ?? null);
  };

  const saveAnswer = async (qId, optionIndex) => {
    const newAnswers = { ...answersRef.current, [qId]: optionIndex };
    setAnswers(newAnswers); answersRef.current = newAnswers;
    if (sessionIdRef.current) {
      await supabase.from('test_sessions').update({ answers: newAnswers }).eq('id', sessionIdRef.current);
    }
  };

  const clearAnswer = (qId) => {
    const newAnswers = { ...answersRef.current };
    delete newAnswers[qId];
    setAnswers(newAnswers); answersRef.current = newAnswers;
    setSelectedOption(null);
    updateStatus(qId, 'not_answered');
  };

  // ── Four JEE Action Buttons ─────────────────────────────────────────────
  const handleSaveAndNext = async () => {
    const q = questions[currentIndex];
    if (!q) return;
    if (selectedOption !== null) {
      await saveAnswer(q.id, selectedOption);
      updateStatus(q.id, 'answered');
    }
    if (currentIndex < questions.length - 1) goToQuestion(currentIndex + 1);
  };

  const handleSaveAndMark = async () => {
    const q = questions[currentIndex];
    if (!q) return;
    if (selectedOption !== null) {
      await saveAnswer(q.id, selectedOption);
      updateStatus(q.id, 'answered_marked');
    }
  };

  const handleMarkAndNext = () => {
    const q = questions[currentIndex];
    if (!q) return;
    updateStatus(q.id, 'marked_review');
    if (currentIndex < questions.length - 1) goToQuestion(currentIndex + 1);
  };

  const handleClearResponse = () => {
    const q = questions[currentIndex];
    if (q) clearAnswer(q.id);
  };

  const handleSubmit = useCallback(async (reason = 'completed') => {
    if (phase === 'submitting' || phase === 'result') return;
    clearInterval(timerRef.current);
    if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
    stopFaceMonitoring(); stopAudioMonitoring();
    try { await document.exitFullscreen(); } catch {}
    setPhase('submitting'); setShowSubmitModal(false);

    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 900;
    // Score: count answered + answered_marked questions
    const statuses = questionStatusesRef.current;
    const ans = answersRef.current;
    const correct = questions.filter(q => (statuses[q.id] === 'answered' || statuses[q.id] === 'answered_marked') && ans[q.id] === q.correct).length;
    const total = questions.length;
    const score = (correct / total) * 100;

    let aiFlag = false, aiProbability = 0, aiReason = 'Not analyzed';
    try {
      const { system, user: userMsg } = buildCheatPrompt({ answers: ans, score, timeTaken, tabSwitches: tabSwitchRef.current, cameraDenied: cameraError, total });
      const cheatRes = await callAI([{ role: 'user', content: userMsg }], system);
      const parsed = parseAIJson(cheatRes);
      if (parsed) { aiFlag = parsed.flag; aiProbability = parsed.ai_probability; aiReason = parsed.reason; }
    } catch {}

    const sessionData = {
      answers: ans, score, correct, total, time_taken_seconds: timeTaken,
      tab_switches: tabSwitchRef.current, camera_denied: cameraError,
      ai_flag: aiFlag || devToolsFlagRef.current,
      ai_flag_reason: devToolsFlagRef.current ? 'DevTools detected' : aiReason,
      ai_probability: aiProbability, status: 'completed', completed_at: new Date().toISOString(),
    };
    if (sessionIdRef.current) await supabase.from('test_sessions').update(sessionData).eq('id', sessionIdRef.current);
    await handleTestComplete(score, sessionIdRef.current);

    const subjectBreakdown = {};
    questions.forEach(q => {
      if (!subjectBreakdown[q.subject]) subjectBreakdown[q.subject] = { total: 0, correct: 0 };
      subjectBreakdown[q.subject].total++;
      if ((statuses[q.id] === 'answered' || statuses[q.id] === 'answered_marked') && ans[q.id] === q.correct) subjectBreakdown[q.subject].correct++;
    });
    setResult({ score, correct, total, passed: score >= 60, aiFlag: aiFlag || devToolsFlagRef.current, aiReason, subjectBreakdown, timeTaken, attemptNumber });
    setPhase('result');
  }, [questions, application, cameraError, phase, startTime, attemptNumber]);

  const handleTestComplete = async (score, currentSessionId) => {
    const passed = score >= 60;
    const updates = { s2_attempts: attemptNumber, s2_best_score: Math.max(score, application.s2_best_score || 0) };
    if (attemptNumber === 1) updates.s2_attempt1_session_id = currentSessionId;
    else updates.s2_attempt2_session_id = currentSessionId;
    if (passed) { updates.status = 'passed_s2'; updates.stage = 3; }
    else if (attemptNumber === 1) { updates.status = 's2_attempt1_failed'; updates.s2_retry_available_at = new Date(Date.now() + 24*60*60*1000).toISOString(); }
    else { updates.status = 'rejected_s2_both_attempts'; }
    await supabase.from('applications').update(updates).eq('id', application.id);
  };


  // ── Proctoring engine ───────────────────────────────────────────────────
  const startProctoringEngine = (stream) => {
    if (modelsLoaded) {
      detectionIntervalRef.current = setInterval(async () => {
        const faceapi = window.faceapi;
        if (!faceapi || !videoRef.current) return;
        try {
          const dets = await faceapi
            .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4, inputSize: 320 }))
            .withFaceLandmarks();
          analyzeDetections(dets);
        } catch {}
      }, 1500);
    }
    if (stream && stream.getAudioTracks().length > 0) {
      initAudioMonitoring(stream);
    } else {
      console.warn('No audio track on stream — skipping audio monitoring');
    }
  };

  const analyzeDetections = (detections) => {
    if (detections.length === 0) {
      noFaceSecondsRef.current += 1.5;
      setCameraStatus('no_face');
      if (noFaceSecondsRef.current >= 3) showLiveWarning('no_face', 'Face not detected', 'Please position your face clearly in the camera frame.');
      if (noFaceSecondsRef.current >= 8) { noFaceSecondsRef.current = 0; triggerFormalWarning('face_absent', 'Your face was not visible for 8+ seconds.'); }
      return;
    }
    noFaceSecondsRef.current = 0;
    if (detections.length > 1) {
      multipleFaceCountRef.current += 1;
      setCameraStatus('multiple_faces');
      if (multipleFaceCountRef.current >= 2) { multipleFaceCountRef.current = 0; triggerFormalWarning('multiple_faces', 'Multiple faces detected. Only the applicant should be present.'); }
      return;
    }
    multipleFaceCountRef.current = 0;
    const lm = detections[0].landmarks;
    const le = lm.getLeftEye(), re = lm.getRightEye(), nose = lm.getNose(), jaw = lm.getJawOutline();
    const lec = { x: le.reduce((s,p)=>s+p.x,0)/le.length, y: le.reduce((s,p)=>s+p.y,0)/le.length };
    const rec = { x: re.reduce((s,p)=>s+p.x,0)/re.length, y: re.reduce((s,p)=>s+p.y,0)/re.length };
    const eyeMid = { x:(lec.x+rec.x)/2, y:(lec.y+rec.y)/2 };
    const noseTip = nose[4];
    const faceWidth = Math.abs(jaw[16].x - jaw[0].x);
    // ── GAZE DIRECTION — horizontal only, never flag looking down ──
    const horizontalDev = noseTip.x - eyeMid.x;
    const normH = Math.abs(horizontalDev) / (faceWidth * 0.5);
    // normV intentionally NOT computed — looking down is normal test behaviour

    if (normH > 0.28) {
      const dir = horizontalDev > 0 ? 'right' : 'left';
      lookAwaySecondsRef.current += 1.5;
      setCameraStatus('looking_away');
      // Live warning after 3 s
      if (lookAwaySecondsRef.current >= 3 && lookAwaySecondsRef.current < 4.5) {
        showLiveWarning('gaze', 'Please face the screen',
          `You appear to be looking ${dir}. Keep your eyes on the screen.`);
      }
      // Formal warning after 7 s sustained
      if (lookAwaySecondsRef.current >= 7) {
        lookAwaySecondsRef.current = 0;
        triggerFormalWarning('gaze_deviation',
          `You were looking ${dir} for an extended period. Please keep your eyes on the screen.`);
      }
    } else {
      lookAwaySecondsRef.current = Math.max(0, lookAwaySecondsRef.current - 1.5);
      setCameraStatus('ok');
    }
    const mouth = lm.getMouth();
    const normMouth = Math.abs(mouth[9].y - mouth[3].y) / (faceWidth * 0.15);
    if (normMouth > 1.2) {
      lipMoveCountRef.current += 1;
      if (lipMoveCountRef.current === 5) showLiveWarning('speaking', 'Please do not speak', 'Speaking during the test is not permitted.');
      if (lipMoveCountRef.current >= 10) { lipMoveCountRef.current = 0; triggerFormalWarning('speaking_detected', 'Repeated mouth movement detected.'); }
    } else { lipMoveCountRef.current = Math.max(0, lipMoveCountRef.current - 1); }
  };

  const initAudioMonitoring = async (stream) => {
    try {
      // Verify stream has a live audio track before doing anything
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) {
        console.warn('No audio track — audio monitoring disabled');
        return;
      }
      const audioTrack = audioTracks[0];
      if (!audioTrack.enabled || audioTrack.readyState !== 'live') {
        console.warn('Audio track not live — audio monitoring disabled');
        return;
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.85;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      // Calibration state — learn room baseline for first 6 samples (~15 s)
      let baselineSum = 0, baselineSamples = 0, calibrated = false;
      let baselineAvg = 0, sustainedNoise = 0;

      audioIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const speechBins = Array.from(data).slice(3, 40);
        const speechVol = speechBins.reduce((a, b) => a + b, 0) / speechBins.length;
        setAudioLevel(Math.round(speechVol));

        // Calibration phase — no flags during first ~15 s
        if (!calibrated) {
          baselineSum += speechVol;
          baselineSamples += 1;
          if (baselineSamples >= 6) {
            baselineAvg = baselineSum / baselineSamples;
            calibrated = true;
            console.log('Audio baseline:', baselineAvg.toFixed(1));
          }
          return;
        }

        // Dynamic threshold: at least 40, or 2.5× the room baseline
        const threshold = Math.max(40, baselineAvg * 2.5);
        if (speechVol > threshold) {
          sustainedNoise += 1;
          // Live warning after ~10 s sustained noise (4 samples × 2.5 s)
          if (sustainedNoise === 4) {
            showLiveWarning('audio', 'Background noise detected',
              'Please ensure you are in a quiet environment. Talking is not permitted.');
          }
          // Formal warning after ~20 s sustained noise (8 samples × 2.5 s)
          if (sustainedNoise >= 8) {
            sustainedNoise = 0;
            triggerFormalWarning('background_sound', 'Sustained loud background noise detected during the test.');
            logViolation('audio_violation', `Noise: ${speechVol.toFixed(1)}, Baseline: ${baselineAvg.toFixed(1)}`);
          }
        } else {
          sustainedNoise = Math.max(0, sustainedNoise - 1);
        }
      }, 2500);
    } catch (e) {
      console.warn('Audio monitoring setup failed:', e.message);
    }
  };

  const showLiveWarning = (type, title, message) => {
    if (lastViolationRef.current === type) return;
    lastViolationRef.current = type;
    setTimeout(() => { if (lastViolationRef.current === type) lastViolationRef.current = ''; }, 8000);
    setLiveWarning({ type, title, message });
    setTimeout(() => setLiveWarning(null), 4000);
  };

  const triggerFormalWarning = (type, reason) => {
    const n = warningCountRef.current + 1;
    warningCountRef.current = n;
    logViolation(type, reason, n);
    if (n >= 3) { handleForceTerminate(reason); return; }
    timerPausedRef.current = true; setTimerPaused(true);
    setFormalWarning({ type, reason, warningNumber: n });
  };

  const handleForceTerminate = async (reason) => {
    clearInterval(detectionIntervalRef.current);
    clearInterval(audioIntervalRef.current);
    clearInterval(timerRef.current);
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    try { await document.exitFullscreen(); } catch {}
    if (sessionIdRef.current) {
      await supabase.from('test_sessions').update({
        force_terminated: true, termination_reason: reason,
        status: 'terminated', integrity_log: integrityLogRef.current,
        completed_at: new Date().toISOString(),
      }).eq('id', sessionIdRef.current);
    }
    setTestTerminated(true); setTerminationReason(reason);
  };

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // ── Status counts ────────────────────────────────────────────────────────
  const statusCounts = Object.values(questionStatuses).reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {});

  // ── PROCTORING TERMINATED ───────────────────────────────────────────────
  if (testTerminated) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">🚫</span></div>
          <h2 className="text-2xl font-bold text-red-700 mb-2">Test Terminated</h2>
          <p className="text-gray-600 mb-4">Your test was automatically terminated due to repeated integrity violations.</p>
          <div className="bg-white border border-red-200 rounded-xl p-4 mb-4 text-left">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reason recorded</p>
            <p className="text-sm text-gray-700">{terminationReason}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800">If you have a remaining attempt, it is still available after 24 hours from your dashboard.</p>
          </div>
          <button onClick={() => navigate('/dashboard')} className="w-full bg-navy text-white py-3 rounded-xl font-semibold">Return to Dashboard</button>
        </div>
      </div>
    );
  }



  // ── PRE-TEST PHASE ──────────────────────────────────────────────────────
  if (phase === 'pretest') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full">

          {/* Attempt 2 warning banner */}
          {attemptNumber === 2 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
              <span className="text-amber-600 text-sm font-medium">
                ⚠ This is your final attempt (2 of 2). Your best score will be used.
              </span>
            </div>
          )}

          {/* Heading — no icon above */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-navy">Aptitude Test — Stage 2</h1>
            <p className="text-gray-500 mt-1">DDS University for Engineering</p>
          </div>

          {/* Quick info bar */}
          <div className="flex justify-center" style={{margin: '16px auto 24px'}}>
            <div className="inline-flex items-center gap-8" style={{background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'10px 24px'}}>
              <span style={{fontSize:'14px', color:'#1e3a5f', fontWeight:500}}>📝 15 Questions</span>
              <span style={{fontSize:'14px', color:'#1e3a5f', fontWeight:500}}>⏱ 15 Minutes</span>
              <span style={{fontSize:'14px', color:'#1e3a5f', fontWeight:500}}>📚 5 Subjects</span>
            </div>
          </div>

          {/* Rules — two groups */}
          <Card className="mb-4">
            <p style={{fontSize:'11px', fontWeight:600, letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:'10px', color:'#16a34a'}}>Requirements</p>
            <div className="space-y-2">
              {[
                '15 questions across 5 subjects (Physics, Chemistry, Maths, English, Reasoning)',
                '15 minutes total time — no extensions',
                'Camera must be enabled for proctoring',
                'Remain in fullscreen throughout the test',
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{text}</span>
                </div>
              ))}
            </div>
            <hr className="border-gray-100 my-3" />
            <p style={{fontSize:'11px', fontWeight:600, letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:'10px', color:'#dc2626'}}>Not Permitted</p>
            <div className="space-y-2">
              {[
                'Tab switching or minimizing browser',
                'Right-click or copy-paste',
                'Use of external resources or assistance',
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-gray-600">{text}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Camera Setup (status display) */}
          <Card className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Camera Setup</p>
            {cameraEnabled ? (
              <div className="flex items-center gap-3">
                <video ref={pretestVideoRef} autoPlay muted playsInline className="w-24 rounded-lg object-cover border border-green-200" style={{height:'72px'}} />
                <div><div className="flex items-center gap-2"><Camera className="w-4 h-4 text-green-600" /><span className="text-sm font-semibold text-green-700">Camera Active</span></div><p className="text-xs text-gray-500 mt-0.5">Camera feed is active and ready.</p></div>
              </div>
            ) : cameraError ? (
              <div className="flex items-center gap-3 text-amber-700"><CameraOff className="w-5 h-5" /><div><p className="text-sm font-semibold">Camera access denied</p><p className="text-xs text-amber-600 mt-0.5">Your session will be flagged for admin review but you can still take the test.</p></div></div>
            ) : (
              <p className="text-sm text-gray-500">Camera will be requested when you click "Enable Camera &amp; Begin Test" below.</p>
            )}
          </Card>

          {/* Primary CTA */}
          <Button variant="primary" size="lg" className="w-full" onClick={handleEnableAndBegin} disabled={questions.length === 0}>
            {cameraEnabled || cameraError ? 'Begin Test →' : 'Enable Camera & Begin Test →'}
          </Button>

          {/* No-camera text link */}
          <p className="text-center mt-3">
            <button
              onClick={() => setShowNoCameraModal(true)}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
              Continue without camera (not recommended — session will be flagged)
            </button>
          </p>

          {/* No-camera confirmation modal */}
          {showNoCameraModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
                <h3 className="font-semibold text-gray-900 mb-2">Proceed without camera?</h3>
                <p className="text-sm text-gray-600 mb-5">Your session will be flagged for manual review by DDS University admissions staff. This may affect your application. Are you sure?</p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowNoCameraModal(false)}>Cancel</Button>
                  <Button variant="primary" onClick={() => { setShowNoCameraModal(false); setCameraError(true); startTest(); }}>Proceed Anyway</Button>
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </div>
    );
  }

    // ── COUNTDOWN PHASE ─────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 bg-navy flex items-center justify-center">
        <motion.div key={countdown} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }} className="text-white text-center">
          <p className="text-8xl font-bold mb-4">{countdown === 0 ? '🚀' : countdown}</p>
          <p className="text-xl opacity-70">{countdown === 0 ? 'Begin!' : 'Get ready...'}</p>
        </motion.div>
      </div>
    );
  }

  // ── SUBMITTING PHASE ────────────────────────────────────────────────────
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

  // ── RESULT PHASE ────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full">
          <Card className="text-center mb-4">
            <motion.p initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className={`text-7xl font-bold mb-2 ${result.passed ? 'text-green-600' : 'text-red-600'}`}>{Math.round(result.score)}%</motion.p>
            <p className="text-gray-500 mb-4">{result.correct} / {result.total} correct</p>
            <Badge variant={result.passed ? 'success' : 'error'} className="text-sm px-4 py-1">
              {result.passed ? `✓ Passed — ${result.attemptNumber === 2 ? 'on 2nd attempt — ' : ''}Minimum 60% achieved` : `✗ Did not pass — Required 60%${result.attemptNumber === 1 ? ' (1 retry available in 24h)' : ' — both attempts used'}`}
            </Badge>
            <p className="text-xs text-gray-400 mt-3">Completed in {Math.floor(result.timeTaken/60)}m {result.timeTaken%60}s · Attempt {result.attemptNumber} of 2</p>
          </Card>
          {result.aiFlag && (
            <div className="bg-amber-50 border border-amber-200 rounded-card p-4 mb-4">
              <div className="flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" /><div><p className="text-sm font-semibold text-amber-800">Your session has been flagged for review</p><p className="text-xs text-amber-700 mt-1">This does not automatically disqualify you. A human reviewer will assess your session before any decision is made.</p></div></div>
            </div>
          )}
          <Card className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Subject Breakdown</p>
            <div className="space-y-2">
              {Object.entries(result.subjectBreakdown).map(([sub, data]) => (
                <div key={sub} className="flex items-center justify-between"><Badge variant={sub.toLowerCase()}>{sub}</Badge><span className="text-sm font-semibold text-navy">{data.correct}/{data.total}</span></div>
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

  // ── TEST PHASE ──────────────────────────────────────────────────────────
  const question = questions[currentIndex];
  if (!question) return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-navy font-semibold">Loading questions...</p>
      </div>
    </div>
  );
  const currentStatus = questionStatuses[question.id] || 'not_visited';
  const paletteQuestions = questions.filter(q => q.subject === activePaletteSubject);
  const timerColor = timeLeft > 600 ? '#16a34a' : timeLeft > 300 ? '#d97706' : '#dc2626';
  const timerPulse = timeLeft <= 300;

  return (

    <div className="fixed inset-0 flex flex-col bg-gray-100 no-select overflow-hidden" style={{fontFamily:'\"Plus Jakarta Sans\", system-ui, sans-serif'}}>

      {/* Live warning toast */}
      <AnimatePresence>
        {liveWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl shadow-lg px-5 py-4 max-w-sm w-full">
            <span className="text-amber-500 text-xl mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">{liveWarning.title}</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{liveWarning.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formal warning modal */}
      {formalWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><span className="text-white text-xl">⚠</span></div>
              <div>
                <p className="text-white font-bold text-lg">Integrity Warning {formalWarning.warningNumber} of 3</p>
                <p className="text-red-100 text-sm">DDS University Proctoring System</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-800 text-sm leading-relaxed mb-4">{formalWarning.reason}</p>
              <div className="flex gap-2 mb-4">
                {[1,2,3].map(n => (
                  <div key={n} style={{flex:1,height:8,borderRadius:4,background:n<=formalWarning.warningNumber?'#ef4444':'#e5e7eb'}}/>
                ))}
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {formalWarning.warningNumber === 1
                  ? '⚠ You have 2 remaining warnings. A third violation will automatically terminate your test.'
                  : '🔴 FINAL WARNING. Your next violation will immediately terminate this test.'}
              </p>
            </div>
            <div className="px-6 pb-5">
              <p className="text-xs text-gray-400 mb-3 text-center">This violation has been recorded and logged to your session.</p>
              <button onClick={() => { setFormalWarning(null); timerPausedRef.current=false; setTimerPaused(false); }}
                className="w-full bg-navy text-white py-3 rounded-xl font-semibold text-sm hover:bg-navy/90 transition-colors">
                I Understand — Continue Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera status indicator - fixed top-right */}
      {cameraEnabled && (
        <div className="fixed top-4 right-4 z-40">
          <div style={{border: cameraStatus==='ok'?'2px solid #4ade80':cameraStatus==='no_face'||cameraStatus==='multiple_faces'?'2px solid #ef4444':'2px solid #fbbf24'}}
            className="relative w-32 h-24 rounded-xl overflow-hidden transition-all duration-300">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{transform:'scaleX(-1)'}} />
            <div style={{background:cameraStatus==='ok'?'rgba(34,197,94,0.8)':cameraStatus==='no_face'||cameraStatus==='multiple_faces'?'rgba(239,68,68,0.8)':'rgba(245,158,11,0.8)'}}
              className="absolute bottom-0 left-0 right-0 py-1 px-2 text-center text-xs text-white font-medium">
              {cameraStatus==='ok'&&'✓ Monitoring'}
              {cameraStatus==='looking_away'&&'⚠ Look forward'}
              {cameraStatus==='no_face'&&'⚠ No face'}
              {cameraStatus==='multiple_faces'&&'⚠ Multiple'}
              {cameraStatus==='speaking'&&'⚠ No speaking'}
              {(cameraStatus==='loading'||!cameraStatus)&&'⟳ Loading'}
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-xs text-gray-400">🎤</span>
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{width:Math.min(100,audioLevel*2)+'%',background:audioLevel>50?'#ef4444':audioLevel>25?'#f59e0b':'#22c55e'}} />
            </div>
          </div>
        </div>
      )}

      {/* Timer paused banner */}
      {timerPaused && (
        <div className="fixed top-2 left-1/2 z-40" style={{transform:'translateX(-50%)'}}>
          <div className="bg-amber-100 border border-amber-300 rounded-full px-4 py-1">
            <p className="text-xs text-amber-700 font-medium">⏸ Timer paused during integrity review</p>
          </div>
        </div>
      )}

      {/* Fullscreen enforcement modal */}
      {showFullscreenModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full mx-4 overflow-hidden shadow-2xl text-center">
            <div className="bg-red-600 px-6 py-5">
              <div className="text-5xl mb-2">🖥️</div>
              <p className="text-white font-bold text-xl">Fullscreen Exited</p>
              <p className="text-red-100 text-sm mt-1">The test is paused</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                You exited fullscreen mode. This has been recorded as a violation.
                You must return to fullscreen to continue the test.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
                <p className="text-xs text-amber-700">
                  ⚠ Exiting fullscreen repeatedly will result in your test being automatically submitted.
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await document.documentElement.requestFullscreen();
                    setShowFullscreenModal(false);
                    timerPausedRef.current = false;
                    setTimerPaused(false);
                  } catch {
                    toast.error('Could not enter fullscreen. Please allow it in your browser settings.');
                  }
                }}
                className="w-full bg-navy text-white py-3 rounded-xl font-bold text-sm hover:bg-navy/90 transition-colors"
              >
                🖥️ Return to Fullscreen — Click Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WARNING MODAL ── */}
      {showWarning && <WarningModal warningNumber={Math.floor(faceWarnings/3)} maxWarnings={3} reason={warningReason} onDismiss={() => setShowWarning(false)} />}

      {/* ── SUBMIT CONFIRMATION MODAL ── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-navy mb-2">Submit Test?</h2>
            <p className="text-gray-500 text-sm mb-6">Once submitted, you cannot go back.</p>
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-green-500 inline-block" /><span className="text-gray-700">Answered: <strong>{statusCounts.answered || 0}</strong></span></div>
              <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-red-500 inline-block" /><span className="text-gray-700">Not Answered: <strong>{statusCounts.not_answered || 0}</strong></span></div>
              <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-purple-500 inline-block" /><span className="text-gray-700">Marked Review: <strong>{statusCounts.marked_review || 0}</strong></span></div>
              <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-purple-700 inline-block" /><span className="text-gray-700">Ans+Marked: <strong>{statusCounts.answered_marked || 0}</strong></span></div>
              <div className="flex items-center gap-2 col-span-2"><span className="w-4 h-4 rounded bg-gray-300 inline-block" /><span className="text-gray-700">Not Visited: <strong>{statusCounts.not_visited || 0}</strong></span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleSubmit('completed')} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors">Submit Test</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-4 py-2 shadow-sm flex-shrink-0" style={{minHeight:'56px'}}>
        {/* Left: Logo + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-navy leading-tight truncate">DDS University</p>
            <p className="text-[10px] text-gray-400 leading-tight truncate">Admissions Test · Attempt {attemptNumber}/2</p>
          </div>
        </div>

        {/* Center: Subject tabs */}
        <div className="flex items-center gap-1 flex-shrink-0 mx-4">
          {['Physics','Chemistry','Maths','English','Reasoning'].map(subj => {
            const isActive = question.subject === subj;
            return (
              <button
                key={subj}
                onClick={() => {
                  const idx = questions.findIndex((q, i) => q.subject === subj && (questionStatuses[q.id] === 'not_visited' || questionStatuses[q.id] === 'not_answered'));
                  const fallback = questions.findIndex(q => q.subject === subj);
                  const target = idx !== -1 ? idx : fallback;
                  if (target !== -1) { setActivePaletteSubject(subj); goToQuestion(target); }
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${isActive ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-navy hover:bg-navy-50'}`}
              >
                {subj}
              </button>
            );
          })}
        </div>

        {/* Right: student info, camera, timer */}
        <div className="flex items-center gap-3 flex-shrink-0">

          <div className="text-right">
            <p className="text-xs text-gray-500 leading-tight">Time Left</p>
            <p className={`text-lg font-bold font-mono leading-tight ${timerPulse ? 'animate-pulse' : ''}`} style={{color: timerColor}}>{formatTime(timeLeft)}</p>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY: Question Area + Sidebar ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: QUESTION AREA ── */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{width:'65%'}}>
          {/* Scrollable question content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Question meta */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-gray-400 font-medium">Question {currentIndex + 1} of {questions.length}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${SUBJECT_COLORS[question.subject] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{question.subject}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${question.difficulty === 'hard' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{question.difficulty || 'Medium'}</span>
              {tabSwitches > 0 && <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {tabSwitches} tab switch{tabSwitches > 1 ? 'es' : ''}</span>}
            </div>

            {/* Question card */}
            <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="bg-white rounded-xl border border-gray-200 p-5 mb-5 shadow-sm">
              <p className="text-xs font-bold text-navy mb-3">Q{currentIndex + 1}.</p>
              <p className="text-base text-gray-900 leading-relaxed font-medium">{question.question}</p>
            </motion.div>

            {/* Options */}
            <div className="space-y-3">
              {question.options.map((opt, i) => {
                const letter = 'ABCD'[i];
                const isSelected = selectedOption === i;
                return (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.005 }}
                    onClick={() => setSelectedOption(isSelected ? null : i)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-navy bg-blue-50 border-l-4' : 'border-gray-200 bg-white hover:border-navy hover:bg-gray-50'}`}
                  >
                    {/* Radio */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-navy bg-navy' : 'border-gray-300 bg-white'}`}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    {/* Letter badge */}
                    <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600'}`}>{letter}</span>
                    <span className="text-gray-800 text-sm leading-relaxed">{opt}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ── BOTTOM ACTION BAR ── */}
          <div className="bg-white border-t border-gray-200 px-6 py-3 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button onClick={() => currentIndex > 0 && goToQuestion(currentIndex - 1)} disabled={currentIndex === 0} className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">← Back</button>
                <button onClick={() => currentIndex < questions.length - 1 && goToQuestion(currentIndex + 1)} disabled={currentIndex === questions.length - 1} className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next →</button>
              </div>
              <div className="flex gap-2">
                <button onClick={handleMarkAndNext} className="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">Mark & Next</button>
                <button onClick={handleClearResponse} className="px-3 py-2 text-xs font-bold rounded-lg border border-red-400 text-red-600 bg-white hover:bg-red-50 transition-colors">Clear</button>
                <button onClick={handleSaveAndMark} className="px-3 py-2 text-xs font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors">Save & Mark</button>
                <button onClick={handleSaveAndNext} className="px-4 py-2 text-xs font-bold rounded-lg bg-navy text-white hover:bg-navy-dark transition-colors">Save & Next</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0" style={{width:'35%'}}>

          {/* Legend */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Question Status</p>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {[
                { key: 'not_visited', label: 'Not Visited', color: '#9ca3af' },
                { key: 'not_answered', label: 'Not Answered', color: '#ef4444' },
                { key: 'answered', label: 'Answered', color: '#22c55e' },
                { key: 'marked_review', label: 'Marked for Review', color: '#a855f7' },
                { key: 'answered_marked', label: 'Answered + Marked', color: '#7c3aed' },
              ].map(({ key, label, color }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded flex-shrink-0" style={{backgroundColor: color}} />
                    <span className="text-gray-600">{label}</span>
                  </div>
                  <span className="font-bold text-gray-800">{statusCounts[key] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Palette subject tabs */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex flex-wrap gap-1">
              {['Physics','Chemistry','Maths','English','Reasoning'].map(subj => (
                <button
                  key={subj}
                  onClick={() => setActivePaletteSubject(subj)}
                  className={`px-2 py-1 text-[10px] font-semibold rounded transition-colors ${activePaletteSubject === subj ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {subj}
                </button>
              ))}
            </div>
          </div>

          {/* Question palette grid */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="grid gap-2" style={{gridTemplateColumns:'repeat(5, 1fr)'}}>
              {paletteQuestions.map((q, paletteIdx) => {
                const globalIdx = questions.findIndex(gq => gq.id === q.id);
                const status = questionStatuses[q.id] || 'not_visited';
                const isActive = globalIdx === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => { setActivePaletteSubject(q.subject); goToQuestion(globalIdx); }}
                    className={`w-9 h-9 rounded-lg text-xs font-bold transition-all relative ${STATUS_COLORS[status]} ${isActive ? 'ring-2 ring-navy ring-offset-1 scale-110' : 'hover:scale-105'}`}
                  >
                    {globalIdx + 1}
                    {status === 'answered_marked' && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border border-white text-[6px] flex items-center justify-center text-white font-black">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors shadow-sm"
            >
              SUBMIT TEST
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
