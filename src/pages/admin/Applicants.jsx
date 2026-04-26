import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, Download, AlertTriangle, ChevronUp, ChevronDown, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Badge, Button, Skeleton, BRANCHES } from '../../components/ui';
import AdminLayout from './AdminLayout';

const STATUS_OPTIONS = ['all', 'pending', 'passed_s1', 'passed_s2', 's2_attempt1_failed', 'rejected_s2_both_attempts',
  'rejected_s1', 'interview', 's3_attempt1_failed', 'rejected_s3_both_attempts', 'selected', 'rejected_s3'];
const STATUS_LABELS = {
  pending: 'Pending', passed_s1: 'Passed S1', passed_s2: 'Passed S2',
  rejected_s1: 'Rejected S1', rejected_s2: 'Rejected S2',
  s2_attempt1_failed: 'S2 Retry Pending', rejected_s2_both_attempts: 'Rejected S2 (Both)',
  interview: 'Interview', selected: 'Selected',
  s3_attempt1_failed: 'S3 Retry Pending', rejected_s3_both_attempts: 'Rejected S3 (Both)',
  rejected_s3: 'Not Selected',
};
const STATUS_BADGE = {
  pending: 'default', passed_s1: 'info', passed_s2: 'navy',
  rejected_s1: 'error', rejected_s2: 'error',
  s2_attempt1_failed: 'warning', rejected_s2_both_attempts: 'error',
  interview: 'warning', selected: 'success',
  s3_attempt1_failed: 'warning', rejected_s3_both_attempts: 'error',
  rejected_s3: 'error',
};
const GRADE_BADGE = { 'A+': 'success', 'A': 'success', 'B+': 'info', 'B': 'info', 'C': 'warning' };

const PAGE_SIZE = 10;

