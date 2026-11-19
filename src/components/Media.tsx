import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Media } from '../db/types';
import { addMediaFiles, formatBytes } from '../lib/media';
import { toast, useObjectUrl } from '../hooks';
import { IconClose, IconLeft, IconRight, IconTrash } from './Icons';

function Thumb({ m, onOpen }: { m: Media; onOpen: () => void }) {
  const url = useObjectUrl(m.blob);
  return (
    <button type="button" className="thumb" onClick={onOpen} aria-label={`Open ${m.kind}${m.name ? ` ${m.name}` : ''}`}>
      {url && (m.kind === 'image' ? <img src={url} alt="" loading="lazy" /> : <video src={`${url}#t=0.1`} muted playsInline preload="metadata" />)}
      {m.kind === 'video' && <span className="play" aria-hidden>▶</span>}
    </button>
  );
}

export function Viewer({ items, start, onClose }: { items: Media[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const m = items[i];
  const url = useObjectUrl(m?.blob);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(items.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [items.length, onClose]);
  if (!m) return null;
  const remove = async () => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    await db.media.delete(m.id);
    if (items.length <= 1) onClose();
    else setI(Math.max(0, i - 1));
  };
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="viewer-bar">
        <button className="icon-btn" aria-label="Close" onClick={onClose}><IconClose /></button>
        <span>{i + 1} / {items.length} · {formatBytes(m.size)}</span>
        <button className="icon-btn" aria-label="Delete" onClick={remove}><IconTrash /></button>
      </div>
      <div
        className="viewer-body"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (dx < -50) setI((x) => Math.min(items.length - 1, x + 1));
          if (dx > 50) setI((x) => Math.max(0, x - 1));
          touchX.current = null;
        }}
      >
        {url && (m.kind === 'image' ? <img src={url} alt={m.name ?? ''} /> : <video key={m.id} src={url} controls autoPlay playsInline />)}
      </div>
      <div className="viewer-bar">
        <button className="icon-btn" aria-label="Previous" disabled={i === 0} onClick={() => setI(i - 1)}><IconLeft /></button>
        <button className="icon-btn" aria-label="Next" disabled={i === items.length - 1} onClick={() => setI(i + 1)}><IconRight /></button>
      </div>
    </div>
  );
}

export function MediaGallery({ ownerType, ownerId }: { ownerType: Media['ownerType']; ownerId: string }) {
  const items = useLiveQuery(
    () => db.media.where('[ownerType+ownerId]').equals([ownerType, ownerId]).sortBy('createdAt'),
    [ownerType, ownerId],
  );
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = `media-${ownerType}-${ownerId}`;
  return (
    <div>
      <div className="gallery">
        {(items ?? []).map((m, i) => <Thumb key={m.id} m={m} onOpen={() => setOpen(i)} />)}
        <label className="add-thumb" htmlFor={inputId}>{busy ? 'Adding…' : '+ Photo / video'}</label>
      </div>
      <input
        id={inputId}
        className="sr-only"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={async (e) => {
          const files = e.target.files;
          if (!files?.length) return;
          setBusy(true);
          try {
            const n = await addMediaFiles(ownerType, ownerId, files);
            if (n) toast(`Added ${n} item${n > 1 ? 's' : ''}`);
          } catch (err) {
            toast(`Could not add media: ${(err as Error).message}`);
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
      {open != null && items && <Viewer items={items} start={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
