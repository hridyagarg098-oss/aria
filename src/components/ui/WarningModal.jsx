import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Full-screen, non-dismissible warning modal for anti-cheat violations.
 * Auto-dismisses after countdownSec.
 */
export default function WarningModal({ warningNumber, maxWarnings = 3, reason, onDismiss, countdownSec = 5 }) {
  const [countdown, setCountdown] = useState(countdownSec);

  useEffect(() => {
    setCountdown(countdownSec);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [warningNumber]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl border-4 border-red-500"
      >
        {/* Warning icon */}
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M12 9v2m0 4h.01M10.29 3.86l-8.58 14.86a1.99 1.99 0 001.72 2.98h17.14a1.99 1.99 0 001.72-2.98L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-red-700 mb-2">
          Integrity Warning {warningNumber}/{maxWarnings}
        </h2>

        <p className="text-gray-700 mb-3 font-medium">{reason}</p>

        <p className="text-sm text-gray-500 mb-4">
          {warningNumber >= maxWarnings
            ? 'Maximum warnings reached. Your test will be terminated.'
            : `${maxWarnings - warningNumber} warning(s) remaining before automatic termination.`
          }
        </p>

        {/* Countdown */}
        <div className="bg-gray-100 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500">Auto-continuing in</p>
          <p className="text-3xl font-bold text-navy">{countdown}</p>
        </div>

        <p className="text-xs text-gray-400">This warning cannot be dismissed. Stay focused on your test.</p>
      </motion.div>
    </div>
  );
}
