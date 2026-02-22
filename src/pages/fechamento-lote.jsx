import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import styles from '../styles/FechamentoLote.module.css';

const ARROBA = 15; // kg por @

export default function FechamentoLote() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();

  const [lotes, setLotes] = useState([]);
  const [loteSelecionado, setLoteSelecionado] = useState(null);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingLotes, setLoadingLotes] = useState(true);

  // Custos extras
  const [custos, setCustos] = useState([]);
  const [showFormCusto, setShowFormCusto] = useState(false);
  const [formCusto, setFormCusto] = useState({ description: '', total_amount: '', cost_date: '' });

  // Preço de venda para simulação
  const [precoVenda, setPrecoVenda] = useState('');
  const [rendCarcacaEdit, setRendCarcacaEdit] = useState('');

  const hoje = new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0];

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadLotes();
  }, [user, authLoading, currentFarm]);

  const loadLotes = async () => {
    setLoadingLotes(true);
    try {
      const { data, error } = await supabase
        .from('lots')
        .select('id, lot_code, head_count, avg_entry_weight, entry_date, category, status, purchase_price_arroba, carcass_yield_pct, cost_per_head_day, pens(pen_number)')
        .eq('farm_id', currentFarm.id)
        .in('status', ['active', 'closed'])
        .order('entry_date', { ascending: false });
      if (error) throw error;
      setLotes(data || []);
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoadingLotes(false); }
  };

  const loadDadosLote = async (loteId) => {
    setLoading(true);
    setDados(null);
    try {
      const lote = lotes.find(l => l.id === loteId);
      if (!lote) return;

      setRendCarcacaEdit(String(lote.carcass_yield_pct || 52));
      const arrobaDivisor = Number(lote.arroba_divisor || 30);

      const [
        { data: tratos },
        { data: pesagens },
        { data: custosExtras },
      ] = await Promise.all([
        supabase.from('feeding_records')
          .select('quantity_kg, leftover_kg, feeding_date, cost_per_kg, feed_types(name, cost_per_kg, dry_matter_pct)')
          .eq('lot_id', loteId)
          .order('feeding_date'),
        supabase.from('lot_weighings')
          .select('avg_weight_kg, weighing_date, head_weighed')
          .eq('lot_id', loteId)
          .order('weighing_date', { ascending: false }),
        supabase.from('lot_extra_costs')
          .select('*')
          .eq('lot_id', loteId)
          .order('cost_date'),
      ]);

      setCustos(custosExtras || []);

      // ── Pesos ──────────────────────────────────────────────
      const pesoInicial = Number(lote.avg_entry_weight || 0);
      const ultimaPesagem = pesagens && pesagens.length > 0 ? pesagens[0] : null;
      const pesoFinal = ultimaPesagem ? Number(ultimaPesagem.avg_weight_kg) : null;
      const dataEntrada = new Date(lote.entry_date + 'T00:00:00');
      const dataFinal = ultimaPesagem
        ? new Date(ultimaPesagem.weighing_date + 'T00:00:00')
        : new Date();
      const dias = Math.max(1, Math.floor((dataFinal - dataEntrada) / 86400000));
      const gmd = pesoFinal && pesoInicial ? ((pesoFinal - pesoInicial) / dias) : null;

      // ── Arrobas ────────────────────────────────────────────
      // @ negociada = peso ÷ divisor (padrão 30, que embute rendimento de carcaça)
      const arrobaInicial = pesoInicial / arrobaDivisor;
      const arrobaFinal = pesoFinal ? pesoFinal / arrobaDivisor : null;
      const arrobaProduzida = arrobaFinal ? arrobaFinal - arrobaInicial : null;

      // ── Consumo ────────────────────────────────────────────
      const t = tratos || [];
      const consumoTotalMN = t.reduce((acc, r) => acc + Number(r.quantity_kg), 0);
      const consumoTotalMS = t.reduce((acc, r) => {
        const ms = r.feed_types?.dry_matter_pct;
        return acc + (ms ? Number(r.quantity_kg) * (Number(ms) / 100) : 0);
      }, 0);
      const consumoMSPctPV = (pesoFinal && dias > 0 && consumoTotalMS > 0)
        ? (consumoTotalMS / dias / pesoFinal) * 100 : null;

      // ── Custo Alimentar ────────────────────────────────────
      // Usa cost_per_kg travado no trato; fallback para feed_types.cost_per_kg
      const custoAlimentarTotal = t.reduce((acc, r) => {
        const cpkg = Number(r.cost_per_kg || r.feed_types?.cost_per_kg || 0);
        return acc + Number(r.quantity_kg) * cpkg;
      }, 0);
      const custoAlimentarDia = dias > 0 && lote.head_count > 0
        ? custoAlimentarTotal / dias / lote.head_count : 0;

      // ── Custo Operacional ──────────────────────────────────
      const custOpDia = Number(lote.cost_per_head_day || 0);
      const custoOpTotal = custOpDia * dias * lote.head_count;

      // ── Custos Extras ──────────────────────────────────────
      const totalExtras = (custosExtras || []).reduce((acc, c) => acc + Number(c.total_amount), 0);
      const extraPorCab = lote.head_count > 0 ? totalExtras / lote.head_count : 0;

      // ── Custo Total ────────────────────────────────────────
      const custoTotal = custoAlimentarTotal + custoOpTotal + totalExtras;
      const custoPorCab = lote.head_count > 0 ? custoTotal / lote.head_count : 0;
      const custoPorArrobaProd = arrobaProduzida && arrobaProduzida > 0 && lote.head_count > 0
        ? custoTotal / (arrobaProduzida * lote.head_count) : null;

      // ── Kg totais ──────────────────────────────────────────
      const totalKgCompra = pesoInicial * lote.head_count;
      const totalKgVenda = pesoFinal ? pesoFinal * lote.head_count : null;

      // ── Preço de Compra ────────────────────────────────────
      const precoCpArr = Number(lote.purchase_price_arroba || 0);
      const precoCpCab = precoCpArr > 0 ? precoCpArr * arrobaInicial : null;
      const precoCpTotal = precoCpCab ? precoCpCab * lote.head_count : null;

      // ── Preço sugerido de venda ────────────────────────────
      // Base: custo total de confinamento por @ produzida + preço de compra por @
      // Ou seja: para não ter prejuízo, precisa recuperar o custo de compra + confinamento
      // Sugestão = (custo confinamento/cab + custo compra/cab) ÷ @ final/cab
      const arrobaFinalCab = arrobaFinal; // @ final por cabeça
      const precoVendaSugerido = arrobaFinalCab && arrobaFinalCab > 0
        ? (custoPorCab + (precoCpCab || 0)) / arrobaFinalCab
        : null;

      setDados({
        lote, dias, pesoInicial, pesoFinal, gmd,
        arrobaInicial, arrobaFinal, arrobaProduzida,
        totalKgCompra, totalKgVenda,
        consumoTotalMN, consumoTotalMS, consumoMSPctPV,
        custoAlimentarTotal, custoAlimentarDia,
        custOpDia, custoOpTotal, totalExtras, extraPorCab,
        custoTotal, custoPorCab, custoPorArrobaProd,
        precoCpArr, precoCpCab, precoCpTotal,
        precoVendaSugerido,
        totalTratos: t.length,
        arrobaDivisor,
      });
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleSelectLote = (loteId) => {
    const lote = lotes.find(l => l.id === loteId);
    setLoteSelecionado(lote || null);
    setPrecoVenda(''); // será preenchido após loadDadosLote via useEffect
    if (loteId) loadDadosLote(loteId);
    else setDados(null);
  };

  // Auto-preenche o preço sugerido quando dados carregam
  useEffect(() => {
    if (dados?.precoVendaSugerido && !precoVenda) {
      setPrecoVenda(dados.precoVendaSugerido.toFixed(2));
    }
  }, [dados]);

  const handleSaveCusto = async (e) => {
    e.preventDefault();
    if (!formCusto.description || !formCusto.total_amount) return alert('Preencha descrição e valor.');
    try {
      const { error } = await supabase.from('lot_extra_costs').insert([{
        lot_id: loteSelecionado.id,
        farm_id: currentFarm.id,
        description: formCusto.description,
        total_amount: parseFloat(formCusto.total_amount),
        cost_date: formCusto.cost_date || hoje,
        registered_by: user.id,
      }]);
      if (error) throw error;
      setFormCusto({ description: '', total_amount: '', cost_date: '' });
      setShowFormCusto(false);
      loadDadosLote(loteSelecionado.id);
    } catch (err) { alert('Erro: ' + err.message); }
  };

  const handleDeleteCusto = async (id) => {
    if (!confirm('Remover este custo?')) return;
    await supabase.from('lot_extra_costs').delete().eq('id', id);
    loadDadosLote(loteSelecionado.id);
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  // Cálculos do simulador de venda
  const rendEdit = parseFloat(rendCarcacaEdit) || 52;
  const pvArr = parseFloat(precoVenda) || 0;
  let margemAnimal = null, precoVendaCab = null, resultadoTotal = null;
  if (dados && pvArr > 0 && dados.arrobaFinal) {
    const divisor = Number(dados.lote.arroba_divisor || 30);
    // @ de venda usa o mesmo divisor do negócio
    const arrobaVenda = dados.pesoFinal / divisor;
    precoVendaCab = pvArr * arrobaVenda;
    margemAnimal = precoVendaCab - dados.custoPorCab - (dados.precoCpCab || 0);
    resultadoTotal = margemAnimal * dados.lote.head_count;
  }

  const fmt = (v, dec = 2) => v != null ? Number(v).toFixed(dec) : '—';
  const fmtR = (v) => v != null ? `R$ ${Number(v).toFixed(2)}` : '—';

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>📊 Fechamento de Lote</h1>
        </div>

        {/* Seleção de lote */}
        <div className={styles.selectorCard}>
          <label>Selecione o Lote</label>
          <select onChange={(e) => handleSelectLote(e.target.value)} defaultValue="">
            <option value="">— Selecione um lote —</option>
            {lotes.map(l => (
              <option key={l.id} value={l.id}>
                {l.lot_code} — {l.head_count} cab. — Baia {l.pens?.pen_number || '?'} — {l.status === 'active' ? 'Ativo' : 'Encerrado'}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className={styles.vazio}>Calculando...</p>}

        {dados && !loading && (
          <>
            {/* Aviso se faltam dados */}
            {!dados.lote.purchase_price_arroba && (
              <div className={styles.avisoConfig}>
                ⚠️ Preço de compra não cadastrado no lote. <a href="/lotes">Edite o lote</a> para completar o fechamento.
              </div>
            )}
            {!dados.pesoFinal && (
              <div className={styles.avisoConfig}>
                ⚠️ Nenhuma pesagem registrada para este lote. O peso final é necessário para calcular as arrobas.
              </div>
            )}

            {/* Grid principal igual à planilha */}
            <div className={styles.planilhaGrid}>

              {/* COLUNA 1 — Dados zootécnicos */}
              <div className={styles.secao}>
                <div className={styles.secaoTitulo}>📋 Dados do Lote</div>
                <table className={styles.tabelaDados}>
                  <tbody>
                    <tr><td>Lote</td><td><strong>{dados.lote.lot_code}</strong></td></tr>
                    <tr><td>Baia</td><td>{dados.lote.pens?.pen_number || '—'}</td></tr>
                    <tr><td>Cabeças</td><td>{dados.lote.head_count}</td></tr>
                    <tr><td>Categoria</td><td>{dados.lote.category}</td></tr>
                    <tr><td>Dias de Confinamento</td><td><strong>{dados.dias}</strong></td></tr>
                    <tr className={styles.trDestaque}><td>Peso Inicial (kg)</td><td>{fmt(dados.pesoInicial, 1)} kg</td></tr>
                    <tr><td>Total kg Compra ({dados.lote.head_count} cab.)</td><td><strong>{fmt(dados.totalKgCompra, 0)} kg</strong></td></tr>
                    <tr className={styles.trDestaque}><td>Peso Final (kg)</td><td>{dados.pesoFinal ? `${fmt(dados.pesoFinal, 1)} kg` : <span className={styles.semDado}>Sem pesagem</span>}</td></tr>
                    <tr><td>Total kg Venda ({dados.lote.head_count} cab.)</td><td>{dados.totalKgVenda ? <strong>{fmt(dados.totalKgVenda, 0)} kg</strong> : <span className={styles.semDado}>—</span>}</td></tr>
                    <tr><td>GMD (kg/dia)</td><td>{dados.gmd ? <strong>{fmt(dados.gmd, 3)}</strong> : <span className={styles.semDado}>—</span>}</td></tr>
                    <tr><td>@ Inicial</td><td>{fmt(dados.arrobaInicial, 2)} @</td></tr>
                    <tr><td>@ Final</td><td>{dados.arrobaFinal ? `${fmt(dados.arrobaFinal, 2)} @` : <span className={styles.semDado}>—</span>}</td></tr>
                    <tr className={styles.trDestaque}><td>@ Produzida / cab</td><td>{dados.arrobaProduzida ? <strong>{fmt(dados.arrobaProduzida, 2)} @</strong> : <span className={styles.semDado}>—</span>}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* COLUNA 2 — Consumo */}
              <div className={styles.secao}>
                <div className={styles.secaoTitulo}>🌾 Consumo de Ração</div>
                <table className={styles.tabelaDados}>
                  <tbody>
                    <tr><td>Total de Tratos</td><td>{dados.totalTratos}</td></tr>
                    <tr className={styles.trDestaque}><td>Consumo Total MN (kg)</td><td><strong>{fmt(dados.consumoTotalMN, 2)} kg</strong></td></tr>
                    <tr className={styles.trDestaque}><td>Consumo Total MS (kg)</td><td><strong>{fmt(dados.consumoTotalMS, 2)} kg</strong></td></tr>
                    <tr><td>Consumo MN/cab</td><td>{fmt(dados.consumoTotalMN / dados.lote.head_count, 2)} kg</td></tr>
                    <tr><td>Consumo MS/cab</td><td>{fmt(dados.consumoTotalMS / dados.lote.head_count, 2)} kg</td></tr>
                    <tr><td>Consumo MS/cab/dia</td><td>{fmt(dados.consumoTotalMS / dados.lote.head_count / dados.dias, 3)} kg</td></tr>
                    <tr className={styles.trDestaque}><td>Consumo MS % PV</td><td>{dados.consumoMSPctPV ? <strong>{fmt(dados.consumoMSPctPV, 2)}%</strong> : <span className={styles.semDado}>—</span>}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* COLUNA 3 — Custos */}
              <div className={styles.secao}>
                <div className={styles.secaoTitulo}>💰 Custos</div>
                <table className={styles.tabelaDados}>
                  <tbody>
                    <tr><td>Custo Alimentar/dia/cab</td><td>{fmtR(dados.custoAlimentarDia)}</td></tr>
                    <tr className={styles.trDestaque}><td>Custo Alimentar Total</td><td><strong>{fmtR(dados.custoAlimentarTotal)}</strong></td></tr>
                    <tr><td>Custo Operacional/dia/cab</td><td>{dados.custOpDia > 0 ? fmtR(dados.custOpDia) : <span className={styles.semDado}>Não informado</span>}</td></tr>
                    <tr className={styles.trDestaque}><td>Custo Operacional Total</td><td><strong>{fmtR(dados.custoOpTotal)}</strong></td></tr>
                    <tr><td>Custos Extras/cab</td><td>{fmtR(dados.extraPorCab)}</td></tr>
                    <tr className={styles.trDestaque}><td>Custos Extras Total</td><td><strong>{fmtR(dados.totalExtras)}</strong></td></tr>
                    <tr style={{borderTop:'2px solid #c8e6c9'}}><td>Custo Total</td><td><strong className={styles.valorTotal}>{fmtR(dados.custoTotal)}</strong></td></tr>
                    <tr><td>Custo por Cabeça</td><td><strong>{fmtR(dados.custoPorCab)}</strong></td></tr>
                    <tr className={styles.trDestaque}><td>Custo por @ Produzida</td><td>{dados.custoPorArrobaProd ? <strong className={styles.valorTotal}>{fmtR(dados.custoPorArrobaProd)}</strong> : <span className={styles.semDado}>—</span>}</td></tr>
                    <tr style={{borderTop:'2px solid #ffcc02'}}><td>Preço de Compra (@)</td><td>{dados.precoCpArr > 0 ? fmtR(dados.precoCpArr) : <span className={styles.semDado}>Não informado</span>}</td></tr>
                    <tr><td>Preço de Compra/cab</td><td>{dados.precoCpCab ? fmtR(dados.precoCpCab) : <span className={styles.semDado}>—</span>}</td></tr>
                    <tr className={styles.trDestaque}><td>Preço de Compra Total</td><td>{dados.precoCpTotal ? <strong>{fmtR(dados.precoCpTotal)}</strong> : <span className={styles.semDado}>—</span>}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Custos Extras */}
            <div className={styles.secaoCard}>
              <div className={styles.secaoCardHeader}>
                <strong>🧾 Custos Extras do Lote</strong>
                <button className={styles.btnAdd} onClick={() => setShowFormCusto(!showFormCusto)}>
                  {showFormCusto ? 'Cancelar' : '+ Adicionar Custo'}
                </button>
              </div>

              {showFormCusto && (
                <form className={styles.formCusto} onSubmit={handleSaveCusto}>
                  <div className={styles.formCustoRow}>
                    <div>
                      <label>Descrição *</label>
                      <input type="text" value={formCusto.description}
                        onChange={e => setFormCusto({...formCusto, description: e.target.value})}
                        placeholder="Ex: Medicamento, Frete, Vacina..." required />
                    </div>
                    <div>
                      <label>Valor Total (R$) *</label>
                      <input type="number" value={formCusto.total_amount}
                        onChange={e => setFormCusto({...formCusto, total_amount: e.target.value})}
                        placeholder="Ex: 1500.00" step="0.01" min="0" required />
                    </div>
                    <div>
                      <label>Data</label>
                      <input type="date" value={formCusto.cost_date}
                        onChange={e => setFormCusto({...formCusto, cost_date: e.target.value})} />
                    </div>
                    <div className={styles.formCustoBtnWrap}>
                      <button type="submit" className={styles.btnSalvar}>Salvar</button>
                    </div>
                  </div>
                </form>
              )}

              {custos.length === 0 ? (
                <p className={styles.semCustos}>Nenhum custo extra registrado.</p>
              ) : (
                <table className={styles.tabelaCustos}>
                  <thead><tr><th>Data</th><th>Descrição</th><th>Total</th><th>Por Cabeça</th><th></th></tr></thead>
                  <tbody>
                    {custos.map(c => (
                      <tr key={c.id}>
                        <td>{new Date(c.cost_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td>{c.description}</td>
                        <td><strong>{fmtR(c.total_amount)}</strong></td>
                        <td>{fmtR(Number(c.total_amount) / dados.lote.head_count)}</td>
                        <td><button className={styles.btnDeletar} onClick={() => handleDeleteCusto(c.id)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={2}><strong>Total</strong></td>
                      <td><strong>{fmtR(dados.totalExtras)}</strong></td>
                      <td><strong>{fmtR(dados.extraPorCab)}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Simulador de Venda */}
            <div className={styles.simuladorCard}>
              <div className={styles.simuladorTitulo}>🎯 Simulador de Venda</div>
              <div className={styles.simuladorForm}>
                <div>
                  <label>
                    Preço de Venda (R$/@)
                    {dados.precoVendaSugerido && (
                      <span className={styles.sugestaoLabel}>
                        &nbsp;— ponto de equilíbrio: R$ {dados.precoVendaSugerido.toFixed(2)}/@
                      </span>
                    )}
                  </label>
                  <input type="number" value={precoVenda}
                    onChange={e => setPrecoVenda(e.target.value)}
                    placeholder="Ex: 323.00" step="0.01" min="0" />
                </div>
                <div>
                  <label>Rendimento de Carcaça (%)</label>
                  <input type="number" value={rendCarcacaEdit}
                    onChange={e => setRendCarcacaEdit(e.target.value)}
                    placeholder="52" step="0.1" min="40" max="70" />
                </div>
                {pvArr > 0 && dados.arrobaFinal && (
                  <div className={styles.simuladorResultado}>
                    <div className={styles.simItem}>
                      <span>@ de Venda/cab (÷{dados.arrobaDivisor || 30})</span>
                      <strong>{fmt(dados.pesoFinal / (dados.arrobaDivisor || 30), 2)} @</strong>
                    </div>
                    <div className={styles.simItem}>
                      <span>Total kg Compra</span>
                      <strong>{fmt(dados.totalKgCompra, 0)} kg</strong>
                    </div>
                    <div className={styles.simItem}>
                      <span>Total kg Venda</span>
                      <strong>{dados.totalKgVenda ? fmt(dados.totalKgVenda, 0) + ' kg' : '—'}</strong>
                    </div>
                    <div className={styles.simItem}>
                      <span>Preço de Venda/cab</span>
                      <strong>{fmtR(precoVendaCab)}</strong>
                    </div>
                    <div className={styles.simItem}>
                      <span>Custo Total/cab (conf. + compra)</span>
                      <strong>{fmtR(dados.custoPorCab + (dados.precoCpCab || 0))}</strong>
                    </div>
                    <div className={`${styles.simItem} ${margemAnimal >= 0 ? styles.simPositivo : styles.simNegativo}`}>
                      <span>Margem por Animal</span>
                      <strong>{fmtR(margemAnimal)}</strong>
                    </div>
                    <div className={`${styles.simItem} ${resultadoTotal >= 0 ? styles.simPositivo : styles.simNegativo}`}>
                      <span>Resultado Total ({dados.lote.head_count} cab.)</span>
                      <strong className={styles.resultadoGrande}>{fmtR(resultadoTotal)}</strong>
                    </div>
                  </div>
                )}
              </div>
              {pvArr > 0 && !dados.arrobaFinal && (
                <p style={{color:'rgba(255,255,255,0.6)',fontSize:'0.88rem',marginTop:'8px'}}>⚠️ Registre uma pesagem para usar o simulador.</p>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
