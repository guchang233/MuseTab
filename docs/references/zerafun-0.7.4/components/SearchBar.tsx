import { ownsSelectOverlay } from "./Select";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { pushBack } from '../lib/native';

/** One search language throughout the site. Filters stay outside the form. */
export default function SearchBar({ label, placeholder, value, onChange, onSubmit, filters, active = false, className = '', inputRef, inputProps, suggestions, busy = false, submitLabel = '搜索', history = [], onHistorySelect, onClearHistory }: {
  label: string; placeholder?: string; value: string; onChange: (value: string) => void;
  onSubmit?: () => void; filters?: ReactNode; active?: boolean; className?: string;
  inputRef?: Ref<HTMLInputElement>; inputProps?: InputHTMLAttributes<HTMLInputElement>; suggestions?: ReactNode;
  busy?: boolean; submitLabel?: string;
  history?: string[]; onHistorySelect?: (value: string) => void; onClearHistory?: () => void;
}) {
  const [open, setOpen] = useState(false), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [focused, setFocused] = useState(false);
  const showHistory = focused && !open && !value.trim() && history.length > 0;
  const id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open && !showHistory) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !ownsSelectOverlay(root.current, event.target)) { setOpen(false); setFocused(false); } };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setFocused(false); if (open) trigger.current?.focus(); } };
    const back = pushBack(() => { setOpen(false); setFocused(false); return true; });
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { back(); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [open, showHistory]);
  return <div ref={root} className={'shared-search ' + className}>
    <form className="search-bar" role="search" aria-label={label} onSubmit={event => { event.preventDefault(); setOpen(false); setFocused(false); onSubmit?.(); }}>
      <div className="search-field">
        {filters ? <button ref={trigger} type="button" className={'search-filter' + (active ? ' is-active' : '')} aria-label={label + '筛选'} aria-expanded={open} aria-controls={id} onClick={() => { setFocused(false); setOpen(v => !v); }}><SlidersHorizontal className="size-4" strokeWidth={1.6} />{active && <i aria-hidden />}</button> : <span className="search-leading"><Search className="size-4" strokeWidth={1.6} /></span>}
        <input {...inputProps} ref={inputRef} type="search" className="search-input" aria-label={label} placeholder={placeholder} value={value} onChange={event => { setFocused(true); onChange(event.target.value); }} onFocus={event => { setFocused(true); inputProps?.onFocus?.(event); }} onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node)) setFocused(false); inputProps?.onBlur?.(event); }} enterKeyHint="search" />
        <button type="button" className="search-clear" aria-label={'清空' + label} aria-hidden={!value} disabled={!value} tabIndex={value ? 0 : -1} style={{ visibility: value ? 'visible' : 'hidden' }} onClick={() => onChange('')}><X className="size-3.5" /></button>
        {suggestions}
        {showHistory && <div className="search-history" aria-label="最近搜索" role="region" onMouseDown={event => event.preventDefault()}>
          <div className="search-history-heading"><span>最近搜索</span>{onClearHistory && <button type="button" onClick={onClearHistory}>清除</button>}</div>
          {history.slice(0, 8).map(text => <button key={text} type="button" className="search-history-item" onClick={() => { setFocused(false); onChange(text); onHistorySelect?.(text); }}>{text}</button>)}
        </div>}
      </div>
      <button type="submit" className="search-submit" disabled={busy}>{busy ? '搜索中…' : submitLabel}</button>
    </form>
    {open && filters && <section id={id} role="dialog" aria-label={label + '筛选'} className="search-filters" data-nav-trap>
      <header><strong>筛选</strong><button type="button" className="icon-btn" aria-label="关闭筛选" onClick={close}><X className="size-4" /></button></header>
      <div className="filter-content">{filters}</div>
    </section>}
  </div>;
}
