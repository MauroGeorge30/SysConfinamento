import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from '../styles/Viabilidade.module.css';

// ── Helpers ─────────────────────────────────────────────────────
const fmtR   = (v, d = 2) => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v, d = 2) => v == null || isNaN(v) ? '—' : `${fmtR(v, d)}%`;
const n      = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const diasEntre = (a, b) => {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000));
};
const fmtData = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

const FASES_PADRAO = [
  { nome: 'Adaptação',  dias: '14', racaoId: '', msPct: '', custoKgMN: '', cms: '' },
  { nome: 'Transição',  dias: '7',  racaoId: '', msPct: '', custoKgMN: '', cms: '' },
  { nome: 'Terminação', dias: '99', racaoId: '', msPct: '', custoKgMN: '', cms: '' },
];

// ── Sub-componentes fora do render para não perder foco ────────
function PRow({ lbl, val, set, ph = '', tp = 'number' }) {
  return (
    <div className={styles.pRow}>
      <label>{lbl}</label>
      <input type={tp} value={val} onChange={e => set(e.target.value)} placeholder={ph} />
    </div>
  );
}
function CRow({ lbl, val, dest, ok, err }) {
  return (
    <div className={`${styles.pRow} ${styles.pCalc} ${dest?styles.pDest:''} ${ok?styles.pOk:''} ${err?styles.pErr:''}`}>
      <label>{lbl}</label><span>{val}</span>
    </div>
  );
}

