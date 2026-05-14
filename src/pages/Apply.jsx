import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight, Loader, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { callAI, buildScoringPrompt, parseAIJson } from '../utils/ai';
import { sendNotification } from '../utils/notifications';
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
    state: studentProfile?.state || '',
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
        state: studentProfile.state || '',
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
  // Supabase client returns { data, error } instead of throwing, so we must check .error
  const withRetry = async (fn, retries = 2, delayMs = 500) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const result = await fn();
        // Supabase returns { data, error } — throw if error exists
        if (result?.error) {
          throw result.error;
        }
        return result;
      } catch (err) {
        const msg = (err?.message || err?.details || '').toLowerCase();
        const isRetryable = msg.includes('lock') || msg.includes('stolen') || msg.includes('timeout');
        if (isRetryable && i < retries) {
          console.warn(`Supabase retry ${i + 1}/${retries}:`, msg);
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
      else if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ''))) errs.phone = 'Please enter a valid 10-digit mobile number';
      if (!form.city.trim()) errs.city = 'City is required';
      if (!form.state) errs.state = 'Please select a state';
      if (!form.branch) errs.branch = 'Please select a branch';
    }
    if (step === 1) {
      if (!form.physics || +form.physics < 0 || +form.physics > 100) errs.physics = 'Enter a valid percentage (0-100)';
      if (!form.chemistry || +form.chemistry < 0 || +form.chemistry > 100) errs.chemistry = 'Enter a valid percentage (0-100)';
      if (!form.maths || +form.maths < 0 || +form.maths > 100) errs.maths = 'Enter a valid percentage (0-100)';
      if (!form.jee || +form.jee < 0 || +form.jee > 100) errs.jee = 'Enter a valid JEE percentile (0-100)';
    }
    if (step === 2) {
      const projWords = form.projects.trim() === '' ? 0 : form.projects.trim().split(/\s+/).length;
      if (projWords < 50) errs.projects = `Minimum 50 words required (currently ${projWords})`;
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
      await withRetry(() =>
        supabase.from('students').upsert({
          id: user.id,
          email: user.email,
          name: form.name,
          phone: '+91' + form.phone.replace(/\s/g, ''),
          city: form.city,
        })
      );

      // Step 2: Create application
      setSubmitStage('Creating application...');
      const formData = {
        name: form.name, city: form.city, state: form.state, branch: form.branch,
        physics: form.physics, chemistry: form.chemistry, maths: form.maths,
        jee: form.jee, projects: form.projects, extra: form.extra,
        whyDDS: form.whyDDS, whyBranch: form.whyBranch,
      };

      const { data: appData } = await withRetry(() =>
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

        // Fire email notification (non-blocking)
        sendNotification('stage1_scored', user.email, {
          name: form.name, score: 'N/A', grade: 'N/A', passed: false, branch: form.branch,
        });

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

      // Fire email notifications (non-blocking)
      sendNotification('application_submitted', user.email, {
        name: form.name, branch: form.branch,
      });
      if (aiResult) {
        sendNotification('stage1_scored', user.email, {
          name: form.name, score: aiResult.score, grade: aiResult.grade, passed: true, branch: form.branch,
        });
        sendNotification('stage2_unlocked', user.email, {
          name: form.name, stage1Score: aiResult.score,
        });
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Submit error:', err);
      const msg = err?.message || err?.details || err?.hint || 'Unknown error';
      const isRetryable = msg.toLowerCase().includes('lock') || msg.toLowerCase().includes('stolen') || msg.toLowerCase().includes('timeout');
      toast.error(isRetryable
        ? 'Network hiccup - please try submitting again.'
        : 'Submission failed: ' + msg
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
          <span className="text-sm text-gray-500">2026 Admissions Application</span>
        </div>

      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Back to home */}
        <a href="/" style={{fontSize:'13px',color:'#6b7280',textDecoration:'none',display:'inline-block',marginBottom:'16px'}}
          onMouseEnter={e=>e.currentTarget.style.color='#1e3a5f'}
          onMouseLeave={e=>e.currentTarget.style.color='#6b7280'}
        >&#8592; Back to DDS University</a>
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

                  {/* Phone with +91 prefix */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                    <div className={`flex border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-navy/20 ${errors.phone ? 'border-red-400' : 'border-gray-300'}`}>
                      <span className="px-3 py-3 bg-gray-50 border-r border-gray-300 text-gray-600 text-sm font-medium select-none">+91</span>
                      <input
                        type="tel"
                        placeholder="98765 43210"
                        maxLength={10}
                        value={form.phone}
                        onChange={e => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="flex-1 px-3 py-3 outline-none text-sm"
                      />
                    </div>
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>

                  {/* City + State side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">City <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        placeholder="Mumbai"
                        value={form.city}
                        onChange={e => update('city', e.target.value)}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-navy/20 ${errors.city ? 'border-red-400' : 'border-gray-300 focus:border-navy'}`}
                      />
                      {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">State <span className="text-red-500">*</span></label>
                      <select
                        value={form.state}
                        onChange={e => update('state', e.target.value)}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-navy/20 bg-white ${errors.state ? 'border-red-400' : 'border-gray-300 focus:border-navy'}`}
                      >
                        <option value="" disabled>Select State</option>
                        {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi (NCT)','Chandigarh','Puducherry','Other'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                    </div>
                  </div>

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
                    {/* Physics */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">
                        Physics (%)
                      </label>
                      <input
                        type="number" min={0} max={100} step={0.1}
                        placeholder="82"
                        value={form.physics}
                        onChange={e => update('physics', e.target.value)}
                        onBlur={e => {
                          const v = +e.target.value;
                          if (e.target.value !== '' && (v < 0 || v > 100)) {
                            setErrors(p => ({ ...p, physics: v > 100 ? 'Cannot exceed 100%' : 'Cannot be less than 0%' }));
                          }
                        }}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy ${errors.physics ? 'border-red-400' : 'border-gray-300'}`}
                      />
                      {errors.physics && <p className="text-red-500 mt-1" style={{fontSize:'11px'}}>{errors.physics}</p>}
                    </div>
                    {/* Chemistry */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">
                        Chemistry (%)
                      </label>
                      <input
                        type="number" min={0} max={100} step={0.1}
                        placeholder="75"
                        value={form.chemistry}
                        onChange={e => update('chemistry', e.target.value)}
                        onBlur={e => {
                          const v = +e.target.value;
                          if (e.target.value !== '' && (v < 0 || v > 100)) {
                            setErrors(p => ({ ...p, chemistry: v > 100 ? 'Cannot exceed 100%' : 'Cannot be less than 0%' }));
                          }
                        }}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy ${errors.chemistry ? 'border-red-400' : 'border-gray-300'}`}
                      />
                      {errors.chemistry && <p className="text-red-500 mt-1" style={{fontSize:'11px'}}>{errors.chemistry}</p>}
                    </div>
                    {/* Maths */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">
                        Maths (%)
                      </label>
                      <input
                        type="number" min={0} max={100} step={0.1}
                        placeholder="91"
                        value={form.maths}
                        onChange={e => update('maths', e.target.value)}
                        onBlur={e => {
                          const v = +e.target.value;
                          if (e.target.value !== '' && (v < 0 || v > 100)) {
                            setErrors(p => ({ ...p, maths: v > 100 ? 'Cannot exceed 100%' : 'Cannot be less than 0%' }));
                          }
                        }}
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy ${errors.maths ? 'border-red-400' : 'border-gray-300'}`}
                      />
                      {errors.maths && <p className="text-red-500 mt-1" style={{fontSize:'11px'}}>{errors.maths}</p>}
                    </div>
                  </div>

                  {/* Live PCM Average */}
                  {(form.physics || form.chemistry || form.maths) && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mt-2 mb-4">
                      <span className="text-sm text-gray-500">Your PCM Average:</span>
                      <span className="text-sm font-semibold text-navy">
                        {(((+form.physics || 0) + (+form.chemistry || 0) + (+form.maths || 0)) /
                          [form.physics, form.chemistry, form.maths].filter(v => v !== '').length
                        ).toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">Calculated automatically</span>
                    </div>
                  )}

                  {/* JEE field */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1">
                      Your JEE Mains Percentile
                    </label>
                    <p style={{fontSize:'12px', color:'#9ca3af', marginBottom:'6px'}}>(Enter your best percentile from any attempt)</p>
                    <input
                      type="number" min={0} max={100} step={0.01}
                      placeholder="94.5"
                      value={form.jee}
                      onChange={e => update('jee', e.target.value)}
                      onBlur={e => {
                        const v = +e.target.value;
                        if (e.target.value !== '' && (v < 0 || v > 100)) {
                          setErrors(p => ({ ...p, jee: v > 100 ? 'Percentile cannot exceed 100' : 'Percentile cannot be less than 0' }));
                        }
                      }}
                      className={`w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy ${errors.jee ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {errors.jee && <p className="text-red-500 mt-1" style={{fontSize:'11px'}}>{errors.jee}</p>}
                  </div>

                  {/* Warning banner */}
                  <div className="mt-4 rounded-lg border-l-4 border-amber-500" style={{background:'#fffbeb', padding:'14px 16px'}}>
                    <p style={{fontSize:'13px', color:'#92400e', fontWeight:500}}>
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
                      {(() => {
                        const wc = form.projects.trim() === '' ? 0 : form.projects.trim().split(/\s+/).length;
                        const needed = Math.max(0, 50 - wc);
                        return (
                          <p className="text-xs mt-1" style={{color: wc >= 50 ? '#16a34a' : '#9ca3af'}}>
                            {wc} words {wc >= 50 ? '✓' : `(${needed} more needed)`}
                          </p>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1">Extracurriculars</label>
                      <p className="text-xs text-gray-400 mb-2">Optional — leave blank if not applicable</p>
                      <textarea
                        placeholder="Sports, competitions, clubs, volunteering, leadership roles..."
                        value={form.extra}
                        onChange={e => update('extra', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy resize-none"
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
                <div>
                  <div
                    className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      errors.declared ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => { setDeclared(d => !d); if (errors.declared) setErrors(p => ({ ...p, declared: '' })); }}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                      declared ? 'bg-navy border-navy' : 'bg-white border-gray-400'
                    }`}>
                      {declared && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-gray-700 leading-relaxed">
                      I declare that all academic scores entered are accurate and match my official board/JEE records. I understand that false information leads to{' '}
                      <strong className="text-gray-900">permanent disqualification</strong>{' '}from DDS University admissions.
                    </span>
                  </div>
                  {errors.declared && <p className="text-xs text-red-600 mt-2">{errors.declared}</p>}
                </div>

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
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-white transition-all ${
                      submitting ? "bg-navy/70 cursor-not-allowed" : "bg-navy hover:bg-navy/90"
                    }`}
                  >
                    {submitting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>Submit Application <span>&#x203a;</span></>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
