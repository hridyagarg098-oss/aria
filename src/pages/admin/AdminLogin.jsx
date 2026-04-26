import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Shield, Terminal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button, Card } from '../../components/ui';
import toast from 'react-hot-toast';

// Hard timeout so login never hangs
function withTimeout(promise, ms = 8000) {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Connection timed out — check your internet.')), ms);
  });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

const SQL_SCRIPT = `-- Run in Supabase SQL Editor → https://supabase.com/dashboard/project/arlxnjafyospxjbjkpey/sql/new
do $$
declare v_id uuid; v_uni uuid;
begin
  select id into v_uni from universities where slug='dds-university';
  select id into v_id from auth.users where email='hridyagarg69@gmail.com';
  if v_id is null then
    insert into auth.users(id,instance_id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,aud,role,created_at,updated_at)
    values(gen_random_uuid(),'00000000-0000-0000-0000-000000000000','hridyagarg69@gmail.com',crypt('hridyaG78',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"DDS Admin"}','authenticated','authenticated',now(),now())
    returning id into v_id;
  else
    update auth.users set encrypted_password=crypt('hridyaG78',gen_salt('bf')),email_confirmed_at=now(),updated_at=now() where id=v_id;
  end if;
  insert into admins(id,university_id,name,email,role) values(v_id,v_uni,'DDS Admin','hridyagarg69@gmail.com','admin')
  on conflict(id) do update set name='DDS Admin',university_id=v_uni;
end $$;`;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('hridyagarg69@gmail.com');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password })
      );

      if (error) {
        if (/not.confirmed/i.test(error.message)) {
          toast.error('Email not confirmed. Run the SQL script below.', { duration: 6000 });
          setShowSql(true);
        } else if (/invalid.login|credentials/i.test(error.message)) {
          toast.error('Wrong password. Run the SQL script if first time.');
          setShowSql(true);
        } else if (error.status === 429) {
          toast.error('Rate limited — wait 60s then try again.', { duration: 8000 });
        } else {
          toast.error(error.message);
        }
        return;
      }

      // ✅ Sign-in succeeded — navigate immediately, AuthContext resolves role
      toast.success('Logging in…');
      navigate('/admin/dashboard', { replace: true });

    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <Link to="/" className="mb-8 text-sm text-gray-500 hover:text-navy transition-colors">
        ← Back to DDS University
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-navy rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-navy">Admin Portal</h1>
          <p className="text-sm text-gray-500 mt-1">DDS University · Admissions Management</p>
        </div>

        <Card className="p-7">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                  className="w-full pl-9 pr-3 py-2.5 border border-border rounded-btn text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none transition-all" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPw ? 'text' : 'password'} placeholder="Enter your password" value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                  className="w-full pl-9 pr-9 py-2.5 border border-border rounded-btn text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none transition-all" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              Admin Login
            </Button>
          </form>

          {/* SQL Helper */}
          <div className="mt-5 pt-4 border-t border-border">
            <button onClick={() => setShowSql(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-navy transition-colors">
              <Terminal className="w-3.5 h-3.5" />
              {showSql ? 'Hide' : 'First time / login error? Show setup SQL'}
            </button>

            {showSql && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
                <div className="bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">{SQL_SCRIPT}</pre>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(SQL_SCRIPT); toast.success('SQL copied!'); }}
                    className="flex-1 text-xs text-center bg-navy text-white rounded-btn py-2 hover:bg-navy/90 font-medium transition-colors">
                    Copy SQL
                  </button>
                  <a href="https://supabase.com/dashboard/project/arlxnjafyospxjbjkpey/sql/new"
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-xs text-center border border-border rounded-btn py-2 hover:bg-gray-50 text-navy font-medium transition-colors">
                    Open SQL Editor →
                  </a>
                </div>
              </motion.div>
            )}
          </div>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          Student?{' '}
          <Link to="/auth" className="text-navy font-semibold hover:underline">Student login →</Link>
        </p>
      </motion.div>
    </div>
  );
}
