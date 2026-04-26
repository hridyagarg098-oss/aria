import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Clock, MessageCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { streamAI, callAI, buildInterviewSystemPrompt, buildInterviewScoringPrompt, parseAIJson } from '../utils/ai';
import { Button, Badge, Card } from '../components/ui';
import toast from 'react-hot-toast';

export default function Interview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [application, setApplication] = useState(null);
  const [testSession, setTestSession] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startedAt] = useState(Date.now());
  const [isRecording, setIsRecording] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [studentName, setStudentName] = useState('');
  const [attemptNumber, setAttemptNumber] = useState(1);
  const messagesEndRef = useRef(null);
  const durationRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    initInterview();
    durationRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(durationRef.current);
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    const name = app.form_data?.name || 'Student';
    setStudentName(name.split(' ')[0]);

    const prompt = buildInterviewSystemPrompt(app.form_data, s2score);
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
    setLoading(true);
    const ariaMsg = { role: 'aria', content: '', timestamp: new Date().toISOString() };
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
          setMessages([{ role: 'aria', content: cleanText, timestamp: new Date().toISOString() }]);
          setQuestionCount(1);
          await supabase.from('interview_sessions').update({
            messages: [{ role: 'aria', content: cleanText, timestamp: new Date().toISOString() }],
            question_count: 1,
          }).eq('id', sid);

          if (complete.includes('[INTERVIEW_COMPLETE]') || complete.includes('[DONE]')) {
            handleInterviewDone(sid, [{ role: 'aria', content: cleanText }]);
          }
        }
      );
    } catch (err) {
      toast.error('Failed to start interview. Please try again.');
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || done) return;

    const studentMsg = { role: 'student', content: input.trim(), timestamp: new Date().toISOString() };
    const newMessages = [...messages, studentMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Add typing indicator
    const typingMsg = { role: 'aria', content: '', typing: true, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, typingMsg]);

    // Build conversation history for AI
    const history = newMessages.map(m => ({
      role: m.role === 'aria' ? 'assistant' : 'user',
      content: m.content,
    }));

    let fullText = '';
    try {
      await streamAI(
        history,
        systemPrompt,
        (chunk) => {
          fullText += chunk;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'aria', content: fullText, timestamp: new Date().toISOString() };
            return updated;
          });
        },
        async (complete) => {
          const hasDone = complete.includes('[INTERVIEW_COMPLETE]') || complete.includes('[DONE]');
          const cleanText = complete.replace('[INTERVIEW_COMPLETE]', '').replace('[DONE]', '').trim();

          const finalMessages = [...newMessages, { role: 'aria', content: cleanText, timestamp: new Date().toISOString() }];
          setMessages(finalMessages);

          const newQCount = questionCount + 1;
          setQuestionCount(newQCount);

          await supabase.from('interview_sessions').update({
            messages: finalMessages,
            question_count: newQCount,
          }).eq('id', sessionId);

          if (hasDone) {
            await handleInterviewDone(sessionId, finalMessages);
          }
        }
      );
    } catch (err) {
      toast.error('Connection error. Please try again.');
      setMessages(prev => prev.filter(m => !m.typing));
    }
    setLoading(false);
  };

  const handleInterviewDone = async (sid, finalMsgs) => {
    setDone(true);
    clearInterval(durationRef.current);

    // Score the interview
    const { system, user: userMsg } = buildInterviewScoringPrompt(finalMsgs);
    let finalScore = 0;
    try {
      const scoreRes = await callAI([{ role: 'user', content: userMsg }], system);
      const scores = parseAIJson(scoreRes);
      finalScore = scores?.total_score || scores?.final_score || 0;

      await supabase.from('interview_sessions').update({
        final_score: finalScore,
        final_assessment: scores?.summary || scores?.assessment,
        communication_score: scores?.communication,
        depth_score: scores?.project_depth,
        enthusiasm_score: scores?.motivation_clarity,
        // New v2 sub-scores
        project_depth_score: scores?.project_depth,
        academic_understanding_score: scores?.academic_understanding,
        motivation_clarity_score: scores?.motivation_clarity,
        problem_solving_score: scores?.problem_solving,
        interview_grade: scores?.grade,
        recommendation: scores?.recommendation,
        admit_confidence: scores?.admit_confidence,
        key_strengths: scores?.key_strengths,
        red_flags: scores?.red_flags,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', sid);
    } catch {}

    // ── 2-Attempt logic for Stage 3 ───────────────────────────────────────
    await handleInterviewComplete(finalScore, sid);
    // ─────────────────────────────────────────────────────────────────────

    setTimeout(() => navigate('/dashboard'), 4000);
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

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Voice input not supported in this browser.');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-IN';
    recognitionRef.current.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setInput(transcript);
    };
    recognitionRef.current.onend = () => setIsRecording(false);
    recognitionRef.current.start();
    setIsRecording(true);
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const formatDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-bg flex" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Left panel */}
      <div className="w-72 bg-white border-r border-border flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {application?.form_data?.name?.charAt(0) || 'S'}
            </div>
            <div>
              <p className="font-semibold text-navy text-sm">{application?.form_data?.name}</p>
              <p className="text-xs text-gray-500">{application?.branch?.split(' ')[0]}</p>
            </div>
          </div>
          {testSession?.score && (
            <Badge variant="info" className="mt-2">Stage 2: {Math.round(testSession.score)}%</Badge>
          )}
          {attemptNumber === 2 && (
            <div className="mt-2 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
              <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-700 font-semibold">Final attempt (2/2)</span>
            </div>
          )}
        </div>

        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${done ? 'bg-green-500' : 'bg-green-500 pulse-dot'}`} />
            <span className="text-xs font-semibold text-gray-700">{done ? 'Interview Complete' : 'Interview in Progress'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-gray-500">Questions</p>
              <p className="font-bold text-navy">{questionCount} / 10</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-gray-500">Duration</p>
              <p className="font-bold text-navy">{formatDuration(duration)}</p>
            </div>
          </div>
        </div>

        <div className="p-5 flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Tips</p>
          <ul className="space-y-2">
            {[
              'Be specific about your projects',
              'Mention actual technologies used',
              'Say "I don\'t know" if unsure',
              'Ask to clarify if needed',
            ].map((tip, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="text-gold mt-0.5">→</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-navy rounded flex items-center justify-center text-white text-xs font-bold">A</div>
            <span className="text-xs font-semibold text-navy">Aria</span>
            <span className="text-xs text-gray-400 ml-auto">Confidential</span>
          </div>
        </div>
      </div>

      {/* Right panel — chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-navy">AI Admissions Interview</p>
            <p className="text-xs text-gray-500">DDS University for Engineering · 2025</p>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-mono text-gray-600">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto chat-scroll px-6 py-5 space-y-5">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'aria' && (
                  <div className="w-8 h-8 bg-navy rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mr-3 mt-0.5">
                    A
                  </div>
                )}
                <div className={`max-w-lg ${msg.role === 'aria' ? '' : 'text-right'}`}>
                  {msg.typing && !msg.content ? (
                    <div className="bg-white border border-border rounded-card px-4 py-3 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
                    </div>
                  ) : (
                    <div className={`rounded-card px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'aria'
                        ? 'bg-white border border-border border-l-4 border-l-navy text-gray-800'
                        : 'bg-navy text-white'
                    }`}>
                      {msg.content}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1 px-1">
                    {msg.role === 'aria' ? 'Aria' : 'You'}
                    {msg.timestamp && ` · ${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                {msg.role === 'student' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold flex-shrink-0 ml-3 mt-0.5">
                    {studentName?.charAt(0) || 'S'}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Done overlay */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-white/80 flex items-center justify-center z-10"
            >
              <Card className="text-center max-w-sm mx-4">
                <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-card-title font-semibold text-navy mb-2">Interview Complete!</h3>
                <p className="text-sm text-gray-500 mb-1">
                  Thank you, <span className="font-semibold">{studentName}</span>. Your interview has been submitted to DDS University.
                </p>
                <p className="text-xs text-gray-400">You will hear back regarding your admission status. Redirecting to dashboard...</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        {!done && (
          <div className="bg-white border-t border-border px-6 py-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
                  rows={3}
                  disabled={loading}
                  className="w-full border border-border rounded-card px-4 py-3 text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none transition-all resize-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={isRecording ? stopVoiceInput : startVoiceInput}
                  className={`p-2.5 rounded-btn border transition-colors ${isRecording ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-border text-gray-500 hover:border-navy hover:text-navy'}`}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <Button
                  variant="primary"
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="p-2.5"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
