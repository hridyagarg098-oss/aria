/**
 * Shared stats calculation for Dashboard and Analytics.
 * Uses consistent filters so both pages show identical numbers.
 */

export const calculateAdmissionStats = (applications) => {
  const total = applications.length;

  // Stage 1 passed = any status beyond pending/rejected_s1
  const s1Passed = applications.filter(a =>
    !['pending', 'rejected_s1'].includes(a.status)
  ).length;

  // Stage 2 passed = statuses that indicate S2 completion
  const s2Passed = applications.filter(a =>
    ['passed_s2', 'interview', 'selected',
     's3_attempt1_failed', 'rejected_s3', 'rejected_s3_both_attempts'].includes(a.status)
  ).length;

  // Interviews done
  const interviews = applications.filter(a =>
    ['interview', 'selected', 'rejected_s3'].includes(a.status)
  ).length;

  // Selected
  const selected = applications.filter(a =>
    a.status === 'selected'
  ).length;

  return {
    total,
    s1Passed,
    s1Rate: total > 0 ? Math.round((s1Passed / total) * 100) : 0,
    s2Passed,
    s2Rate: s1Passed > 0 ? Math.round((s2Passed / s1Passed) * 100) : 0,
    interviews,
    interviewRate: s2Passed > 0 ? Math.round((interviews / s2Passed) * 100) : 0,
    selected,
    selectionRate: total > 0 ? Math.round((selected / total) * 100) : 0,
  };
};

/**
 * Calculate AI flag count from test sessions.
 * A session is "flagged" if any integrity metric is triggered.
 */
export const calculateFlagCount = (sessions) => {
  return (sessions || []).filter(s =>
    s.ai_flag === true ||
    (s.face_warning_count >= 2) ||
    (s.tab_switches >= 2) ||
    s.force_terminated === true ||
    (s.integrity_log && s.integrity_log.length >= 3)
  ).length;
};
