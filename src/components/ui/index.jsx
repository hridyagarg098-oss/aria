import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

// ── Button ──────────────────────────────────────────────────────
export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) => {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-btn transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-navy text-white hover:bg-navy-light focus:ring-navy active:bg-navy-dark',
    gold: 'bg-gold text-white hover:bg-yellow-600 focus:ring-gold active:bg-yellow-700',
    outline: 'bg-white text-navy border border-border hover:bg-navy-50 focus:ring-navy',
    ghost: 'text-navy hover:bg-navy-50 focus:ring-navy',
    danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50 focus:ring-red-400',
    success: 'bg-white text-green-700 border border-green-200 hover:bg-green-50 focus:ring-green-400',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
        </svg>
      )}
      {children}
    </button>
  );
};

// ── Card ────────────────────────────────────────────────────────
export const Card = ({ className = '', children, ...props }) => (
  <div
    className={cn('bg-white border border-border rounded-card p-6 shadow-sm', className)}
    {...props}
  >
    {children}
  </div>
);

// ── Badge / Pill ────────────────────────────────────────────────
export const Badge = ({ variant = 'default', className = '', children }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-600',
    navy: 'bg-navy text-white',
    gold: 'bg-gold-bg text-yellow-800 border border-yellow-200',
    success: 'bg-green-50 text-green-700 border border-green-200',
    error: 'bg-red-50 text-red-700 border border-red-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    maths: 'bg-blue-50 text-blue-700',
    physics: 'bg-purple-50 text-purple-700',
    chemistry: 'bg-green-50 text-green-700',
    english: 'bg-amber-50 text-amber-700',
    reasoning: 'bg-cyan-50 text-cyan-700',
    pending: 'bg-gray-100 text-gray-600',
    passed_s1: 'bg-blue-50 text-blue-700 border border-blue-200',
    passed_s2: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    rejected_s1: 'bg-red-50 text-red-700 border border-red-200',
    rejected_s2: 'bg-red-50 text-red-700 border border-red-200',
    rejected_s3: 'bg-red-50 text-red-700 border border-red-200',
    s2_attempt1_failed: 'bg-amber-50 text-amber-700 border border-amber-200',
    rejected_s2_both_attempts: 'bg-red-50 text-red-700 border border-red-200',
    s3_attempt1_failed: 'bg-amber-50 text-amber-700 border border-amber-200',
    rejected_s3_both_attempts: 'bg-red-50 text-red-700 border border-red-200',
    interview: 'bg-purple-50 text-purple-700 border border-purple-200',
    selected: 'bg-green-50 text-green-700 border border-green-200',
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold',
      variants[variant] || variants.default,
      className
    )}>
      {children}
    </span>
  );
};

// ── Input ───────────────────────────────────────────────────────
export const Input = ({
  label,
  error,
  hint,
  className = '',
  containerClass = '',
  ...props
}) => (
  <div className={cn('flex flex-col gap-1', containerClass)}>
    {label && (
      <label className="text-xs font-semibold text-gray-700 uppercase tracking-widest">
        {label}
      </label>
    )}
    <input
      className={cn(
        'w-full bg-white border border-border rounded-btn px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors',
        'focus:border-navy focus:ring-2 focus:ring-navy/10',
        error && 'border-red-400 focus:border-red-400 focus:ring-red-400/10',
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-600">{error}</p>}
    {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
  </div>
);

// ── Textarea ────────────────────────────────────────────────────
export const Textarea = ({
  label,
  error,
  hint,
  className = '',
  containerClass = '',
  ...props
}) => (
  <div className={cn('flex flex-col gap-1', containerClass)}>
    {label && (
      <label className="text-xs font-semibold text-gray-700 uppercase tracking-widest">
        {label}
      </label>
    )}
    <textarea
      className={cn(
        'w-full bg-white border border-border rounded-btn px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors resize-none',
        'focus:border-navy focus:ring-2 focus:ring-navy/10',
        error && 'border-red-400',
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-600">{error}</p>}
    {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
  </div>
);

// ── Select ──────────────────────────────────────────────────────
export const Select = ({
  label,
  error,
  className = '',
  containerClass = '',
  children,
  ...props
}) => (
  <div className={cn('flex flex-col gap-1', containerClass)}>
    {label && (
      <label className="text-xs font-semibold text-gray-700 uppercase tracking-widest">
        {label}
      </label>
    )}
    <select
      className={cn(
        'w-full bg-white border border-border rounded-btn px-3 py-2.5 text-sm text-gray-900 transition-colors',
        'focus:border-navy focus:ring-2 focus:ring-navy/10',
        error && 'border-red-400',
        className
      )}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

// ── ProgressBar ─────────────────────────────────────────────────
export const ProgressBar = ({ value = 0, max = 100, variant = 'navy', className = '' }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    navy: 'bg-navy',
    gold: 'bg-gold',
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-400',
  };
  return (
    <div className={cn('w-full bg-gray-100 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full progress-fill', colors[variant] || colors.navy)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ── Skeleton ─────────────────────────────────────────────────────
export const Skeleton = ({ className = '', ...props }) => (
  <div className={cn('skeleton', className)} {...props} />
);

// ── Modal ───────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, className = '' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={cn('relative bg-white rounded-card shadow-lg max-w-md w-full p-6', className)}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-card-title font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

// ── Section Header ───────────────────────────────────────────────
export const SectionHeader = ({ eyebrow, title, subtitle, center = false }) => (
  <div className={cn('mb-8', center && 'text-center')}>
    {eyebrow && (
      <p className="text-label text-gold uppercase tracking-widest mb-2">{eyebrow}</p>
    )}
    <h2 className="text-section-head text-navy">{title}</h2>
    {subtitle && <p className="text-body text-gray-500 mt-2 max-w-xl">{subtitle}</p>}
  </div>
);

// Status label map for applications
export const STATUS_LABELS = {
  pending: 'Pending',
  passed_s1: 'Passed Stage 1',
  rejected_s1: 'Rejected S1',
  passed_s2: 'Passed Stage 2',
  rejected_s2: 'Rejected S2',
  s2_attempt1_failed: 'S2 Retry Pending',
  rejected_s2_both_attempts: 'Rejected S2 (Both)',
  interview: 'Interview Done',
  s3_attempt1_failed: 'S3 Retry Pending',
  rejected_s3_both_attempts: 'Rejected S3 (Both)',
  selected: 'Selected',
  rejected_s3: 'Not Selected',
};

export const BRANCHES = [
  'Computer Science Engineering',
  'Electronics & Communication Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
  'Information Technology',
];
