import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Compras.module.css';

const fmtN   = (v, d = 2) => v != null && !isNaN(v) ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtR   = (v, d = 2) => v != null && !isNaN(v) ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtKg  = (v) => v != null ? fmtN(v, 0) + ' kg' : '—';
const fmtDt  = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hoje   = () => { const d = new Date(new Date().getTime() - 4*60*60*1000); return d.toISOString().split('T')[0]; };

const ITEM_VAZIO = () => ({ ingredient_id: '', quantity_kg: '', price_per_ton: '', freight_per_ton: '0', _key: Math.random() });

export default function Compras() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions();

  // ── Estado ──────────────────────────────────────────────────
  const [insumos,    setInsumos]    = useState([]);
  const [compras,    setCompras]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [salvando,   setSalvando]   = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);

  // Filtros da lista
  const [filtroInsumo, setFiltroInsumo] = useState('');
  const [filtroDtIni,  setFiltroDtIni]  = useState('');
  const [filtroDtFim,  setFiltroDtFim]  = useState('');

  // Form de nova compra (NF)
  const [form, setForm] = useState({
    purchase_date: hoje(),
    supplier:      '',
    invoice_number:'',
    notes:         '',
  });
  const [itens, setItens] = useState([ITEM_VAZIO()]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    if (!authLoading && currentFarm) loadDados();
  }, [authLoading, user, currentFarm]);

  // ── Carregamento ─────────────────────────────────────────────
  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: ins }, { data: comp }] = await Promise.all([
        supabase.from('feed_ingredients').select('id, name, dry_matter_pct, unit, stock_qty_kg, stock_min_kg')
          .eq('farm_id', currentFarm.id).eq('active', true).order('name', { ascending: true }),
        supabase.from('feed_ingredient_prices')
          .select('*, feed_ingredients(id, name, dry_matter_pct, unit)')
          .eq('farm_id', currentFarm.id)
          .order('effective_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);
      setInsumos(ins || []);
      setCompras(comp || []);
    } catch (e) { alert('Erro ao carregar: ' + e.message); }
    finally { setLoading(false); }
  };

  // ── Itens do formulário ──────────────────────────────────────
  const addItem   = () => setItens(p => [...p, ITEM_VAZIO()]);
  const remItem   = (key) => setItens(p => p.filter(i => i._key !== key));
  const updItem   = (key, field, val) => setItens(p => p.map(i => i._key !== key ? i : { ...i, [field]: val }));

  const calcItem  = (item) => {
    const pTon  = parseFloat(item.price_per_ton)  || 0;
    const frete = parseFloat(item.freight_per_ton) || 0;
    const qtd   = parseFloat(item.quantity_kg)    || 0;
    const totalTon = pTon + frete;
    const pKg   = totalTon / 1000;
    const ins   = insumos.find(i => i.id === item.ingredient_id);
    const pKgMs = ins?.dry_matter_pct ? pKg / (ins.dry_matter_pct / 100) : null;
    const totalNota = (qtd / 1000) * totalTon;
    return { pTon, frete, totalTon, pKg, pKgMs, qtd, totalNota };
  };

  const totaisNF = itens.reduce((acc, item) => {
    const c = calcItem(item);
    return { qtd: acc.qtd + c.qtd, total: acc.total + c.totalNota };
  }, { qtd: 0, total: 0 });

  // ── Reset form ───────────────────────────────────────────────
  const resetForm = () => {
    setForm({ purchase_date: hoje(), supplier: '', invoice_number: '', notes: '' });
    setItens([ITEM_VAZIO()]);
    setEditandoId(null);
    setShowForm(false);
  };

  // ── Salvar compra ────────────────────────────────────────────
  const handleSalvar = async () => {
    const itensValidos = itens.filter(i => i.ingredient_id && i.quantity_kg && i.price_per_ton);
    if (!itensValidos.length) return alert('Adicione ao menos um insumo com quantidade e preço.');
    if (!form.purchase_date)  return alert('Informe a data da compra.');

    setSalvando(true);
    try {
      for (const item of itensValidos) {
        const { pTon, frete, totalTon, pKg, pKgMs, qtd } = calcItem(item);
        const ins = insumos.find(i => i.id === item.ingredient_id);

        // 1. Grava histórico de preços (feed_ingredient_prices)
        if (editandoId) {
          // ao editar, localiza o registro original pelo ingredient_id + invoice_number
          const compraOriginal = compras.find(c => c.id === editandoId && c.ingredient_id === item.ingredient_id);
          if (compraOriginal) {
            await supabase.from('feed_ingredient_prices').update({
              effective_date: form.purchase_date,
              price: pKg, price_per_ton: pTon, freight_per_ton: frete, total_price_per_ton: totalTon,
              price_per_kg_ms: pKgMs, quantity_kg_received: qtd,
              supplier: form.supplier || null, invoice_number: form.invoice_number || null,
            }).eq('id', compraOriginal.id);
          }
        } else {
          await supabase.from('feed_ingredient_prices').insert([{
            ingredient_id: item.ingredient_id, farm_id: currentFarm.id,
            effective_date: form.purchase_date, price: pKg,
            price_per_ton: pTon, freight_per_ton: frete, total_price_per_ton: totalTon,
            price_per_kg_ms: pKgMs, quantity_kg_received: qtd,
            supplier: form.supplier || null, invoice_number: form.invoice_number || null,
            registered_by: user.id,
          }]);

          // 2. Grava movimentação de estoque
          await supabase.from('ingredient_stock_movements').insert([{
            ingredient_id: item.ingredient_id, farm_id: currentFarm.id,
            movement_type: 'entrada', quantity_kg: qtd,
            entry_date: form.purchase_date, registered_by: user.id,
            notes: `Compra${form.invoice_number ? ' NF: ' + form.invoice_number : ''}${form.supplier ? ' — ' + form.supplier : ''} — ${fmtR(pTon, 2)}/ton`,
          }]);

          // 3. Atualiza preços + estoque do insumo
          await supabase.from('feed_ingredients').update({
            price_per_ton: pTon, freight_per_ton: frete, total_price_per_ton: totalTon,
            price_per_kg: pKg, price_per_kg_ms: pKgMs, current_price: pKg,
            stock_qty_kg: (ins?.stock_qty_kg || 0) + qtd,
            supplier: form.supplier || ins?.supplier || null,
          }).eq('id', item.ingredient_id);
        }
      }

      alert(`✅ Compra registrada com sucesso!\n${itensValidos.length} insumo(s) — Total: ${fmtR(totaisNF.total, 2)}`);
      resetForm();
      loadDados();
    } catch (e) { alert('Erro ao salvar: ' + e.message); }
    finally { setSalvando(false); }
  };

  // ── Excluir compra ───────────────────────────────────────────
  const handleExcluir = async (c) => {
    const ins = insumos.find(i => i.id === c.ingredient_id);
    if (!confirm(`Excluir esta compra de ${fmtN(c.quantity_kg_received, 0)} kg de ${ins?.name || '—'}?\n\nO estoque será revertido.`)) return;
    try {
      // Reverte estoque
      const novoEstoque = (ins?.stock_qty_kg || 0) - (c.quantity_kg_received || 0);
      await supabase.from('feed_ingredients').update({ stock_qty_kg: novoEstoque }).eq('id', c.ingredient_id);

      // Remove movimentação relacionada (pela data + ingredient + tipo entrada)
      await supabase.from('ingredient_stock_movements')
        .delete()
        .eq('ingredient_id', c.ingredient_id)
        .eq('farm_id', currentFarm.id)
        .eq('movement_type', 'entrada')
        .eq('entry_date', c.effective_date)
        .like('notes', `%${c.invoice_number || c.supplier || 'Compra'}%`);

      // Remove o registro de preço
      await supabase.from('feed_ingredient_prices').delete().eq('id', c.id);

      loadDados();
    } catch (e) { alert('Erro ao excluir: ' + e.message); }
  };

  // ── Filtros ──────────────────────────────────────────────────
  const comprasFiltradas = compras.filter(c => {
    if (filtroInsumo && c.ingredient_id !== filtroInsumo) return false;
    if (filtroDtIni  && c.effective_date < filtroDtIni)   return false;
    if (filtroDtFim  && c.effective_date > filtroDtFim)   return false;
    return true;
  });

  // Agrupa por NF (invoice_number + supplier + effective_date)
  const nfMap = {};
  comprasFiltradas.forEach(c => {
    const chave = `${c.effective_date}__${c.invoice_number || ''}__${c.supplier || ''}`;
    if (!nfMap[chave]) nfMap[chave] = { chave, effective_date: c.effective_date, invoice_number: c.invoice_number, supplier: c.supplier, itens: [] };
    nfMap[chave].itens.push(c);
  });
  const nfLista = Object.values(nfMap).sort((a, b) => b.effective_date.localeCompare(a.effective_date));

  if (authLoading || !user) return <div>Carregando...</div>;

  return (
    <Layout>
      <div className={styles.container}>

        {/* ── Cabeçalho ── */}
        <div className={styles.header}>
          <div>
            <h1>🛒 Compras de Insumos</h1>
            <p>Registre notas fiscais com múltiplos insumos de uma só vez</p>
          </div>
          {canCreate('feed_ingredient_prices') && (
            <button className={styles.btnNova} onClick={() => { resetForm(); setShowForm(s => !s); }}>
              {showForm && !editandoId ? '✕ Cancelar' : '+ Nova Compra'}
            </button>
          )}
        </div>

        {/* ── Formulário nova compra ── */}
        {showForm && (
          <div className={styles.formCard}>
            <div className={styles.formCardTitle}>
              {editandoId ? '✏️ Editar Compra' : '🛒 Nova Nota Fiscal de Compra'}
            </div>

            {/* Dados da NF */}
            <div className={styles.nfDados}>
              <div>
                <label>Data da Compra *</label>
                <input type="date" value={form.purchase_date}
                  onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
              </div>
              <div>
                <label>Fornecedor</label>
                <input type="text" value={form.supplier} placeholder="Ex: Cooperativa do Vale..."
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
              <div>
                <label>Nota Fiscal / Referência</label>
                <input type="text" value={form.invoice_number} placeholder="NF 00001..."
                  onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
              </div>
              <div>
                <label>Observações</label>
                <input type="text" value={form.notes} placeholder="Opcional..."
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* Tabela de itens */}
            <div className={styles.itensBox}>
              <div className={styles.itensHeader}>
                <strong>📦 Insumos desta compra</strong>
                <button className={styles.btnAddItem} onClick={addItem}>+ Adicionar insumo</button>
              </div>

              <div className={styles.tabelaItensWrapper}>
                <table className={styles.tabelaItens}>
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th>Quantidade (kg)</th>
                      <th>Preço/ton (R$)</th>
                      <th>Frete/ton (R$)</th>
                      <th>Total/ton</th>
                      <th>R$/kg MN</th>
                      <th>R$/kg MS</th>
                      <th>Total NF</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(item => {
                      const c = calcItem(item);
                      return (
                        <tr key={item._key}>
                          <td>
                            <select value={item.ingredient_id}
                              onChange={e => updItem(item._key, 'ingredient_id', e.target.value)}>
                              <option value="">Selecione...</option>
                              {insumos.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                          </td>
                          <td>
                            <input type="number" className={styles.inputNum} value={item.quantity_kg}
                              placeholder="10000" step="1" min="0"
                              onChange={e => updItem(item._key, 'quantity_kg', e.target.value)} />
                          </td>
                          <td>
                            <input type="number" className={styles.inputNum} value={item.price_per_ton}
                              placeholder="850.00" step="0.01" min="0"
                              onChange={e => updItem(item._key, 'price_per_ton', e.target.value)} />
                          </td>
                          <td>
                            <input type="number" className={styles.inputNum} value={item.freight_per_ton}
                              placeholder="0" step="0.01" min="0"
                              onChange={e => updItem(item._key, 'freight_per_ton', e.target.value)} />
                          </td>
                          <td className={styles.tdCalc}>
                            {c.totalTon > 0 ? fmtR(c.totalTon, 2) + '/ton' : '—'}
                          </td>
                          <td className={styles.tdDestaque}>
                            {c.pKg > 0 ? fmtR(c.pKg, 4) : '—'}
                          </td>
                          <td className={styles.tdMs}>
                            {c.pKgMs ? fmtR(c.pKgMs, 4) : '—'}
                          </td>
                          <td className={styles.tdTotal}>
                            {c.totalNota > 0 ? fmtR(c.totalNota, 2) : '—'}
                          </td>
                          <td>
                            {itens.length > 1 && (
                              <button className={styles.btnRem} onClick={() => remItem(item._key)} title="Remover">✕</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {itens.some(i => calcItem(i).totalNota > 0) && (
                    <tfoot>
                      <tr className={styles.trTotal}>
                        <td colSpan={2}><strong>TOTAL</strong></td>
                        <td colSpan={5}><strong>{fmtKg(totaisNF.qtd)}</strong></td>
                        <td colSpan={2}><strong className={styles.totalValor}>{fmtR(totaisNF.total, 2)}</strong></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className={styles.formAcoes}>
              <button className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
              <button className={styles.btnSalvar} onClick={handleSalvar} disabled={salvando}>
                {salvando ? 'Salvando...' : editandoId ? '✅ Salvar Alterações' : '✅ Registrar Compra'}
              </button>
            </div>
          </div>
        )}

        {/* ── Filtros ── */}
        <div className={styles.filtros}>
          <div>
            <label>Insumo</label>
            <select value={filtroInsumo} onChange={e => setFiltroInsumo(e.target.value)}>
              <option value="">Todos</option>
              {insumos.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label>De</label>
            <input type="date" value={filtroDtIni} onChange={e => setFiltroDtIni(e.target.value)} />
          </div>
          <div>
            <label>Até</label>
            <input type="date" value={filtroDtFim} onChange={e => setFiltroDtFim(e.target.value)} />
          </div>
          {(filtroInsumo || filtroDtIni || filtroDtFim) && (
            <button className={styles.btnLimparFiltro} onClick={() => { setFiltroInsumo(''); setFiltroDtIni(''); setFiltroDtFim(''); }}>
              ✕ Limpar
            </button>
          )}
          <span className={styles.contagem}>{nfLista.length} nota(s)</span>
        </div>

        {/* ── Lista de compras agrupadas por NF ── */}
        {loading ? (
          <div className={styles.vazio}>Carregando...</div>
        ) : nfLista.length === 0 ? (
          <div className={styles.vazio}>
            <div className={styles.vazioBig}>🛒</div>
            <p>Nenhuma compra registrada.</p>
            <p style={{ fontSize: '0.85rem', color: '#aaa' }}>Clique em "+ Nova Compra" para começar.</p>
          </div>
        ) : (
          <div className={styles.listaNf}>
            {nfLista.map(nf => {
              const totalNf   = nf.itens.reduce((s, c) => s + ((c.quantity_kg_received / 1000) * (c.total_price_per_ton || 0)), 0);
              const totalKg   = nf.itens.reduce((s, c) => s + (c.quantity_kg_received || 0), 0);
              const aberta    = expandidoId === nf.chave;
              return (
                <div key={nf.chave} className={styles.nfCard}>
                  {/* Cabeçalho da NF */}
                  <div className={styles.nfCardHeader} onClick={() => setExpandidoId(aberta ? null : nf.chave)}>
                    <div className={styles.nfCardLeft}>
                      <div className={styles.nfData}>{fmtDt(nf.effective_date)}</div>
                      <div className={styles.nfInfo}>
                        {nf.invoice_number && <span className={styles.nfBadge}>📄 NF {nf.invoice_number}</span>}
                        {nf.supplier && <span className={styles.nfSupplier}>🏭 {nf.supplier}</span>}
                        <span className={styles.nfItensCount}>{nf.itens.length} insumo(s)</span>
                      </div>
                    </div>
                    <div className={styles.nfCardRight}>
                      <div className={styles.nfTotais}>
                        <div>
                          <span>Total kg</span>
                          <strong>{fmtKg(totalKg)}</strong>
                        </div>
                        <div>
                          <span>Total R$</span>
                          <strong className={styles.nfValor}>{fmtR(totalNf, 2)}</strong>
                        </div>
                      </div>
                      <span className={styles.nfArrow}>{aberta ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Itens expandidos */}
                  {aberta && (
                    <div className={styles.nfItens}>
                      <table className={styles.tabelaNfItens}>
                        <thead>
                          <tr>
                            <th>Insumo</th>
                            <th>Quantidade</th>
                            <th>Preço/ton</th>
                            <th>Frete/ton</th>
                            <th>Total/ton</th>
                            <th>R$/kg MN</th>
                            <th>R$/kg MS</th>
                            <th>Total</th>
                            {canDelete('feed_ingredient_prices') && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {nf.itens.map(c => {
                            const ins     = c.feed_ingredients;
                            const totalC  = ((c.quantity_kg_received || 0) / 1000) * (c.total_price_per_ton || 0);
                            return (
                              <tr key={c.id}>
                                <td>
                                  <strong>{ins?.name || '—'}</strong>
                                  {ins?.dry_matter_pct && (
                                    <span className={styles.msTag}>MS {fmtN(ins.dry_matter_pct, 1)}%</span>
                                  )}
                                </td>
                                <td>{fmtKg(c.quantity_kg_received)}</td>
                                <td>{fmtR(c.price_per_ton, 2)}</td>
                                <td>{fmtR(c.freight_per_ton, 2)}</td>
                                <td>{fmtR(c.total_price_per_ton, 2)}</td>
                                <td className={styles.tdDestaque}>{fmtR(c.price, 4)}</td>
                                <td className={styles.tdMs}>{c.price_per_kg_ms ? fmtR(c.price_per_kg_ms, 4) : '—'}</td>
                                <td className={styles.tdTotal}>{fmtR(totalC, 2)}</td>
                                {canDelete('feed_ingredient_prices') && (
                                  <td>
                                    <button className={styles.btnExcluirItem}
                                      onClick={() => handleExcluir(c)} title="Excluir esta linha">
                                      🗑
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className={styles.trTotal}>
                            <td><strong>TOTAL</strong></td>
                            <td><strong>{fmtKg(totalKg)}</strong></td>
                            <td colSpan={5}></td>
                            <td><strong className={styles.totalValor}>{fmtR(totalNf, 2)}</strong></td>
                            {canDelete('feed_ingredient_prices') && <td></td>}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
