import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from '../styles/Viabilidade.module.css';

// ── Helpers ────────────────────────────────────────────────────
const fmtR = (v, dec = 2) =>
  v == null || isNaN(v) ? '—' :
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtPct = (v, dec = 2) => v == null || isNaN(v) ? '—' : `${fmtR(v, dec)}%`;
const n = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;

// Calcula dias entre duas datas
const diasEntre = (inicio, fim) => {
  if (!inicio || !fim) return 0;
  const d1 = new Date(inicio + 'T00:00:00');
  const d2 = new Date(fim   + 'T00:00:00');
  return Math.max(0, Math.round((d2 - d1) / 86400000));
};

export default function Viabilidade() {
  const router  = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();

  // ── Dados do sistema ─────────────────────────────────────────
  const [lotes,  setLotes]  = useState([]);
  const [racoes, setRacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Seleção de lote ──────────────────────────────────────────
  const [loteId, setLoteId] = useState('');

  // ── Parâmetros de compra (livres) ────────────────────────────
  const [animais,         setAnimais]         = useState('1');
  const [pesoEntrada,     setPesoEntrada]     = useState('320');
  const [precoCompraAt,   setPrecoCompraAt]   = useState('');   // R$/@
  const [kmFrete,         setKmFrete]         = useState('');
  const [precoKmFrete,    setPrecoKmFrete]    = useState('');
  const [qtdCarreta,      setQtdCarreta]      = useState('');
  const [comissao,        setComissao]        = useState('');
  const [operacional,     setOperacional]     = useState('');
  const [taxas,           setTaxas]           = useState('');

  // ── Parâmetros de saída (livres) ─────────────────────────────
  const [gmd,             setGmd]             = useState('1.5');
  const [cmsPctPv,        setCmsPctPv]        = useState('2.3');
  const [rendCarcaca,     setRendCarcaca]     = useState('56');
  const [precoVendaAt,    setPrecoVendaAt]    = useState('');   // R$/@

  // ── Fases editáveis ──────────────────────────────────────────
  const [fases, setFases] = useState([]); // [{ nome, dias, racaoId, msPct, custoPorKgMN }]

  // ── Load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentFarm) return;
    const load = async () => {
      setLoading(true);
      const [{ data: lotesData }, { data: racoesData }] = await Promise.all([
        supabase.from('lots').select(`
          id, lot_code, head_count, entry_date, entry_weight,
          lot_phases(id, phase_name, feed_type_id, start_date, end_date, cms_pct_pv,
            feed_types(id, name, cost_per_kg, dry_matter_pct))
        `).eq('farm_id', currentFarm.id).is('exit_date', null).order('lot_code'),
        supabase.from('feed_types').select('id, name, cost_per_kg, dry_matter_pct')
          .eq('farm_id', currentFarm.id).order('name'),
      ]);
      setLotes(lotesData || []);
      setRacoes(racoesData || []);
      setLoading(false);
    };
    load();
  }, [currentFarm]);

  // ── Ao selecionar lote, preenche campos ──────────────────────
  useEffect(() => {
    if (!loteId) { setFases([]); return; }
    const lote = lotes.find(l => l.id === loteId);
    if (!lote) return;

    // Preenche peso de entrada e animais do lote
    if (lote.entry_weight) setPesoEntrada(String(lote.entry_weight));
    if (lote.head_count)   setAnimais(String(lote.head_count));

    // Monta fases a partir de lot_phases
    const fasesSorted = [...(lote.lot_phases || [])]
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    const fasesBuilt = fasesSorted.map(f => {
      const dias = diasEntre(f.start_date, f.end_date || new Date().toISOString().split('T')[0]);
      const racao = f.feed_types;
      const msPct = racao?.dry_matter_pct ? parseFloat(racao.dry_matter_pct) : null;
      const custoKgMN = racao?.cost_per_kg ? parseFloat(racao.cost_per_kg) : null;
      return {
        nome:      f.phase_name || 'Fase',
        dias:      String(dias),
        racaoId:   f.feed_type_id || '',
        msPct:     msPct != null ? String(msPct) : '',
        custoKgMN: custoKgMN != null ? String(custoKgMN) : '',
        cms:       f.cms_pct_pv ? String(f.cms_pct_pv) : '',
      };
    });

    // Se não há fases, cria 3 padrão
    if (fasesBuilt.length === 0) {
      setFases([
        { nome: 'Adaptação',  dias: '14', racaoId: '', msPct: '', custoKgMN: '', cms: '' },
        { nome: 'Transição',  dias: '7',  racaoId: '', msPct: '', custoKgMN: '', cms: '' },
        { nome: 'Terminação', dias: '99', racaoId: '', msPct: '', custoKgMN: '', cms: '' },
      ]);
    } else {
      setFases(fasesBuilt);
    }
  }, [loteId, lotes]);

  // ── Ao mudar ração de uma fase, atualiza MS% e custo ─────────
  const handleRacaoFase = (idx, racaoId) => {
    const racao = racoes.find(r => r.id === racaoId);
    setFases(prev => prev.map((f, i) => i !== idx ? f : {
      ...f,
      racaoId,
      msPct:     racao?.dry_matter_pct ? String(racao.dry_matter_pct) : f.msPct,
      custoKgMN: racao?.cost_per_kg    ? String(racao.cost_per_kg)    : f.custoKgMN,
    }));
  };

  const setFaseField = (idx, field, value) => {
    setFases(prev => prev.map((f, i) => i !== idx ? f : { ...f, [field]: value }));
  };

  const addFase = () => setFases(prev => [...prev, { nome: 'Nova Fase', dias: '0', racaoId: '', msPct: '', custoKgMN: '', cms: '' }]);
  const removeFase = (idx) => setFases(prev => prev.filter((_, i) => i !== idx));

  // ── CÁLCULOS ─────────────────────────────────────────────────
  const calc = useCallback(() => {
    const qtdAnimais   = n(animais) || 1;
    const pesoEntKg    = n(pesoEntrada);
    const precoAt      = n(precoCompraAt);
    const km           = n(kmFrete);
    const precoKm      = n(precoKmFrete);
    const qtdCarretaV  = n(qtdCarreta) || 1;
    const comissaoV    = n(comissao);
    const operacionalV = n(operacional);
    const taxasV       = n(taxas);
    const gmdV         = n(gmd);
    const cmsPctPvV    = n(cmsPctPv) / 100;
    const rendV        = n(rendCarcaca) / 100;
    const precoVendaV  = n(precoVendaAt);

    // Peso entrada em @
    const pesoEntAt = pesoEntKg / 30;

    // Preço animal base
    const precoAnimalBase = precoAt * pesoEntAt;

    // Frete por cab
    const freteCab = km > 0 && precoKm > 0 ? (km * precoKm) / qtdCarretaV : 0;

    // Preço compra total/cb
    const precoCompraTotalCb = precoAnimalBase + freteCab + comissaoV;

    // Preço @ com frete e comissão
    const precoAtComFrete = pesoEntAt > 0 ? precoCompraTotalCb / pesoEntAt : 0;
    const precoKgComFrete = pesoEntKg > 0 ? precoCompraTotalCb / pesoEntKg : 0;

    // ── Cálculo por fases ────────────────────────────────────────
    const totalDias = fases.reduce((s, f) => s + n(f.dias), 0);

    // Peso inicial de cada fase (acumulando GMD)
    let pesoAcum = pesoEntKg;
    const fasesCalc = fases.map(f => {
      const dias   = n(f.dias);
      const pIni   = pesoAcum;
      const pFin   = pIni + (gmdV * dias);
      const pMedio = (pIni + pFin) / 2;
      const msPct  = n(f.msPct) / 100;
      const cms    = n(f.cms || cmsPctPv) / 100;
      const cmsKg  = pMedio * (cms > 0 ? cms : cmsPctPvV); // consumo MS kg/dia
      const custoMN = n(f.custoKgMN);
      const custoMS = msPct > 0 ? custoMN / msPct : 0;     // R$/kg MS
      const cmn    = msPct > 0 ? cmsKg / msPct : 0;        // consumo MN kg/dia
      const diaria = cmn * custoMN;
      const custoFase = diaria * dias;
      pesoAcum = pFin;
      return { ...f, dias, pIni, pFin, pMedio, msPct, cmsKg, custoMS, cmn, diaria, custoFase, custoMN };
    });

    const pesoSaida = pesoAcum;

    // MS ponderada = SOMARPRODUTO(dias, ms_fase) / total_dias
    const msDietaPonderada = totalDias > 0
      ? fasesCalc.reduce((s, f) => s + f.dias * (n(f.msPct)), 0) / totalDias
      : 0;

    // Custo R$/kg MN ponderado
    const custoKgMNPonderado = totalDias > 0
      ? fasesCalc.reduce((s, f) => s + f.dias * f.custoMN, 0) / totalDias
      : 0;

    // CMS médio ponderado
    const cmsKgMedio = totalDias > 0
      ? fasesCalc.reduce((s, f) => s + f.dias * f.cmsKg, 0) / totalDias
      : 0;

    // Consumo MN kg total
    const consumoMNTotal = fasesCalc.reduce((s, f) => s + f.cmn * f.dias, 0);

    // Custo alimentar total
    const custoAlimentarTotal = fasesCalc.reduce((s, f) => s + f.custoFase, 0);

    // Diária média
    const diariasMedia = totalDias > 0 ? custoAlimentarTotal / totalDias : 0;

    // Peso entrada @ (30kg)
    const pesoEntAt30 = pesoEntKg / 30;

    // Saída
    const pesoCarcaca = pesoSaida * rendV;
    const atProduzida = pesoCarcaca / 15;   // @ carcaça = kg/15

    // Custo total por cabeça
    const custoTotalCb = precoCompraTotalCb + custoAlimentarTotal + operacionalV + taxasV;

    // Custo @ produzida
    const custoAtProduzida = atProduzida > 0 ? custoTotalCb / atProduzida : 0;

    // Receita
    const receitaTotalCb = atProduzida * precoVendaV;

    // Lucro
    const lucroLiquidoCb = receitaTotalCb - custoTotalCb;
    const lucroLote      = lucroLiquidoCb * qtdAnimais;

    // Peso saída em @
    const pesoSaidaAt = pesoSaida / 30;

    // Ganho peso total
    const ganhoPesoTotal = pesoSaida - pesoEntKg;

    return {
      qtdAnimais, pesoEntKg, pesoEntAt: pesoEntAt30,
      precoAnimalBase, freteCab, precoCompraTotalCb, precoAtComFrete, precoKgComFrete,
      totalDias, fasesCalc, pesoSaida, pesoSaidaAt, ganhoPesoTotal,
      msDietaPonderada, custoKgMNPonderado, cmsKgMedio,
      consumoMNTotal, custoAlimentarTotal, diariasMedia,
      pesoCarcaca, atProduzida,
      custoTotalCb, custoAtProduzida,
      receitaTotalCb, lucroLiquidoCb, lucroLote,
    };
  }, [animais, pesoEntrada, precoCompraAt, kmFrete, precoKmFrete, qtdCarreta,
      comissao, operacional, taxas, gmd, cmsPctPv, rendCarcaca, precoVendaAt, fases]);

  const r = calc();

  // ── Auth guard ───────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [authLoading, user, router]);
  if (authLoading || !user) return null;

  const lucroPorCb     = r.lucroLiquidoCb;
  const lucroPositivo  = lucroPorCb >= 0;

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <Layout>
      <div className={styles.container}>

        {/* ── HEADER ──────────────────────────────────────────── */}
        <div className={styles.header}>
          <div>
            <h1>📈 Viabilidade do Confinamento</h1>
            <p className={styles.subtitle}>Simulação econômica por animal — ajuste os parâmetros e veja o resultado em tempo real</p>
          </div>
          {r.lucroLote !== 0 && (
            <div className={`${styles.resultadoHeader} ${lucroPositivo ? styles.resultadoPositivo : styles.resultadoNegativo}`}>
              <span>{lucroPositivo ? '✅ VIÁVEL' : '❌ INVIÁVEL'}</span>
              <strong>R$ {fmtR(r.lucroLote)}</strong>
              <small>lucro do lote</small>
            </div>
          )}
        </div>

        {/* ── SELEÇÃO DE LOTE ──────────────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>🐄 Selecionar Lote (opcional)</div>
          <div className={styles.row3}>
            <div>
              <label>Lote ativo</label>
              <select value={loteId} onChange={e => setLoteId(e.target.value)}>
                <option value="">— Simulação manual —</option>
                {lotes.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.lot_code} — {l.head_count} cab — {l.entry_weight ? l.entry_weight + 'kg' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.infoBox}>
              <span>💡 Ao selecionar um lote, as fases, pesos e rações são preenchidos automaticamente. Todos os campos permanecem editáveis.</span>
            </div>
          </div>
        </div>

        {/* ── PAINEL DE FASES ──────────────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.cardHeader}>📋 Fases do Confinamento</div>
            <button className={styles.btnAddFase} onClick={addFase}>+ Fase</button>
          </div>

          <div className={styles.tabelaWrap}>
            <table className={styles.tabelaFases}>
              <thead>
                <tr>
                  <th>Fase</th>
                  <th>Dias</th>
                  <th>Ração</th>
                  <th>P. Inicial (kg)</th>
                  <th>P. Final (kg)</th>
                  <th>P. Médio (kg)</th>
                  <th>MS Dieta %</th>
                  <th>CMS % PV</th>
                  <th>CMS kg/dia</th>
                  <th>R$/kg MS</th>
                  <th>R$/kg MN</th>
                  <th>Diária R$</th>
                  <th>Custo Fase R$</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {fases.length === 0 && (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>
                      Nenhuma fase configurada — selecione um lote ou clique em "+ Fase"
                    </td>
                  </tr>
                )}
                {r.fasesCalc.map((f, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? styles.linhaA : styles.linhaB}>
                    <td>
                      <input
                        className={styles.inputFaseNome}
                        value={fases[idx]?.nome || ''}
                        onChange={e => setFaseField(idx, 'nome', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.inputFaseNum}
                        type="number" min="0"
                        value={fases[idx]?.dias || ''}
                        onChange={e => setFaseField(idx, 'dias', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className={styles.selectFase}
                        value={fases[idx]?.racaoId || ''}
                        onChange={e => handleRacaoFase(idx, e.target.value)}
                      >
                        <option value="">— Selecione —</option>
                        {racoes.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className={styles.tdCalc}>{fmtR(f.pIni, 1)}</td>
                    <td className={styles.tdCalc}>{fmtR(f.pFin, 1)}</td>
                    <td className={styles.tdCalc}>{fmtR(f.pMedio, 1)}</td>
                    <td>
                      <input
                        className={styles.inputFaseNum}
                        type="number" min="0" max="100" step="0.01"
                        value={fases[idx]?.msPct || ''}
                        onChange={e => setFaseField(idx, 'msPct', e.target.value)}
                        placeholder="ex: 66"
                      />
                    </td>
                    <td>
                      <input
                        className={styles.inputFaseNum}
                        type="number" min="0" max="100" step="0.1"
                        value={fases[idx]?.cms || cmsPctPv}
                        onChange={e => setFaseField(idx, 'cms', e.target.value)}
                        placeholder={cmsPctPv}
                      />
                    </td>
                    <td className={styles.tdCalc}>{fmtR(f.cmsKg, 3)}</td>
                    <td className={styles.tdCalc}>{f.msPct > 0 ? fmtR(f.custoMS, 4) : '—'}</td>
                    <td>
                      <input
                        className={styles.inputFaseNum}
                        type="number" min="0" step="0.0001"
                        value={fases[idx]?.custoKgMN || ''}
                        onChange={e => setFaseField(idx, 'custoKgMN', e.target.value)}
                        placeholder="R$/kg MN"
                      />
                    </td>
                    <td className={styles.tdCalc}>{fmtR(f.diaria, 2)}</td>
                    <td className={`${styles.tdCalc} ${styles.tdDestaque}`}>R$ {fmtR(f.custoFase, 2)}</td>
                    <td>
                      {fases.length > 1 && (
                        <button className={styles.btnRemoveFase} onClick={() => removeFase(idx)}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {fases.length > 0 && (
                <tfoot>
                  <tr className={styles.linhaTotal}>
                    <td><strong>TOTAL</strong></td>
                    <td><strong>{r.totalDias} dias</strong></td>
                    <td colSpan={4}></td>
                    <td><strong>{fmtPct(r.msDietaPonderada, 2)}</strong></td>
                    <td><strong>{fmtPct(n(cmsPctPv), 1)}</strong></td>
                    <td><strong>{fmtR(r.cmsKgMedio, 3)}</strong></td>
                    <td></td>
                    <td><strong>R$ {fmtR(r.custoKgMNPonderado, 4)}</strong></td>
                    <td><strong>R$ {fmtR(r.diariasMedia, 2)}</strong></td>
                    <td><strong>R$ {fmtR(r.custoAlimentarTotal, 2)}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── PARÂMETROS ───────────────────────────────────────── */}
        <div className={styles.gridParams}>

          {/* Compra */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>🐂 Parâmetros de Compra</div>
            <div className={styles.paramGrid}>
              <div className={styles.paramRow}>
                <label>Animais (cab.)</label>
                <input type="number" min="1" value={animais} onChange={e => setAnimais(e.target.value)} />
              </div>
              <div className={styles.paramRow}>
                <label>Peso de Entrada (kg)</label>
                <input type="number" min="0" step="0.1" value={pesoEntrada} onChange={e => setPesoEntrada(e.target.value)} />
              </div>
              <div className={styles.paramRow}>
                <label>Preço de Compra (R$/@)</label>
                <input type="number" min="0" step="0.01" value={precoCompraAt} onChange={e => setPrecoCompraAt(e.target.value)} placeholder="ex: 349.61" />
              </div>
              <div className={styles.paramRow}>
                <label>KM do Frete</label>
                <input type="number" min="0" value={kmFrete} onChange={e => setKmFrete(e.target.value)} placeholder="ex: 600" />
              </div>
              <div className={styles.paramRow}>
                <label>Preço por KM (R$)</label>
                <input type="number" min="0" step="0.01" value={precoKmFrete} onChange={e => setPrecoKmFrete(e.target.value)} placeholder="ex: 7.00" />
              </div>
              <div className={styles.paramRow}>
                <label>Animais na Carreta</label>
                <input type="number" min="1" value={qtdCarreta} onChange={e => setQtdCarreta(e.target.value)} placeholder="ex: 100" />
              </div>
              <div className={styles.paramRow}>
                <label>Comissão (R$/cab)</label>
                <input type="number" min="0" step="0.01" value={comissao} onChange={e => setComissao(e.target.value)} placeholder="ex: 114.40" />
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>Frete / cab</label>
                <span>R$ {fmtR(r.freteCab)}</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>Peso Entrada (@)</label>
                <span>{fmtR(r.pesoEntAt, 2)} @</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc} ${styles.paramDestaque}`}>
                <label>Preço Animal (R$/cb)</label>
                <span>R$ {fmtR(r.precoAnimalBase)}</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>@ c/ frete e comissão</label>
                <span>R$ {fmtR(r.precoAtComFrete)}</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>kg c/ frete e comissão</label>
                <span>R$ {fmtR(r.precoKgComFrete, 4)}</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc} ${styles.paramDestaque}`}>
                <label>Preço Compra Total/cb</label>
                <span>R$ {fmtR(r.precoCompraTotalCb)}</span>
              </div>
            </div>
          </div>

          {/* Produção */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>⚙️ Parâmetros de Produção</div>
            <div className={styles.paramGrid}>
              <div className={styles.paramRow}>
                <label>GMD (kg/dia)</label>
                <input type="number" min="0" step="0.01" value={gmd} onChange={e => setGmd(e.target.value)} />
              </div>
              <div className={styles.paramRow}>
                <label>CMS % PV (padrão fases)</label>
                <input type="number" min="0" step="0.01" value={cmsPctPv} onChange={e => setCmsPctPv(e.target.value)} />
              </div>
              <div className={styles.paramRow}>
                <label>Rendimento Carcaça (%)</label>
                <input type="number" min="0" max="100" step="0.1" value={rendCarcaca} onChange={e => setRendCarcaca(e.target.value)} />
              </div>
              <div className={styles.paramRow}>
                <label>Custo Operacional (R$)</label>
                <input type="number" min="0" step="0.01" value={operacional} onChange={e => setOperacional(e.target.value)} placeholder="por cabeça" />
              </div>
              <div className={styles.paramRow}>
                <label>Taxas (R$)</label>
                <input type="number" min="0" step="0.01" value={taxas} onChange={e => setTaxas(e.target.value)} placeholder="por cabeça" />
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>Período Total</label>
                <span>{r.totalDias} dias</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>MS Dieta Ponderada</label>
                <span>{fmtPct(r.msDietaPonderada, 2)}</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>R$/kg MN Ponderado</label>
                <span>R$ {fmtR(r.custoKgMNPonderado, 4)}</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>Consumo MN total (kg)</label>
                <span>{fmtR(r.consumoMNTotal, 2)} kg</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>Custo Diária Média</label>
                <span>R$ {fmtR(r.diariasMedia)}</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc} ${styles.paramDestaque}`}>
                <label>Custo Alimentar Total</label>
                <span>R$ {fmtR(r.custoAlimentarTotal)}</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>Peso de Saída</label>
                <span>{fmtR(r.pesoSaida, 1)} kg ({fmtR(r.pesoSaidaAt, 2)} @)</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>Ganho de Peso</label>
                <span>+{fmtR(r.ganhoPesoTotal, 1)} kg</span>
              </div>
            </div>
          </div>

          {/* Venda */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>💰 Parâmetros de Venda</div>
            <div className={styles.paramGrid}>
              <div className={styles.paramRow}>
                <label>Preço de Venda (R$/@)</label>
                <input type="number" min="0" step="0.01" value={precoVendaAt} onChange={e => setPrecoVendaAt(e.target.value)} placeholder="ex: 327" />
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>Peso Carcaça ({rendCarcaca}%)</label>
                <span>{fmtR(r.pesoCarcaca, 1)} kg</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>@ Produzida</label>
                <span>{fmtR(r.atProduzida, 2)} @</span>
              </div>
              <div className={`${styles.paramRow} ${styles.paramCalc}`}>
                <label>Custo @ Produzida</label>
                <span>R$ {fmtR(r.custoAtProduzida)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RESULTADO FINAL ───────────────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>📊 Resultado — Engorda Macho</div>

          <div className={styles.resultadoGrid}>

            <div className={styles.resultadoBloco}>
              <div className={styles.resultadoTitulo}>Por Cabeça</div>
              <div className={styles.resultadoLinha}>
                <span>Preço Animal (c/ frete)</span>
                <strong>R$ {fmtR(r.precoCompraTotalCb)}</strong>
              </div>
              <div className={styles.resultadoLinha}>
                <span>Custo Alimentar</span>
                <strong>R$ {fmtR(r.custoAlimentarTotal)}</strong>
              </div>
              <div className={styles.resultadoLinha}>
                <span>Custo Operacional</span>
                <strong>R$ {fmtR(n(operacional))}</strong>
              </div>
              <div className={styles.resultadoLinha}>
                <span>Taxas</span>
                <strong>R$ {fmtR(n(taxas))}</strong>
              </div>
              <div className={`${styles.resultadoLinha} ${styles.resultadoTotalLinha}`}>
                <span>Custo Total / cb</span>
                <strong>R$ {fmtR(r.custoTotalCb)}</strong>
              </div>
              <div className={`${styles.resultadoLinha} ${styles.resultadoReceitaLinha}`}>
                <span>Receita Total / cb</span>
                <strong>R$ {fmtR(r.receitaTotalCb)}</strong>
              </div>
              <div className={`${styles.resultadoLinha} ${lucroPositivo ? styles.lucroPositivoLinha : styles.lucroNegativoLinha}`}>
                <span>Lucro Líquido / cb</span>
                <strong>R$ {fmtR(r.lucroLiquidoCb)}</strong>
              </div>
            </div>

            <div className={styles.resultadoBloco}>
              <div className={styles.resultadoTitulo}>Lote ({fmtR(n(animais), 0)} cab.)</div>
              <div className={styles.resultadoLinha}>
                <span>Custo Total Lote</span>
                <strong>R$ {fmtR(r.custoTotalCb * n(animais))}</strong>
              </div>
              <div className={styles.resultadoLinha}>
                <span>Receita Total Lote</span>
                <strong>R$ {fmtR(r.receitaTotalCb * n(animais))}</strong>
              </div>
              <div className={`${styles.resultadoLinha} ${lucroPositivo ? styles.lucroPositivoLinha : styles.lucroNegativoLinha}`}>
                <span>Lucro do Lote</span>
                <strong>R$ {fmtR(r.lucroLote)}</strong>
              </div>
            </div>

            <div className={`${styles.resultadoBloco} ${styles.resultadoIndicadores}`}>
              <div className={styles.resultadoTitulo}>Indicadores</div>
              <div className={styles.indicadorItem}>
                <span>@ produzida / cb</span>
                <strong>{fmtR(r.atProduzida, 2)} @</strong>
              </div>
              <div className={styles.indicadorItem}>
                <span>Custo @ produzida</span>
                <strong>R$ {fmtR(r.custoAtProduzida)}</strong>
              </div>
              <div className={styles.indicadorItem}>
                <span>Preço venda</span>
                <strong>R$ {fmtR(n(precoVendaAt))} / @</strong>
              </div>
              <div className={`${styles.indicadorItem} ${lucroPositivo ? styles.indPositivo : styles.indNegativo}`}>
                <span>Margem / @</span>
                <strong>R$ {fmtR(r.atProduzida > 0 ? r.lucroLiquidoCb / r.atProduzida : 0)}</strong>
              </div>
              <div className={`${styles.indicadorItem} ${lucroPositivo ? styles.indPositivo : styles.indNegativo}`}>
                <span>Margem %</span>
                <strong>{r.receitaTotalCb > 0 ? fmtPct((r.lucroLiquidoCb / r.receitaTotalCb) * 100) : '—'}</strong>
              </div>
            </div>

          </div>
        </div>

      </div>
    </Layout>
  );
}
