import React from 'react';

/**
 * Reusable skeleton loader for loading states.
 * Uses the `.skeleton` class from index.css for the wave animation.
 */
const Skeleton = ({ width = '100%', height = '16px', radius = '8px', className = '' }) => (
  <div
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius: radius }}
  />
);

export default Skeleton;
