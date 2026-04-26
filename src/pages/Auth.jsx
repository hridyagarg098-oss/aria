import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Card } from '../components/ui';
import toast from 'react-hot-toast';

// ── Timeout wrapper — prevents any auth call from hanging forever ──────────────
function withTimeout(promise, ms = 8000, label = 'Request') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out. Check your internet connection.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── Rate limit cooldown (persisted) ───────────────────────────────────────────
const RL_KEY = 'aria_rl_ts';
const RL_SEC = 65;
const getRLLeft = () => {
  const ts = localStorage.getItem(RL_KEY);
  return ts ? Math.max(0, RL_SEC - Math.floor((Date.now() - +ts) / 1000)) : 0;
};
const setRL = () => localStorage.setItem(RL_KEY, String(Date.now()));
const clearRL = () => localStorage.removeItem(RL_KEY);

// ── Error classifier ──────────────────────────────────────────────────────────
const isRateLimit = (err) =>
  err?.status === 429 || /rate.?limit|too.?many|email.?rate/i.test(err?.message || '');
const isNotConfirmed = (err) => /not.confirmed/i.test(err?.message || '');
const isWrongCredentials = (err) => /invalid.login|credentials/i.test(err?.message || '');
const isAlreadyExists = (err) => /already.registered|already.been/i.test(err?.message || '');

