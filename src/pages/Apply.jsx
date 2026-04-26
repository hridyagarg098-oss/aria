import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight, Loader, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { callAI, buildScoringPrompt, parseAIJson } from '../utils/ai';
import { Button, Card, Input, Textarea, Select, Badge, BRANCHES } from '../components/ui';
import toast from 'react-hot-toast';

// Eligibility criteria — server-side only, never shown to student during form
const DDS_CRITERIA = {
  physics_min: 60,
  chemistry_min: 60,
  maths_min: 60,
  pcm_avg_min: 75,
  jee_min: 90,
};

const STEPS = ['Personal', 'Academics', 'Profile'];

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export default function Apply() {
  const { user, studentProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState('');
  const [declared, setDeclared] = useState(false);
  const [universityId, setUniversityId] = useState(null);

  const [form, setForm] = useState({
    name: studentProfile?.name || '',
    phone: studentProfile?.phone || '',
    city: studentProfile?.city || '',
    branch: '',
    physics: '',
    chemistry: '',
    maths: '',
    jee: '',
    projects: '',
    extra: '',
    whyDDS: '',
    whyBranch: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (studentProfile) {
      setForm(prev => ({
        ...prev,
        name: studentProfile.name || '',
        phone: studentProfile.phone || '',
        city: studentProfile.city || '',
      }));
    }
  }, [studentProfile]);

  useEffect(() => {
    const checkExisting = async () => {
      if (!user) return;
      // Wait a tick to let getDDSUniversityId resolve first
      await new Promise(r => setTimeout(r, 100));
      const uid = await getDDSUniversityId();
      const { data } = await supabase
        .from('applications')
        .select('id, status')
        .eq('student_id', user.id)
        .eq('university_id', uid)
        .single();
      if (data) {
        toast('You have already submitted an application.', { icon: '📋' });
        navigate('/dashboard');
      }
    };
    checkExisting();
  }, [user]);

  // Fetch university ID once at mount — avoids concurrent auth lock contention later
  const getDDSUniversityId = async () => {
    if (universityId) return universityId;
    const { data } = await supabase.from('universities').select('id').eq('slug', 'dds-university').single();
    const id = data?.id;
    if (id) setUniversityId(id);
    return id;
  };

  // A simple retry wrapper for Supabase ops that may hit lock contention
  const withRetry = async (fn, retries = 2, delayMs = 500) => {
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (err) {
        const isLockErr = err?.message?.toLowerCase().includes('lock') || err?.message?.toLowerCase().includes('stolen');
        if (isLockErr && i < retries) {
          await new Promise(r => setTimeout(r, delayMs * (i + 1)));
          continue;
        }
        throw err;
      }
    }
  };

  useEffect(() => {
    // Fetch university ID eagerly so it's cached before submit
    if (user) getDDSUniversityId();
  }, [user]);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;

  const validateStep = () => {
    const errs = {};
    if (step === 0) {
      if (!form.name.trim()) errs.name = 'Full name is required';
      if (!form.phone.trim()) errs.phone = 'Phone number is required';
      if (!form.city.trim()) errs.city = 'City is required';
      if (!form.branch) errs.branch = 'Please select a branch';
    }
    if (step === 1) {
      if (!form.physics || +form.physics < 0 || +form.physics > 100) errs.physics = 'Enter a valid percentage (0–100)';
      if (!form.chemistry || +form.chemistry < 0 || +form.chemistry > 100) errs.chemistry = 'Enter a valid percentage (0–100)';
      if (!form.maths || +form.maths < 0 || +form.maths > 100) errs.maths = 'Enter a valid percentage (0–100)';
      if (!form.jee || +form.jee < 0 || +form.jee > 100) errs.jee = 'Enter a valid JEE percentile (0–100)';
    }
    if (step === 2) {
      if (form.projects.trim().length < 100) errs.projects = 'Minimum 100 characters required';
      if (!form.whyDDS.trim()) errs.whyDDS = 'Required';
      if (wordCount(form.whyDDS) < 150) errs.whyDDS = `Minimum 150 words required (currently ${wordCount(form.whyDDS)})`;
      if (!form.whyBranch.trim()) errs.whyBranch = 'Required';
      if (wordCount(form.whyBranch) < 100) errs.whyBranch = `Minimum 100 words required (currently ${wordCount(form.whyBranch)})`;
      if (!declared) errs.declared = 'You must accept the declaration to submit';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setDir(1);
    setStep(s => s + 1);
  };

  const prevStep = () => {
    setDir(-1);
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);

    try {
      const uid = universityId || await getDDSUniversityId();
      if (!uid) throw new Error('Could not find university. Please refresh and try again.');

      // Step 1: Upsert student profile
      setSubmitStage('Saving your profile...');
      const { error: studentErr } = await withRetry(() =>
        supabase.from('students').upsert({
          id: user.id,
          email: user.email,
          name: form.name,
          phone: form.phone,
          city: form.city,
        })
      );
      if (studentErr) throw studentErr;

      // Step 2: Create application
      setSubmitStage('Creating application...');
      const formData = {
        name: form.name, city: form.city, branch: form.branch,
        physics: form.physics, chemistry: form.chemistry, maths: form.maths,
        jee: form.jee, projects: form.projects, extra: form.extra,
        whyDDS: form.whyDDS, whyBranch: form.whyBranch,
      };

      const { data: appData, error: appError } = await withRetry(() =>
        supabase
          .from('applications')
          .insert({
            student_id: user.id,
            university_id: uid,
            branch: form.branch,
            form_data: formData,
            stage: 1,
            status: 'pending',
          })
          .select()
          .single()
      );
      if (appError) throw appError;

      // Step 3: Server-side eligibility check
      setSubmitStage('Checking eligibility criteria...');
      await new Promise(r => setTimeout(r, 600));

      const phy = +form.physics, che = +form.chemistry, mat = +form.maths, jee = +form.jee;
      const pcmAvg = (phy + che + mat) / 3;

      const failures = [];
      if (phy < DDS_CRITERIA.physics_min) failures.push(`Physics score: You entered ${phy}% (minimum required: ${DDS_CRITERIA.physics_min}%)`);
      if (che < DDS_CRITERIA.chemistry_min) failures.push(`Chemistry score: You entered ${che}% (minimum required: ${DDS_CRITERIA.chemistry_min}%)`);
      if (mat < DDS_CRITERIA.maths_min) failures.push(`Maths score: You entered ${mat}% (minimum required: ${DDS_CRITERIA.maths_min}%)`);
      if (pcmAvg < DDS_CRITERIA.pcm_avg_min) failures.push(`PCM Average: Your average is ${pcmAvg.toFixed(1)}% (minimum required: ${DDS_CRITERIA.pcm_avg_min}%)`);
      if (jee < DDS_CRITERIA.jee_min) failures.push(`JEE Percentile: You entered ${jee} (minimum required: ${DDS_CRITERIA.jee_min})`);

      if (failures.length > 0) {
        await withRetry(() =>
          supabase.from('applications').update({
            status: 'rejected_s1',
            stage: 1,
            eligibility_result: { passed: false, failures },
          }).eq('id', appData.id)
        );
        await refreshProfile();
        toast('Application submitted. See your dashboard for results.', { icon: '📋' });
        navigate('/dashboard');
        return;
      }

      // Step 4: AI scoring (only if eligible)
      setSubmitStage('Scoring your application profile...');
      const { system, user: userMsg } = buildScoringPrompt(formData);
      const aiResponse = await callAI([{ role: 'user', content: userMsg }], system);
      const aiResult = parseAIJson(aiResponse);

      setSubmitStage('Generating personalised feedback...');
      await new Promise(r => setTimeout(r, 400));

      // Step 5: Save AI results
      const aiUpdate = aiResult ? {
        ai_score: aiResult.score,
        ai_grade: aiResult.grade,
        ai_feedback: aiResult.feedback,
        ai_strengths: aiResult.strengths,
        ai_improvements: aiResult.improvements,
        ai_academic_remark: aiResult.academic_remark,
        status: 'passed_s1',
        stage: 2,
        eligibility_result: { passed: true, failures: [] },
      } : {
        status: 'passed_s1',
        stage: 2,
        eligibility_result: { passed: true, failures: [] },
      };

      await withRetry(() =>
        supabase.from('applications').update(aiUpdate).eq('id', appData.id)
      );

      setSubmitStage('Done!');
      await refreshProfile();
      toast.success('Application submitted successfully!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Submit error:', err);
      // User-friendly message for lock errors
      const isLock = err?.message?.toLowerCase().includes('lock') || err?.message?.toLowerCase().includes('stolen');
      toast.error(isLock
        ? 'Network hiccup — please try submitting again.'
        : 'Submission failed: ' + (err.message || 'Unknown error')
      );
      setSubmitting(false);
      setSubmitStage('');
    }
  };

  const whyDDSWords = wordCount(form.whyDDS);
  const whyBranchWords = wordCount(form.whyBranch);

  if (submitting) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center">
        <div className="bg-white border border-border rounded-card p-10 shadow-sm max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-navy/5 rounded-full flex items-center justify-center mx-auto mb-5">
            <Loader className="w-8 h-8 text-navy animate-spin" />
          </div>
          <h3 className="text-card-title font-semibold text-navy mb-2">Aria AI is reviewing your application</h3>
          <p className="text-sm text-gray-500 mb-6">{submitStage}</p>
          <div className="space-y-2">
            {['Checking eligibility criteria', 'Scoring application profile', 'Generating personalised feedback'].map((s, i) => {
              const stageIdx = ['Checking', 'Scoring', 'Generating'].findIndex(k => submitStage.includes(k));
              const done = i < stageIdx;
              const active = i === stageIdx;
              return (
                <div key={s} className={`flex items-center gap-3 text-sm ${done ? 'text-green-600' : active ? 'text-navy' : 'text-gray-400'}`}>
                  {done
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    : active
                    ? <Loader className="w-4 h-4 animate-spin" />
                    : <div className="w-4 h-4 rounded-full border-2 border-gray-200" />}
                  {s}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-white border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <span className="font-bold text-navy">DDS University</span>
          <span className="text-gray-300 mx-2">·</span>
          <span className="text-sm text-gray-500">2025 Admissions Application</span>
        </div>
        <Badge variant="gold">Powered by Aria</Badge>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 ${i <= step ? 'text-navy' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-navy text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="text-xs font-semibold hidden sm:block">{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 transition-all ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs text-gray-400">Step {step + 1} of {STEPS.length}</p>
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.25 }}
          >
            {/* STEP 0 — Personal */}
            {step === 0 && (
              <Card>
                <h2 className="text-card-title font-semibold text-navy mb-1">Personal Information</h2>
                <p className="text-sm text-gray-500 mb-6">Basic details for your application.</p>
                <div className="space-y-4">
                  <Input label="Full Name" placeholder="Rahul Sharma" value={form.name} onChange={e => update('name', e.target.value)} error={errors.name} required />
                  <Input label="Phone Number" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={e => update('phone', e.target.value)} error={errors.phone} required />
                  <Input label="City, State" placeholder="Mumbai, Maharashtra" value={form.city} onChange={e => update('city', e.target.value)} error={errors.city} required />
                  <Select label="Branch Preference" value={form.branch} onChange={e => update('branch', e.target.value)} error={errors.branch}>
                    <option value="">Select your preferred branch</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="primary" onClick={nextStep} className="gap-2">
                    Continue <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 1 — Academics (NO eligibility indicators) */}
            {step === 1 && (
              <div className="space-y-4">
                <Card>
                  <h2 className="text-card-title font-semibold text-navy mb-1">Academic Details</h2>
                  <p className="text-sm text-gray-500 mb-6">Enter your Class 12 Board scores and JEE percentile exactly as they appear on your marksheet.</p>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <Input
                      label="Your Physics score in Class 12 Board exams (%)"
                      type="number" min="0" max="100"
                      placeholder="82"
                      value={form.physics}
                      onChange={e => update('physics', e.target.value)}
                      error={errors.physics}
                    />
                    <Input
                      label="Your Chemistry score in Class 12 Board exams (%)"
                      type="number" min="0" max="100"
                      placeholder="75"
                      value={form.chemistry}
                      onChange={e => update('chemistry', e.target.value)}
                      error={errors.chemistry}
                    />
                    <Input
                      label="Your Maths score in Class 12 Board exams (%)"
                      type="number" min="0" max="100"
                      placeholder="91"
                      value={form.maths}
                      onChange={e => update('maths', e.target.value)}
                      error={errors.maths}
                    />
                  </div>
                  <Input
                    label="Your JEE Mains 2024/2025 Percentile"
                    type="number" min="0" max="100" step="0.01"
                    placeholder="94.5"
                    value={form.jee}
                    onChange={e => update('jee', e.target.value)}
                    error={errors.jee}
                  />
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <p className="text-xs text-amber-800 font-medium">
                      ⚠️ Enter your actual scores. Misrepresentation leads to immediate disqualification from DDS University admissions.
                    </p>
                  </div>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>← Back</Button>
                  <Button variant="primary" onClick={nextStep} className="gap-2">
                    Continue <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2 — Profile */}
            {step === 2 && (
              <div className="space-y-4">
                <Card>
                  <h2 className="text-card-title font-semibold text-navy mb-1">Profile & Motivation</h2>
                  <p className="text-sm text-gray-500 mb-6">The AI interview will reference what you write here. Be specific and genuine.</p>

                  <div className="space-y-5">
                    <div>
                      <Textarea
                        label="Projects & Achievements *"
                        placeholder="Describe your best project — what problem did it solve? How did you build it? What did you learn? Be specific about technologies, approaches, and outcomes."
                        value={form.projects}
                        onChange={e => update('projects', e.target.value)}
                        rows={5}
                        error={errors.projects}
                      />
                      <p className={`text-xs mt-1 ${form.projects.length >= 100 ? 'text-green-600' : 'text-gray-400'}`}>
                        {form.projects.length} / 100 characters minimum
                      </p>
                    </div>

                    <div>
                      <Textarea
                        label="Extracurriculars (Optional)"
                        placeholder="Sports, competitions, clubs, volunteering, leadership roles..."
                        value={form.extra}
                        onChange={e => update('extra', e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div>
                      <Textarea
                        label="Why DDS University? * (150–300 words)"
                        placeholder="What specifically draws you to DDS University? Mention programs, faculty, research, culture — be concrete, not generic."
                        value={form.whyDDS}
                        onChange={e => update('whyDDS', e.target.value)}
                        rows={6}
                        error={errors.whyDDS}
                      />
                      <p className={`text-xs mt-1 ${whyDDSWords >= 150 && whyDDSWords <= 300 ? 'text-green-600' : whyDDSWords > 0 && whyDDSWords < 150 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {whyDDSWords} words {whyDDSWords < 150 ? `(${150 - whyDDSWords} more needed)` : whyDDSWords > 300 ? '(over limit)' : '✓ Good length'}
                      </p>
                    </div>

                    <div>
                      <Textarea
                        label={`Why ${form.branch || 'this branch'}? * (100–200 words)`}
                        placeholder="Why this specific branch? Connect it to your background, experiences, and future goals."
                        value={form.whyBranch}
                        onChange={e => update('whyBranch', e.target.value)}
                        rows={5}
                        error={errors.whyBranch}
                      />
                      <p className={`text-xs mt-1 ${whyBranchWords >= 100 && whyBranchWords <= 200 ? 'text-green-600' : whyBranchWords > 0 && whyBranchWords < 100 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {whyBranchWords} words {whyBranchWords < 100 ? `(${100 - whyBranchWords} more needed)` : '✓ Good'}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Declaration checkbox */}
                <Card className={`border ${errors.declared ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <button
                    type="button"
                    onClick={() => { setDeclared(d => !d); if (errors.declared) setErrors(p => ({ ...p, declared: '' })); }}
                    className="flex items-start gap-3 w-full text-left"
                  >
                    {declared
                      ? <CheckSquare className="w-5 h-5 text-navy flex-shrink-0 mt-0.5" />
                      : <Square className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />}
                    <p className="text-sm text-gray-700 leading-relaxed">
                      I declare that all academic scores entered are accurate and match my official board/JEE records.
                      I understand that false information leads to <strong>permanent disqualification</strong> from DDS University admissions.
                    </p>
                  </button>
                  {errors.declared && <p className="text-xs text-red-600 mt-2 pl-8">{errors.declared}</p>}
                </Card>

                <div className="bg-gold-bg border border-yellow-200 rounded-card p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800 mb-0.5">Your AI interview will be based on this</p>
                      <p className="text-xs text-amber-700">The AI interview agent will read your application and ask specific questions about your projects and essays. Write genuinely — it will probe for depth.</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={prevStep}>← Back</Button>
                  <Button variant="primary" size="lg" onClick={handleSubmit} className="gap-2">
                    Submit Application <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
