import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, CheckCircle, BarChart2, AlertTriangle, Trophy, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Skeleton } from '../../components/ui';
import AdminLayout from './AdminLayout';
import { formatDistanceToNow } from 'date-fns';

const fadeIn = { hidden: { opacity: 0, y: 16 }, visible: i => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.3 } }) };

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [branchData, setBranchData] = useState([]);
  const [funnelData, setFunnelData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => fetchData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchData = async () => {
    try {
      const { data: apps } = await supabase
        .from('applications')
        .select('*, students(name, email, city), test_sessions(ai_flag), interview_sessions(ai_flags)')
        .order('created_at', { ascending: false });

      if (!apps) return;

      const total = apps.length;
      const s1passed = apps.filter(a => ['passed_s1', 'passed_s2', 'rejected_s2', 'interview', 'selected'].includes(a.status)).length;
      const s2passed = apps.filter(a => ['passed_s2', 'interview', 'selected'].includes(a.status)).length;
      const interviews = apps.filter(a => ['interview', 'selected'].includes(a.status)).length;
      const selected = apps.filter(a => a.status === 'selected').length;
      const flagged = apps.filter(a => a.test_sessions?.some(ts => ts.ai_flag)).length;

      setStats({ total, s1passed, s2passed, interviews, selected, flagged });

      // Branch distribution
      const branchMap = {};
      apps.forEach(a => {
        if (!branchMap[a.branch]) branchMap[a.branch] = { name: a.branch.split(' ')[0], total: 0, passed: 0 };
        branchMap[a.branch].total++;
        if (['passed_s1', 'passed_s2', 'interview', 'selected'].includes(a.status)) branchMap[a.branch].passed++;
      });
      setBranchData(Object.values(branchMap).sort((a, b) => b.total - a.total));

      // Funnel
      setFunnelData([
        { stage: 'Applied', count: total },
        { stage: 'S1 Pass', count: s1passed },
        { stage: 'S2 Pass', count: s2passed },
        { stage: 'Interview', count: interviews },
        { stage: 'Selected', count: selected },
      ]);

      // Recent activity
      setRecentActivity(apps.slice(0, 8).map(a => ({
        id: a.id,
        name: a.students?.name || 'Unknown',
        branch: a.branch?.split(' ')[0],
        status: a.status,
        time: a.created_at,
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const STAT_CARDS = stats ? [
    { label: 'Total Applications', value: stats.total, icon: Users, color: 'text-navy', bg: 'bg-navy/5' },
    { label: 'Stage 1 Passed', value: `${stats.s1passed} (${stats.total ? Math.round(stats.s1passed / stats.total * 100) : 0}%)`, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Stage 2 Passed', value: stats.s2passed, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Interviews Done', value: stats.interviews, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Selected', value: stats.selected, icon: Trophy, color: 'text-amber-600', bg: 'bg-gold-bg' },
    { label: 'AI Flags Raised', value: stats.flagged, icon: AlertTriangle, color: stats.flagged > 0 ? 'text-red-600' : 'text-gray-400', bg: stats.flagged > 0 ? 'bg-red-50' : 'bg-gray-50' },
  ] : [];

  const STATUS_LABEL_MAP = {
    pending: 'Pending', passed_s1: 'Passed S1', passed_s2: 'Passed S2',
    rejected_s1: 'Rejected', rejected_s2: 'Rejected', interview: 'Interview', selected: 'Selected', rejected_s3: 'Not Selected',
  };
  const STATUS_BADGE_MAP = {
    pending: 'default', passed_s1: 'info', passed_s2: 'navy', rejected_s1: 'error',
    rejected_s2: 'error', interview: 'warning', selected: 'success', rejected_s3: 'error',
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-section-head text-navy">Admissions Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">DDS University for Engineering · 2025 Cycle · Live Data</p>
      </div>

      {/* Stats row */}
      <motion.div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.07 } } }}>
        {loading ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />) :
          STAT_CARDS.map((card, i) => (
            <motion.div key={card.label} custom={i} variants={fadeIn}>
              <Card className="p-4">
                <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-xl font-bold text-navy">{card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{card.label}</p>
              </Card>
            </motion.div>
          ))
        }
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Funnel */}
        <Card className="lg:col-span-2">
          <p className="text-card-title font-semibold text-navy mb-4">Admission Funnel</p>
          {loading ? <Skeleton className="h-52" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnelData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  cursor={{ fill: '#f8f9fa' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {funnelData.map((_, i) => (
                    <Cell key={i} fill={['#1e3a5f', '#2d5282', '#c8960a', '#f5c842', '#065f46'][i] || '#1e3a5f'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Recent Activity */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">Recent Activity</p>
          {loading ? <Skeleton className="h-52" /> : (
            <div className="space-y-2.5">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No applications yet</p>
              ) : recentActivity.map((act) => (
                <div key={act.id} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{act.name}</p>
                    <p className="text-xs text-gray-500">{act.branch} · {formatDistanceToNow(new Date(act.time), { addSuffix: true })}</p>
                  </div>
                  <Badge variant={STATUS_BADGE_MAP[act.status] || 'default'} className="text-xs">
                    {STATUS_LABEL_MAP[act.status] || act.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Branch Distribution */}
      <Card>
        <p className="text-card-title font-semibold text-navy mb-4">Branch Distribution</p>
        {loading ? <Skeleton className="h-40" /> : branchData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={branchData} layout="vertical" barSize={20}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={80} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} cursor={{ fill: '#f8f9fa' }} />
              <Bar dataKey="total" fill="#1e3a5f" radius={[0, 4, 4, 0]} name="Total" />
              <Bar dataKey="passed" fill="#c8960a" radius={[0, 4, 4, 0]} name="Passed S1" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </AdminLayout>
  );
}
