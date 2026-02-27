import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Racoes.module.css';

// ─── Helpers ────────────────────────────────────────────────
const fmtN  = (v, d = 2) => v != null && !isNaN(v) ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtR  = (v, d = 2) => v != null && !isNaN(v) ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const hoje = () => new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0];

// ─── ABA: RAÇÕES ────────────────────────────────────────────
function AbaRacoes({ currentFarm, canCreate, canEdit, canDelete }) {
  const [racoes, setRacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', dry_matter_pct: '' });

  useEffect(() => { loadRacoes(); }, []);

  const loadRacoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feed_types')
        .select('*, feed_compositions!feed_compositions_feed_type_id_fkey(id, version, effective_date, cost_per_kg, base_qty_kg, is_current)')
        .eq('farm_id', currentFarm.id)
        .order('name');
      if (error) throw error;
      setRacoes(data || []);
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const resetForm = () => { setFormData({ name: '', dry_matter_pct: '' }); setEditingId(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name: formData.name, dry_matter_pct: formData.dry_matter_pct ? parseFloat(formData.dry_matter_pct) : null, farm_id: currentFarm.id };
      if (editingId) {
        const { error } = await supabase.from('feed_types').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feed_types').insert([payload]);
        if (error) throw error;
      }
      resetForm(); loadRacoes();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className={styles.subHeader}>
        <span>{racoes.length} ração(ões)</span>
        {canCreate('feed_types') && (
          <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm && !editingId ? 'Cancelar' : '+ Nova Ração'}
          </button>
        )}
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h2>{editingId ? 'Editar Ração' : 'Nova Ração'}</h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.row}>
              <div>
                <label>Nome da Ração *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div>
                <label>MS% da ração (mistura final)</label>
                <input type="number" value={formData.dry_matter_pct} onChange={e => setFormData({ ...formData, dry_matter_pct: e.target.value })} placeholder="Ex: 54.0" step="0.01" min="0" max="100" />
              </div>
            </div>
            <div className={styles.formAcoes}>
              <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
              <button type="submit" disabled={loading}>{loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className={styles.vazio}>Carregando...</p> : racoes.length === 0 ? (
        <div className={styles.vazio}><p>Nenhuma ração cadastrada.</p></div>
      ) : (
        <div className={styles.tabelaWrapper}>
          <table className={styles.tabela}>
            <thead><tr>
              <th>Nome</th><th>MS%</th><th>Custo/kg MN</th><th>Custo/kg MS</th><th>Versão</th><th>Vigência</th>
              {(canEdit('feed_types') || canDelete('feed_types')) && <th>Ações</th>}
            </tr></thead>
            <tbody>
              {racoes.map(r => {
                const comp = r.feed_compositions?.find(c => c.is_current);
                const custoMN = r.cost_per_kg ? Number(r.cost_per_kg) : null;
                const custoMS = custoMN && r.dry_matter_pct ? custoMN / (Number(r.dry_matter_pct) / 100) : null;
                return (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.dry_matter_pct ? <span className={styles.badgeBlue}>{fmtN(r.dry_matter_pct, 1)}%</span> : <span className={styles.badgeWarn}>N/I</span>}</td>
                    <td>{custoMN ? <strong>{fmtR(custoMN, 4)}/kg</strong> : <span className={styles.semComp}>Sem composição</span>}</td>
                    <td>{custoMS ? fmtR(custoMS, 4) + '/kg MS' : '—'}</td>
                    <td>{comp ? <span className={styles.badgeGreen}>v{comp.version}</span> : '—'}</td>
                    <td>{comp ? new Date(comp.effective_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    {(canEdit('feed_types') || canDelete('feed_types')) && (
                      <td><div className={styles.acoes}>
                        {canEdit('feed_types') && (
                          <button className={styles.btnEditar} onClick={() => {
                            setFormData({ name: r.name, dry_matter_pct: r.dry_matter_pct || '' });
                            setEditingId(r.id); setShowForm(true);
                          }}>Editar</button>
                        )}
                        {canDelete('feed_types') && (
                          <button className={styles.btnDeletar} onClick={async () => {
                            if (!confirm('Deletar esta ração?')) return;
                            await supabase.from('feed_types').delete().eq('id', r.id);
                            loadRacoes();
                          }}>Deletar</button>
                        )}
                      </div></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ABA: INSUMOS ───────────────────────────────────────────
function AbaInsumos({ currentFarm, user, canCreate, canEdit, canDelete }) {
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEntradaId, setShowEntradaId] = useState(null);
  const [showMovId, setShowMovId] = useState(null);
  const [movimentos, setMovimentos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingMovId, setEditingMovId] = useState(null);
  const [formEditMov, setFormEditMov] = useState({ quantity_kg: '', entry_date: '', notes: '' });
  const [showEditId, setShowEditId] = useState(null);

  // Form cadastro do insumo
  const [formData, setFormData] = useState({
    name: '', supplier: '', unit: 'kg', dry_matter_pct: '', stock_min_kg: '', notes: ''
  });

  // Form entrada de estoque
  const [formEntrada, setFormEntrada] = useState({
    entry_date: hoje(), quantity_kg_received: '', price_per_ton: '',
    freight_per_ton: '0', invoice_number: '', supplier: ''
  });

  useEffect(() => { loadInsumos(); }, []);

  const loadInsumos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feed_ingredients')
        .select('*')
        .eq('farm_id', currentFarm.id)
        .order('name');
      if (error) throw error;
      setInsumos(data || []);
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const loadMovimentos = async (ingredientId) => {
    if (showMovId === ingredientId) { setShowMovId(null); return; }
    try {
      const { data, error } = await supabase
        .from('ingredient_stock_movements')
        .select('*')
        .eq('ingredient_id', ingredientId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setMovimentos(data || []);
      setShowMovId(ingredientId);
      setEditingMovId(null);
    } catch (err) { alert('Erro: ' + err.message); }
  };

  const handleEditMov = (m) => {
    if (m.movement_type === 'baixa_trato' || m.movement_type === 'ajuste_batida') return alert('Este movimento é automático e não pode ser editado diretamente.\nPara corrigir, ajuste o peso realizado na Batida de Vagão.');
    setEditingMovId(m.id);
    // Extrai preço/ton e frete da observação ou deixa vazio para reeditar
    setFormEditMov({
      quantity_kg: String(Math.abs(m.quantity_kg)),
      entry_date: m.entry_date,
      price_per_ton: '',
      freight_per_ton: '0',
      notes: m.notes || '',
    });
  };

  const handleSaveMov = async (m, insumo) => {
    const novaQtd = parseFloat(formEditMov.quantity_kg);
    if (!novaQtd || novaQtd <= 0) return alert('Quantidade inválida.');
    setLoading(true);
    try {
      const qtdAntiga = Math.abs(m.quantity_kg);
      const diff = novaQtd - qtdAntiga;

      // Recalcula preços se informados
      const pTon = parseFloat(formEditMov.price_per_ton) || 0;
      const frete = parseFloat(formEditMov.freight_per_ton) || 0;
      const totalTon = pTon > 0 ? pTon + frete : null;
      const pKg = totalTon ? totalTon / 1000 : null;
      const pKgMs = pKg && insumo.dry_matter_pct ? pKg / (insumo.dry_matter_pct / 100) : null;

      // Atualiza movimentação
      const { error: errMov } = await supabase
        .from('ingredient_stock_movements')
        .update({ quantity_kg: novaQtd, entry_date: formEditMov.entry_date, notes: formEditMov.notes || null })
        .eq('id', m.id);
      if (errMov) throw errMov;

      // Ajusta saldo pela diferença de quantidade
      const updateIns = { stock_qty_kg: (insumo.stock_qty_kg || 0) + diff };
      // Atualiza preços no insumo somente se foram informados
      if (pKg) {
        updateIns.price_per_ton = pTon;
        updateIns.freight_per_ton = frete;
        updateIns.total_price_per_ton = totalTon;
        updateIns.price_per_kg = pKg;
        updateIns.current_price = pKg;
        if (pKgMs) updateIns.price_per_kg_ms = pKgMs;
      }
      const { error: errIns } = await supabase.from('feed_ingredients').update(updateIns).eq('id', insumo.id);
      if (errIns) throw errIns;

      setEditingMovId(null);
      await loadMovimentos(insumo.id);
      loadInsumos();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteMov = async (m, insumo) => {
    if (m.movement_type === 'baixa_trato' || m.movement_type === 'ajuste_batida') return alert('Este movimento é automático e não pode ser deletado diretamente.\nPara corrigir, ajuste o peso realizado na Batida de Vagão.');
    if (!confirm(`Deletar esta movimentação de ${fmtN(Math.abs(m.quantity_kg), 2)} kg?\nO estoque será ajustado automaticamente.`)) return;
    setLoading(true);
    try {
      const { error: errMov } = await supabase.from('ingredient_stock_movements').delete().eq('id', m.id);
      if (errMov) throw errMov;

      // Reverte o efeito no saldo
      const ajuste = m.movement_type === 'entrada' ? -m.quantity_kg : Math.abs(m.quantity_kg);
      await supabase.from('feed_ingredients')
        .update({ stock_qty_kg: (insumo.stock_qty_kg || 0) + ajuste })
        .eq('id', insumo.id);

      await loadMovimentos(insumo.id);
      loadInsumos();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteInsumo = async (ins) => {
    // Verifica se está em alguma composição
    const { data: usos, error } = await supabase
      .from('feed_composition_items')
      .select('id, feed_compositions(feed_types!feed_compositions_feed_type_id_fkey(name))')
      .eq('ingredient_id', ins.id)
      .limit(5);

    if (error) { alert('Erro ao verificar uso: ' + error.message); return; }

    if (usos && usos.length > 0) {
      // Está em composição — só pode inativar
      const racoes = [...new Set(usos.map(u => u.feed_compositions?.feed_types?.name).filter(Boolean))];
      const msg = `O insumo "${ins.name}" está em ${usos.length} composição(ões):\n${racoes.join(', ')}\n\nNão é possível deletar. Deseja inativá-lo?\n(Ficará oculto mas o histórico é preservado)`;
      if (!confirm(msg)) return;
      const { error: errInativo } = await supabase.from('feed_ingredients').update({ active: false }).eq('id', ins.id);
      if (errInativo) { alert('Erro: ' + errInativo.message); return; }
      alert('✅ Insumo inativado. Pode ser reativado editando-o.');
    } else {
      // Sem uso — pode deletar permanentemente
      if (!confirm(`Deletar o insumo "${ins.name}" permanentemente?\n\nEle não está em nenhuma composição.\nTodas as movimentações de estoque também serão removidas.`)) return;
      const { error: errDel } = await supabase.from('feed_ingredients').delete().eq('id', ins.id);
      if (errDel) { alert('Erro ao deletar: ' + errDel.message); return; }
      alert('✅ Insumo deletado.');
    }
    loadInsumos();
  };

  const resetForm = () => {
    setFormData({ name: '', supplier: '', unit: 'kg', dry_matter_pct: '', stock_min_kg: '', notes: '' });
    setEditingId(null); setShowForm(false); setShowEditId(null);
  };

  const resetEntrada = () => {
    setFormEntrada({ entry_date: hoje(), quantity_kg_received: '', price_per_ton: '', freight_per_ton: '0', invoice_number: '', supplier: '' });
    setShowEntradaId(null);
  };

  const handleAbrirEdicao = (ins) => {
    setFormData({ name: ins.name, supplier: ins.supplier || '', unit: ins.unit, dry_matter_pct: ins.dry_matter_pct || '', stock_min_kg: ins.stock_min_kg || '', notes: ins.notes || '' });
    setEditingId(ins.id);
    setShowEditId(ins.id);
    setShowEntradaId(null);
    setShowForm(false);
  };

  const handleToggleEdit = (insId, ins) => {
    if (showEditId === insId) { setShowEditId(null); setEditingId(null); }
    else { handleAbrirEdicao(ins); }
  };

  // Cálculos derivados da entrada
  const calcEntrada = (f) => {
    const pTon = parseFloat(f.price_per_ton) || 0;
    const frete = parseFloat(f.freight_per_ton) || 0;
    const totalTon = pTon + frete;
    const pKg = totalTon / 1000;
    return { totalTon, pKg };
  };

  const calcInsumoPrices = (pTon, frete, ms) => {
    const totalTon = (parseFloat(pTon) || 0) + (parseFloat(frete) || 0);
    const pKg = totalTon / 1000;
    const pKgMs = ms ? pKg / (parseFloat(ms) / 100) : null;
    return { totalTon, pKg, pKgMs };
  };

  // Salvar cadastro do insumo
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        supplier: formData.supplier || null,
        unit: formData.unit,
        dry_matter_pct: formData.dry_matter_pct ? parseFloat(formData.dry_matter_pct) : null,
        stock_min_kg: formData.stock_min_kg ? parseFloat(formData.stock_min_kg) : 0,
        notes: formData.notes || null,
        farm_id: currentFarm.id,
        active: true,
      };
      if (editingId) {
        const { error } = await supabase.from('feed_ingredients').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feed_ingredients').insert([payload]);
        if (error) throw error;
      }
      resetForm(); setShowEditId(null); loadInsumos();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  // Registrar entrada de estoque
  const handleEntrada = async (insumo) => {
    const f = formEntrada;
    if (!f.quantity_kg_received || !f.price_per_ton) return alert('Preencha quantidade e preço/ton.');
    const { totalTon, pKg } = calcEntrada(f);
    const ms = insumo.dry_matter_pct;
    const pKgMs = ms ? pKg / (ms / 100) : null;
    const qtd = parseFloat(f.quantity_kg_received);

    setLoading(true);
    try {
      // 1. Atualiza preços e estoque no insumo
      await supabase.from('feed_ingredients').update({
        price_per_ton: parseFloat(f.price_per_ton),
        freight_per_ton: parseFloat(f.freight_per_ton) || 0,
        total_price_per_ton: totalTon,
        price_per_kg: pKg,
        price_per_kg_ms: pKgMs,
        current_price: pKg, // mantém compatibilidade
        stock_qty_kg: (insumo.stock_qty_kg || 0) + qtd,
        supplier: f.supplier || insumo.supplier || null,
      }).eq('id', insumo.id);

      // 2. Grava movimentação de entrada
      await supabase.from('ingredient_stock_movements').insert([{
        ingredient_id: insumo.id,
        farm_id: currentFarm.id,
        movement_type: 'entrada',
        quantity_kg: qtd,
        entry_date: f.entry_date,
        notes: `Entrada — ${fmtR(parseFloat(f.price_per_ton), 2)}/ton` + (f.invoice_number ? ` — NF: ${f.invoice_number}` : ''),
        registered_by: user.id,
      }]);

      // 3. Grava histórico de preços
      await supabase.from('feed_ingredient_prices').insert([{
        ingredient_id: insumo.id,
        farm_id: currentFarm.id,
        price: pKg,
        effective_date: f.entry_date,
        quantity_kg_received: qtd,
        price_per_ton: parseFloat(f.price_per_ton),
        freight_per_ton: parseFloat(f.freight_per_ton) || 0,
        total_price_per_ton: totalTon,
        price_per_kg_ms: pKgMs,
        supplier: f.supplier || null,
        invoice_number: f.invoice_number || null,
        registered_by: user.id,
      }]);

      alert(`✅ Entrada registrada!\n${qtd.toFixed(0)} kg | R$ ${pKg.toFixed(4)}/kg`);
      resetEntrada(); loadInsumos();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  // Preview dos cálculos no form de entrada
  const previewEntrada = calcEntrada(formEntrada);
  const insumoAtivo = insumos.find(i => i.id === showEntradaId);
  const previewKgMs = insumoAtivo?.dry_matter_pct
    ? previewEntrada.pKg / (insumoAtivo.dry_matter_pct / 100) : null;

  return (
    <div>
      <div className={styles.subHeader}>
        <span>{insumos.length} insumo(s)</span>
        {canCreate('feed_ingredients') && (
          <button className={styles.btnAdd} onClick={() => { resetForm(); setShowEntradaId(null); setShowForm(!showForm); }}>
            {showForm && !editingId ? 'Cancelar' : '+ Novo Insumo'}
          </button>
        )}
      </div>

      {/* ── Form cadastro insumo ── */}
      {showForm && (
        <div className={styles.formCard}>
          <h2>{editingId ? '✏️ Editar Insumo' : '➕ Novo Insumo'}</h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.row}>
              <div>
                <label>Nome do Insumo *</label>
                <input type="text" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Milho, Torta de Soja, Ureia" required />
              </div>
              <div>
                <label>Empresa Fornecedora</label>
                <input type="text" value={formData.supplier}
                  onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Ex: Agropecuária São João" />
              </div>
            </div>
            <div className={styles.row3}>
              <div>
                <label>Unidade</label>
                <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                  <option value="kg">kg</option>
                  <option value="t">t (tonelada)</option>
                  <option value="L">L (litro)</option>
                  <option value="sc">sc (saco)</option>
                </select>
              </div>
              <div>
                <label>MS% — Matéria Seca</label>
                <input type="number" value={formData.dry_matter_pct}
                  onChange={e => setFormData({ ...formData, dry_matter_pct: e.target.value })}
                  placeholder="Ex: 87.50" step="0.01" min="0" max="100" />
              </div>
              <div>
                <label>Estoque mínimo (kg) — alerta</label>
                <input type="number" value={formData.stock_min_kg}
                  onChange={e => setFormData({ ...formData, stock_min_kg: e.target.value })}
                  placeholder="Ex: 5000" step="1" min="0" />
              </div>
            </div>
            <div>
              <label>Observações</label>
              <input type="text" value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Opcional..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box' }} />
            </div>
            <div className={styles.formAcoes}>
              <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
              <button type="submit" disabled={loading}>{loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tabela de insumos ── */}
      {loading ? <p className={styles.vazio}>Carregando...</p> : insumos.length === 0 ? (
        <div className={styles.vazio}><p>Nenhum insumo cadastrado.</p></div>
      ) : (
        <div className={styles.listaInsumos}>
          {insumos.map(ins => {
            const estoqueBaixo = ins.stock_min_kg > 0 && ins.stock_qty_kg < ins.stock_min_kg;
            const estoqueNeg = ins.stock_qty_kg < 0;
            return (
              <div key={ins.id} className={`${styles.insumoCard} ${estoqueNeg ? styles.insumoCardNeg : estoqueBaixo ? styles.insumoCardBaixo : ''}`}>

                {/* Cabeçalho do card */}
                <div className={styles.insumoCardHeader}>
                  <div className={styles.insumoCardLeft}>
                    <strong className={styles.insumoNome}>{ins.name}</strong>
                    {ins.supplier && <span className={styles.insumoSupplier}>🏭 {ins.supplier}</span>}
                  </div>
                  <div className={styles.insumoCardRight}>
                    {/* Estoque */}
                    <div className={`${styles.estoqueTag} ${estoqueNeg ? styles.estoqueNeg : estoqueBaixo ? styles.estoqueBaixo : styles.estoqueOk}`}>
                      📦 {fmtN(ins.stock_qty_kg, 0)} kg
                      {estoqueBaixo && !estoqueNeg && <span> ⚠️</span>}
                      {estoqueNeg && <span> ❌ negativo</span>}
                    </div>
                    {/* Botões */}
                    <div className={styles.acoes}>
                      <button className={styles.btnEntrada}
                        onClick={() => { setShowEntradaId(showEntradaId === ins.id ? null : ins.id); setShowForm(false); }}>
                        {showEntradaId === ins.id ? 'Fechar' : '📥 Entrada'}
                      </button>
                      <button className={styles.btnHistorico} onClick={() => loadMovimentos(ins.id)}>
                        {showMovId === ins.id ? 'Fechar' : '📋 Movimentos'}
                      </button>
                      {canEdit('feed_ingredients') && (
                        <button className={styles.btnEditar} onClick={() => handleToggleEdit(ins.id, ins)}>✏️ Editar</button>
                      )}
                      {canDelete('feed_ingredients') && (
                        <button className={styles.btnDeletarIns} onClick={() => handleDeleteInsumo(ins)}>🗑 Deletar</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Indicadores de preço e MS */}
                <div className={styles.insumoIndicadores}>
                  <div className={styles.indicItem}>
                    <span>MS%</span>
                    <strong>{ins.dry_matter_pct ? fmtN(ins.dry_matter_pct, 2) + '%' : '—'}</strong>
                  </div>
                  <div className={styles.indicItem}>
                    <span>Preço/ton</span>
                    <strong>{ins.price_per_ton ? fmtR(ins.price_per_ton, 2) : '—'}</strong>
                  </div>
                  <div className={styles.indicItem}>
                    <span>Frete/ton</span>
                    <strong>{ins.freight_per_ton ? fmtR(ins.freight_per_ton, 2) : 'R$ 0,00'}</strong>
                  </div>
                  <div className={styles.indicItem}>
                    <span>Total/ton</span>
                    <strong>{ins.total_price_per_ton ? fmtR(ins.total_price_per_ton, 2) : '—'}</strong>
                  </div>
                  <div className={`${styles.indicItem} ${styles.indicDestaque}`}>
                    <span>Preço/kg MN</span>
                    <strong>{ins.price_per_kg ? fmtR(ins.price_per_kg, 4) : '—'}</strong>
                  </div>
                  <div className={`${styles.indicItem} ${styles.indicDestaqueMs}`}>
                    <span>Preço/kg MS</span>
                    <strong>{ins.price_per_kg_ms ? fmtR(ins.price_per_kg_ms, 4) : '—'}</strong>
                  </div>
                  <div className={styles.indicItem}>
                    <span>Estoque mín.</span>
                    <strong>{ins.stock_min_kg ? fmtN(ins.stock_min_kg, 0) + ' kg' : '—'}</strong>
                  </div>
                </div>

                {/* ── Painel de edição inline ── */}
                {showEditId === ins.id && (
                  <div className={styles.entradaPanel}>
                    <div className={styles.entradaPanelTitle}>✏️ Editar Insumo — {ins.name}</div>
                    <form onSubmit={handleSubmit}>
                      <div className={styles.row}>
                        <div>
                          <label>Nome do Insumo *</label>
                          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div>
                          <label>Empresa Fornecedora</label>
                          <input type="text" value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} placeholder="Ex: Agropecuária São João" />
                        </div>
                      </div>
                      <div className={styles.row3}>
                        <div>
                          <label>Unidade</label>
                          <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                            <option value="kg">kg</option>
                            <option value="t">t (tonelada)</option>
                            <option value="L">L (litro)</option>
                            <option value="sc">sc (saco)</option>
                          </select>
                        </div>
                        <div>
                          <label>MS% — Matéria Seca</label>
                          <input type="number" value={formData.dry_matter_pct} onChange={e => setFormData({ ...formData, dry_matter_pct: e.target.value })} placeholder="Ex: 87.50" step="0.01" min="0" max="100" />
                        </div>
                        <div>
                          <label>Estoque mínimo (kg)</label>
                          <input type="number" value={formData.stock_min_kg} onChange={e => setFormData({ ...formData, stock_min_kg: e.target.value })} placeholder="Ex: 5000" step="1" min="0" />
                        </div>
                      </div>
                      <div>
                        <label>Observações</label>
                        <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Opcional..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box' }} />
                      </div>
                      <div className={styles.entradaBtns} style={{ marginTop: 12 }}>
                        <button type="button" className={styles.btnCancelar} onClick={() => { setShowEditId(null); setEditingId(null); }}>Cancelar</button>
                        <button type="submit" disabled={loading}>{loading ? 'Salvando...' : '✅ Salvar Alterações'}</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ── Painel de entrada de estoque ── */}
                {showEntradaId === ins.id && (
                  <div className={styles.entradaPanel}>
                    <div className={styles.entradaPanelTitle}>📥 Registrar Entrada de Estoque — {ins.name}</div>
                    <div className={styles.row3}>
                      <div>
                        <label>Data de Entrada *</label>
                        <input type="date" value={formEntrada.entry_date}
                          onChange={e => setFormEntrada({ ...formEntrada, entry_date: e.target.value })} />
                      </div>
                      <div>
                        <label>Fornecedor (desta entrada)</label>
                        <input type="text" value={formEntrada.supplier}
                          onChange={e => setFormEntrada({ ...formEntrada, supplier: e.target.value })}
                          placeholder={ins.supplier || 'Fornecedor...'} />
                      </div>
                      <div>
                        <label>Nota Fiscal / Referência</label>
                        <input type="text" value={formEntrada.invoice_number}
                          onChange={e => setFormEntrada({ ...formEntrada, invoice_number: e.target.value })}
                          placeholder="NF 00001..." />
                      </div>
                    </div>
                    <div className={styles.row3}>
                      <div>
                        <label>Quantidade recebida (kg) *</label>
                        <input type="number" value={formEntrada.quantity_kg_received}
                          onChange={e => setFormEntrada({ ...formEntrada, quantity_kg_received: e.target.value })}
                          placeholder="Ex: 10000" step="0.001" min="0" />
                      </div>
                      <div>
                        <label>Preço por tonelada (R$) *</label>
                        <input type="number" value={formEntrada.price_per_ton}
                          onChange={e => setFormEntrada({ ...formEntrada, price_per_ton: e.target.value })}
                          placeholder="Ex: 850.00" step="0.01" min="0" />
                      </div>
                      <div>
                        <label>Frete por tonelada (R$)</label>
                        <input type="number" value={formEntrada.freight_per_ton}
                          onChange={e => setFormEntrada({ ...formEntrada, freight_per_ton: e.target.value })}
                          placeholder="Ex: 30.00" step="0.01" min="0" />
                      </div>
                    </div>

                    {/* Preview calculado */}
                    {previewEntrada.pKg > 0 && (
                      <div className={styles.entradaPreview}>
                        <div className={styles.previewItem}>
                          <span>Total/ton (com frete)</span>
                          <strong>{fmtR(previewEntrada.totalTon, 2)}/ton</strong>
                        </div>
                        <div className={`${styles.previewItem} ${styles.previewDestaque}`}>
                          <span>Preço/kg MN</span>
                          <strong>{fmtR(previewEntrada.pKg, 4)}/kg</strong>
                        </div>
                        {previewKgMs && (
                          <div className={`${styles.previewItem} ${styles.previewDestaqueMs}`}>
                            <span>Preço/kg MS ({fmtN(ins.dry_matter_pct, 1)}%)</span>
                            <strong>{fmtR(previewKgMs, 4)}/kg MS</strong>
                          </div>
                        )}
                        {formEntrada.quantity_kg_received && (
                          <div className={styles.previewItem}>
                            <span>Total da nota</span>
                            <strong>{fmtR((parseFloat(formEntrada.quantity_kg_received) / 1000) * previewEntrada.totalTon, 2)}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.entradaBtns}>
                      <button className={styles.btnCancelar} onClick={resetEntrada}>Cancelar</button>
                      <button className={styles.btnSalvarEntrada} onClick={() => handleEntrada(ins)} disabled={loading}>
                        {loading ? 'Salvando...' : '✅ Confirmar Entrada'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Painel de movimentações ── */}
                {showMovId === ins.id && (
                  <div className={styles.movPanel}>
                    <div className={styles.movPanelTitle}>📋 Movimentações — {ins.name}</div>
                    {movimentos.length === 0 ? (
                      <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Nenhuma movimentação registrada.</p>
                    ) : (
                      <table className={styles.tabelaMov}>
                        <thead><tr>
                          <th>Data</th><th>Tipo</th><th>Quantidade</th><th>Observação</th><th>Ações</th>
                        </tr></thead>
                        <tbody>
                          {movimentos.map(m => {
                            const isEntrada = m.movement_type === 'entrada';
                            const isTrato    = m.movement_type === 'baixa_trato';
                                    const isAjuste   = m.movement_type === 'ajuste_batida';
                            const isEditing = editingMovId === m.id;
                            // preview de cálculo no form de edição
                            const ePTon = parseFloat(formEditMov.price_per_ton) || 0;
                            const eFrete = parseFloat(formEditMov.freight_per_ton) || 0;
                            const eTotalTon = ePTon + eFrete;
                            const ePKg = eTotalTon / 1000;
                            const ePKgMs = ePKg && ins.dry_matter_pct ? ePKg / (ins.dry_matter_pct / 100) : null;
                            return (
                              <>
                                <tr key={m.id}>
                                  <td>{new Date(m.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                  <td>
                                    <span className={isEntrada ? styles.movBadgeEntrada : isTrato ? styles.movBadgeBaixa : styles.movBadgeAjuste}>
                                      {isEntrada ? '📥 Entrada' : isTrato ? '📤 Trato' : '🔧 Ajuste'}
                                    </span>
                                  </td>
                                  <td className={isEntrada ? styles.movQtdPos : styles.movQtdNeg}>
                                    {isEntrada ? '+' : ''}{fmtN(m.quantity_kg, 2)} kg
                                  </td>
                                  <td style={{ fontSize: '0.82rem', color: '#666' }}>{m.notes || '—'}</td>
                                  <td>
                                    {!isTrato ? (
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className={isEditing ? styles.btnSalvarMov : styles.btnEditarMov}
                                          onClick={() => isEditing ? setEditingMovId(null) : handleEditMov(m)}
                                          title={isEditing ? 'Fechar' : 'Editar'}>
                                          {isEditing ? '✕' : '✏️'}
                                        </button>
                                        {!isEditing && (
                                          <button className={styles.btnDeletarMov} onClick={() => handleDeleteMov(m, ins)} title="Deletar">🗑</button>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.72rem', color: '#bbb' }}>auto</span>
                                    )}
                                  </td>
                                </tr>

                                {/* Painel de edição expandido */}
                                {isEditing && (
                                  <tr key={m.id + '_edit'}>
                                    <td colSpan={5} style={{ padding: 0, background: '#fffde7', borderBottom: '2px solid #ffe082' }}>
                                      <div className={styles.editMovPanel}>
                                        <div className={styles.editMovTitle}>✏️ Editando entrada de {fmtN(Math.abs(m.quantity_kg), 2)} kg</div>
                                        <div className={styles.row3}>
                                          <div>
                                            <label>Data</label>
                                            <input type="date" value={formEditMov.entry_date}
                                              onChange={e => setFormEditMov({ ...formEditMov, entry_date: e.target.value })} />
                                          </div>
                                          <div>
                                            <label>Quantidade (kg) *</label>
                                            <input type="number" value={formEditMov.quantity_kg}
                                              onChange={e => setFormEditMov({ ...formEditMov, quantity_kg: e.target.value })}
                                              step="0.001" min="0" placeholder="Ex: 10000" />
                                          </div>
                                          <div>
                                            <label>Observação</label>
                                            <input type="text" value={formEditMov.notes}
                                              onChange={e => setFormEditMov({ ...formEditMov, notes: e.target.value })}
                                              placeholder="Opcional..." />
                                          </div>
                                        </div>
                                        <div className={styles.row}>
                                          <div>
                                            <label>Novo preço/ton (R$) — deixe vazio para não alterar</label>
                                            <input type="number" value={formEditMov.price_per_ton}
                                              onChange={e => setFormEditMov({ ...formEditMov, price_per_ton: e.target.value })}
                                              step="0.01" min="0" placeholder={`Atual: ${fmtR(ins.price_per_ton, 2)}`} />
                                          </div>
                                          <div>
                                            <label>Frete/ton (R$)</label>
                                            <input type="number" value={formEditMov.freight_per_ton}
                                              onChange={e => setFormEditMov({ ...formEditMov, freight_per_ton: e.target.value })}
                                              step="0.01" min="0" placeholder={`Atual: ${fmtR(ins.freight_per_ton, 2)}`} />
                                          </div>
                                        </div>
                                        {ePKg > 0 && (
                                          <div className={styles.entradaPreview} style={{ marginBottom: '0.8rem' }}>
                                            <div className={styles.previewItem}><span>Total/ton</span><strong>{fmtR(eTotalTon, 2)}</strong></div>
                                            <div className={`${styles.previewItem} ${styles.previewDestaque}`}><span>Preço/kg MN</span><strong>{fmtR(ePKg, 4)}</strong></div>
                                            {ePKgMs && <div className={`${styles.previewItem} ${styles.previewDestaqueMs}`}><span>Preço/kg MS</span><strong>{fmtR(ePKgMs, 4)}</strong></div>}
                                          </div>
                                        )}
                                        <div className={styles.entradaBtns}>
                                          <button className={styles.btnCancelar} onClick={() => setEditingMovId(null)}>Cancelar</button>
                                          <button className={styles.btnSalvarEntrada} onClick={() => handleSaveMov(m, ins)} disabled={loading}>
                                            {loading ? 'Salvando...' : '✅ Salvar Correção'}
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ABA: COMPOSIÇÕES ───────────────────────────────────────
function AbaComposicoes({ currentFarm, user, canCreate, canEdit, canDelete }) {
  const [racoes, setRacoes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [composicoes, setComposicoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedComp, setExpandedComp] = useState(null);
  const [editingCompId, setEditingCompId] = useState(null);
  const [formComp, setFormComp] = useState({ feed_type_id: '', base_qty_kg: '1000', effective_date: hoje(), notes: '' });
  const [itens, setItens] = useState([{ ingredient_id: '', proportion_pct: '', quantity_kg: '', price_per_unit: '' }]);

  useEffect(() => { loadDados(); }, []);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: r }, { data: i }, { data: c, error: ce }] = await Promise.all([
        supabase.from('feed_types').select('id, name, dry_matter_pct').eq('farm_id', currentFarm.id).order('name'),
        supabase.from('feed_ingredients').select('id, name, unit, current_price, price_per_kg, dry_matter_pct').eq('farm_id', currentFarm.id).eq('active', true).order('name'),
        supabase.from('feed_compositions')
          .select('*, feed_types!feed_compositions_feed_type_id_fkey(name), feed_composition_items(*, feed_ingredients(name, unit, dry_matter_pct))')
          .eq('farm_id', currentFarm.id).order('created_at', { ascending: false }).limit(50),
      ]);
      if (ce) throw ce;
      setRacoes(r || []); setInsumos(i || []); setComposicoes(c || []);
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const addItem = () => setItens([...itens, { ingredient_id: '', proportion_pct: '', quantity_kg: '', price_per_unit: '' }]);
  const removeItem = (idx) => setItens(itens.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) => {
    const novos = [...itens];
    novos[idx] = { ...novos[idx], [field]: value };
    if (field === 'ingredient_id' && value) {
      const ing = insumos.find(i => i.id === value);
      if (ing) novos[idx].price_per_unit = String(ing.price_per_kg || ing.current_price || '');
    }
    if (field === 'proportion_pct' && value && formComp.base_qty_kg)
      novos[idx].quantity_kg = ((parseFloat(value) / 100) * parseFloat(formComp.base_qty_kg)).toFixed(3);
    if (field === 'quantity_kg' && value && formComp.base_qty_kg)
      novos[idx].proportion_pct = ((parseFloat(value) / parseFloat(formComp.base_qty_kg)) * 100).toFixed(4);
    setItens(novos);
  };

  const totalQty = itens.reduce((acc, i) => acc + (parseFloat(i.quantity_kg) || 0), 0);
  const totalCusto = itens.reduce((acc, i) => acc + ((parseFloat(i.quantity_kg) || 0) * (parseFloat(i.price_per_unit) || 0)), 0);
  const totalPct = itens.reduce((acc, i) => acc + (parseFloat(i.proportion_pct) || 0), 0);
  const custoPorKg = formComp.base_qty_kg && parseFloat(formComp.base_qty_kg) > 0 ? totalCusto / parseFloat(formComp.base_qty_kg) : 0;

  // MS% ponderada da composição atual
  const msPonderada = itens.reduce((acc, item) => {
    const ing = insumos.find(i => i.id === item.ingredient_id);
    const pct = parseFloat(item.proportion_pct) || 0;
    const ms = ing?.dry_matter_pct ? parseFloat(ing.dry_matter_pct) : null;
    return ms ? acc + (pct * ms / 100) : acc;
  }, 0);


  // Corrige preços da composição vigente com os valores atuais dos insumos
  const handleCorrigirPrecos = async (c) => {
    const nomeRacao = c.feed_types?.name || 'esta ração';
    if (!confirm(`Corrigir preços da composição vigente de "${nomeRacao}" usando os valores atuais dos insumos?\n\nUse apenas para corrigir erros de cadastro. Versões históricas não serão alteradas.`)) return;
    setLoading(true);
    try {
      const ingredientIds = (c.feed_composition_items || []).map(i => i.ingredient_id);
      const { data: insumosAtuais, error: errIns } = await supabase
        .from('feed_ingredients')
        .select('id, price_per_kg, current_price')
        .in('id', ingredientIds);
      if (errIns) throw errIns;

      const precoMap = {};
      (insumosAtuais || []).forEach(i => { precoMap[i.id] = i.price_per_kg || i.current_price || 0; });

      let totalCustoNovo = 0;
      for (const item of (c.feed_composition_items || [])) {
        const novoPreco = precoMap[item.ingredient_id] || Number(item.price_per_unit);
        const novoCusto = Number(item.quantity_kg) * novoPreco;
        totalCustoNovo += novoCusto;
        const { error } = await supabase
          .from('feed_composition_items')
          .update({ price_per_unit: parseFloat(novoPreco.toFixed(4)), total_cost: parseFloat(novoCusto.toFixed(2)) })
          .eq('id', item.id);
        if (error) throw error;
      }

      const novoCustoPorKg = totalCustoNovo / Number(c.base_qty_kg);
      await supabase.from('feed_compositions')
        .update({ cost_per_kg: parseFloat(novoCustoPorKg.toFixed(4)), total_cost: parseFloat(totalCustoNovo.toFixed(2)) })
        .eq('id', c.id);
      await supabase.from('feed_types')
        .update({ cost_per_kg: novoCustoPorKg })
        .eq('id', c.feed_type_id);

      alert('Precos corrigidos! Novo custo/kg: R$ ' + novoCustoPorKg.toFixed(4));
      loadDados();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormComp({ feed_type_id: '', base_qty_kg: '1000', effective_date: hoje(), notes: '' });
    setItens([{ ingredient_id: '', proportion_pct: '', quantity_kg: '', price_per_unit: '' }]);
    setShowForm(false); setEditingCompId(null);
  };

  const handleEditComp = (c) => {
    setFormComp({ feed_type_id: c.feed_type_id, base_qty_kg: String(c.base_qty_kg), effective_date: c.effective_date, notes: c.notes || '' });
    const itensCarregados = (c.feed_composition_items || []).map(item => ({
      id: item.id, ingredient_id: item.ingredient_id,
      proportion_pct: String(item.proportion_pct), quantity_kg: String(item.quantity_kg), price_per_unit: String(item.price_per_unit),
    }));
    setItens(itensCarregados.length > 0 ? itensCarregados : [{ ingredient_id: '', proportion_pct: '', quantity_kg: '', price_per_unit: '' }]);
    setEditingCompId(c.id); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitComp = async (e) => {
    e.preventDefault();
    if (!formComp.feed_type_id) return alert('Selecione a ração.');
    const itensValidos = itens.filter(i => i.ingredient_id && i.quantity_kg && i.price_per_unit);
    if (itensValidos.length === 0) return alert('Adicione pelo menos um ingrediente.');
    setLoading(true);
    try {
      const totalCustoCalc = itensValidos.reduce((acc, i) => acc + (parseFloat(i.quantity_kg) * parseFloat(i.price_per_unit)), 0);
      const custoPorKgCalc = totalCustoCalc / parseFloat(formComp.base_qty_kg);

      if (editingCompId) {
        const { error: errComp } = await supabase.from('feed_compositions').update({
          feed_type_id: formComp.feed_type_id, base_qty_kg: parseFloat(formComp.base_qty_kg),
          cost_per_kg: parseFloat(custoPorKgCalc.toFixed(4)), total_cost: parseFloat(totalCustoCalc.toFixed(2)),
          effective_date: formComp.effective_date, notes: formComp.notes || null,
        }).eq('id', editingCompId);
        if (errComp) throw errComp;
        await supabase.from('feed_composition_items').delete().eq('composition_id', editingCompId);
        const { error: errItems } = await supabase.from('feed_composition_items').insert(
          itensValidos.map(i => ({
            composition_id: editingCompId, ingredient_id: i.ingredient_id, farm_id: currentFarm.id,
            proportion_pct: parseFloat(parseFloat(i.proportion_pct).toFixed(4)),
            quantity_kg: parseFloat(parseFloat(i.quantity_kg).toFixed(3)),
            price_per_unit: parseFloat(parseFloat(i.price_per_unit).toFixed(4)),
            total_cost: parseFloat((parseFloat(i.quantity_kg) * parseFloat(i.price_per_unit)).toFixed(2)),
          }))
        );
        if (errItems) throw errItems;
        alert('Composição atualizada! Custo/kg: ' + fmtR(custoPorKgCalc, 4));
      } else {
        const { data: versoes } = await supabase.from('feed_compositions').select('version')
          .eq('feed_type_id', formComp.feed_type_id).order('version', { ascending: false }).limit(1);
        const proximaVersao = versoes?.length > 0 ? versoes[0].version + 1 : 1;
        const { data: novaComp, error: errComp } = await supabase.from('feed_compositions').insert([{
          feed_type_id: formComp.feed_type_id, farm_id: currentFarm.id, version: proximaVersao,
          base_qty_kg: parseFloat(formComp.base_qty_kg), cost_per_kg: parseFloat(custoPorKgCalc.toFixed(4)),
          total_cost: parseFloat(totalCustoCalc.toFixed(2)), effective_date: formComp.effective_date,
          is_current: true, notes: formComp.notes || null, registered_by: user.id,
        }]).select().single();
        if (errComp) throw errComp;
        const { error: errItems } = await supabase.from('feed_composition_items').insert(
          itensValidos.map(i => ({
            composition_id: novaComp.id, ingredient_id: i.ingredient_id, farm_id: currentFarm.id,
            proportion_pct: parseFloat(parseFloat(i.proportion_pct).toFixed(4)),
            quantity_kg: parseFloat(parseFloat(i.quantity_kg).toFixed(3)),
            price_per_unit: parseFloat(parseFloat(i.price_per_unit).toFixed(4)),
            total_cost: parseFloat((parseFloat(i.quantity_kg) * parseFloat(i.price_per_unit)).toFixed(2)),
          }))
        );
        if (errItems) throw errItems;
        // Atualiza MS% e cost_per_kg na ração
        await supabase.from('feed_types').update({ cost_per_kg: custoPorKgCalc, dry_matter_pct: msPonderada > 0 ? parseFloat(msPonderada.toFixed(2)) : null }).eq('id', formComp.feed_type_id);
        alert(`Composição v${proximaVersao} salva!\nCusto/kg: ${fmtR(custoPorKgCalc, 4)}\nMS% calculada: ${fmtN(msPonderada, 2)}%`);
      }
      resetForm(); loadDados();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className={styles.subHeader}>
        <span>{composicoes.length} composição(ões)</span>
        {canCreate('feed_compositions') && (
          <button className={styles.btnAdd} onClick={() => showForm ? resetForm() : setShowForm(true)}>
            {showForm ? 'Cancelar' : '+ Nova Composição'}
          </button>
        )}
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h2>{editingCompId ? '✏️ Editar Composição' : 'Nova Composição de Ração'}</h2>
          <form onSubmit={handleSubmitComp}>
            <div className={styles.row3}>
              <div>
                <label>Ração *</label>
                <select value={formComp.feed_type_id} onChange={e => setFormComp({ ...formComp, feed_type_id: e.target.value })} required>
                  <option value="">Selecione a ração</option>
                  {racoes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label>Base de cálculo (kg)</label>
                <input type="number" value={formComp.base_qty_kg} onChange={e => setFormComp({ ...formComp, base_qty_kg: e.target.value })} placeholder="1000" min="1" step="0.1" />
              </div>
              <div>
                <label>Data de Vigência</label>
                <input type="date" value={formComp.effective_date} onChange={e => setFormComp({ ...formComp, effective_date: e.target.value })} />
              </div>
            </div>

            <div className={styles.ingredientesBox}>
              <div className={styles.ingredientesHeader}>
                <strong>Ingredientes</strong>
                <button type="button" className={styles.btnAddItem} onClick={addItem}>+ Adicionar</button>
              </div>
              <div className={styles.tabelaWrapper}>
                <table className={styles.tabelaItens}>
                  <thead><tr>
                    <th>Ingrediente</th><th>MS%</th><th>Proporção (%)</th>
                    <th>Qtd ({formComp.base_qty_kg || '?'} kg)</th><th>Preço R$/kg</th><th>Custo</th><th></th>
                  </tr></thead>
                  <tbody>
                    {itens.map((item, idx) => {
                      const ing = insumos.find(i => i.id === item.ingredient_id);
                      const custoItem = (parseFloat(item.quantity_kg) || 0) * (parseFloat(item.price_per_unit) || 0);
                      return (
                        <tr key={idx}>
                          <td>
                            <select value={item.ingredient_id} onChange={e => updateItem(idx, 'ingredient_id', e.target.value)}>
                              <option value="">Selecione...</option>
                              {insumos.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: '#1565c0', textAlign: 'center' }}>
                            {ing?.dry_matter_pct ? fmtN(ing.dry_matter_pct, 1) + '%' : '—'}
                          </td>
                          <td><input type="number" value={item.proportion_pct} onChange={e => updateItem(idx, 'proportion_pct', e.target.value)} placeholder="%" step="0.0001" min="0" max="100" className={styles.inputSmall} /></td>
                          <td><input type="number" value={item.quantity_kg} onChange={e => updateItem(idx, 'quantity_kg', e.target.value)} placeholder="kg" step="0.001" min="0" className={styles.inputSmall} /></td>
                          <td><input type="number" value={item.price_per_unit} onChange={e => updateItem(idx, 'price_per_unit', e.target.value)} placeholder="R$/kg" step="0.0001" min="0" className={styles.inputSmall} /></td>
                          <td className={styles.custoItem}>{custoItem > 0 ? fmtR(custoItem, 2) : '—'}</td>
                          <td>{itens.length > 1 && <button type="button" className={styles.btnRemItem} onClick={() => removeItem(idx)}>✕</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={styles.totalRow}>
                      <td><strong>TOTAL</strong></td>
                      <td><span className={styles.badgeBlue}>{fmtN(msPonderada, 2)}% MS</span></td>
                      <td><strong className={Math.abs(totalPct - 100) < 0.5 ? styles.pctOk : styles.pctWarn}>{totalPct.toFixed(2)}%</strong></td>
                      <td><strong>{totalQty.toFixed(1)} kg</strong></td>
                      <td>—</td>
                      <td><strong>{fmtR(totalCusto, 2)}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {totalCusto > 0 && (
                <div className={styles.previewCusto}>
                  <div className={styles.previewItem}>
                    <span>Custo total ({formComp.base_qty_kg} kg)</span>
                    <strong>{fmtR(totalCusto, 2)}</strong>
                  </div>
                  <div className={styles.previewItem}>
                    <span>Custo/kg MN</span>
                    <strong className={styles.custoDestaque}>{fmtR(custoPorKg, 4)}/kg</strong>
                  </div>
                  <div className={styles.previewItem}>
                    <span>MS% ponderada</span>
                    <strong>{fmtN(msPonderada, 2)}%</strong>
                  </div>
                  {msPonderada > 0 && (
                    <div className={styles.previewItem}>
                      <span>Custo/kg MS</span>
                      <strong>{fmtR(custoPorKg / (msPonderada / 100), 4)}/kg MS</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: '#444', display: 'block', marginBottom: '4px' }}>Observações</label>
              <input type="text" value={formComp.notes} onChange={e => setFormComp({ ...formComp, notes: e.target.value })}
                placeholder="Ex: Reajuste de preço do milho — fev/2026"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box' }} />
            </div>

            <div className={styles.formAcoes}>
              <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
              <button type="submit" disabled={loading}>{loading ? 'Salvando...' : editingCompId ? 'Salvar Alterações' : 'Salvar Composição'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className={styles.vazio}>Carregando...</p> : composicoes.length === 0 ? (
        <div className={styles.vazio}><p>Nenhuma composição cadastrada.</p></div>
      ) : (
        <div className={styles.listaComposicoes}>
          {composicoes.map(c => (
            <div key={c.id} className={c.is_current ? styles.compCardAtiva : styles.compCardAntiga}>
              <div className={styles.compCardHeader} onClick={() => setExpandedComp(expandedComp === c.id ? null : c.id)}>
                <div className={styles.compCardLeft}>
                  <strong>{c.feed_types?.name || '—'}</strong>
                  <span className={c.is_current ? styles.badgeGreen : styles.badgeGray}>{c.is_current ? 'Vigente' : 'Histórico'} — v{c.version}</span>
                </div>
                <div className={styles.compCardRight}>
                  <span>{new Date(c.effective_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  <strong className={styles.custoDestaque}>{fmtR(c.cost_per_kg, 4)}/kg</strong>
                  {canEdit('feed_compositions') && c.is_current && (
                    <button className={styles.btnCorrigir} onClick={e => { e.stopPropagation(); handleCorrigirPrecos(c); }}
                      title="Corrige os preços desta composição com os valores atuais dos insumos (use para erros de cadastro)">
                      🔧 Corrigir preços
                    </button>
                  )}
                  {canEdit('feed_compositions') && (
                    <button className={styles.btnEditar} onClick={e => { e.stopPropagation(); handleEditComp(c); }}>Editar</button>
                  )}
                  {canDelete('feed_compositions') && (
                    <button className={styles.btnDeletar} onClick={e => {
                      e.stopPropagation();
                      if (!confirm('Deletar composição v' + c.version + '?')) return;
                      supabase.from('feed_compositions').delete().eq('id', c.id).then(() => loadDados());
                    }}>Deletar</button>
                  )}
                  <span className={styles.expandIcon}>{expandedComp === c.id ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedComp === c.id && (() => {
                // Pré-calcula colunas derivadas por item
                const itensComMs = (c.feed_composition_items || []).map(item => {
                  const ms = item.feed_ingredients?.dry_matter_pct;
                  const msFrac = ms ? Number(ms) / 100 : null;
                  const qtdMs = msFrac != null ? Number(item.quantity_kg) * msFrac : null;
                  // Preço/kg MS = preço MN dividido pela fração de MS
                  const precoKgMs = msFrac ? Number(item.price_per_unit) / msFrac : null;
                  // Custo MS = qtdMs × precoKgMs (equivalente a total_cost, mas expresso em base MS)
                  const custoMs = qtdMs != null && precoKgMs != null ? qtdMs * precoKgMs : null;
                  return { ...item, qtdMs, precoKgMs, custoMs };
                });

                const totalQtdMs   = itensComMs.reduce((acc, i) => acc + (i.qtdMs  || 0), 0);
                const totalCustoMn = itensComMs.reduce((acc, i) => acc + Number(i.total_cost || 0), 0);
                const totalCustoMs = itensComMs.reduce((acc, i) => acc + (i.custoMs || 0), 0);
                const baseQty      = Number(c.base_qty_kg);

                // Preço/kg MN = total custo MN / quantidade MN
                const precoKgMnFinal = baseQty > 0 ? totalCustoMn / baseQty : null;
                // Preço/kg MS = total custo MN / quantidade MS
                const precoKgMsFinal = totalQtdMs > 0 ? totalCustoMn / totalQtdMs : null;
                // MS% da dieta = qtd MS / qtd MN
                const msDieta = baseQty > 0 ? (totalQtdMs / baseQty) * 100 : null;

                return (
                  <div className={styles.compCardBody}>
                    {c.notes && <p className={styles.compNotes}>{c.notes}</p>}
                    <div style={{overflowX:'auto'}}>
                    <table className={styles.tabelaComp}>
                      <thead>
                        <tr>
                          <th>Ingrediente</th>
                          <th>MS%</th>
                          <th>Proporção</th>
                          <th>Qtd MN</th>
                          <th className={styles.thMs}>Qtd MS</th>
                          <th className={styles.thPctMs}>% MS</th>
                          <th>R$/kg MN</th>
                          <th className={styles.thPrecoMs}>R$/kg MS</th>
                          <th>Custo MN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensComMs.map(item => {
                          const pctMs = totalQtdMs > 0 && item.qtdMs != null
                            ? (item.qtdMs / totalQtdMs) * 100 : null;
                          return (
                            <tr key={item.id}>
                              <td>{item.feed_ingredients?.name || '—'}</td>
                              <td style={{ color: '#1565c0', fontSize: '0.85rem' }}>
                                {item.feed_ingredients?.dry_matter_pct
                                  ? fmtN(item.feed_ingredients.dry_matter_pct, 2) + '%' : '—'}
                              </td>
                              <td>{fmtN(item.proportion_pct, 3)}%</td>
                              <td>{fmtN(item.quantity_kg, 2)} kg</td>
                              <td className={styles.tdMs}>
                                {item.qtdMs != null ? fmtN(item.qtdMs, 2) + ' kg' : <span style={{color:'#ccc'}}>—</span>}
                              </td>
                              <td className={styles.tdPctMs}>
                                {pctMs != null
                                  ? <span className={styles.badgePctMs}>{fmtN(pctMs, 2)}%</span>
                                  : <span style={{color:'#ccc'}}>—</span>}
                              </td>
                              <td>{fmtR(item.price_per_unit, 4)}</td>
                              <td className={styles.tdPrecoMs}>
                                {item.precoKgMs != null ? fmtR(item.precoKgMs, 4) : <span style={{color:'#ccc'}}>—</span>}
                              </td>
                              <td>{fmtR(item.total_cost, 2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        {/* Linha TOTAL */}
                        <tr className={styles.totalRow}>
                          <td><strong>TOTAL</strong></td>
                          <td></td>
                          <td></td>
                          <td><strong>{fmtN(baseQty, 0)} kg</strong></td>
                          <td className={styles.tdMs}><strong>{fmtN(totalQtdMs, 2)} kg</strong></td>
                          <td className={styles.tdPctMs}><strong>100%</strong></td>
                          <td></td>
                          <td className={styles.tdPrecoMs}></td>
                          <td><strong>{fmtR(totalCustoMn, 2)}</strong></td>
                        </tr>
                        {/* Linha Preço/kg */}
                        <tr className={styles.totalRowDestaque}>
                          <td><strong>Preço/kg</strong></td>
                          <td></td><td></td>
                          <td><span className={styles.labelMn}>MN</span></td>
                          <td className={styles.tdMs}><span className={styles.labelMs}>MS</span></td>
                          <td className={styles.tdPctMs}></td>
                          <td></td>
                          <td className={styles.tdPrecoMs}></td>
                          <td></td>
                        </tr>
                        <tr className={styles.totalRowPreco}>
                          <td></td><td></td><td></td>
                          <td><strong className={styles.precoMnFinal}>{fmtR(precoKgMnFinal, 4)}</strong></td>
                          <td className={styles.tdMs}><strong className={styles.precoMsFinal}>{fmtR(precoKgMsFinal, 4)}</strong></td>
                          <td className={styles.tdPctMs}></td>
                          <td></td>
                          <td className={styles.tdPrecoMs}></td>
                          <td></td>
                        </tr>
                        {/* Linha MS% da dieta */}
                        <tr className={styles.totalRowMs}>
                          <td><strong>MS% da Dieta</strong></td>
                          <td></td><td></td>
                          <td colSpan={2} className={styles.tdMs}>
                            <strong className={styles.msDietaFinal}>
                              {msDieta != null ? fmtN(msDieta, 2) + '%' : '—'}
                            </strong>
                          </td>
                          <td colSpan={4}></td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ABA: TRANSFERIR ENTRE FAZENDAS ─────────────────────────
function AbaTransferir({ currentFarm, user }) {
  const [fazendas, setFazendas]     = useState([]);
  const [origem, setOrigem]         = useState('');
  const [destino, setDestino]       = useState('');
  const [dados, setDados]           = useState(null); // { insumos, racoes, composicoes }
  const [loading, setLoading]       = useState(false);
  const [salvando, setSalvando]     = useState(false);
  const [selInsumos, setSelInsumos] = useState({});
  const [selRacoes, setSelRacoes]   = useState({});
  const [selComps, setSelComps]     = useState({});
  const [resultado, setResultado]   = useState(null);

  useEffect(() => {
    supabase.from('farms').select('id, name').then(({ data }) => setFazendas(data || []));
  }, []);

  const carregarOrigem = async () => {
    if (!origem) return;
    setLoading(true);
    setDados(null); setSelInsumos({}); setSelRacoes({}); setSelComps({}); setResultado(null);
    try {
      const [{ data: ins }, { data: rac }, { data: comp }] = await Promise.all([
        supabase.from('feed_ingredients').select('*').eq('farm_id', origem).order('name'),
        supabase.from('feed_types').select('*').eq('farm_id', origem).order('name'),
        supabase.from('feed_compositions')
          .select('*, feed_types!feed_compositions_feed_type_id_fkey(name), feed_composition_items(*, feed_ingredients(name))')
          .eq('farm_id', origem).order('created_at', { ascending: false }),
      ]);
      setDados({ insumos: ins || [], racoes: rac || [], composicoes: comp || [] });
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setLoading(false); }
  };

  const toggleAll = (map, setMap, items, idKey = 'id') => {
    const todos = items.every(i => map[i[idKey]]);
    const novo = {};
    if (!todos) items.forEach(i => { novo[i[idKey]] = true; });
    setMap(novo);
  };

  const handleTransferir = async () => {
    if (!destino) return alert('Selecione a fazenda de destino.');
    if (destino === origem) return alert('Origem e destino não podem ser iguais.');
    const insIds  = Object.keys(selInsumos).filter(k => selInsumos[k]);
    const racIds  = Object.keys(selRacoes).filter(k => selRacoes[k]);
    const compIds = Object.keys(selComps).filter(k => selComps[k]);
    if (!insIds.length && !racIds.length && !compIds.length) return alert('Selecione ao menos um item para transferir.');

    const nomeDest = fazendas.find(f => f.id === destino)?.name || destino;
    if (!confirm(`Transferir os itens selecionados para "${nomeDest}"?\n\nItens já existentes com o mesmo nome serão ignorados.`)) return;

    setSalvando(true);
    setResultado(null);
    let res = { insumos: 0, insumosPulados: 0, racoes: 0, racoesPuladas: 0, comps: 0, compsPuladas: 0 };
    try {
      // ── 1. Insumos ──
      const insSelecionados = (dados.insumos || []).filter(i => selInsumos[i.id]);
      const { data: insDestExist } = await supabase.from('feed_ingredients').select('id, name').eq('farm_id', destino);
      const insDestMap = {}; // nome.lower → id destino
      (insDestExist || []).forEach(i => { insDestMap[i.name.toLowerCase()] = i.id; });
      const insIdMap = {}; // id_origem → id_destino

      // Mapeia insumos que já existem no destino (mesmo sem selecionar)
      for (const ins of (dados.insumos || [])) {
        if (insDestMap[ins.name.toLowerCase()]) {
          insIdMap[ins.id] = insDestMap[ins.name.toLowerCase()];
        }
      }

      for (const ins of insSelecionados) {
        if (insIdMap[ins.id]) { res.insumosPulados++; continue; } // já existe
        const { id: _id, farm_id: _f, created_at: _c, updated_at: _u, ...resto } = ins;
        const { data: novo, error } = await supabase.from('feed_ingredients').insert([{ ...resto, farm_id: destino, stock_qty_kg: 0 }]).select('id').single();
        if (error) throw error;
        insIdMap[ins.id] = novo.id;
        res.insumos++;
      }

      // ── 2. Rações ──
      const racSelecionadas = (dados.racoes || []).filter(r => selRacoes[r.id]);
      const { data: racDestExist } = await supabase.from('feed_types').select('id, name').eq('farm_id', destino);
      const racDestMap = {}; // nome.lower → id destino
      (racDestExist || []).forEach(r => { racDestMap[r.name.toLowerCase()] = r.id; });
      const racIdMap = {}; // id_origem → id_destino

      // Mapeia rações que já existem no destino (mesmo sem selecionar)
      for (const rac of (dados.racoes || [])) {
        if (racDestMap[rac.name.toLowerCase()]) {
          racIdMap[rac.id] = racDestMap[rac.name.toLowerCase()];
        }
      }

      for (const rac of racSelecionadas) {
        if (racIdMap[rac.id]) { res.racoesPuladas++; continue; } // já existe
        const { id: _id, farm_id: _f, created_at: _c, updated_at: _u, ...resto } = rac;
        const { data: novo, error } = await supabase.from('feed_types').insert([{ ...resto, farm_id: destino }]).select('id').single();
        if (error) throw error;
        racIdMap[rac.id] = novo.id;
        res.racoes++;
      }

      // ── 3. Composições ──
      const compSelecionadas = (dados.composicoes || []).filter(c => selComps[c.id]);
      for (const comp of compSelecionadas) {
        const racaoDestId = racIdMap[comp.feed_type_id];
        if (!racaoDestId) { res.compsPuladas++; continue; } // ração não existe no destino

        const { id: _id, farm_id: _f, created_at: _c, updated_at: _u, feed_types: _ft, feed_composition_items: items, registered_by: _rb, ...restoComp } = comp;
        const { data: novaComp, error: errC } = await supabase.from('feed_compositions')
          .insert([{ ...restoComp, feed_type_id: racaoDestId, farm_id: destino, registered_by: user.id }]).select('id').single();
        if (errC) throw errC;

        // Itens da composição — só insere os que têm insumo mapeado
        const itensValidos = (items || []).filter(it => insIdMap[it.ingredient_id]);
        const itensSemMapa = (items || []).filter(it => !insIdMap[it.ingredient_id]);
        if (itensSemMapa.length > 0) {
          console.warn('Itens sem insumo mapeado:', itensSemMapa.map(it => it.feed_ingredients?.name));
        }

        if (itensValidos.length > 0) {
          const novosItens = itensValidos.map(it => {
            const { id: _i, composition_id: _fc, feed_composition_id: _fc2, feed_ingredients: _fi, farm_id: _fid, created_at: _ca, updated_at: _ua, ...restoIt } = it;
            return { ...restoIt, composition_id: novaComp.id, ingredient_id: insIdMap[it.ingredient_id], farm_id: destino };
          });
          const { error: errIt } = await supabase.from('feed_composition_items').insert(novosItens);
          if (errIt) throw errIt;
        }

        // Atualiza is_current na ração destino
        if (comp.is_current) {
          await supabase.from('feed_compositions').update({ is_current: false })
            .eq('farm_id', destino).eq('feed_type_id', racaoDestId).neq('id', novaComp.id);
          await supabase.from('feed_compositions').update({ is_current: true }).eq('id', novaComp.id);
          await supabase.from('feed_types').update({ cost_per_kg: restoComp.cost_per_kg }).eq('id', racaoDestId);
        }
        res.comps++;
      }

      setResultado(res);
    } catch (e) { alert('Erro ao transferir: ' + e.message); }
    finally { setSalvando(false); }
  };

  const fazEndasOutras = fazendas.filter(f => f.id !== currentFarm?.id);

  return (
    <div>
      <div className={styles.subHeader}>
        <span>Copiar insumos, rações e composições entre fazendas</span>
      </div>

      {/* Seleção de fazendas */}
      <div className={styles.formCard}>
        <h2>🔄 Transferir Dados entre Fazendas</h2>
        <div className={styles.row}>
          <div>
            <label>Fazenda de Origem (possui os dados)</label>
            <select value={origem} onChange={e => { setOrigem(e.target.value); setDados(null); setResultado(null); }}>
              <option value="">Selecione a origem...</option>
              {fazendas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label>Fazenda de Destino (vai receber os dados)</label>
            <select value={destino} onChange={e => setDestino(e.target.value)}>
              <option value="">Selecione o destino...</option>
              {fazendas.filter(f => f.id !== origem).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>
        {origem && (
          <div className={styles.formAcoes} style={{ marginTop: 12 }}>
            <button className={styles.btnAdd} onClick={carregarOrigem} disabled={loading}>
              {loading ? 'Carregando...' : '🔍 Carregar Dados da Origem'}
            </button>
          </div>
        )}
      </div>

      {/* Resultado */}
      {resultado && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '1rem 1.2rem', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: 6 }}>✅ Transferência concluída!</div>
          <div style={{ fontSize: '0.88rem', color: '#444', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <span>🧪 Insumos: <strong>{resultado.insumos}</strong> copiados{resultado.insumosPulados > 0 ? `, ${resultado.insumosPulados} já existiam` : ''}</span>
            <span>🌾 Rações: <strong>{resultado.racoes}</strong> copiadas{resultado.racoesPuladas > 0 ? `, ${resultado.racoesPuladas} já existiam` : ''}</span>
            <span>📋 Composições: <strong>{resultado.comps}</strong> copiadas{resultado.compsPuladas > 0 ? `, ${resultado.compsPuladas} ignoradas (ração não disponível)` : ''}</span>
          </div>
        </div>
      )}

      {/* Seleção de itens */}
      {dados && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Insumos */}
          <div className={styles.formCard} style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong>🧪 Insumos ({dados.insumos.length})</strong>
              <button className={styles.btnHistorico} onClick={() => toggleAll(selInsumos, setSelInsumos, dados.insumos)}>
                {dados.insumos.every(i => selInsumos[i.id]) ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {dados.insumos.map(ins => (
                <label key={ins.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: selInsumos[ins.id] ? '#e8f5e9' : '#f9f9f9', border: '1px solid ' + (selInsumos[ins.id] ? '#a5d6a7' : '#e0e0e0'), borderRadius: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input type="checkbox" checked={!!selInsumos[ins.id]} onChange={e => setSelInsumos(p => ({ ...p, [ins.id]: e.target.checked }))} />
                  <span>{ins.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Rações */}
          <div className={styles.formCard} style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong>🌾 Rações ({dados.racoes.length})</strong>
              <button className={styles.btnHistorico} onClick={() => toggleAll(selRacoes, setSelRacoes, dados.racoes)}>
                {dados.racoes.every(r => selRacoes[r.id]) ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {dados.racoes.map(rac => (
                <label key={rac.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: selRacoes[rac.id] ? '#e8f5e9' : '#f9f9f9', border: '1px solid ' + (selRacoes[rac.id] ? '#a5d6a7' : '#e0e0e0'), borderRadius: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input type="checkbox" checked={!!selRacoes[rac.id]} onChange={e => setSelRacoes(p => ({ ...p, [rac.id]: e.target.checked }))} />
                  <span>{rac.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Composições */}
          <div className={styles.formCard} style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <strong>📋 Composições ({dados.composicoes.length})</strong>
              <button className={styles.btnHistorico} onClick={() => toggleAll(selComps, setSelComps, dados.composicoes)}>
                {dados.composicoes.every(c => selComps[c.id]) ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#888', marginBottom: 10 }}>⚠️ A ração correspondente também deve estar selecionada (ou já existir no destino).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dados.composicoes.map(comp => (
                <label key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: selComps[comp.id] ? '#e8f5e9' : '#f9f9f9', border: '1px solid ' + (selComps[comp.id] ? '#a5d6a7' : '#e0e0e0'), borderRadius: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input type="checkbox" checked={!!selComps[comp.id]} onChange={e => setSelComps(p => ({ ...p, [comp.id]: e.target.checked }))} />
                  <span><strong>{comp.feed_types?.name || '—'}</strong></span>
                  <span style={{ color: '#888' }}>v{comp.version} · {new Date(comp.effective_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  {comp.is_current && <span style={{ background: '#e8f5e9', color: '#2e7d32', fontSize: '0.72rem', fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>Vigente</span>}
                  <span style={{ marginLeft: 'auto', color: '#1565c0', fontSize: '0.8rem' }}>
                    {(comp.feed_composition_items || []).length} ingrediente(s)
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Botão de ação */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>
              {Object.values(selInsumos).filter(Boolean).length} insumos · {Object.values(selRacoes).filter(Boolean).length} rações · {Object.values(selComps).filter(Boolean).length} composições selecionados
            </span>
            <button className={styles.btnAdd} onClick={handleTransferir} disabled={salvando}>
              {salvando ? 'Transferindo...' : '🔄 Transferir para ' + (fazendas.find(f => f.id === destino)?.name || '...')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function Racoes() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [aba, setAba] = useState('insumos');

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [user, authLoading]);
  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  const props = { currentFarm, user, canCreate, canEdit, canDelete };

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}><h1>🌾 Rações e Insumos</h1></div>
        <div className={styles.abas}>
          <button className={`${styles.aba} ${aba === 'insumos' ? styles.abaAtiva : ''}`} onClick={() => setAba('insumos')}>🧪 Insumos</button>
          <button className={`${styles.aba} ${aba === 'racoes' ? styles.abaAtiva : ''}`} onClick={() => setAba('racoes')}>🌾 Rações</button>
          <button className={`${styles.aba} ${aba === 'composicoes' ? styles.abaAtiva : ''}`} onClick={() => setAba('composicoes')}>📋 Composições</button>
          <button className={`${styles.aba} ${aba === 'transferir' ? styles.abaAtiva : ''}`} onClick={() => setAba('transferir')}>🔄 Transferir</button>
        </div>
        {aba === 'insumos' && <AbaInsumos {...props} />}
        {aba === 'racoes' && <AbaRacoes {...props} />}
        {aba === 'composicoes' && <AbaComposicoes {...props} />}
        {aba === 'transferir' && <AbaTransferir {...props} />}
      </div>
    </Layout>
  );
}
