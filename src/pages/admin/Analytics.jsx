import React, { useState, useEffect } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, Legend, PieChart, Pie, LineChart, Line
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Skeleton } from '../../components/ui';
import AdminLayout from './AdminLayout';
import { calculateAdmissionStats } from '../../utils/statsHelpers';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: apps } = await supabase
      .from('applications')
      .select('*, test_sessions(score, tab_switches, ai_flag, time_taken_seconds)')
      .order('created_at', { ascending: false });

    if (!apps) { setLoading(false); return; }
    console.log('Analytics raw apps:', apps);

    // Use shared stats calculator for consistency with Dashboard
    const admStats = calculateAdmissionStats(apps);
    const { total, s1Passed: s1, s2Passed: s2, interviews: s3, selected: sel } = admStats;

    // Score distribution buckets
    const scoreBuckets = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}–${i * 10 + 9}`, count: 0 }));
    apps.filter(a => a.ai_score).forEach(a => {
      const bucket = Math.min(9, Math.floor(a.ai_score / 10));
      scoreBuckets[bucket].count++;
    });

    // City distribution
    const cityMap = {};
    apps.forEach(a => {
      const city = a.form_data?.city?.split(',')[0]?.trim() || 'Unknown';
      cityMap[city] = (cityMap[city] || 0) + 1;
    });
    const cityData = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([city, count]) => ({ city, count }));

    // AI flag rate
    const flagged = apps.filter(a => a.test_sessions?.some(ts => ts.ai_flag)).length;
    const testCount = apps.filter(a => a.test_sessions?.length > 0).length;

    // Branch conversion
    const branchMap = {};
    apps.forEach(a => {
      const b = a.branch?.split(' ')[0] || 'Unknown';
      if (!branchMap[b]) branchMap[b] = { branch: b, applied: 0, selected: 0 };
      branchMap[b].applied++;
      if (a.status === 'selected') branchMap[b].selected++;
    });
    const branchConv = Object.values(branchMap);

    // Scatter: JEE vs AI Score
    const scatter = apps
      .filter(a => a.form_data?.jee && a.ai_score)
      .map(a => ({ jee: +a.form_data.jee, score: Math.round(a.ai_score), branch: a.branch?.split(' ')[0] }));

    // Tab switches histogram
    const tabMap = { '0': 0, '1': 0, '2': 0, '3+': 0 };
    apps.forEach(a => {
      const ts = a.test_sessions?.[0];
      if (ts) {
        if (ts.tab_switches === 0) tabMap['0']++;
        else if (ts.tab_switches === 1) tabMap['1']++;
        else if (ts.tab_switches === 2) tabMap['2']++;
        else tabMap['3+']++;
      }
    });
    const tabData = Object.entries(tabMap).map(([switches, count]) => ({ switches, count }));

    // ── NEW: Applications by Branch (full name) ──
    const branchFullMap = {};
    apps.forEach(a => {
      const b = a.branch || 'Unknown';
      if (!branchFullMap[b]) branchFullMap[b] = 0;
      branchFullMap[b]++;
    });
    const branchAppData = Object.entries(branchFullMap)
      .sort((a, b) => b[1] - a[1])
      .map(([branch, count]) => ({ branch: branch.length > 18 ? branch.slice(0, 16) + '...' : branch, count, fullName: branch }));

    // ── NEW: Average Scores per Stage ──
    const s1Scores = apps.filter(a => a.ai_score).map(a => a.ai_score);
    const s2Scores = apps.filter(a => a.test_sessions?.length > 0 && a.test_sessions[0]?.score).map(a => a.test_sessions[0].score);
    const s3Scores = apps.filter(a => a.s3_best_score).map(a => a.s3_best_score);
    const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
    const avgScores = [
      { stage: 'Stage 1', avg: avg(s1Scores), min: s1Scores.length ? Math.round(Math.min(...s1Scores)) : 0, max: s1Scores.length ? Math.round(Math.max(...s1Scores)) : 0, count: s1Scores.length },
      { stage: 'Stage 2', avg: avg(s2Scores), min: s2Scores.length ? Math.round(Math.min(...s2Scores)) : 0, max: s2Scores.length ? Math.round(Math.max(...s2Scores)) : 0, count: s2Scores.length },
      { stage: 'Stage 3', avg: avg(s3Scores), min: s3Scores.length ? Math.round(Math.min(...s3Scores)) : 0, max: s3Scores.length ? Math.round(Math.max(...s3Scores)) : 0, count: s3Scores.length },
    ];

    // ── NEW: Pass/Fail Rates per Stage ──
    const s1Total = apps.filter(a => a.ai_score || a.status?.includes('s1')).length;
    const s1Pass = apps.filter(a => ['passed_s1', 'passed_s2', 'passed_s3', 'selected', 's3_attempt1_failed'].some(s => a.status?.includes(s) || a.stage >= 2)).length;
    const s2Total = apps.filter(a => a.test_sessions?.length > 0).length;
    const s2Pass = apps.filter(a => a.stage >= 3 || a.status === 'passed_s2' || a.status === 'passed_s3' || a.status === 'selected').length;
    const s3Total = apps.filter(a => a.s3_best_score > 0).length;
    const s3Pass = apps.filter(a => a.status === 'passed_s3' || a.status === 'selected').length;
    const passFailData = [
      { stage: 'Stage 1', passed: s1Pass, failed: Math.max(0, s1Total - s1Pass), rate: s1Total ? Math.round(s1Pass / s1Total * 100) : 0 },
      { stage: 'Stage 2', passed: s2Pass, failed: Math.max(0, s2Total - s2Pass), rate: s2Total ? Math.round(s2Pass / s2Total * 100) : 0 },
      { stage: 'Stage 3', passed: s3Pass, failed: Math.max(0, s3Total - s3Pass), rate: s3Total ? Math.round(s3Pass / s3Total * 100) : 0 },
    ];

    setData({ total, s1, s2, s3, sel, scoreBuckets, cityData, flagged, testCount, branchConv, scatter, tabData, branchAppData, avgScores, passFailData });
    setLoading(false);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="mb-6"><h1 className="text-section-head text-navy">Analytics</h1></div>
        <div className="grid md:grid-cols-2 gap-6">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      </AdminLayout>
    );
  }

  if (!data) return <AdminLayout><p className="text-gray-400 text-center py-20">No data yet.</p></AdminLayout>;

  const convData = [
    { stage: 'Applied', count: data.total, fill: '#1e3a5f' },
    { stage: 'S1 Pass', count: data.s1, fill: '#2d5282' },
    { stage: 'S2 Pass', count: data.s2, fill: '#c8960a' },
    { stage: 'Interview', count: data.s3, fill: '#f5c842' },
    { stage: 'Selected', count: data.sel, fill: '#065f46' },
  ];

  const radarData = [
    { subject: 'S1 Rate', A: data.total ? Math.round(data.s1 / data.total * 100) : 0 },
    { subject: 'S2 Rate', A: data.s1 ? Math.round(data.s2 / data.s1 * 100) : 0 },
    { subject: 'S3 Rate', A: data.s2 ? Math.round(data.s3 / data.s2 * 100) : 0 },
    { subject: 'Selection', A: data.s3 ? Math.round(data.sel / data.s3 * 100) : 0 },
    { subject: 'Clean Tests', A: data.testCount ? Math.round((data.testCount - data.flagged) / data.testCount * 100) : 100 },
  ];

  const COLORS = ['#1e3a5f', '#2d5282', '#c8960a', '#f5c842', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-section-head text-navy">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">DDS University · 2026 Admissions Cycle</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Applied', value: data.total, sub: '100%' },
          { label: 'S1 Pass', value: data.s1, sub: data.total ? `${Math.round(data.s1/data.total*100)}%` : '—' },
          { label: 'S2 Pass', value: data.s2, sub: data.s1 ? `${Math.round(data.s2/data.s1*100)}%` : '—' },
          { label: 'Interview', value: data.s3, sub: data.s2 ? `${Math.round(data.s3/data.s2*100)}%` : '—' },
          { label: 'Selected', value: data.sel, sub: data.total ? `${Math.round(data.sel/data.total*100)}%` : '—' },
        ].map((k, i) => (
          <Card key={k.label} className="p-4 text-center">
            <p className="text-3xl font-bold text-navy">{k.value}</p>
            <p className="text-xs text-gray-500 mt-1">{k.label}</p>
            <p className={`text-xs font-semibold mt-0.5 ${i === 4 ? 'text-green-600' : 'text-navy'}`}>{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">Conversion Funnel</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={convData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {convData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pipeline Radar */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">Pipeline Health</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Radar name="Rate %" dataKey="A" stroke="#1e3a5f" fill="#1e3a5f" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        {/* AI Score Distribution */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">AI Score Distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.scoreBuckets} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.scoreBuckets.map((d, i) => (
                  <Cell key={i} fill={i >= 8 ? '#065f46' : i >= 6 ? '#1e3a5f' : i >= 4 ? '#c8960a' : '#d1d5db'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* JEE vs AI Score Scatter */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">JEE Percentile vs AI Score</p>
          <ResponsiveContainer width="100%" height={180}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="jee" name="JEE" type="number" domain={[90, 100]} tick={{ fontSize: 10 }} label={{ value: 'JEE %ile', position: 'bottom', fontSize: 10, dy: 8 }} />
              <YAxis dataKey="score" name="AI Score" type="number" tick={{ fontSize: 10 }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Scatter data={data.scatter} fill="#1e3a5f" fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>

        {/* City Distribution */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">Top Cities</p>
          <div className="space-y-2">
            {data.cityData.map((c, i) => (
              <div key={c.city} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{c.city}</span>
                    <span className="text-navy font-bold">{c.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-navy rounded-full"
                      style={{ width: `${(c.count / data.cityData[0].count) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Anti-cheat stats */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">Anti-Cheat Summary</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-navy">{data.testCount}</p>
              <p className="text-xs text-gray-500">Tests Taken</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${data.flagged > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <p className={`text-2xl font-bold ${data.flagged > 0 ? 'text-amber-600' : 'text-green-600'}`}>{data.flagged}</p>
              <p className={`text-xs ${data.flagged > 0 ? 'text-amber-500' : 'text-green-500'}`}>AI Flagged</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Tab Switches</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.tabData} barSize={28}>
              <XAxis dataKey="switches" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.tabData.map((d, i) => <Cell key={i} fill={i === 0 ? '#065f46' : i === 1 ? '#c8960a' : '#dc2626'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── NEW: Applications by Branch ── */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">Applications by Branch</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.branchAppData} barSize={24} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="branch" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v, n, p) => [v, p.payload.fullName]} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {(data.branchAppData || []).map((d, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── NEW: Average Scores per Stage ── */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">Average Scores per Stage</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {data.avgScores.map((s, i) => (
              <div key={s.stage} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-navy">{s.avg}</p>
                <p className="text-xs text-gray-500 mt-1">{s.stage}</p>
                <p className="text-[10px] text-gray-400">{s.count} scores · {s.min}–{s.max}</p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.avgScores} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="avg" name="Average" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="max" name="Max" fill="#c8960a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── NEW: Pass/Fail Rates ── */}
        <Card>
          <p className="text-card-title font-semibold text-navy mb-4">Pass / Fail Rates per Stage</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.passFailData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="passed" name="Passed" stackId="a" fill="#065f46" radius={[0, 0, 0, 0]} />
              <Bar dataKey="failed" name="Failed" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {data.passFailData.map(s => (
              <div key={s.stage} className="text-center">
                <p className={`text-lg font-bold ${s.rate >= 60 ? 'text-green-600' : s.rate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{s.rate}%</p>
                <p className="text-xs text-gray-500">{s.stage} pass rate</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
