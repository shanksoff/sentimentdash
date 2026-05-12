import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const TOOLTIP_W = 240  // matches w-60
const TOOLTIP_H = 160  // rough max height estimate
const GAP       = 8

export default function InfoTooltip({ text }) {
  const [rect, setRect] = useState(null)
  const btnRef          = useRef(null)

  const show = () => setRect(btnRef.current?.getBoundingClientRect() ?? null)
  const hide = () => setRect(null)

  useEffect(() => {
    if (!rect) return
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [rect])

  // Compute position only when we have a rect
  let style = {}
  let arrowStyle = {}
  let below = false

  if (rect) {
    const anchorCx = rect.left + rect.width / 2  // centre x of icon

    // Flip below if not enough space above
    below = rect.top < TOOLTIP_H + GAP

    // Clamp left so box stays inside viewport
    const rawLeft = anchorCx - TOOLTIP_W / 2
    const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - TOOLTIP_W - 8))

    style = {
      position:   'fixed',
      width:      TOOLTIP_W,
      left:       clampedLeft,
      background: '#0C1018',
      border:     '1px solid #1E2C3E',
      zIndex:     9999,
      ...(below
        ? { top:  rect.bottom + GAP }
        : { bottom: window.innerHeight - rect.top + GAP }),
    }

    // Arrow points toward the icon
    const arrowLeft = anchorCx - clampedLeft  // relative to tooltip box
    const clampedArrow = Math.max(12, Math.min(arrowLeft, TOOLTIP_W - 12))
    arrowStyle = {
      position: 'absolute',
      left:     clampedArrow,
      transform: 'translateX(-50%)',
      width: 0, height: 0,
      ...(below
        ? { bottom: '100%', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid #1E2C3E' }
        : { top: '100%',    borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop:    '5px solid #1E2C3E' }),
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={() => rect ? hide() : show()}
        className="text-slate-600 hover:text-[#00E5B3] transition-colors leading-none ml-1 shrink-0"
        aria-label="More information"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="6" cy="6" r="5" />
          <line x1="6" y1="5.5" x2="6" y2="8.5" strokeLinecap="round" />
          <circle cx="6" cy="3.5" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {rect && createPortal(
        <div
          className="rounded-xl p-3 text-[10px] text-slate-400 leading-relaxed shadow-2xl pointer-events-none"
          style={style}
        >
          {text}
          <div style={arrowStyle} />
        </div>,
        document.body
      )}
    </>
  )
}
