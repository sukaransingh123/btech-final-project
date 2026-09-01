import React, { useState } from 'react';
import apiService from '../utils/api';

const shorten = (address) => address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '—';
const dateTime = (seconds) => seconds ? new Date(Number(seconds) * 1000).toLocaleString() : '—';

/** Public, no-wallet-required viewer for the Phase 1/2 lifecycle contract. */
export default function SupplyChainTracker() {
  const [batchId, setBatchId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async (event) => {
    event?.preventDefault();
    const value = batchId.trim().replace(/^.*?(\d+)$/, '$1'); // accepts a plain batch ID or a simple QR payload ending in it
    if (!/^\d+$/.test(value)) { setError('Enter a numeric Phase 1 batch ID.'); return; }
    setLoading(true); setError(''); setResult(null);
    try { setResult(await apiService.getSupplyChainProvenance(value)); }
    catch (requestError) { setError(requestError.message || 'Batch could not be verified.'); }
    finally { setLoading(false); }
  };

  const styles = {
    page: { maxWidth: 850, margin: '36px auto', padding: 24, color: '#172033' },
    hero: { background: 'linear-gradient(135deg,#0f766e,#1d4ed8)', color: 'white', padding: 32, borderRadius: 18, boxShadow: '0 14px 32px #1e3a8a33' },
    form: { display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' },
    input: { padding: '13px 15px', borderRadius: 9, border: 'none', flex: '1 1 260px', fontSize: 16 },
    button: { padding: '13px 20px', border: 'none', borderRadius: 9, background: '#fbbf24', color: '#172033', fontWeight: 700, cursor: 'pointer' },
    card: { background: '#fff', borderRadius: 15, padding: 24, marginTop: 22, boxShadow: '0 5px 20px #17203314' },
    timeline: { borderLeft: '3px solid #14b8a6', margin: '18px 0 0 12px', paddingLeft: 23 },
    event: { position: 'relative', paddingBottom: 23 },
    dot: { position: 'absolute', width: 13, height: 13, borderRadius: '50%', background: '#14b8a6', left: -31, top: 4, border: '3px solid #ccfbf1' },
  };

  return <main style={styles.page}>
    <section style={styles.hero}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2 }}>PUBLIC VERIFICATION PORTAL</div>
      <h1 style={{ margin: '8px 0', fontSize: 30 }}>Medicine Batch Tracker</h1>
      <p style={{ margin: 0, opacity: .9 }}>Trace custody from raw materials to the patient using the blockchain record.</p>
      <form onSubmit={search} style={styles.form}>
        <input aria-label="Batch ID" style={styles.input} value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="Enter a Phase 1 batch ID, e.g. 0" />
        <button type="submit" style={styles.button} disabled={loading}>{loading ? 'Checking…' : 'Verify batch'}</button>
      </form>
    </section>

    {error && <div role="alert" style={{ ...styles.card, color: '#b91c1c', border: '1px solid #fecaca' }}>{error}</div>}
    {result && <section style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div><div style={{ color: '#64748b', fontSize: 13 }}>BATCH #{result.batch.batchId}</div><h2 style={{ margin: '5px 0' }}>{result.batch.drugName}</h2></div>
        <div style={{ alignSelf: 'center', background: result.batch.isAuthentic ? '#dcfce7' : '#fee2e2', color: result.batch.isAuthentic ? '#166534' : '#b91c1c', padding: '9px 12px', borderRadius: 99, fontWeight: 700 }}>
          {result.batch.isAuthentic ? '✓ Verified & Tamper-Proof' : '⚠ Counterfeit Flagged'}
        </div>
      </div>
      <p style={{ color: '#475569' }}>Current stage: <strong>{result.batch.stageName}</strong> · Current holder: <code>{shorten(result.batch.currentOwner)}</code></p>
      <h3>Provenance timeline</h3>
      <div style={styles.timeline}>{result.timeline.map((entry) => <div key={entry.sequence} style={styles.event}>
        <i style={styles.dot} /><strong>{entry.stageName}</strong><div style={{ color: '#475569', fontSize: 14 }}>{entry.fromRoleName} → {entry.toRoleName}</div>
        <div style={{ color: '#64748b', fontSize: 13 }}>{dateTime(entry.timestamp)} · {shorten(entry.from)} → {shorten(entry.to)}</div>
        <div style={{ color: '#64748b', fontSize: 12, wordBreak: 'break-all' }}>On-chain integrity hash: {entry.digitalSignature}</div>
      </div>)}</div>
    </section>}
  </main>;
}