export default function Auth() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(getRLLeft);
  const [notConfirmed, setNotConfirmed] = useState(false);
  const timerRef = useRef(null);

  // Tick cooldown down
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      const left = getRLLeft();
      setCooldown(left);
      if (left === 0) { clearInterval(timerRef.current); clearRL(); }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [cooldown]);

  // Handle session from URL (email confirm callback + auto sign-in)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        navigate('/dashboard', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const triggerCooldown = (msg) => {
    setRL();
    setCooldown(RL_SEC);
    timerRef.current = setInterval(() => {
      const left = getRLLeft();
      setCooldown(left);
      if (left === 0) { clearInterval(timerRef.current); clearRL(); }
    }, 1000);
    toast.error(msg || `Rate limited — wait ${RL_SEC}s`, { duration: 8000 });
  };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (cooldown > 0 || loading) return;
    setNotConfirmed(false);
    setLoading(true);

    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }),
        10000, 'Login'
      );

      if (error) {
        if (isRateLimit(error)) { triggerCooldown(`Too many attempts — wait ${RL_SEC}s`); return; }
        if (isNotConfirmed(error)) { setNotConfirmed(true); return; }
        if (isWrongCredentials(error)) { toast.error('Wrong email or password.'); return; }
        toast.error(error.message);
        return;
      }

      // ✅ Navigate immediately — AuthContext resolves role in background
      navigate('/dashboard', { replace: true });

    } catch (err) {
      if (err.message?.includes('timed out')) {
        toast.error('Connection slow — try again in a moment.', { duration: 6000 });
      } else {
        toast.error(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── SIGNUP ─────────────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    if (cooldown > 0 || loading) return;
    if (password.length < 8) { toast.error('Password must be 8+ characters.'); return; }
    setLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: name.trim() } },
        }),
        15000, 'Sign up'
      );

      if (error) {
        if (isRateLimit(error)) {
          triggerCooldown(`Email rate limit hit — wait ${RL_SEC}s. Or ask admin to disable email confirmation in Supabase.`);
          return;
        }
        if (isAlreadyExists(error)) {
          toast.error('Account already exists — log in instead.');
          setTab('login');
          return;
        }
        toast.error(error.message);
        return;
      }

      if (data?.session) {
        // ✅ Email confirmation is OFF — logged in immediately
        toast.success(`Welcome, ${name.split(' ')[0]}! Your account is ready.`);
        navigate('/dashboard', { replace: true });
      } else if (data?.user) {
        // Email confirmation required
        toast.success(
          'Account created! Check your email to confirm, then log in here.',
          { duration: 8000 }
        );
        setTab('login');
      } else {
        toast.error('Something went wrong — please try again.');
      }

    } catch (err) {
      if (err.message?.includes('timed out')) {
        // Signup timed out — but the user MAY have been created
        // Try to sign in immediately (works if email confirmation is OFF)
        toast.loading('Verifying account…', { id: 'verify' });
        try {
          const { error: signinErr } = await withTimeout(
            supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }),
            5000, 'Verify'
          );
          toast.dismiss('verify');
          if (!signinErr) {
            toast.success('Account created! Logging you in…');
            navigate('/dashboard', { replace: true });
          } else if (isNotConfirmed(signinErr)) {
            setNotConfirmed(true);
            toast.dismiss('verify');
            toast('Account created but needs email confirmation.', { icon: '📧', duration: 8000 });
            setTab('login');
          } else {
            toast.error('Signup timed out. Check connection and try again.');
          }
        } catch {
          toast.dismiss('verify');
          toast.error('Connection timed out. Check your internet and try again.');
        }
      } else {
        toast.error(err.message || 'Signup failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = () => {
    if (!password) return null;
    if (password.length < 6) return { label: 'Too short', bar: 'bg-red-400', text: 'text-red-500', w: '20%' };
    if (password.length < 8) return { label: 'Weak', bar: 'bg-amber-400', text: 'text-amber-600', w: '40%' };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: 'Fair', bar: 'bg-yellow-400', text: 'text-yellow-600', w: '60%' };
    if (password.length >= 10) return { label: 'Strong', bar: 'bg-green-500', text: 'text-green-600', w: '100%' };
    return { label: 'Good', bar: 'bg-green-400', text: 'text-green-500', w: '80%' };
  };
  const strength = pwStrength();
  const disabled = loading || cooldown > 0;

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <Link to="/" className="mb-8 text-sm text-gray-500 hover:text-navy transition-colors">
        ← Back to DDS University
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-navy rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <span className="text-white font-bold text-xl">DDS</span>
          </div>
          <h1 className="text-xl font-bold text-navy">DDS University for Engineering</h1>
          <p className="text-sm text-gray-500 mt-1">2025 Admissions · Powered by Aria</p>
        </div>

        {/* Banners */}
        <AnimatePresence>
          {cooldown > 0 && (
            <motion.div key="rl" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-card p-3 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Rate limited — wait <strong className="font-mono tabular-nums">{cooldown}s</strong> before trying again.
              </p>
            </motion.div>
          )}
          {notConfirmed && (
            <motion.div key="nc" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-blue-50 border border-blue-200 rounded-card p-4 mb-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">📧 Email not confirmed</p>
              <p className="text-xs text-blue-600 mb-2 leading-relaxed">
                Your account exists but the email isn't confirmed.
                Ask admin to run this in the Supabase SQL Editor:
              </p>
              <div className="bg-gray-900 rounded-lg p-2.5">
                <code className="text-xs text-green-400 font-mono break-all">
                  {`update auth.users set email_confirmed_at = now() where email = '${email.trim().toLowerCase()}';`}
                </code>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `update auth.users set email_confirmed_at = now() where email = '${email.trim().toLowerCase()}';`
                  );
                  toast.success('SQL copied!');
                }}
                className="text-xs text-blue-700 font-semibold mt-2 hover:underline"
              >Copy SQL →</button>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="p-0 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {['login', 'signup'].map(t => (
              <button key={t}
                onClick={() => { setTab(t); setNotConfirmed(false); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  tab === t ? 'bg-white text-navy border-b-2 border-navy' : 'bg-gray-50 text-gray-500 hover:text-navy'
                }`}>
                {t === 'login' ? 'Log In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="p-7">
            <AnimatePresence mode="wait">
              {tab === 'login' ? (
                <motion.form key="login"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }} onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" placeholder="yourname@email.com" value={email}
                        onChange={e => setEmail(e.target.value)} required autoComplete="email" disabled={disabled}
                        className="w-full pl-9 pr-3 py-2.5 border border-border rounded-btn text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none transition-all disabled:opacity-50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type={showPw ? 'text' : 'password'} placeholder="Your password" value={password}
                        onChange={e => setPassword(e.target.value)} required autoComplete="current-password" disabled={disabled}
                        className="w-full pl-9 pr-9 py-2.5 border border-border rounded-btn text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none transition-all disabled:opacity-50" />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" variant="primary" size="lg" loading={loading} disabled={disabled} className="w-full">
                    {cooldown > 0 ? `Wait ${cooldown}s` : 'Log In'}
                  </Button>
                  <p className="text-center text-xs text-gray-500">
                    No account?{' '}
                    <button type="button" onClick={() => setTab('signup')} className="text-navy font-semibold hover:underline">Sign up →</button>
                  </p>
                </motion.form>
              ) : (
                <motion.form key="signup"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }} onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="Rahul Sharma" value={name}
                        onChange={e => setName(e.target.value)} required autoComplete="name" disabled={disabled}
                        className="w-full pl-9 pr-3 py-2.5 border border-border rounded-btn text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none transition-all disabled:opacity-50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" placeholder="yourname@email.com" value={email}
                        onChange={e => setEmail(e.target.value)} required autoComplete="email" disabled={disabled}
                        className="w-full pl-9 pr-3 py-2.5 border border-border rounded-btn text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none transition-all disabled:opacity-50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters" value={password}
                        onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" disabled={disabled}
                        className="w-full pl-9 pr-9 py-2.5 border border-border rounded-btn text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none transition-all disabled:opacity-50" />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {strength && (
                      <div className="mt-2">
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${strength.bar}`} style={{ width: strength.w }} />
                        </div>
                        <p className={`text-xs mt-1 ${strength.text}`}>{strength.label}</p>
                      </div>
                    )}
                  </div>
                  <Button type="submit" variant="primary" size="lg" loading={loading} disabled={disabled} className="w-full">
                    {cooldown > 0 ? `Wait ${cooldown}s` : 'Create Account & Apply'}
                  </Button>
                  <p className="text-center text-xs text-gray-400">By signing up you agree to DDS University's terms.</p>
                  <p className="text-center text-xs text-gray-500">
                    Already have an account?{' '}
                    <button type="button" onClick={() => setTab('login')} className="text-navy font-semibold hover:underline">Log in →</button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          College admin?{' '}
          <Link to="/admin" className="text-navy font-semibold hover:underline">Admin login →</Link>
        </p>
      </motion.div>
    </div>
  );
}
