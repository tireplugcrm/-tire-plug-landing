import React from 'react';

// One tire we have on the shelf, on /tires/<size>: brand, what the tire is, the spec sheet
// we have for it, and a text-to-reserve button. Availability only, no price.
const SIDEWALL = {
  BSW: 'Black sidewall', BW: 'Black sidewall', BK: 'Black sidewall', 'B/TL': 'Black sidewall',
  MBW: 'Matte black sidewall', WSW: 'White sidewall', OWL: 'Outlined white letters',
  RWL: 'Raised white letters', VSB: 'Vertical serrated band',
};

function specRows(s) {
  return [
    ['Load / speed', s.loadIndex || s.speed ? `${s.loadIndex || ''}${s.speed || ''}` : null],
    ['Load range', s.loadRange && (s.ply ? `${s.loadRange} (${s.ply}-ply)` : s.loadRange)],
    ['UTQG', s.utqg],
    ['Sidewall', SIDEWALL[s.sidewall] || s.sidewall],
    ['Overall diameter', s.overallDiameter && `${s.overallDiameter}"`],
    ['Tread depth', s.treadDepth32 && `${s.treadDepth32}/32"`],
    ['Max load', s.loadLbs && `${Number(s.loadLbs).toLocaleString()} lbs`],
    ['Max pressure', s.maxPsi && `${s.maxPsi} PSI`],
    ['Weight', s.weightLbs && `${s.weightLbs} lbs`],
    ['Warranty', s.warranty && `${Number(s.warranty).toLocaleString()} miles`],
  ].filter(([, v]) => v);
}

export default function StockTireCard({ tire: t, size, smsHref }) {
  const s = t.specs || {};
  const rows = specRows(s);
  const fit = [size, s.loadIndex ? `${s.loadIndex}${s.speed || ''}` : '', s.loadRange === 'XL' ? 'XL' : ''].filter(Boolean).join(' ');
  const chips = [
    s.warranty && `${Math.round(s.warranty / 1000)}K-mile warranty`,
    s.utqg && `UTQG ${s.utqg}`,
    t.lt && 'LT',
    s.runFlat && 'Run-flat',
    ...t.features.filter((f) => !/warranty|coverage|hazard|offered in|utqg/i.test(f) && f.length <= 28),
  ].filter(Boolean).slice(0, 4);

  // Brand mark: the logo if we have one, else the name as a wordmark. Big in the photo
  // slot when there's no tire photo, small above the model name when there is.
  return (
    <li className="stc">
      <div className="stc-ph">
        <span className={`stc-lvl ${t.level}`}>{t.level === 'in' ? 'In stock' : 'Low stock'}</span>
        {t.img
          ? <img className="stc-img" src={t.img} alt={`${t.brand} ${t.model} tire`} loading="lazy" />
          : t.logo
            ? <img className={`stc-logo-big${t.logoDark ? ' on-dark' : ''}`} src={t.logo} alt={t.brand} />
            : <span className="stc-word-big">{t.brand}</span>}
      </div>
      <div className="stc-body">
        {t.img && (t.logo ? <img className={`stc-logo${t.logoDark ? ' on-dark' : ''}`} src={t.logo} alt={t.brand} /> : <span className="stc-word">{t.brand}</span>)}
        <h3>{t.model || t.brand}</h3>
        {t.category && <div className="stc-cat">{t.category}</div>}
        <div className="stc-fit">✓ Fits {fit}</div>
        {chips.length > 0 && <div className="stc-chips">{chips.map((c) => <span key={c}>{c}</span>)}</div>}
        <div className="stc-ready">Ready to install today</div>
        <div className="stc-ctas">
          <a className="stc-btn red" href={smsHref}>Text to reserve</a>
          <a className="stc-btn ghost" href="tel:5625004625">Call</a>
        </div>
        {(rows.length > 0 || t.about || t.features.length > 0) && (
          <details className="stc-specs">
            <summary>Specs</summary>
            <dl>{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
            {t.about && <p>{t.about}</p>}
            {t.features.length > 0 && <ul>{t.features.map((f) => <li key={f}>{f}</li>)}</ul>}
          </details>
        )}
      </div>

      <style jsx>{`
        .stc { display: grid; grid-template-columns: 170px 1fr; background: #fff; border: 1px solid #e6e6e6; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,0.05); }
        .stc-ph { position: relative; display: grid; place-items: center; padding: 2.2rem 0.9rem 0.9rem; background: #fafafa; border-right: 1px solid #f0f0f0; }
        .stc-img { width: 100%; max-height: 190px; object-fit: contain; }
        .stc-logo-big { width: 80%; max-height: 70px; object-fit: contain; }
        .on-dark { background: #111; padding: 8px 10px; border-radius: 8px; box-sizing: border-box; }
        .stc-word-big { font-size: 1.35rem; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase; color: #111; text-align: center; line-height: 1.05; word-break: break-word; }
        .stc-lvl { position: absolute; top: 10px; left: 10px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.3rem 0.55rem; border-radius: 6px; }
        .stc-lvl.in { background: #e8f6ec; color: #1b6b34; }
        .stc-lvl.low { background: #fff3e0; color: #9a5300; }
        .stc-body { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; }
        .stc-logo { height: 22px; width: auto; align-self: flex-start; }
        .stc-word { font-size: 0.78rem; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b; }
        h3 { font-size: 1.2rem; font-weight: 800; margin: 0; line-height: 1.15; }
        .stc-cat { color: #6b6b6b; font-size: 0.82rem; }
        .stc-fit { color: #1b6b34; font-size: 0.85rem; font-weight: 700; }
        .stc-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .stc-chips span { font-size: 0.74rem; font-weight: 700; background: #f5f5f5; border: 1px solid #e6e6e6; padding: 0.15rem 0.5rem; border-radius: 6px; }
        .stc-ready { color: #555; font-size: 0.8rem; }
        .stc-ctas { display: flex; gap: 0.5rem; margin-top: 0.3rem; }
        .stc-btn { flex: 1; text-align: center; text-decoration: none; padding: 0.7rem 0.9rem; border-radius: 50px; font-weight: 800; font-size: 0.88rem; }
        .stc-btn.red { background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; box-shadow: 0 8px 20px rgba(224,27,34,0.2); }
        .stc-btn.ghost { flex: 0 0 auto; background: #fff; color: #111; border: 1px solid #dcdcdc; padding-left: 1.2rem; padding-right: 1.2rem; }
        .stc-btn.ghost:hover { border-color: #E01B22; }
        .stc-specs { margin-top: 0.4rem; border-top: 1px solid #f0f0f0; padding-top: 0.5rem; }
        .stc-specs summary { cursor: pointer; color: #E01B22; font-weight: 700; font-size: 0.85rem; }
        .stc-specs dl { display: grid; grid-template-columns: auto 1fr; gap: 0.3rem 1rem; margin: 0.6rem 0 0; font-size: 0.82rem; }
        .stc-specs dt { color: #6b6b6b; }
        .stc-specs dd { margin: 0; font-weight: 700; text-align: right; }
        .stc-specs p { color: #555; font-size: 0.8rem; margin: 0.6rem 0 0; }
        .stc-specs ul { color: #555; font-size: 0.8rem; margin: 0.4rem 0 0; padding-left: 1.1rem; }
        @media (max-width: 560px) {
          .stc { grid-template-columns: 110px 1fr; }
          .stc-word-big { font-size: 1rem; }
        }
      `}</style>
    </li>
  );
}