export default function Viabilidade() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();

  const [lotes,      setLotes]      = useState([]);
  const [racoes,     setRacoes]     = useState([]);
  const [simulacoes, setSimulacoes] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [aba,        setAba]        = useState('nova');
  const [salvando,   setSalvando]   = useState(false);
  const [simAberta,  setSimAberta]  = useState(null);
  const [nomeSim,    setNomeSim]    = useState('');
  const [msgSalvo,   setMsgSalvo]   = useState('');
  const [loteId,     setLoteId]     = useState('');

  // Parâmetros
  const [animais,       setAnimais]       = useState('1');
  const [pesoEntrada,   setPesoEntrada]   = useState('');
  const [precoCompraAt, setPrecoCompraAt] = useState('');
  const [kmFrete,       setKmFrete]       = useState('');
  const [precoKmFrete,  setPrecoKmFrete]  = useState('');
  const [qtdCarreta,    setQtdCarreta]    = useState('');
  const [comissao,      setComissao]      = useState('');
  const [operacional,   setOperacional]   = useState('');
  const [taxas,         setTaxas]         = useState('');
  const [gmd,           setGmd]           = useState('1.5');
  const [cmsPctPv,      setCmsPctPv]      = useState('2.3');
  const [rendCarcaca,   setRendCarcaca]   = useState('56');
  const [precoVendaAt,  setPrecoVendaAt]  = useState('');
  const [fases,         setFases]         = useState(FASES_PADRAO);

  // Load
  useEffect(() => {
    if (!currentFarm) return;
    (async () => {
      setLoading(true);
      const [{ data: ld }, { data: rd }, { data: sd }] = await Promise.all([
        supabase.from('lots').select(`id, lot_code, head_count, entry_date, entry_weight,
          lot_phases(id, phase_name, feed_type_id, start_date, end_date, cms_pct_pv,
            feed_types(id, name, cost_per_kg, dry_matter_pct))
        `).eq('farm_id', currentFarm.id).order('entry_date', { ascending: false }),
        supabase.from('feed_types').select('id, name, cost_per_kg, dry_matter_pct')
          .eq('farm_id', currentFarm.id).order('name'),
        supabase.from('viability_simulations').select('*')
          .eq('farm_id', currentFarm.id).order('created_at', { ascending: false }),
      ]);
      setLotes(ld || []);
      setRacoes(rd || []);
      setSimulacoes(sd || []);
      setLoading(false);
    })();
  }, [currentFarm]);

  // Ao selecionar lote
  useEffect(() => {
    if (!loteId) { setFases(FASES_PADRAO); return; }
    const lote = lotes.find(l => l.id === loteId);
    if (!lote) return;
    if (lote.entry_weight) setPesoEntrada(String(lote.entry_weight));
    if (lote.head_count)   setAnimais(String(lote.head_count));
    const fs = [...(lote.lot_phases || [])].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    setFases(fs.length > 0 ? fs.map(f => ({
      nome: f.phase_name || 'Fase',
      dias: String(diasEntre(f.start_date, f.end_date || new Date().toISOString().split('T')[0])),
      racaoId:   f.feed_type_id || '',
      msPct:     f.feed_types?.dry_matter_pct ? String(f.feed_types.dry_matter_pct) : '',
      custoKgMN: f.feed_types?.cost_per_kg    ? String(f.feed_types.cost_per_kg)    : '',
      cms:       f.cms_pct_pv                  ? String(f.cms_pct_pv)                : '',
    })) : FASES_PADRAO);
  }, [loteId, lotes]);

  const handleRacaoFase = (idx, racaoId) => {
    const r = racoes.find(x => x.id === racaoId);
    setFases(p => p.map((f, i) => i !== idx ? f : {
      ...f, racaoId,
      msPct:     r?.dry_matter_pct ? String(r.dry_matter_pct) : f.msPct,
      custoKgMN: r?.cost_per_kg    ? String(r.cost_per_kg)    : f.custoKgMN,
    }));
  };
  const setFF = (i, k, v) => setFases(p => p.map((f, j) => j !== i ? f : { ...f, [k]: v }));
  const addFase    = () => setFases(p => [...p, { nome: 'Fase', dias: '0', racaoId: '', msPct: '', custoKgMN: '', cms: '' }]);
  const removeFase = (i) => setFases(p => p.filter((_, j) => j !== i));

  // Cálculo
  const calc = (an, pe, pca, km, pkm, qc, co, op, tx, gv, cms, rc, pv, fs) => {
    const qtd   = n(an) || 1;
    const peKg  = n(pe);
    const frete = n(km) > 0 && n(pkm) > 0 ? (n(km) * n(pkm)) / (n(qc) || 1) : 0;
    const anBase = n(pca) * (peKg / 30);
    const compraTotal = anBase + frete + n(co);
    const gmdV = n(gv); const cmsP = n(cms) / 100; const rendV = n(rc) / 100;
    const totalDias = fs.reduce((s, f) => s + n(f.dias), 0);

    let pAcum = peKg;
    const fc = fs.map(f => {
      const dias = n(f.dias); const pI = pAcum; const pF = pI + gmdV * dias; const pM = (pI + pF) / 2;
      const cmsF = n(f.cms || cms) / 100 || cmsP;
      const ms = n(f.msPct) / 100;
      const cKg = pM * cmsF;
      const cmn = ms > 0 ? cKg / ms : 0;
      const cuMN = n(f.custoKgMN);
      const cuMS = ms > 0 ? cuMN / ms : 0;
      const dia = cmn * cuMN;
      pAcum = pF;
      return { ...f, dias, pI, pF, pM, ms, cKg, cmn, cuMN, cuMS, dia, cuFase: dia * dias };
    });

    const pesoS   = pAcum;
    const msPond  = totalDias > 0 ? fc.reduce((s, f) => s + f.dias * n(f.msPct), 0) / totalDias : 0;
    const cuPond  = totalDias > 0 ? fc.reduce((s, f) => s + f.dias * f.cuMN, 0) / totalDias : 0;
    const cKgMed  = totalDias > 0 ? fc.reduce((s, f) => s + f.dias * f.cKg, 0) / totalDias : 0;
    const cuAlim  = fc.reduce((s, f) => s + f.cuFase, 0);
    const diaMed  = totalDias > 0 ? cuAlim / totalDias : 0;
    const mnTot   = fc.reduce((s, f) => s + f.cmn * f.dias, 0);
    const carc    = pesoS * rendV;
    const atP     = carc / 15;
    const cuTot   = compraTotal + cuAlim + n(op) + n(tx);
    const cuAt    = atP > 0 ? cuTot / atP : 0;
    const rec     = atP * n(pv);
    const luc     = rec - cuTot;
    const lucLote = luc * qtd;
    const margPct = rec > 0 ? (luc / rec) * 100 : 0;
    const margAt  = atP > 0 ? luc / atP : 0;

    return { qtd, peKg, peAt: peKg/30, anBase, frete, compraTotal,
             atComF: peKg>0?compraTotal/(peKg/30):0, kgComF: peKg>0?compraTotal/peKg:0,
             totalDias, fc, pesoS, ganhoPeso: pesoS-peKg,
             msPond, cuPond, cKgMed, cuAlim, diaMed, mnTot,
             carc, atP, cuTot, cuAt, rec, luc, lucLote, margPct, margAt };
  };

  const r = calc(animais, pesoEntrada, precoCompraAt, kmFrete, precoKmFrete, qtdCarreta,
                 comissao, operacional, taxas, gmd, cmsPctPv, rendCarcaca, precoVendaAt, fases);
  const viavel = r.luc >= 0;

  const handleSalvar = async () => {
    if (!nomeSim.trim()) return alert('Informe um nome para a simulação.');
    setSalvando(true);
    const { error } = await supabase.from('viability_simulations').insert([{
      farm_id: currentFarm.id, lot_id: loteId || null, created_by: user.id,
      nome: nomeSim.trim(),
      animais: n(animais), peso_entrada_kg: n(pesoEntrada), preco_compra_at: n(precoCompraAt),
      km_frete: n(kmFrete), preco_km_frete: n(precoKmFrete), qtd_carreta: n(qtdCarreta),
      comissao: n(comissao), operacional: n(operacional), taxas: n(taxas),
      gmd: n(gmd), cms_pct_pv: n(cmsPctPv), rend_carcaca: n(rendCarcaca), preco_venda_at: n(precoVendaAt),
      fases,
      resultado: { totalDias: r.totalDias, pesoSaida: r.pesoS, atProd: r.atP,
                   custoTotalCb: r.cuTot, receitaCb: r.rec, lucroCb: r.luc,
                   lucroLote: r.lucLote, margemPct: r.margPct, margemAt: r.margAt, custoAtProd: r.cuAt },
    }]);
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return; }
    setMsgSalvo('✅ Simulação salva!'); setTimeout(() => setMsgSalvo(''), 3000);
    setNomeSim('');
    const { data } = await supabase.from('viability_simulations').select('*')
      .eq('farm_id', currentFarm.id).order('created_at', { ascending: false });
    setSimulacoes(data || []);
    setSalvando(false);
  };

  const carregarSim = (s) => {
    setLoteId(s.lot_id || ''); setAnimais(String(s.animais||'')); setPesoEntrada(String(s.peso_entrada_kg||''));
    setPrecoCompraAt(String(s.preco_compra_at||'')); setKmFrete(String(s.km_frete||''));
    setPrecoKmFrete(String(s.preco_km_frete||'')); setQtdCarreta(String(s.qtd_carreta||''));
    setComissao(String(s.comissao||'')); setOperacional(String(s.operacional||''));
    setTaxas(String(s.taxas||'')); setGmd(String(s.gmd||'')); setCmsPctPv(String(s.cms_pct_pv||''));
    setRendCarcaca(String(s.rend_carcaca||'')); setPrecoVendaAt(String(s.preco_venda_at||''));
    setFases(s.fases || FASES_PADRAO); setAba('nova');
  };

  const deletarSim = async (id) => {
    if (!confirm('Excluir esta simulação?')) return;
    await supabase.from('viability_simulations').delete().eq('id', id);
    setSimulacoes(p => p.filter(s => s.id !== id));
    if (simAberta === id) setSimAberta(null);
  };

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [authLoading, user, router]);
  if (authLoading || !user) return null;

  return (
    <Layout>
      <div className={styles.container}>

        {/* HEADER */}
        <div className={styles.header}>
          <div>
            <h1>📈 Viabilidade</h1>
            <p className={styles.sub}>Simulação econômica — resultados em tempo real</p>
          </div>
          <div className={styles.headerRight}>
            {n(precoVendaAt) > 0 && (
              <div className={`${styles.tag} ${viavel ? styles.tagOk : styles.tagErr}`}>
                <span>{viavel ? '✅ VIÁVEL' : '❌ INVIÁVEL'}</span>
                <strong>R$ {fmtR(r.lucLote)}</strong>
                <small>lucro do lote</small>
              </div>
            )}
            <div className={styles.abas}>
              <button className={aba==='nova'?styles.abaOn:styles.abaOff} onClick={() => setAba('nova')}>🧮 Nova</button>
              <button className={aba==='salvas'?styles.abaOn:styles.abaOff} onClick={() => setAba('salvas')}>
                📂 Salvas {simulacoes.length > 0 && <em className={styles.cnt}>{simulacoes.length}</em>}
              </button>
            </div>
          </div>
        </div>

        {/* ABA SALVAS */}
        {aba === 'salvas' && (
          <div>
            {simulacoes.length === 0 && <div className={styles.vazio}>Nenhuma simulação salva.</div>}
            {simulacoes.map(s => {
              const res = s.resultado || {};
              const ok  = Number(res.lucroCb || 0) >= 0;
              const ab  = simAberta === s.id;
              const lote = lotes.find(l => l.id === s.lot_id);
              return (
                <div key={s.id} className={styles.sCard}>
                  <div className={styles.sHead} onClick={() => setSimAberta(ab ? null : s.id)}>
                    <div className={styles.sLeft}>
                      <div className={styles.sNome}>{s.nome}</div>
                      <div className={styles.sMeta}>
                        {lote && <span>🐄 {lote.lot_code}</span>}
                        <span>📅 {fmtData(s.created_at)}</span>
                        <span>{res.totalDias}d</span>
                        <span>{s.animais} cab</span>
                        <span>GMD {s.gmd}</span>
                        <span>{s.peso_entrada_kg}kg entrada</span>
                      </div>
                    </div>
                    <div className={styles.sRight}>
                      <div className={styles.sInds}>
                        <div className={styles.sI}><span>Custo/cb</span><strong>R$ {fmtR(res.custoTotalCb)}</strong></div>
                        <div className={styles.sI}><span>Receita/cb</span><strong>R$ {fmtR(res.receitaCb)}</strong></div>
                        <div className={`${styles.sI} ${ok?styles.sIOk:styles.sIErr}`}><span>Lucro/cb</span><strong>R$ {fmtR(res.lucroCb)}</strong></div>
                        <div className={`${styles.sI} ${ok?styles.sIOk:styles.sIErr}`}><span>Lucro lote</span><strong>R$ {fmtR(res.lucroLote)}</strong></div>
                      </div>
                      <div className={styles.sAcoes}>
                        <button className={styles.btnLoad} onClick={e=>{e.stopPropagation();carregarSim(s)}}>📥 Carregar</button>
                        <button className={styles.btnDel}  onClick={e=>{e.stopPropagation();deletarSim(s.id)}}>Excluir</button>
                        <span>{ab?'▲':'▼'}</span>
                      </div>
                    </div>
                  </div>
                  {ab && (
                    <div className={styles.sDet}>
                      <div className={styles.sDetGrid}>
                        <div>
                          <div className={styles.sDetTit}>Compra</div>
                          {[['Peso entrada',`${s.peso_entrada_kg} kg`],['Preço @',`R$ ${fmtR(s.preco_compra_at)}`],
                            ['Frete',`${s.km_frete}km × R$${s.preco_km_frete} ÷ ${s.qtd_carreta}`],
                            ['Comissão',`R$ ${fmtR(s.comissao)}`]].map(([l,v])=>(
                            <div key={l} className={styles.sDL}><span>{l}</span><strong>{v}</strong></div>))}
                        </div>
                        <div>
                          <div className={styles.sDetTit}>Produção</div>
                          {[['GMD',`${s.gmd} kg/d`],['Período',`${res.totalDias} dias`],
                            ['Peso saída',`${fmtR(res.pesoSaida,1)} kg`],['@ produzida',`${fmtR(res.atProd,2)} @`],
                            ['Rendimento',`${s.rend_carcaca}%`],['Custo @',`R$ ${fmtR(res.custoAtProd)}`]].map(([l,v])=>(
                            <div key={l} className={styles.sDL}><span>{l}</span><strong>{v}</strong></div>))}
                        </div>
                        <div>
                          <div className={styles.sDetTit}>Resultado</div>
                          {[['Preço venda',`R$ ${fmtR(s.preco_venda_at)} /@`],['Custo/cb',`R$ ${fmtR(res.custoTotalCb)}`],
                            ['Receita/cb',`R$ ${fmtR(res.receitaCb)}`]].map(([l,v])=>(
                            <div key={l} className={styles.sDL}><span>{l}</span><strong>{v}</strong></div>))}
                          <div className={`${styles.sDL} ${ok?styles.sDLOk:styles.sDLErr}`}><span>Lucro/cb</span><strong>R$ {fmtR(res.lucroCb)}</strong></div>
                          <div className={`${styles.sDL} ${ok?styles.sDLOk:styles.sDLErr}`}><span>Lucro lote</span><strong>R$ {fmtR(res.lucroLote)}</strong></div>
                          <div className={styles.sDL}><span>Margem</span><strong>{fmtPct(res.margemPct)}</strong></div>
                        </div>
                        <div>
                          <div className={styles.sDetTit}>Fases</div>
                          {(s.fases||[]).map((f,i)=>(
                            <div key={i} className={styles.sDL}><span>{f.nome} ({f.dias}d)</span><strong>MS {f.msPct}% · R$ {fmtR(n(f.custoKgMN),4)}/kg</strong></div>))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ABA NOVA SIMULAÇÃO */}
        {aba === 'nova' && (
          <>
            {/* Lote + Salvar */}
            <div className={styles.card}>
              <div className={styles.row2}>
                <div>
                  <label className={styles.lbl}>Lote (opcional)</label>
                  <select className={styles.sel} value={loteId} onChange={e => setLoteId(e.target.value)}>
                    <option value="">— Simulação manual —</option>
                    {lotes.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.lot_code} · {l.head_count}cab · {l.entry_weight||'?'}kg · {''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.lbl}>Nome da simulação</label>
                  <div className={styles.rowI}>
                    <input className={styles.inp} value={nomeSim} onChange={e=>setNomeSim(e.target.value)} placeholder="ex: Engorda Jun/26 — 320kg entrada"/>
                    <button className={styles.btnSv} onClick={handleSalvar} disabled={salvando}>
                      {salvando ? '...' : '💾 Salvar'}
                    </button>
                  </div>
                  {msgSalvo && <div className={styles.msg}>{msgSalvo}</div>}
                </div>
              </div>
            </div>

            {/* Fases */}
            <div className={styles.card}>
              <div className={styles.cardHR}>
                <span className={styles.cardT}>📋 Fases <em className={styles.cardSub}>{r.totalDias} dias</em></span>
                <button className={styles.btnAF} onClick={addFase}>+ Fase</button>
              </div>
              <div className={styles.tWrap}>
                <table className={styles.tab}>
                  <thead><tr>
                    <th>Fase</th><th>Dias</th><th>Ração</th>
                    <th>P.Ini</th><th>P.Fin</th><th>P.Méd</th>
                    <th>MS%</th><th>CMS%PV</th><th>CMS kg</th>
                    <th>R$/kgMS</th><th>R$/kgMN</th><th>Diária</th><th>Custo Fase</th><th/>
                  </tr></thead>
                  <tbody>
                    {fases.length === 0 && <tr><td colSpan={14} className={styles.tVazio}>Selecione um lote ou clique em "+ Fase"</td></tr>}
                    {r.fc.map((f, i) => (
                      <tr key={i} className={i%2===0?styles.trA:styles.trB}>
                        <td><input className={styles.iNm} value={fases[i]?.nome||''} onChange={e=>setFF(i,'nome',e.target.value)}/></td>
                        <td><input className={styles.iN} type="number" min="0" value={fases[i]?.dias||''} onChange={e=>setFF(i,'dias',e.target.value)}/></td>
                        <td><select className={styles.iS} value={fases[i]?.racaoId||''} onChange={e=>handleRacaoFase(i,e.target.value)}>
                          <option value="">—</option>{racoes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                        <td className={styles.tc}>{fmtR(f.pI,1)}</td>
                        <td className={styles.tc}>{fmtR(f.pF,1)}</td>
                        <td className={styles.tc}>{fmtR(f.pM,1)}</td>
                        <td><input className={styles.iN} type="number" step="0.01" value={fases[i]?.msPct||''} onChange={e=>setFF(i,'msPct',e.target.value)} placeholder="66"/></td>
                        <td><input className={styles.iN} type="number" step="0.1"  value={fases[i]?.cms||cmsPctPv} onChange={e=>setFF(i,'cms',e.target.value)}/></td>
                        <td className={styles.tc}>{fmtR(f.cKg,3)}</td>
                        <td className={styles.tc}>{f.ms>0?fmtR(f.cuMS,4):'—'}</td>
                        <td><input className={styles.iN} type="number" step="0.0001" value={fases[i]?.custoKgMN||''} onChange={e=>setFF(i,'custoKgMN',e.target.value)} placeholder="0.00"/></td>
                        <td className={styles.tc}>{fmtR(f.dia,2)}</td>
                        <td className={`${styles.tc} ${styles.tcG}`}>R$ {fmtR(f.cuFase,2)}</td>
                        <td>{fases.length>1&&<button className={styles.btnRm} onClick={()=>removeFase(i)}>×</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                  {fases.length > 0 && (
                    <tfoot><tr className={styles.trTot}>
                      <td><strong>TOTAL</strong></td><td><strong>{r.totalDias}d</strong></td>
                      <td colSpan={4}/><td><strong>{fmtPct(r.msPond,1)}</strong></td>
                      <td><strong>{cmsPctPv}%</strong></td><td><strong>{fmtR(r.cKgMed,3)}</strong></td>
                      <td/><td><strong>R$ {fmtR(r.cuPond,4)}</strong></td>
                      <td><strong>R$ {fmtR(r.diaMed,2)}</strong></td>
                      <td><strong>R$ {fmtR(r.cuAlim,2)}</strong></td><td/>
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* 3 colunas */}
            <div className={styles.cols3}>

              <div className={styles.card}>
                <div className={styles.cardT}>🐂 Compra</div>
                <div className={styles.pG}>
                  <PRow lbl="Animais (cab.)"       val={animais}       set={setAnimais}/>
                  <PRow lbl="Peso Entrada (kg)"     val={pesoEntrada}   set={setPesoEntrada}/>
                  <PRow lbl="Preço Compra (R$/@)"   val={precoCompraAt} set={setPrecoCompraAt} ph="349.61"/>
                  <PRow lbl="KM do Frete"           val={kmFrete}       set={setKmFrete} ph="600"/>
                  <PRow lbl="R$ por KM"             val={precoKmFrete}  set={setPrecoKmFrete} ph="7.00"/>
                  <PRow lbl="Animais na Carreta"    val={qtdCarreta}    set={setQtdCarreta} ph="100"/>
                  <PRow lbl="Comissão (R$/cb)"      val={comissao}      set={setComissao} ph="0"/>
                  <div className={styles.pDiv}/>
                  <CRow lbl="Frete / cab"           val={`R$ ${fmtR(r.frete)}`}/>
                  <CRow lbl="Peso entrada (@)"      val={`${fmtR(r.peAt,2)} @`}/>
                  <CRow lbl="Preço animal base"     val={`R$ ${fmtR(r.anBase)}`}/>
                  <CRow lbl="@ c/ frete+comissão"   val={`R$ ${fmtR(r.atComF)}`}/>
                  <CRow lbl="kg c/ frete+comissão"  val={`R$ ${fmtR(r.kgComF,4)}`}/>
                  <CRow lbl="Preço compra total/cb" val={`R$ ${fmtR(r.compraTotal)}`} dest/>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardT}>⚙️ Produção</div>
                <div className={styles.pG}>
                  <PRow lbl="GMD (kg/dia)"         val={gmd}         set={setGmd} ph="1.5"/>
                  <PRow lbl="CMS % PV (padrão)"    val={cmsPctPv}    set={setCmsPctPv} ph="2.3"/>
                  <PRow lbl="Rendimento Carcaça %"  val={rendCarcaca} set={setRendCarcaca} ph="56"/>
                  <PRow lbl="Custo Operacional R$"  val={operacional} set={setOperacional} ph="0"/>
                  <PRow lbl="Taxas R$"              val={taxas}       set={setTaxas} ph="0"/>
                  <div className={styles.pDiv}/>
                  <CRow lbl="Período total"         val={`${r.totalDias} dias`}/>
                  <CRow lbl="MS dieta ponderada"    val={fmtPct(r.msPond,1)}/>
                  <CRow lbl="R$/kg MN ponderado"    val={`R$ ${fmtR(r.cuPond,4)}`}/>
                  <CRow lbl="Consumo MN total"      val={`${fmtR(r.mnTot,2)} kg`}/>
                  <CRow lbl="Custo diária média"    val={`R$ ${fmtR(r.diaMed,2)}`}/>
                  <CRow lbl="Peso de saída"         val={`${fmtR(r.pesoS,1)} kg`}/>
                  <CRow lbl="Ganho de peso"         val={`+${fmtR(r.ganhoPeso,1)} kg`}/>
                  <CRow lbl="Custo alimentar total" val={`R$ ${fmtR(r.cuAlim)}`} dest/>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardT}>💰 Venda & Resultado</div>
                <div className={styles.pG}>
                  <PRow lbl="Preço de Venda (R$/@)" val={precoVendaAt} set={setPrecoVendaAt} ph="327"/>
                  <CRow lbl="Peso carcaça"           val={`${fmtR(r.carc,1)} kg`}/>
                  <CRow lbl="@ produzida"            val={`${fmtR(r.atP,2)} @`}/>
                  <CRow lbl="Custo @ produzida"      val={`R$ ${fmtR(r.cuAt)}`}/>
                  <div className={styles.pDiv}/>
                  <CRow lbl="Preço animal c/frete"   val={`R$ ${fmtR(r.compraTotal)}`}/>
                  <CRow lbl="Custo alimentar"        val={`R$ ${fmtR(r.cuAlim)}`}/>
                  <CRow lbl="Operacional + Taxas"    val={`R$ ${fmtR(n(operacional)+n(taxas))}`}/>
                  <CRow lbl="Custo total / cb"       val={`R$ ${fmtR(r.cuTot)}`} dest/>
                  <CRow lbl="Receita total / cb"     val={`R$ ${fmtR(r.rec)}`} ok={r.rec>0&&r.luc>0}/>
                  <CRow lbl={`Lucro líquido / cb`}   val={`R$ ${fmtR(r.luc)}`} ok={viavel} err={!viavel&&n(precoVendaAt)>0}/>
                  <CRow lbl={`Lucro lote (${animais} cab)`} val={`R$ ${fmtR(r.lucLote)}`} ok={viavel} err={!viavel&&n(precoVendaAt)>0}/>
                  <CRow lbl="Margem %"               val={fmtPct(r.margPct)}/>
                  <CRow lbl="Margem / @"             val={`R$ ${fmtR(r.margAt)}`}/>
                </div>
              </div>

            </div>
          </>
        )}

      </div>
    </Layout>
  );
}
