import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Save, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card, Input, Select, Badge } from '../../components/ui';
import AdminLayout from './AdminLayout';
import toast from 'react-hot-toast';

const SUBJECTS = ['Maths', 'Physics', 'Chemistry'];
const DISTRIBUTIONS = { Maths: 7, Physics: 5, Chemistry: 3 };

const BLANK_QUESTION = (subject) => ({
  id: Math.random().toString(36).slice(2),
  subject,
  difficulty: 'medium',
  question: '',
  options: ['', '', '', ''],
  correct: 0,
});

export default function TestBuilder() {
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [testId, setTestId] = useState(null);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(900);
  const [expandedQ, setExpandedQ] = useState(null);
  const [universityId, setUniversityId] = useState(null);

  useEffect(() => { fetchTest(); }, []);

  const fetchTest = async () => {
    const { data: uni } = await supabase.from('universities').select('id').eq('slug', 'dds-university').single();
    if (!uni) return;
    setUniversityId(uni.id);

    const { data: test } = await supabase
      .from('aptitude_tests')
      .select('*')
      .eq('university_id', uni.id)
      .single();

    if (test) {
      setTestId(test.id);
      setQuestions(test.questions.map(q => ({ ...q, id: q.id || Math.random().toString(36).slice(2) })));
      setTimeLimitSeconds(test.time_limit_seconds || 900);
    } else {
      // Initialize with defaults from each subject
      const defaults = SUBJECTS.flatMap(sub =>
        Array.from({ length: DISTRIBUTIONS[sub] }, () => BLANK_QUESTION(sub))
      );
      setQuestions(defaults);
    }
  };

  const addQuestion = (subject) => {
    const q = BLANK_QUESTION(subject);
    setQuestions(prev => [...prev, q]);
    setExpandedQ(q.id);
    toast(`Added ${subject} question`, { duration: 1500 });
  };

  const updateQuestion = (id, updates) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const updateOption = (qId, optIdx, value) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      const opts = [...q.options];
      opts[optIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const removeQuestion = (id) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
    if (expandedQ === id) setExpandedQ(null);
  };

  const countBySubject = (subject) => questions.filter(q => q.subject === subject).length;

  const validate = () => {
    const total = questions.length;
    if (total < 1) { toast.error('Add at least 1 question'); return false; }
    const incomplete = questions.find(q => !q.question.trim() || q.options.some(o => !o.trim()));
    if (incomplete) {
      toast.error('All questions and options must be filled in');
      setExpandedQ(incomplete.id);
      return false;
    }
    return true;
  };

  const saveTest = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        university_id: universityId,
        questions: questions.map(({ id, ...rest }) => ({ ...rest, id })),
        time_limit_seconds: timeLimitSeconds,
        is_active: true,
      };

      if (testId) {
        await supabase.from('aptitude_tests').update(payload).eq('id', testId);
      } else {
        const { data } = await supabase.from('aptitude_tests').insert(payload).select().single();
        setTestId(data.id);
      }
      toast.success(`Test saved — ${questions.length} questions`);
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const groupedBySubject = SUBJECTS.reduce((acc, sub) => {
    acc[sub] = questions.filter(q => q.subject === sub);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-section-head text-navy">Test Builder</h1>
          <p className="text-gray-500 text-sm mt-1">
            {questions.length} questions · {Math.floor(timeLimitSeconds / 60)} min test
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-border rounded-btn px-3 py-2">
            <span className="text-xs text-gray-500">Time Limit:</span>
            <select
              value={timeLimitSeconds}
              onChange={e => setTimeLimitSeconds(+e.target.value)}
              className="text-sm font-medium text-navy outline-none bg-transparent"
            >
              {[600, 900, 1200, 1800].map(s => (
                <option key={s} value={s}>{s / 60} min</option>
              ))}
            </select>
          </div>
          <Button variant="primary" onClick={saveTest} loading={saving} className="gap-2">
            <Save className="w-4 h-4" /> Save Test
          </Button>
        </div>
      </div>

      {/* Distribution summary */}
      <Card className="mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Question Distribution (Recommended: 7M / 5P / 3C)</p>
        <div className="flex gap-4">
          {SUBJECTS.map(sub => {
            const count = countBySubject(sub);
            const recommended = DISTRIBUTIONS[sub];
            const ok = count === recommended;
            return (
              <div key={sub} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${ok ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <Badge variant={sub.toLowerCase()}>{sub}</Badge>
                <span className={`text-sm font-bold ${ok ? 'text-green-700' : 'text-amber-700'}`}>{count}</span>
                <span className="text-xs text-gray-500">/ {recommended}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-navy/20 bg-navy/5">
            <span className="text-xs text-navy font-semibold">Total</span>
            <span className="text-sm font-bold text-navy">{questions.length}</span>
          </div>
        </div>
      </Card>

      {/* Questions by subject */}
      {SUBJECTS.map(subject => (
        <div key={subject} className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge variant={subject.toLowerCase()} className="text-xs">{subject}</Badge>
              <span className="text-sm font-medium text-gray-600">{countBySubject(subject)} questions</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => addQuestion(subject)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add {subject}
            </Button>
          </div>

          <div className="space-y-3">
            {groupedBySubject[subject].length === 0 && (
              <div className="border-2 border-dashed border-gray-200 rounded-card py-8 text-center">
                <p className="text-sm text-gray-400">No {subject} questions yet</p>
                <button onClick={() => addQuestion(subject)} className="text-xs text-navy hover:underline mt-1">Add one →</button>
              </div>
            )}

            {groupedBySubject[subject].map((q, qIdx) => {
              const globalIdx = questions.indexOf(q);
              const isExpanded = expandedQ === q.id;
              const isIncomplete = !q.question.trim() || q.options.some(o => !o.trim());

              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white border rounded-card shadow-sm overflow-hidden ${isIncomplete ? 'border-amber-200' : 'border-border'}`}
                >
                  {/* Question header */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedQ(isExpanded ? null : q.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-gray-400 flex-shrink-0">
                        {String(qIdx + 1).padStart(2, '0')}
                      </span>
                      {isIncomplete && <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                      <p className="text-sm text-gray-700 truncate max-w-lg">
                        {q.question || <span className="text-gray-400 italic">No question text</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={q.difficulty === 'easy' ? 'success' : q.difficulty === 'hard' ? 'error' : 'info'}>
                        {q.difficulty}
                      </Badge>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Question body */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-t border-border px-4 py-4 space-y-4"
                    >
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1">Question Text</label>
                          <textarea
                            value={q.question}
                            onChange={e => updateQuestion(q.id, { question: e.target.value })}
                            rows={2}
                            placeholder="Enter the question..."
                            className="w-full border border-border rounded-btn px-3 py-2 text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none resize-none"
                          />
                        </div>
                        <div className="w-32">
                          <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1">Difficulty</label>
                          <select
                            value={q.difficulty}
                            onChange={e => updateQuestion(q.id, { difficulty: e.target.value })}
                            className="w-full border border-border rounded-btn px-2 py-2 text-sm focus:border-navy outline-none bg-white"
                          >
                            {['easy', 'medium', 'hard'].map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-2">Options (click to mark correct)</label>
                        <div className="grid grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex gap-2 items-center">
                              <button
                                onClick={() => updateQuestion(q.id, { correct: optIdx })}
                                className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${
                                  q.correct === optIdx
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-gray-300 text-gray-400 hover:border-green-400'
                                }`}
                              >
                                {q.correct === optIdx ? '✓' : 'ABCD'[optIdx]}
                              </button>
                              <input
                                value={opt}
                                onChange={e => updateOption(q.id, optIdx, e.target.value)}
                                placeholder={`Option ${['A', 'B', 'C', 'D'][optIdx]}`}
                                className={`flex-1 border rounded-btn px-3 py-2 text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none transition-all ${
                                  q.correct === optIdx ? 'border-green-300 bg-green-50' : 'border-border'
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-green-600 mt-1.5">
                          ✓ Correct: {q.options[q.correct] ? `Option ${['A', 'B', 'C', 'D'][q.correct]}: ${q.options[q.correct].slice(0, 40)}` : 'Not set'}
                        </p>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => removeQuestion(q.id)}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Question
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Save footer */}
      <div className="sticky bottom-0 bg-white border-t border-border px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {questions.length} questions · {Math.floor(timeLimitSeconds / 60)} minutes · avg ~{questions.length > 0 ? Math.floor(timeLimitSeconds / questions.length) : 0}s per question
        </p>
        <Button variant="primary" onClick={saveTest} loading={saving} size="lg" className="gap-2">
          <Save className="w-4 h-4" /> Save Test
        </Button>
      </div>
    </AdminLayout>
  );
}
