import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconClose } from './Icons';
import type { Discipline, GradeSystem } from '../db/types';
import { GRADE_SYSTEM_LABEL } from '../db/types';
import { gradeList, isValidGrade, normalizeGrade, systemsFor } from '../lib/grades/grades';

export function Chips<T extends string>({
  options, value, onChange, label, labels, multi, scroll, className,
}: {
  options: readonly T[];
  value: T | T[] | undefined;
  onChange: (v: any) => void;
  label?: string;
  labels?: Partial<Record<T, string>>;
  multi?: boolean;
  scroll?: boolean;
  className?: string;
}) {
  const selected = (o: T) => (Array.isArray(value) ? value.includes(o) : value === o);
  const toggle = (o: T) => {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    } else onChange(o);
  };
  return (
    <div role="group" aria-label={label} className={`chips ${scroll ? 'scroll' : ''} ${className ?? ''}`}>
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={selected(o)} onClick={() => toggle(o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function Rating({ value, onChange, max = 5, label, symbol = '★' }: { value?: number; onChange: (n: number | undefined) => void; max?: number; label: string; symbol?: string }) {
  return (
    <div className="stars" role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} of ${max}`}
          aria-pressed={(value ?? 0) >= n}
          onClick={() => onChange(value === n ? undefined : n)}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', on);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><IconClose /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface ACOption { id: string; label: string; sub?: string }

/** Text input with a suggestion list. Calls onPick when an option is chosen. */
export function Autocomplete({
  value, onChange, options, onPick, placeholder, label, autoFocus, showOnFocus = true,
}: {
  value: string;
  onChange: (s: string) => void;
  options: ACOption[];
  onPick: (o: ACOption) => void;
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
  showOnFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    return options.filter((o) => !q || o.label.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q)).slice(0, 8);
  }, [value, options]);
  useEffect(() => {
    const on = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', on);
    return () => document.removeEventListener('pointerdown', on);
  }, []);
  return (
    <div className="ac" ref={ref}>
      <input
        aria-label={label}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        onFocus={() => showOnFocus && setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="ac-list" role="listbox">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onPick(o);
                  setOpen(false);
                }}
              >
                <div style={{ fontWeight: 600 }}>{o.label}</div>
                {o.sub && <div className="muted" style={{ fontSize: '0.85rem' }}>{o.sub}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** System switcher + one-tap grade chips + free-text fallback. */
export function GradePicker({
  discipline, system, grade, onChange, hint,
}: {
  discipline: Discipline;
  system: GradeSystem;
  grade: string;
  onChange: (grade: string, system: GradeSystem) => void;
  /** grade to scroll to when nothing is selected (e.g. your recent level) */
  hint?: string;
}) {
  const systems = systemsFor(discipline);
  const sys = systems.includes(system) ? system : systems[0];
  const list = gradeList(sys);
  const scroller = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    // scroll the selected grade into view
    const row = scroller.current?.querySelector('.chips') as HTMLElement | null;
    if (!row) return;
    let el = row.querySelector('[aria-pressed="true"]') as HTMLElement | null;
    if (!el && hint) el = [...row.querySelectorAll('button')].find((b) => b.textContent === hint) ?? null;
    if (el) row.scrollLeft = el.offsetLeft - row.clientWidth / 2 + el.offsetWidth / 2;
  }, [sys, grade, hint]);
  const typedOk = typed && isValidGrade(typed, sys);
  return (
    <fieldset>
      <legend>Grade</legend>
      <Chips options={systems} value={sys} onChange={(s: GradeSystem) => onChange('', s)} labels={GRADE_SYSTEM_LABEL} label="Grade system" />
      <div ref={scroller}>
        <Chips scroll options={list} value={normalizeGrade(grade, sys)} onChange={(g: string) => onChange(g, sys)} label="Grade" />
      </div>
      <div className="row">
        <input
          style={{ flex: 1, minWidth: 0 }}
          aria-label="Type a grade"
          placeholder={sys === 'uk' ? 'or type, e.g. E1 5a' : 'or type a grade'}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button type="button" className="btn secondary sm" disabled={!typedOk} onClick={() => { onChange(normalizeGrade(typed, sys), sys); setTyped(''); }}>
          Use
        </button>
      </div>
      {typed && !typedOk && <span className="field-hint">Not a recognised {GRADE_SYSTEM_LABEL[sys]} grade.</span>}
    </fieldset>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Stat({ label, value, meta }: { label: string; value: ReactNode; meta?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {meta && <div className="meta">{meta}</div>}
    </div>
  );
}

export const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s));
