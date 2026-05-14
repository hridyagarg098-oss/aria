import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { streamAI, callAI, buildMasterInterviewPrompt, buildMasterScoringPrompt, parseAIJson } from '../utils/ai';
import { sendNotification } from '../utils/notifications';
import toast from 'react-hot-toast';

export default function Interview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Core interview state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const [application, setApplication] = useState(null);
  const [testSession, setTestSession] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [studentName, setStudentName] = useState('');
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [scoreData, setScoreData] = useState(null);
  const [studentData, setStudentData] = useState(null);

  // Timer state
  const [questionNumber, setQuestionNumber] = useState(0);
  const [questionTimer, setQuestionTimer] = useState(120);
  const [timerActive, setTimerActive] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [timerWarning, setTimerWarning] = useState(false);
  const [thinkingTime, setThinkingTime] = useState(false);

  // Anti-cheat state
  const [warningCount, setWarningCount] = useState(0);
  const [formalWarning, setFormalWarning] = useState(null);
  const [liveWarning, setLiveWarning] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('loading');
  const [tabSwitches, setTabSwitches] = useState(0);
  const [terminatedReason, setTerminatedReason] = useState(null);

  // Speech-to-text state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const recognitionRef = useRef(null);

  // Refs
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const questionTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const autoSubmitRef = useRef(null);
  const thinkingTimerRef = useRef(null);
  const videoRef = useRef(null);
  const warningCountRef = useRef(0);
  const integrityLogRef = useRef([]);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const lastViolationRef = useRef('');
  const noFaceSecondsRef = useRef(0);
  const lookAwaySecondsRef = useRef(0);

  const interviewStarted = !!sessionId;

  // Session-wide timer (counts up)
  useEffect(() => {
    sessionTimerRef.current = setInterval(() => {
      setSessionTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(sessionTimerRef.current);
  }, []);

  useEffect(() => {
    initInterview();
    return () => {
      clearInterval(questionTimerRef.current);
      clearInterval(sessionTimerRef.current);
      clearTimeout(thinkingTimerRef.current);
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Per-question timer: 5s thinking time + 120s countdown, auto-submit on expiry
  const startQuestionTimer = useCallback(() => {
    // Phase 1: "Take a moment to think" (5 seconds)
    setThinkingTime(true);
    setQuestionTimer(120);
    setTimerActive(false);
    setTimerWarning(false);
    clearInterval(questionTimerRef.current);
    clearTimeout(thinkingTimerRef.current);

    thinkingTimerRef.current = setTimeout(() => {
      setThinkingTime(false);
      setTimerActive(true);

      // Phase 2: Actual countdown
      questionTimerRef.current = setInterval(() => {
        setQuestionTimer(prev => {
          if (prev <= 31) setTimerWarning(true);
          if (prev <= 1) {
            clearInterval(questionTimerRef.current);
            setTimerActive(false);
            if (autoSubmitRef.current) autoSubmitRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 5000);
  }, []);

  const initInterview = async () => {
    // Allow both first-timers (passed_s2) and retry candidates (s3_attempt1_failed)
    const { data: app } = await supabase
      .from('applications')
      .select('*')
      .eq('student_id', user.id)
      .in('status', ['passed_s2', 's3_attempt1_failed'])
      .single();

    if (!app) {
      toast.error('No eligible application found for interview.');
      navigate('/dashboard');
      return;
    }

    // ── Server-side cooldown enforcement ──────────────────────────────────
    if (app.s3_attempts >= 2) {
      toast.error('You have used both Stage 3 interview attempts.');
      navigate('/dashboard');
      return;
    }

    if (app.status === 's3_attempt1_failed' && app.s3_retry_available_at) {
      const retryAt = new Date(app.s3_retry_available_at);
      if (new Date() < retryAt) {
        const diff = retryAt - new Date();
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        toast.error(`Interview retry not yet available. Please wait ${hrs}h ${mins}m.`);
        navigate('/dashboard');
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    setApplication(app);
    const currentAttempt = (app.s3_attempts || 0) + 1;
    setAttemptNumber(currentAttempt);

    const { data: ts } = await supabase
      .from('test_sessions')
      .select('score')
      .eq('application_id', app.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    setTestSession(ts);

    const s2score = ts?.score ? Math.round(ts.score) : 0;
    const fd = app.form_data || {};

    // Fetch student record for name (may differ from form_data)
    const { data: student } = await supabase
      .from('students')
      .select('name')
      .eq('id', app.student_id)
      .single();

    const studentName = student?.name || fd.name || 'Student';
    setStudentName(studentName.split(' ')[0]);

    const pcmAvg = (
      (Number(fd.physics || 0) + Number(fd.chemistry || 0) + Number(fd.maths || 0)) / 3
    ).toFixed(1);

    const sData = {
      name: studentName,
      branch: app.branch,
      physics: fd.physics,
      chemistry: fd.chemistry,
      maths: fd.maths,
      jee: fd.jee,
      projects: fd.projects,
      whyDDS: fd.whyDDS,
      whyBranch: fd.whyBranch,
      extracurriculars: fd.extra || fd.extracurriculars,
      s1Score: app.ai_score ? Math.round(app.ai_score) : 'N/A',
      s2Score: s2score,
      pcmAverage: pcmAvg,
    };
    setStudentData(sData);
    const prompt = buildMasterInterviewPrompt(sData);
    setSystemPrompt(prompt);

    // Create interview session
    const { data: session } = await supabase
      .from('interview_sessions')
      .insert({
        application_id: app.id,
        student_id: user.id,
        status: 'in_progress',
        attempt_number: currentAttempt,
      })
      .select()
      .single();

    setSessionId(session.id);

    // Start with opening question
    await streamOpeningQuestion(app, prompt, session.id);
  };

  const streamOpeningQuestion = async (app, prompt, sid) => {
    setIsTyping(true);
    const ariaMsg = { role: 'assistant', content: '', timestamp: new Date().toISOString() };
    setMessages([ariaMsg]);

    let fullText = '';
    try {
      await streamAI(
        [{ role: 'user', content: 'Begin the interview with your opening question.' }],
        prompt,
        (chunk) => {
          fullText += chunk;
          setMessages(prev => prev.map((m, i) => i === 0 ? { ...m, content: fullText } : m));
        },
        async (complete) => {
          const cleanText = complete.replace('[INTERVIEW_COMPLETE]', '').replace('[DONE]', '').trim();
          setMessages([{ role: 'assistant', content: cleanText, timestamp: new Date().toISOString() }]);
          setQuestionNumber(1);
          await supabase.from('interview_sessions').update({
            messages: [{ role: 'assistant', content: cleanText, timestamp: new Date().toISOString() }],
            question_count: 1,
          }).eq('id', sid);

          if (complete.includes('[INTERVIEW_COMPLETE]') || complete.includes('[DONE]')) {
            handleInterviewDone(sid, [{ role: 'assistant', content: cleanText }]);
          } else {
            startQuestionTimer();
          }
        }
      );
    } catch (err) {
      toast.error('Failed to start interview. Please try again.');
    }
    setIsTyping(false);
  };

  // Auto-submit handler (called by timer ref to avoid stale closure)
  const handleAutoSubmitTimeout = useCallback(() => {
    const timeoutMessage = inputValue.trim() || '[No response provided — time limit reached]';
    setInputValue('');
    setMessages(prev => [...prev, {
      role: 'user', content: timeoutMessage,
      timestamp: new Date().toISOString(), timedOut: true,
    }]);
    sendToAI(timeoutMessage);
  }, [inputValue]);

  // Keep autoSubmitRef always current
  useEffect(() => {
    autoSubmitRef.current = handleAutoSubmitTimeout;
  }, [handleAutoSubmitTimeout]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  // ── Speech-to-Text (Web Speech API) ────────────────────────────────────
  const toggleSpeechRecognition = useCallback(() => {
    if (!speechSupported) {
      toast.error('Speech recognition not supported in this browser. Use Chrome for best results.');
      return;
    }

    if (isListening) {
      // Stop listening
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Start listening
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
      toast('🎤 Listening... Speak your answer', { duration: 2000 });
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim = transcript;
        }
      }
      // Append finalized text + show interim text
      const currentBase = inputValue.endsWith(' ') ? inputValue : (inputValue ? inputValue + ' ' : '');
      setInputValue(currentBase.trimEnd() + (finalTranscript ? ' ' + finalTranscript : '') + (interim ? interim : ''));
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        toast('No speech detected. Try again.', { icon: '🎤', duration: 2000 });
      } else if (event.error !== 'aborted') {
        toast.error('Mic error: ' + event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [speechSupported, isListening, inputValue]);

  // Stop speech recognition when AI is responding
  useEffect(() => {
    if (isTyping && isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  }, [isTyping, isListening]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping || interviewDone) return;
    clearInterval(questionTimerRef.current);
    setTimerActive(false);
    setTimerWarning(false);

    const userMessage = inputValue.trim();
    setInputValue('');

    setMessages(prev => [...prev, {
      role: 'user', content: userMessage, timestamp: new Date().toISOString(),
    }]);

    await sendToAI(userMessage);
  };

  const sendToAI = async (userMessage) => {
    setIsTyping(true);

    // Build full history from current messages + new user message
    const currentMsgs = [...messages, { role: 'user', content: userMessage, timestamp: new Date().toISOString() }];
    const history = currentMsgs.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    // Add typing placeholder
    setMessages(prev => [...prev, { role: 'assistant', content: '', typing: true, timestamp: new Date().toISOString() }]);

    let fullText = '';
    try {
      await streamAI(
        history,
        systemPrompt,
        (chunk) => {
          fullText += chunk;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: fullText, timestamp: new Date().toISOString() };
            return updated;
          });
        },
        async (complete) => {
          const hasDone = complete.includes('[INTERVIEW_COMPLETE]') || complete.includes('[DONE]');
          const cleanText = complete.replace('[INTERVIEW_COMPLETE]', '').replace('[DONE]', '').trim();

          const finalMessages = [...currentMsgs, { role: 'assistant', content: cleanText, timestamp: new Date().toISOString() }];
          setMessages(finalMessages);

          const newQNum = questionNumber + 1;
          setQuestionNumber(newQNum);

          await supabase.from('interview_sessions').update({
            messages: finalMessages,
            question_count: newQNum,
          }).eq('id', sessionId);

          if (hasDone) {
            // Don't let scoring errors bubble up as "Connection error"
            // handleInterviewDone has its own error handling with fallback scores
            try {
              await handleInterviewDone(sessionId, finalMessages);
            } catch (scoreErr) {
              console.error('Scoring phase error (handled):', scoreErr);
              // Scoring already has fallback logic, so this is just a safety net
            }
          } else {
            startQuestionTimer();
          }
        }
      );
    } catch (err) {
      console.error('Stream error:', err);
      // Only show connection error if we don't have a complete response yet
      if (!interviewDone && !fullText.includes('[INTERVIEW_COMPLETE]') && !fullText.includes('[DONE]')) {
        toast.error('Connection error. Please try again.');
        setMessages(prev => prev.filter(m => !m.typing));
      }
    }
    setIsTyping(false);
  };

  const handleInterviewDone = async (sid, finalMsgs) => {
    setInterviewDone(true);
    clearInterval(questionTimerRef.current);
    clearInterval(sessionTimerRef.current);
    setTimerActive(false);

    // Build transcript string for scoring — truncate if too long to avoid token limits
    const transcriptText = finalMsgs
      .map(m => `${m.role === 'assistant' ? 'DR. MEHTA' : 'CANDIDATE'}: ${m.content}`)
      .join('\n\n');

    // Truncate transcript to ~6000 chars to stay within Groq's context window
    const maxTranscriptChars = 6000;
    const truncatedTranscript = transcriptText.length > maxTranscriptChars
      ? transcriptText.slice(0, maxTranscriptChars) + '\n\n[Transcript truncated for scoring — full version saved separately]'
      : transcriptText;

    const sd = studentData || {};

    // ── 8-Dimension Master Scoring ────────────────────────────────────────
    const scoringPrompt = buildMasterScoringPrompt(sd, truncatedTranscript);

    let finalScore = 0;
    let parsedScores = null;

    // Retry the scoring call up to 3 times with increasing delay
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        toast('Dr. Mehta is evaluating your interview...', { icon: '📝', duration: 4000 });
        const scoreRes = await callAI(
          [{ role: 'user', content: scoringPrompt }],
          'You are a senior admissions committee member. Return only valid JSON. Be strict but fair.'
        );
        parsedScores = parseAIJson(scoreRes);
        if (parsedScores?.total_score != null) {
          finalScore = parsedScores.total_score;
          break; // Success — exit retry loop
        }
        console.warn(`Scoring attempt ${attempt}: parsed but no total_score, retrying...`);
      } catch (err) {
        console.error(`Scoring attempt ${attempt}/3 failed:`, err.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }

    // If all retries failed, use fallback with new 8-dimension schema
    if (!parsedScores || parsedScores.total_score == null) {
      console.error('All scoring attempts failed, using fallback');
      parsedScores = {
        total_score: 50,
        grade: 'B',
        recommendation: 'Borderline',
        dimension_scores: {
          project_reality: { score: 10, max: 20, evidence: 'Scoring unavailable', verdict: 'Adequate' },
          subject_knowledge: { score: 7, max: 15, evidence: 'Scoring unavailable', verdict: 'Adequate' },
          communication: { score: 8, max: 15, evidence: 'Scoring unavailable', verdict: 'Adequate' },
          pressure_handling: { score: 7, max: 15, evidence: 'Scoring unavailable', verdict: 'Adequate' },
          genuine_motivation: { score: 5, max: 10, evidence: 'Scoring unavailable', verdict: 'Adequate' },
          case_study: { score: 7, max: 15, evidence: 'Scoring unavailable', verdict: 'Adequate' },
          self_awareness: { score: 3, max: 5, evidence: 'Scoring unavailable', verdict: 'Adequate' },
          future_vision: { score: 3, max: 5, evidence: 'Scoring unavailable', verdict: 'Adequate' },
        },
        best_moment: 'Unavailable',
        worst_moment: 'Unavailable',
        scripted_answers_detected: false,
        genuineness_score: 50,
        project_viability: 'Moderate Potential',
        project_viability_reason: 'Manual review required.',
        red_flags: [],
        green_flags: [],
        committee_summary: 'Automated scoring failed. Manual review required.',
        final_verdict: 'Manual review required.',
        admit_confidence: 50,
      };
      finalScore = 50;
    }

    // Save scores to DB — store full assessment + key dimension scores
    const ds = parsedScores.dimension_scores || {};
    try {
      await supabase.from('interview_sessions').update({
        final_score: finalScore,
        final_assessment: JSON.stringify(parsedScores),
        communication_score: ds.communication?.score,
        depth_score: ds.project_reality?.score,
        enthusiasm_score: ds.genuine_motivation?.score,
        project_depth_score: ds.project_reality?.score,
        academic_understanding_score: ds.subject_knowledge?.score,
        motivation_clarity_score: ds.genuine_motivation?.score,
        problem_solving_score: ds.case_study?.score,
        interview_grade: parsedScores.grade,
        recommendation: parsedScores.recommendation,
        admit_confidence: parsedScores.admit_confidence,
        key_strengths: parsedScores.green_flags,
        red_flags: parsedScores.red_flags,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', sid);
    } catch (dbErr) {
      console.error('Failed to save scores to DB:', dbErr);
    }

    setScoreData(parsedScores);

    // Fire interview scored email notification (non-blocking)
    sendNotification('interview_scored', user?.email, {
      name: studentName || sd.name,
      branch: sd.branch,
    });

    // ── 2-Attempt logic for Stage 3 ───────────────────────────────────────
    await handleInterviewComplete(finalScore, sid);
    // ─────────────────────────────────────────────────────────────────────
  };

  /**
   * 2-attempt handler for Stage 3.
   * Pass threshold: 50/100. Retry cooldown: 48 hours.
   */
  const handleInterviewComplete = async (finalScore, currentSessionId) => {
    if (!application) return;
    const passed = finalScore >= 50;

    const updates = {
      s3_attempts: attemptNumber,
      s3_best_score: Math.max(finalScore, application.s3_best_score || 0),
    };

    if (attemptNumber === 1) {
      updates.s3_attempt1_session_id = currentSessionId;
    } else {
      updates.s3_attempt2_session_id = currentSessionId;
    }

    if (passed) {
      updates.status = 'interview';
      updates.stage = 3;
      // Awaiting admin final decision
    } else if (attemptNumber === 1) {
      updates.status = 's3_attempt1_failed';
      updates.s3_retry_available_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    } else {
      updates.status = 'rejected_s3_both_attempts';
    }

    await supabase.from('applications').update(updates).eq('id', application.id);
  };

  // ═══════════════════════════════════════════════════════
  //  ANTI-CHEAT SYSTEM
  // ═══════════════════════════════════════════════════════

  const showLiveWarning = (type, title, message) => {
    if (lastViolationRef.current === type) return;
    lastViolationRef.current = type;
    setTimeout(() => { if (lastViolationRef.current === type) lastViolationRef.current = ''; }, 8000);
    setLiveWarning({ type, title, message });
    setTimeout(() => setLiveWarning(null), 4000);
  };

  const triggerFormalWarning = (type, reason) => {
    warningCountRef.current += 1;
    const count = warningCountRef.current;
    logViolation(type, reason, count);
    if (count >= 3) { handleForceEnd('Interview ended due to repeated integrity violations.'); return; }
    setFormalWarning({ type, reason, warningNumber: count, maxWarnings: 3 });
  };

  const logViolation = async (type, reason, warnNum = null) => {
    const entry = { timestamp: new Date().toISOString(), type, reason, warning_number: warnNum };
    integrityLogRef.current = [...integrityLogRef.current, entry];
    if (sessionId) {
      await supabase.from('interview_sessions').update({ integrity_log: integrityLogRef.current }).eq('id', sessionId).catch(e => console.error('Log violation:', e));
    }
  };

  const handleForceEnd = async (reason) => {
    clearInterval(detectionIntervalRef.current);
    clearInterval(questionTimerRef.current);
    clearInterval(sessionTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    await supabase.from('interview_sessions').update({
      force_terminated: true, termination_reason: reason,
      status: 'terminated', integrity_log: integrityLogRef.current,
      completed_at: new Date().toISOString(),
    }).eq('id', sessionId);
    setInterviewDone(true);
    setTerminatedReason(reason);
  };

  // AC-1: Tab switching detection
  useEffect(() => {
    if (!interviewStarted) return;
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches(prev => {
          const next = prev + 1;
          logViolation('tab_switch', `Tab switch #${next} during interview`);
          if (next === 1) showLiveWarning('tab_switch', 'Tab switch detected', 'Please do not leave this tab during the interview.');
          else if (next === 2) triggerFormalWarning('tab_switch', 'You switched tabs again during the interview. This is your final warning.');
          else if (next >= 3) handleForceEnd('Interview ended: repeated tab switching.');
          return next;
        });
      }
    };
    const handleBlur = () => handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => { document.removeEventListener('visibilitychange', handleVisibility); window.removeEventListener('blur', handleBlur); };
  }, [interviewStarted]);

  // AC-2: Fullscreen lock (desktop only)
  useEffect(() => {
    if (!interviewStarted) return;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) return;
    document.documentElement.requestFullscreen().catch(e => console.warn('Fullscreen:', e));
    const handleFSChange = () => {
      if (!document.fullscreenElement) {
        setTimeout(() => { document.documentElement.requestFullscreen().catch(() => {}); }, 400);
        logViolation('fullscreen_exit', 'Exited fullscreen during interview');
        triggerFormalWarning('fullscreen_exit', 'You exited fullscreen during the interview.');
      }
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => { document.removeEventListener('fullscreenchange', handleFSChange); document.exitFullscreen?.(); };
  }, [interviewStarted]);

  // AC-3: Keyboard blocking (Ctrl+C/V/A/T/W, F12, etc.)
  useEffect(() => {
    if (!interviewStarted) return;
    const handleKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const blocked = (ctrl && ['c','v','a','x','t','w','u','p','s','f'].includes(e.key.toLowerCase())) ||
        (ctrl && e.shiftKey && ['i','j','c','k'].includes(e.key.toLowerCase())) ||
        ['F12','F11'].includes(e.key) || (e.altKey && (e.key === 'Tab' || e.key === 'F4'));
      if (blocked) { e.preventDefault(); e.stopPropagation(); logViolation('keyboard_block', `Blocked: ${ctrl ? 'Ctrl+' : ''}${e.key}`); }
    };
    const blockCopy = (e) => { e.preventDefault(); showLiveWarning('copy', 'Copy not allowed', 'You cannot copy text during the interview.'); };
    const blockPaste = (e) => { e.preventDefault(); logViolation('paste_attempt', 'Student attempted to paste during interview'); showLiveWarning('paste', 'Paste not allowed', 'You must type your own answers.'); };
    const blockCtx = (e) => e.preventDefault();
    document.addEventListener('keydown', handleKey, true);
    document.addEventListener('copy', blockCopy);
    document.addEventListener('paste', blockPaste);
    document.addEventListener('contextmenu', blockCtx);
    return () => { document.removeEventListener('keydown', handleKey, true); document.removeEventListener('copy', blockCopy); document.removeEventListener('paste', blockPaste); document.removeEventListener('contextmenu', blockCtx); };
  }, [interviewStarted]);

  // AC-4: Screenshot + screen share blocking
  useEffect(() => {
    if (!interviewStarted) return;
    const handleKey = (e) => {
      if (e.key === 'PrintScreen' || e.key === 'Meta') {
        e.preventDefault();
        logViolation('screenshot_attempt', 'Print Screen attempted during interview');
        showLiveWarning('screenshot', 'Screenshots not permitted', 'Screenshots are blocked during the interview.');
      }
    };
    const origGDM = navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices);
    if (origGDM && navigator.mediaDevices) {
      navigator.mediaDevices.getDisplayMedia = async () => {
        logViolation('screen_share_attempt', 'Screen share attempted during interview');
        triggerFormalWarning('screen_share', 'Screen sharing is not permitted during the interview.');
        throw new Error('Screen sharing blocked');
      };
    }
    document.addEventListener('keyup', handleKey);
    return () => { document.removeEventListener('keyup', handleKey); if (origGDM && navigator.mediaDevices) navigator.mediaDevices.getDisplayMedia = origGDM; };
  }, [interviewStarted]);

  // AC-5: Camera + face tracking
  useEffect(() => {
    if (!interviewStarted) return;
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        streamRef.current = stream;
        setCameraStatus('ok');
        // Load face-api.js dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
        script.onload = async () => {
          const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/models';
          try {
            await Promise.all([
              window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
              window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
            ]);
          } catch (e) { console.warn('face-api models:', e); return; }
          detectionIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || !window.faceapi) return;
            try {
              const detections = await window.faceapi.detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 })).withFaceLandmarks(true);
              if (detections.length === 0) {
                noFaceSecondsRef.current += 1.5; setCameraStatus('no_face');
                if (noFaceSecondsRef.current >= 10) { noFaceSecondsRef.current = 0; triggerFormalWarning('face_absent', 'Your face was not visible for 10 seconds.'); }
                return;
              }
              noFaceSecondsRef.current = 0;
              if (detections.length > 1) { triggerFormalWarning('multiple_faces', 'Multiple faces detected during interview.'); return; }
              const lm = detections[0].landmarks; const le = lm.getLeftEye(); const re = lm.getRightEye(); const nose = lm.getNose(); const jaw = lm.getJawOutline();
              const eyeMidX = (le[0].x + re[re.length - 1].x) / 2; const noseTip = nose[4]; const faceW = Math.abs(jaw[16].x - jaw[0].x);
              const normH = Math.abs(noseTip.x - eyeMidX) / (faceW * 0.5);
              if (normH > 0.30) {
                lookAwaySecondsRef.current += 1.5; setCameraStatus('looking_away');
                if (lookAwaySecondsRef.current >= 7) { lookAwaySecondsRef.current = 0; triggerFormalWarning('gaze_deviation', 'You were looking away from the screen for an extended period.'); }
              } else { lookAwaySecondsRef.current = Math.max(0, lookAwaySecondsRef.current - 1.5); setCameraStatus('ok'); }
            } catch (e) { console.warn('Detection error:', e); }
          }, 1500);
        };
        document.head.appendChild(script);
      } catch (err) { console.warn('Camera init failed:', err); setCameraStatus('error'); }
    };
    initCamera();
    return () => { clearInterval(detectionIntervalRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [interviewStarted]);

  const TIPS = [
    'Be specific. Name exact technologies you used.',
    'Reference your actual project experience.',
    'If unsure, explain your reasoning — thinking aloud is valued.',
    'Keep answers focused — 3-5 sentences is ideal.',
    'Avoid generic answers. Interviewers can tell.',
    'Connect your answers back to your projects.',
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Aria Interview</span>
          <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: '100px', fontSize: '12px' }}>
            DDS University · {application?.branch?.split(' ')[0] || ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '13px', opacity: 0.8 }}>Question {questionNumber} of 10</span>
          <span style={{ fontFamily: 'monospace', fontSize: '14px', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '6px' }}>
            ⏱ {formatTime(sessionTimer)}
          </span>
          {/* Camera preview */}
          <div style={{ width: '48px', height: '36px', borderRadius: '6px', overflow: 'hidden', border: `2px solid ${cameraStatus === 'ok' ? '#4ade80' : cameraStatus === 'looking_away' ? '#fbbf24' : '#f87171'}` }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          </div>
        </div>
      </div>

      {/* ── THINKING TIME INDICATOR ── */}
      {thinkingTime && (
        <div style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e',
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <span style={{ fontSize: '14px', color: '#166534', fontWeight: 600 }}>
            Take a moment to think before answering...
          </span>
          <span style={{ fontSize: '12px', color: '#4ade80', marginLeft: 'auto' }}>Timer starts in 5s</span>
        </div>
      )}

      {/* ── QUESTION TIMER BAR ── */}
      {timerActive && (
        <div style={{ backgroundColor: timerWarning ? '#fef3c7' : '#eef2ff', borderBottom: `1px solid ${timerWarning ? '#f59e0b' : '#c7d2fe'}`, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: '13px', color: timerWarning ? '#92400e' : '#4338ca', fontWeight: 500 }}>
            {timerWarning ? '⚠ ' : ''}Time to answer: {formatTime(questionTimer)}
          </span>
          <div style={{ flex: 1, maxWidth: '300px', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '100px', marginLeft: '16px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '100px', backgroundColor: timerWarning ? '#f59e0b' : '#4338ca', width: `${(questionTimer / 120) * 100}%`, transition: 'width 1s linear, background-color 0.3s' }} />
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: '240px', flexShrink: 0, backgroundColor: 'white', borderRight: '1px solid #e5e7eb', padding: '20px 16px', overflowY: 'auto' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#1e3a5f', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'white', marginBottom: '12px' }}>
            {studentName?.[0]?.toUpperCase() || 'S'}
          </div>
          <p style={{ fontWeight: 600, fontSize: '15px', color: '#111827', marginBottom: '4px' }}>{studentName || 'Student'}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>{application?.branch || ''}</p>

          {/* Progress dots */}
          <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Progress</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: i < questionNumber ? '#1e3a5f' : i === questionNumber ? '#c8960a' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: i < questionNumber || i === questionNumber ? 'white' : '#9ca3af' }}>
                {i + 1}
              </div>
            ))}
          </div>

          {attemptNumber === 2 && (
            <div style={{ marginTop: '16px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: '#92400e', fontWeight: 600 }}>
              ⚠ Final attempt (2/2)
            </div>
          )}

          {/* Rotating tips */}
          <div style={{ marginTop: '24px', backgroundColor: '#f8f9fa', borderRadius: '10px', padding: '12px' }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Tip</p>
            <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
              {TIPS[Math.floor(sessionTimer / 90) % TIPS.length]}
            </p>
          </div>
        </div>

        {/* CHAT AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '16px' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: '32px', height: '32px', backgroundColor: '#1e3a5f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5c842', fontWeight: 700, fontSize: '13px', marginRight: '10px', flexShrink: 0, marginTop: '4px' }}>A</div>
                )}
                <div style={{ maxWidth: '70%' }}>
                  {msg.typing && !msg.content ? (
                    <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[0, 1, 2].map(j => (
                        <div key={j} style={{ width: '7px', height: '7px', backgroundColor: '#9ca3af', borderRadius: '50%', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${j * 0.2}s` }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ backgroundColor: msg.role === 'user' ? '#1e3a5f' : 'white', color: msg.role === 'user' ? 'white' : '#111827', padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: '14px', lineHeight: 1.6, border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', textAlign: msg.role === 'user' ? 'right' : 'left', paddingLeft: msg.role === 'assistant' ? '4px' : 0 }}>
                    {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.timedOut && <span style={{ color: '#f87171', marginLeft: '6px' }}>(time limit reached)</span>}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator (when isTyping but no streaming placeholder) */}
            {isTyping && messages.length > 0 && !messages[messages.length - 1]?.typing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', backgroundColor: '#1e3a5f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5c842', fontWeight: 700, fontSize: '13px' }}>A</div>
                <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{ width: '7px', height: '7px', backgroundColor: '#9ca3af', borderRadius: '50%', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${j * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {!interviewDone ? (
            <div style={{ padding: '16px 24px', backgroundColor: 'white', borderTop: '1px solid #e5e7eb' }}>
              {/* Voice recording indicator */}
              {isListening && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px 14px', backgroundColor: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>Recording — speak your answer clearly</span>
                  <button
                    onClick={toggleSpeechRecognition}
                    style={{ marginLeft: 'auto', fontSize: '12px', color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
                  >Stop</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                {/* Mic button */}
                {speechSupported && (
                  <button
                    onClick={toggleSpeechRecognition}
                    disabled={isTyping || interviewDone}
                    title={isListening ? 'Stop recording' : 'Speak your answer'}
                    style={{
                      width: '48px', height: '48px', border: 'none', borderRadius: '12px', cursor: isTyping ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s',
                      backgroundColor: isListening ? '#ef4444' : '#f3f4f6',
                      boxShadow: isListening ? '0 0 0 3px rgba(239,68,68,0.3)' : 'none',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isListening ? 'white' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  disabled={isTyping || interviewDone}
                  placeholder={isListening ? 'Listening... speak your answer' : 'Type your answer here... (Enter to send)'}
                  style={{ flex: 1, minHeight: '52px', maxHeight: '140px', padding: '14px 16px', fontSize: '14px', border: `1px solid ${isListening ? '#fca5a5' : '#e5e7eb'}`, borderRadius: '12px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, backgroundColor: isTyping ? '#f9fafb' : isListening ? '#fff5f5' : 'white', transition: 'border-color 0.2s, background-color 0.2s' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping || interviewDone}
                  style={{ width: '48px', height: '48px', backgroundColor: inputValue.trim() && !isTyping ? '#1e3a5f' : '#e5e7eb', border: 'none', borderRadius: '12px', cursor: inputValue.trim() && !isTyping ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background-color 0.2s' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', textAlign: 'center' }}>
                {speechSupported
                  ? 'Press Enter to send · Shift+Enter for new line · 🎤 Click mic to speak'
                  : 'Press Enter to send · Shift+Enter for new line'
                }
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Interview Complete Screen ── */}
      <AnimatePresence>
        {interviewDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backgroundColor: '#f8f9fa' }}
          >
            <div style={{ maxWidth: '520px', width: '100%', backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e5e7eb', padding: '40px', textAlign: 'center', margin: '0 16px' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1e3a5f', marginBottom: '8px' }}>Interview Complete</h2>
              <p style={{ color: '#6b7280', fontSize: '15px', marginBottom: '32px' }}>
                Thank you {studentName}. Your interview has been submitted to DDS University for review.
              </p>
              <div style={{ backgroundColor: '#f8f9fa', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Your Interview Score</p>
                <div style={{ fontSize: '48px', fontWeight: 700, color: '#1e3a5f', filter: 'blur(8px)', userSelect: 'none' }}>
                  {scoreData?.total_score || '--'}/100
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>Score revealed after admissions committee review</p>
              </div>
              <div style={{ backgroundColor: '#eef2ff', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: '#3730a3' }}>📧 Decision expected within <strong>7 working days</strong></p>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ width: '100%', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
                Return to Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FORMAL WARNING MODAL ── */}
      {formalWarning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', maxWidth: '420px', width: '100%', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#dc2626', padding: '20px 24px' }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '17px' }}>⚠ Integrity Warning {formalWarning.warningNumber} of 3</p>
              <p style={{ color: '#fca5a5', fontSize: '13px', marginTop: '4px' }}>DDS University Interview Proctoring</p>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ color: '#374151', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>{formalWarning.reason}</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {[1, 2, 3].map(n => (<div key={n} style={{ flex: 1, height: '6px', borderRadius: '100px', backgroundColor: n <= formalWarning.warningNumber ? '#dc2626' : '#e5e7eb' }} />))}
              </div>
              <div style={{ backgroundColor: '#fef3c7', borderRadius: '10px', padding: '12px', marginBottom: '20px', fontSize: '13px', color: '#92400e' }}>
                {formalWarning.warningNumber < 3 ? `${3 - formalWarning.warningNumber} warning(s) remaining before interview termination.` : 'Final warning issued.'}
              </div>
              <button onClick={() => setFormalWarning(null)} style={{ width: '100%', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>I Understand — Continue Interview</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE WARNING TOAST ── */}
      {liveWarning && (
        <div style={{ position: 'fixed', top: '72px', left: '50%', transform: 'translateX(-50%)', zIndex: 9998, backgroundColor: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '12px', padding: '12px 16px', maxWidth: '360px', width: '90%', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '18px' }}>⚠</span>
          <div>
            <p style={{ fontWeight: 600, fontSize: '13px', color: '#92400e' }}>{liveWarning.title}</p>
            <p style={{ fontSize: '12px', color: '#b45309', marginTop: '2px', lineHeight: 1.5 }}>{liveWarning.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

