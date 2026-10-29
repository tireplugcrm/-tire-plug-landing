import React, { useId, useState } from 'react';
import { useRouter } from 'next/router';
import { sizeToSlug } from '../lib/tire-catalog';
import { track } from '../lib/track';

// Size picker that sends the customer to /tires/<size> with every option we carry.
// Same dropdown values as the text-quote finder, so any real tire size can be picked;
// sizes we don't list yet land on a page that offers to text us for a quote.
export const SIZE_MODES = {
  metric: {
    example: '225/45R17',
    labels: ['Width', 'Height', 'Rim'],
    s1: ['155', '165', '175', '185', '195', '205', '215', '225', '235', '245', '255', '265', '275', '285', '295', '305', '315', '325', '335'],
    s2: ['25', '30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80', '85'],
    s3: ['13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '24', '26'],
    build: (a, b, c) => `${a}/${b}R${c}`,
  },
  truck: {
    example: '33x12.50R20',
    labels: ['Diameter', 'Width', 'Rim'],
    s1: ['30', '31', '32', '33', '34', '35', '36', '37', '38', '40'],
    s2: ['9.50', '10.50', '11.50', '12.50', '13.00', '13.50', '14.50', '15.50'],
    s3: ['15', '16', '17', '18', '20', '22', '24', '26', '28'],
    build: (a, b, c) => `${a}X${b}R${c}`,
  },
};

export default function TireSizeSearch({ initial, compact = false }) {
  const router = useRouter();
  const parsed = parseSize(initial);
  const [mode, setMode] = useState(parsed?.mode || 'metric');
  const [s1, setS1] = useState(parsed?.s1 || '');
  const [s2, setS2] = useState(parsed?.s2 || '');
  const [s3, setS3] = useState(parsed?.s3 || '');
  const labelId = useId();
  const cfg = SIZE_MODES[mode];
  const ready = s1 && s2 && s3;

  const pick = (m) => { setMode(m); setS1(''); setS2(''); setS3(''); };
  const go = (e) => {
    e.preventDefault();
    if (!ready) return;
    const size = cfg.build(s1, s2, s3);
    track('Size search', { size }, { event: 'Search', params: { search_string: size } });
    router.push(`/tires/${sizeToSlug(size)}`);
  };

  return (
    <form className={`tss${compact ? ' compact' : ''}`} onSubmit={go}>
      <span className="tss-label" id={labelId}>Input your tire size - Check Our Stock Now!</span>
      <div className="tss-row" role="group" aria-labelledby={labelId}>
        <select aria-label={cfg.labels[0]} value={s1} onChange={(e) => setS1(e.target.value)}>
          <option value="">{cfg.labels[0]}</option>{cfg.s1.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select aria-label={cfg.labels[1]} value={s2} onChange={(e) => setS2(e.target.value)}>
          <option value="">{cfg.labels[1]}</option>{cfg.s2.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select aria-label={cfg.labels[2]} value={s3} onChange={(e) => setS3(e.target.value)}>
          <option value="">{cfg.labels[2]}</option>{cfg.s3.map((v) => <option key={v} value={v}>R{v}</option>)}
        </select>
      </div>
      <button type="submit" className="tss-go" disabled={!ready}>
        {ready ? `Show tires in ${cfg.build(s1, s2, s3).replace('X', 'x')} →` : 'Pick your size to see tires'}
      </button>
      <p className="tss-hint">It's on your tire's sidewall, e.g. {cfg.example}.</p>
      <button type="button" className="tss-switch" onClick={() => pick(mode === 'metric' ? 'truck' : 'metric')}>
        {mode === 'metric' ? 'Truck size like 33x12.50R20?' : 'Regular size like 225/45R17?'}
      </button>

      <style jsx>{`
        .tss { display: flex; flex-direction: column; gap: 0.6rem; }
        .tss-label { font-size: 1rem; font-weight: 900; color: #000; }
        .tss-switch { align-self: center; background: none; border: none; padding: 0; color: #6b6b6b; font: inherit; font-size: 0.75rem; text-decoration: underline; cursor: pointer; }
        .tss-switch:hover { color: #E01B22; }
        .tss-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .tss-row select { width: 100%; padding: 0.85rem 0.6rem; border: 1px solid #dcdcdc; border-radius: 10px; background: #fff; color: #111; font: inherit; font-size: 0.95rem; appearance: none; -webkit-appearance: none; cursor: pointer; }
        .tss-row select:focus { outline: none; border-color: #E01B22; }
        .tss-go { margin-top: 0.2rem; width: 100%; padding: 1.05rem; border: none; border-radius: 50px; background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; font: inherit; font-weight: 800; font-size: 1rem; cursor: pointer; box-shadow: 0 8px 20px rgba(224,27,34,0.2); }
        .tss-go:disabled { opacity: 0.45; cursor: default; box-shadow: none; }
        .tss-go:focus-visible { outline: 2px solid #111; outline-offset: 2px; }
        .tss-hint { margin: 0; color: #6b6b6b; font-size: 0.75rem; text-align: center; }
        .compact .tss-go { padding: 0.9rem; }
      `}</style>
    </form>
  );
}

// "265/70R17" -> { mode, s1, s2, s3 } so the picker can show the current size.
function parseSize(key) {
  if (!key) return null;
  let m = String(key).match(/^(\d{3})\/(\d{2})R(\d{2})$/i);
  if (m) return { mode: 'metric', s1: m[1], s2: m[2], s3: m[3] };
  m = String(key).match(/^(\d{2})X([\d.]+)R(\d{2})$/i);
  if (m) return { mode: 'truck', s1: m[1], s2: m[2], s3: m[3] };
  return null;
}
