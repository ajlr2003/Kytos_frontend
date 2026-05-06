/**
 * src/components/ui/Toast.jsx
 *
 * Transient success/action notification displayed at the bottom-right corner
 * of the viewport. Auto-dismisses after 2.8 seconds by calling onClose.
 *
 * Requires the `.pur-toast` CSS class, declared in shared.css.
 *
 * Usage:
 *   {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
 */

import { useEffect } from 'react';

/**
 * @param {{ msg: string, onClose: () => void }} props
 */
export default function Toast({ msg, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2800);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="pur-toast">
      <svg
        viewBox="0 0 24 24" width="16" height="16"
        fill="none" stroke="#fff"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {msg}
    </div>
  );
}
