import { useId, useState } from 'react'
import { formatAngle, parseAngle } from './coordinates.js'

const PLACEHOLDERS = {
  hours: 'e.g. 18h36m56s or 18.6',
  degrees: "e.g. +38°47'01\" or 38.78",
  positive: 'e.g. 245°30′ or 245.5',
  latitude: "e.g. 51°09' N or 51,15",
  longitude: "e.g. 4°28' OL or 4.47",
}

/**
 * Text field for an angle stored in degrees. Shows the live value until the user edits it;
 * Enter commits, Escape cancels, arrow keys nudge by `step` degrees (×10 with Shift).
 */
export default function AngleField({ label, symbol, value, kind, mode, onCommit, normalize, step = 1, rangeHint }) {
  const id = useId()
  const [draft, setDraft] = useState(null)
  const [invalid, setInvalid] = useState(false)
  const formatted = formatAngle(value, kind, mode)
  const parseKind = kind === 'positive' ? 'degrees' : kind

  function commit() {
    const parsed = parseAngle(draft ?? '', parseKind)
    const next = parsed === null ? null : normalize ? normalize(parsed) : parsed
    if (next === null) {
      setInvalid(true)
      return false
    }
    onCommit(next)
    setDraft(null)
    setInvalid(false)
    return true
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (draft !== null) commit()
    } else if (event.key === 'Escape') {
      setDraft(null)
      setInvalid(false)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const delta = step * (event.shiftKey ? 10 : 1) * (event.key === 'ArrowUp' ? 1 : -1)
      const next = normalize ? normalize(value + delta) : value + delta
      if (next !== null) onCommit(next)
      setDraft(null)
      setInvalid(false)
    }
  }

  return (
    <div className="angle-field" data-invalid={invalid}>
      <label htmlFor={id}>
        <span className="angle-symbol">{symbol}</span>
        <span className="angle-name">{label}</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="text"
        spellCheck="false"
        autoComplete="off"
        value={draft ?? formatted}
        placeholder={PLACEHOLDERS[kind]}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          setDraft(event.target.value)
          setInvalid(false)
        }}
        onBlur={() => {
          if (draft !== null && !commit()) {
            setDraft(null)
            setInvalid(false)
          }
        }}
        onKeyDown={handleKeyDown}
      />
      <span id={`${id}-hint`} className="angle-hint">
        {invalid ? `Not a valid value${rangeHint ? ` (${rangeHint})` : ''}` : rangeHint}
      </span>
    </div>
  )
}
