import { useMemo, useState } from 'react';
import type { IndoorOutdoor, Location } from '../db/types';
import { Autocomplete, Chips } from './ui';
import type { Dataset } from '../lib/stats';

export interface LocationDraft {
  id?: string; // existing location
  name: string;
  area: string;
  country: string;
  type: IndoorOutdoor;
}

export const draftFromLocation = (l?: Location): LocationDraft =>
  l ? { id: l.id, name: l.name, area: l.area, country: l.country, type: l.type } : { name: '', area: '', country: '', type: 'indoor' };

/** Pick a recent location, or type a new one (area/country fields appear). */
export function LocationPicker({ ds, value, onChange }: { ds: Dataset; value: LocationDraft; onChange: (d: LocationDraft) => void }) {
  const options = useMemo(() => {
    const last = new Map<string, string>();
    for (const s of ds.sessions) if (s.locationId && (last.get(s.locationId) ?? '') < s.date) last.set(s.locationId, s.date);
    return [...ds.locations]
      .sort((a, b) => ((last.get(b.id) ?? '') < (last.get(a.id) ?? '') ? -1 : 1))
      .map((l) => ({ id: l.id, label: l.name, sub: [l.area, l.country].filter(Boolean).join(', ') }));
  }, [ds]);
  const [touched, setTouched] = useState(false);
  const areas = [...new Set(ds.locations.map((l) => l.area).filter(Boolean))];
  const countries = [...new Set(ds.locations.map((l) => l.country).filter(Boolean))];
  return (
    <div className="stack">
      <label className="field">
        Crag or gym
        <Autocomplete
          label="Crag or gym"
          value={value.name}
          options={options}
          placeholder="Start typing, or pick a recent one"
          onChange={(name) => {
            setTouched(true);
            onChange({ ...value, id: undefined, name });
          }}
          onPick={(o) => {
            const l = ds.locations.find((x) => x.id === o.id);
            if (l) onChange({ id: l.id, name: l.name, area: l.area, country: l.country, type: l.type });
          }}
        />
      </label>
      {!value.id && value.name.trim() && touched && (
        <div className="form-grid two">
          <label className="field">
            Area
            <input list="areas" value={value.area} onChange={(e) => onChange({ ...value, area: e.target.value })} placeholder="e.g. Fontainebleau" />
            <datalist id="areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
          </label>
          <label className="field">
            Country
            <input list="countries" value={value.country} onChange={(e) => onChange({ ...value, country: e.target.value })} placeholder="e.g. France" />
            <datalist id="countries">{countries.map((a) => <option key={a} value={a} />)}</datalist>
          </label>
        </div>
      )}
      <Chips options={['indoor', 'outdoor'] as const} value={value.type} labels={{ indoor: 'Indoor', outdoor: 'Outdoor' }} label="Indoor or outdoor" onChange={(type: IndoorOutdoor) => onChange({ ...value, type })} />
    </div>
  );
}