export default function Applicants() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [attemptFilter, setAttemptFilter] = useState('all');
  const [sort, setSort] = useState({ field: 'created_at', dir: 'desc' });

  useEffect(() => { fetchApplications(); }, []);

  useEffect(() => {
    let data = [...applications];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(a =>
        a.students?.name?.toLowerCase().includes(q) ||
        a.students?.email?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') data = data.filter(a => a.status === statusFilter);
    if (branchFilter !== 'all') data = data.filter(a => a.branch === branchFilter);
    if (flagFilter === 'flagged') data = data.filter(a => a.test_sessions?.some(ts => ts.ai_flag));
    if (attemptFilter === 'passed_s2_attempt2') data = data.filter(a => a.status === 'passed_s2' && a.s2_attempts === 2);
    if (attemptFilter === 'passed_s3_attempt2') data = data.filter(a => a.status === 'interview' && a.s3_attempts === 2);

    data.sort((a, b) => {
      let aVal, bVal;
      if (sort.field === 'ai_score') { aVal = a.ai_score || 0; bVal = b.ai_score || 0; }
      else if (sort.field === 'jee') { aVal = +(a.form_data?.jee || 0); bVal = +(b.form_data?.jee || 0); }
      else if (sort.field === 'name') { aVal = a.students?.name || ''; bVal = b.students?.name || ''; }
      else { aVal = a.created_at; bVal = b.created_at; }
      return sort.dir === 'asc'
        ? (typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal)
        : (typeof bVal === 'string' ? bVal.localeCompare(aVal) : bVal - aVal);
    });

    setFiltered(data);
    setPage(1);
  }, [applications, search, statusFilter, branchFilter, flagFilter, sort]);

  const fetchApplications = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*, students(name, email, city), test_sessions(score, correct, ai_flag, tab_switches), s2_attempts, s3_attempts, s2_best_score, s3_best_score')
      .order('created_at', { ascending: false });
    setApplications(data || []);
    setLoading(false);
  };

  const toggleSort = (field) => {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'desc' });
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'City', 'Branch', 'PCM Avg', 'JEE', 'AI Score', 'Grade', 'S2 Score', 'Status', 'Applied'];
    const rows = filtered.map(a => {
      const fd = a.form_data || {};
      const avg = fd.physics && fd.chemistry && fd.maths ? ((+fd.physics + +fd.chemistry + +fd.maths) / 3).toFixed(1) : '';
      const ts = a.test_sessions?.[0];
      return [
        a.students?.name, a.students?.email, a.students?.city, a.branch,
        avg, fd.jee, a.ai_score, a.ai_grade, ts?.score ? Math.round(ts.score) + '%' : '',
        a.status, new Date(a.created_at).toLocaleDateString(),
      ].map(v => `"${v || ''}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'aria-applicants.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter('all'); setBranchFilter('all'); setFlagFilter('all'); setAttemptFilter('all');
  };

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const SortIcon = ({ field }) => {
    if (sort.field !== field) return null;
    return sort.dir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-section-head text-navy">Applicant Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} applicants {search || statusFilter !== 'all' ? '(filtered)' : 'total'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-btn text-sm focus:border-navy focus:ring-2 focus:ring-navy/10 outline-none"
          />
        </div>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-border rounded-btn px-3 py-2 text-sm focus:border-navy outline-none bg-white">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : STATUS_LABELS[s]}</option>)}
        </select>

        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
          className="border border-border rounded-btn px-3 py-2 text-sm focus:border-navy outline-none bg-white">
          <option value="all">All Branches</option>
          {BRANCHES.map(b => <option key={b} value={b}>{b.split(' ')[0]}</option>)}
        </select>

        <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)}
          className="border border-border rounded-btn px-3 py-2 text-sm focus:border-navy outline-none bg-white">
          <option value="all">All Flags</option>
          <option value="flagged">Flagged Only</option>
        </select>

        <select value={attemptFilter} onChange={e => setAttemptFilter(e.target.value)}
          className="border border-border rounded-btn px-3 py-2 text-sm focus:border-navy outline-none bg-white">
          <option value="all">All Attempts</option>
          <option value="passed_s2_attempt2">Passed S2 on 2nd Attempt</option>
          <option value="passed_s3_attempt2">Passed S3 on 2nd Attempt</option>
        </select>

        {(search || statusFilter !== 'all' || branchFilter !== 'all' || flagFilter !== 'all' || attemptFilter !== 'all') && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No applicants found</p>
            <p className="text-sm mt-1">Adjust filters or wait for applications</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest w-10">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-navy" onClick={() => toggleSort('name')}>
                  Name <SortIcon field="name" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Branch</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">PCM Avg</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-navy" onClick={() => toggleSort('jee')}>
                  JEE <SortIcon field="jee" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-navy" onClick={() => toggleSort('ai_score')}>
                  AI Score <SortIcon field="ai_score" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">S2</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Attempts</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Flag</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((app, i) => {
                const fd = app.form_data || {};
                const pcmAvg = fd.physics && fd.chemistry && fd.maths
                  ? ((+fd.physics + +fd.chemistry + +fd.maths) / 3).toFixed(1)
                  : '—';
                const ts = app.test_sessions?.[0];
                const isFlagged = ts?.ai_flag || ts?.tab_switches > 2;
                const rowIdx = (page - 1) * PAGE_SIZE + i + 1;

                return (
                  <motion.tr
                    key={app.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={`border-b border-border last:border-0 hover:bg-blue-50/30 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    onClick={() => navigate(`/admin/applicant/${app.id}`)}
                  >
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{rowIdx}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{app.students?.name || '—'}</p>
                      <p className="text-xs text-gray-500">{app.students?.city}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-navy bg-navy/5 rounded px-2 py-0.5">
                        {app.branch?.split(' ')[0] || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{pcmAvg}%</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{fd.jee || '—'}</td>
                    <td className="px-4 py-3">
                      {app.ai_score ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-navy">{Math.round(app.ai_score)}</span>
                          {app.ai_grade && <Badge variant={GRADE_BADGE[app.ai_grade] || 'default'}>{app.ai_grade}</Badge>}
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {ts?.score ? (
                        <span className="text-sm font-medium text-gray-700">{Math.round(ts.score)}%</span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs space-y-0.5">
                        {(app.s2_attempts || 0) > 0 && <span className={`font-medium ${app.s2_attempts >= 2 ? 'text-amber-600' : 'text-gray-600'}`}>S2: {app.s2_attempts}/2</span>}
                        {(app.s3_attempts || 0) > 0 && <span className={`block font-medium ${app.s3_attempts >= 2 ? 'text-amber-600' : 'text-gray-600'}`}>S3: {app.s3_attempts}/2</span>}
                        {!(app.s2_attempts || 0) && !(app.s3_attempts || 0) && <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isFlagged ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[app.status] || 'default'}>
                        {STATUS_LABELS[app.status] || app.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-navy font-semibold hover:underline">View →</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-border rounded-btn disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >← Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
              Math.max(0, page - 3), Math.min(totalPages, page + 2)
            ).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 text-xs rounded-btn border transition-colors ${page === p ? 'bg-navy text-white border-navy' : 'border-border hover:bg-gray-50'}`}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs border border-border rounded-btn disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >Next →</button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
