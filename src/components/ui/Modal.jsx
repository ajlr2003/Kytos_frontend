/**
 * src/components/ui/Modal.jsx
 *
 * Reusable overlay modal dialog. Renders a centered card over a dimmed backdrop.
 * Clicking the backdrop calls onClose; clicking inside the card stops propagation.
 *
 * Requires `.pur-modal-*` CSS classes, declared in shared.css.
 *
 * Usage:
 *   <Modal title="Edit Item" onClose={() => setOpen(false)} width={560}>
 *     <p>Modal content here</p>
 *   </Modal>
 */

/**
 * @param {{
 *   title:    string,
 *   onClose:  () => void,
 *   width?:   number,
 *   children: React.ReactNode,
 * }} props
 */
export default function Modal({ title, onClose, width = 480, children }) {
  return (
    <div className="pur-modal-overlay" onClick={onClose}>
      <div
        className="pur-modal"
        style={{ width }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="pur-modal-header">
          <span className="pur-modal-title">{title}</span>
          <button className="pur-modal-close" onClick={onClose} aria-label="Close modal">
            <svg
              viewBox="0 0 24 24" width="16" height="16"
              fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="pur-modal-body">{children}</div>
      </div>
    </div>
  );
}
