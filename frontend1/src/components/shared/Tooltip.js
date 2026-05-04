import React from 'react';

/**
 * A wrapper component that shows a tooltip after the user hovers for exactly 3 seconds.
 */
export default function Tooltip({ text, children, position = 'top' }) {
  if (!text) return children;

  // The CSS class tooltip-content uses a transition-delay: 3s on hover
  // which satisfies the requirement of showing exactly after 3 seconds of continuous hover.
  return (
    <div className="tooltip-container">
      {children}
      <div 
        className="tooltip-content" 
        style={position === 'bottom' ? { top: 'calc(100% + 10px)', bottom: 'auto', transform: 'translateX(-50%) translateY(-4px) scale(0.95)' } : {}}
      >
        {text}
      </div>
    </div>
  );
}
