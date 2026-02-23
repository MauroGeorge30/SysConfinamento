import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Racoes.module.css';

// ─── ABA: RAÇÕES ────────────────────────────────────────────
function AbaRacoes({ currentFarm, user, canCreate, canEdit, canDelete }) {
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
    if (!formData.name.trim()) return alert('Nome é obrigatório.');
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        dry_matter_pct: formData.dry_matter_pct ? parseFloat(formData.dry_matter_pct) : null,
        farm_id: currentFarm.id,
      };
      if (editingId) {
        const { error } = await supabase.from('feed_types').update(payload).eq('id', editingId);
        if (error) throw error;
        alert('Ração atualizada!');
      } else {
        const { error } = await supabase.from('feed_types').insert([payload]);
        if (error) throw error;
        alert('Ração cadastrada! Agora cadastre a composição na aba Composições.');
      }
      resetForm(); loadRacoes();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deletar esta ração e todas as suas composições?')) return;
    try {
      const { error } = await supabase.from('feed_types').delete().eq('id', id);
      if (error) throw error;
      loadRacoes();
    } catch (err) { alert('Erro: ' + err.message); }
  };

  return (
    <div>
      <div className={styles.subHeader}>
        <span>{racoes.length} ração(ões) cadastrada(s)</span>
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
                <input type="text" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Premix Terminação, Silagem de Milho" required />
              </div>
              <div>
                <label>Matéria Seca — MS% (para cálculo de CMS)</label>
                <input type="number" value={formData.dry_matter_pct}
                  onChange={(e) => setFormData({ ...formData, dry_matter_pct: e.target.value })}
                  placeholder="Ex: 54.0" step="0.1" min="0" max="100" />
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
              {racoes.map((r) => {
                const comp = r.feed_compositions && r.feed_compositions.find(c => c.is_current);
                const custoMN = r.cost_per_kg ? Number(r.cost_per_kg) : null;
                const custoMS = custoMN && r.dry_matter_pct ? custoMN / (Number(r.dry_matter_pct) / 100) : null;
                return (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.dry_matter_pct
                      ? <span className={styles.badgeBlue}>{Number(r.dry_matter_pct).toFixed(1)}%</span>
                      : <span className={styles.badgeWarn}>N/I</span>}
                    </td>
                    <td>{custoMN ? <strong>R$ {custoMN.toFixed(4)}/kg</strong> : <span className={styles.semComp}>Sem composição</span>}</td>
                    <td>{custoMS ? 'R$ ' + custoMS.toFixed(4) + '/kg' : '—'}</td>
                    <td>{comp ? <span className={styles.badgeGreen}>v{comp.version}</span> : <span className={styles.semComp}>—</span>}</td>
                    <td>{comp ? new Date(comp.effective_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    {(canEdit('feed_types') || canDelete('feed_types')) && (
                      <td><div className={styles.acoes}>
                        {canEdit('feed_types') && (
                          <button className={styles.btnEditar} onClick={() => {
                            setFormData({ name: r.name, dry_matter_pct: r.dry_matter_pct || '' });
                            setEditingId(r.id); setShowForm(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}>Editar</button>
                        )}
                        {canDelete('feed_types') && (
                          <button className={styles.btnDeletar} onClick={() => handleDelete(r.id)}>Deletar</button>
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
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showHistorico, setShowHistorico] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', unit: 'kg', current_price: '', notes: '' });

  useEffect(() => { loadInsumos(); }, []);

  const loadInsumos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feed_ingredients')
        .select('*')
        .eq('farm_id', currentFarm.id)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      setInsumos(data || []);
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  const loadHistorico = async (ingredientId) => {
    if (showHistorico === ingredientId) { setShowHistorico(null); return; }
    try {
      const { data, error } = await supabase
        .from('feed_ingredient_prices')
        .select('*')
        .eq('ingredient_id', ingredientId)
        .order('effective_date', { ascending: false })
        .limit(10);
      if (error) throw error;
      setHistorico(data || []);
      setShowHistorico(ingredientId);
    } catch (err) { alert('Erro: ' + err.message); }
  };

  const resetForm = () => { setFormData({ name: '', unit: 'kg', current_price: '', notes: '' }); setEditingId(null); setShowForm(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Nome é obrigatório.');
    if (!formData.current_price || isNaN(formData.current_price)) return alert('Preço inválido.');
    setLoading(true);
    try {
      const payload = {
        name: formData.name, unit: formData.unit,
        current_price: parseFloat(formData.current_price),
        notes: formData.notes || null, farm_id: currentFarm.id,
      };
      if (editingId) {
        const { error } = await supabase.from('feed_ingredients').update(payload).eq('id', editingId);
        if (error) throw error;
        // Grava histórico manualmente ao atualizar preço
        await supabase.from('feed_ingredient_prices').insert([{
          ingredient_id: editingId, farm_id: currentFarm.id,
          price: parseFloat(formData.current_price),
          effective_date: new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0],
          registered_by: user.id,
        }]);
        alert('Insumo atualizado! Histórico de preço gravado.');
      } else {
        const { data, error } = await supabase.from('feed_ingredients').insert([payload]).select().single();
        if (error) throw error;
        await supabase.from('feed_ingredient_prices').insert([{
          ingredient_id: data.id, farm_id: currentFarm.id,
          price: parseFloat(formData.current_price),
          effective_date: new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0],
          registered_by: user.id,
        }]);
        alert('Insumo cadastrado!');
      }
      resetForm(); loadInsumos();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className={styles.subHeader}>
        <span>{insumos.length} insumo(s) cadastrado(s)</span>
        {canCreate('feed_ingredients') && (
          <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm && !editingId ? 'Cancelar' : '+ Novo Insumo'}
          </button>
        )}
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h2>{editingId ? 'Atualizar Preço do Insumo' : 'Novo Insumo'}</h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.row}>
              <div>
                <label>Nome do Insumo *</label>
                <input type="text" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Milho, Núcleo, Ureia, Torta de Soja" required />
              </div>
              <div>
                <label>Unidade</label>
                <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                  <option value="kg">kg</option>
                  <option value="L">L (litro)</option>
                  <option value="sc">sc (saco)</option>
                  <option value="t">t (tonelada)</option>
                </select>
              </div>
            </div>
            <div className={styles.row}>
              <div>
                <label>Preço Atual (R$ / {formData.unit}) *</label>
                <input type="number" value={formData.current_price}
                  onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
                  placeholder="Ex: 1.30" step="0.0001" min="0" required />
              </div>
              <div>
                <label>Observações</label>
                <input type="text" value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Opcional..." />
              </div>
            </div>
            <div className={styles.formAcoes}>
              <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
              <button type="submit" disabled={loading}>{loading ? 'Salvando...' : editingId ? 'Atualizar Preço' : 'Cadastrar'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className={styles.vazio}>Carregando...</p> : insumos.length === 0 ? (
        <div className={styles.vazio}><p>Nenhum insumo cadastrado.</p><p style={{fontSize:'0.85rem',color:'#aaa'}}>Cadastre os ingredientes antes de montar composições.</p></div>
      ) : (
        <div className={styles.tabelaWrapper}>
          <table className={styles.tabela}>
            <thead><tr><th>Insumo</th><th>Unidade</th><th>Preço Atual</th><th>Observações</th><th>Ações</th></tr></thead>
            <tbody>
              {insumos.map((ins) => (
                <>
                  <tr key={ins.id}>
                    <td><strong>{ins.name}</strong></td>
                    <td>{ins.unit}</td>
                    <td><strong className={styles.preco}>R$ {Number(ins.current_price).toFixed(4)}/{ins.unit}</strong></td>
                    <td style={{fontSize:'0.85rem',color:'#888'}}>{ins.notes || '—'}</td>
                    <td><div className={styles.acoes}>
                      <button className={styles.btnHistorico} onClick={() => loadHistorico(ins.id)}>
                        {showHistorico === ins.id ? 'Fechar' : 'Histórico'}
                      </button>
                      <button className={styles.btnEditar} onClick={() => {
                        setFormData({ name: ins.name, unit: ins.unit, current_price: ins.current_price, notes: ins.notes || '' });
                        setEditingId(ins.id); setShowForm(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}>Editar</button>
                      <button className={styles.btnDeletar} onClick={async () => {
                        if (!confirm('Deletar permanentemente o insumo "' + ins.name + '"?\n\nSe estiver em composições, use Inativar.')) return;
                        try {
                          const { error } = await supabase.from('feed_ingredients').delete().eq('id', ins.id);
                          if (error) {
                            if (error.message.includes('foreign key') || error.message.includes('violates')) {
                              if (confirm('Este insumo está em composições e não pode ser deletado.\nDeseja inativá-lo em vez disso?')) {
                                await supabase.from('feed_ingredients').update({ active: false }).eq('id', ins.id);
                              }
                            } else { alert('Erro: ' + error.message); }
                          }
                          loadInsumos();
                        } catch (err) { alert('Erro: ' + err.message); }
                      }}>Deletar</button>
                    </div></td>
                  </tr>
                  {showHistorico === ins.id && (
                    <tr key={ins.id + '_hist'}>
                      <td colSpan={5} className={styles.tdHistorico}>
                        <div className={styles.historicoBox}>
                          <strong>Histórico de preços — {ins.name}</strong>
                          {historico.length === 0 ? <p>Nenhum histórico.</p> : (
                            <table className={styles.tabelaHistorico}>
                              <thead><tr><th>Data</th><th>Preço</th></tr></thead>
                              <tbody>
                                {historico.map(h => (
                                  <tr key={h.id}>
                                    <td>{new Date(h.effective_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td>R$ {Number(h.price).toFixed(4)}/{ins.unit}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
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

  const hoje = new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [formComp, setFormComp] = useState({ feed_type_id: '', base_qty_kg: '1000', effective_date: hoje, notes: '' });
  const [itens, setItens] = useState([{ ingredient_id: '', proportion_pct: '', quantity_kg: '', price_per_unit: '' }]);

  useEffect(() => { loadDados(); }, []);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: r }, { data: i }, { data: c, error: ce }] = await Promise.all([
        supabase.from('feed_types').select('id, name, dry_matter_pct').eq('farm_id', currentFarm.id).order('name'),
        supabase.from('feed_ingredients').select('id, name, unit, current_price').eq('farm_id', currentFarm.id).eq('active', true).order('name'),
        supabase.from('feed_compositions')
          .select('*, feed_types!feed_compositions_feed_type_id_fkey(name), feed_composition_items(*, feed_ingredients(name, unit))')
          .eq('farm_id', currentFarm.id)
          .order('created_at', { ascending: false })
          .limit(50),
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
      if (ing) novos[idx].price_per_unit = String(ing.current_price);
    }
    if (field === 'proportion_pct' && value && formComp.base_qty_kg) {
      novos[idx].quantity_kg = ((parseFloat(value) / 100) * parseFloat(formComp.base_qty_kg)).toFixed(3);
    }
    if (field === 'quantity_kg' && value && formComp.base_qty_kg) {
      novos[idx].proportion_pct = ((parseFloat(value) / parseFloat(formComp.base_qty_kg)) * 100).toFixed(4);
    }
    setItens(novos);
  };

  const totalQty = itens.reduce((acc, i) => acc + (parseFloat(i.quantity_kg) || 0), 0);
  const totalCusto = itens.reduce((acc, i) => acc + ((parseFloat(i.quantity_kg) || 0) * (parseFloat(i.price_per_unit) || 0)), 0);
  const totalPct = itens.reduce((acc, i) => acc + (parseFloat(i.proportion_pct) || 0), 0);
  const custoPorKg = formComp.base_qty_kg && parseFloat(formComp.base_qty_kg) > 0
    ? totalCusto / parseFloat(formComp.base_qty_kg) : 0;

  const resetForm = () => {
    setFormComp({ feed_type_id: '', base_qty_kg: '1000', effective_date: hoje, notes: '' });
    setItens([{ ingredient_id: '', proportion_pct: '', quantity_kg: '', price_per_unit: '' }]);
    setShowForm(false);
    setEditingCompId(null);
  };

  const handleEditComp = (c) => {
    setFormComp({
      feed_type_id: c.feed_type_id,
      base_qty_kg: String(c.base_qty_kg),
      effective_date: c.effective_date,
      notes: c.notes || '',
    });
    const itensCarregados = (c.feed_composition_items || []).map(item => ({
      id: item.id,
      ingredient_id: item.ingredient_id,
      proportion_pct: String(item.proportion_pct),
      quantity_kg: String(item.quantity_kg),
      price_per_unit: String(item.price_per_unit),
    }));
    setItens(itensCarregados.length > 0 ? itensCarregados : [{ ingredient_id: '', proportion_pct: '', quantity_kg: '', price_per_unit: '' }]);
    setEditingCompId(c.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitComp = async (e) => {
    e.preventDefault();
    if (!formComp.feed_type_id) return alert('Selecione a ração.');
    const itensValidos = itens.filter(i => i.ingredient_id && i.quantity_kg && i.price_per_unit);
    if (itensValidos.length === 0) return alert('Adicione pelo menos um ingrediente completo.');
    setLoading(true);
    try {
      const totalCustoCalc = itensValidos.reduce((acc, i) => acc + (parseFloat(i.quantity_kg) * parseFloat(i.price_per_unit)), 0);
      const custoPorKgCalc = totalCustoCalc / parseFloat(formComp.base_qty_kg);

      if (editingCompId) {
        // ── MODO EDIÇÃO: atualiza composição existente ──
        const { error: errComp } = await supabase
          .from('feed_compositions')
          .update({
            feed_type_id: formComp.feed_type_id,
            base_qty_kg: parseFloat(formComp.base_qty_kg),
            cost_per_kg: parseFloat(custoPorKgCalc.toFixed(4)),
            total_cost: parseFloat(totalCustoCalc.toFixed(2)),
            effective_date: formComp.effective_date,
            notes: formComp.notes || null,
          })
          .eq('id', editingCompId);
        if (errComp) throw errComp;

        // Deleta itens antigos e reinserem os novos
        const { error: errDel } = await supabase.from('feed_composition_items').delete().eq('composition_id', editingCompId);
        if (errDel) throw errDel;

        const itemsPayload = itensValidos.map(i => ({
          composition_id: editingCompId,
          ingredient_id: i.ingredient_id,
          farm_id: currentFarm.id,
          proportion_pct: parseFloat(parseFloat(i.proportion_pct).toFixed(4)),
          quantity_kg: parseFloat(parseFloat(i.quantity_kg).toFixed(3)),
          price_per_unit: parseFloat(parseFloat(i.price_per_unit).toFixed(4)),
          total_cost: parseFloat((parseFloat(i.quantity_kg) * parseFloat(i.price_per_unit)).toFixed(2)),
        }));
        const { error: errItems } = await supabase.from('feed_composition_items').insert(itemsPayload);
        if (errItems) throw errItems;

        alert('Composição atualizada!\nNovo custo por kg: R$ ' + custoPorKgCalc.toFixed(4));
      } else {
        // ── MODO CRIAÇÃO: nova versão ──
        const { data: versoes } = await supabase
          .from('feed_compositions').select('version')
          .eq('feed_type_id', formComp.feed_type_id)
          .order('version', { ascending: false }).limit(1);
        const proximaVersao = versoes && versoes.length > 0 ? versoes[0].version + 1 : 1;

        const { data: novaComp, error: errComp } = await supabase
          .from('feed_compositions')
          .insert([{
            feed_type_id: formComp.feed_type_id,
            farm_id: currentFarm.id,
            version: proximaVersao,
            base_qty_kg: parseFloat(formComp.base_qty_kg),
            cost_per_kg: parseFloat(custoPorKgCalc.toFixed(4)),
            total_cost: parseFloat(totalCustoCalc.toFixed(2)),
            effective_date: formComp.effective_date,
            is_current: true,
            notes: formComp.notes || null,
            registered_by: user.id,
          }]).select().single();
        if (errComp) throw errComp;

        const itemsPayload = itensValidos.map(i => ({
          composition_id: novaComp.id,
          ingredient_id: i.ingredient_id,
          farm_id: currentFarm.id,
          proportion_pct: parseFloat(parseFloat(i.proportion_pct).toFixed(4)),
          quantity_kg: parseFloat(parseFloat(i.quantity_kg).toFixed(3)),
          price_per_unit: parseFloat(parseFloat(i.price_per_unit).toFixed(4)),
          total_cost: parseFloat((parseFloat(i.quantity_kg) * parseFloat(i.price_per_unit)).toFixed(2)),
        }));
        const { error: errItems } = await supabase.from('feed_composition_items').insert(itemsPayload);
        if (errItems) throw errItems;

        alert('Composição v' + proximaVersao + ' cadastrada!\nCusto por kg: R$ ' + custoPorKgCalc.toFixed(4));
      }

      resetForm(); loadDados();
    } catch (err) { alert('Erro: ' + err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className={styles.subHeader}>
        <span>{composicoes.length} composição(ões) registrada(s)</span>
        {canCreate('feed_compositions') && (
          <button className={styles.btnAdd} onClick={() => { if (showForm) { resetForm(); } else { setShowForm(true); } }}>
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
                <select value={formComp.feed_type_id}
                  onChange={(e) => setFormComp({ ...formComp, feed_type_id: e.target.value })} required>
                  <option value="">Selecione a ração</option>
                  {racoes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label>Base de cálculo (kg)</label>
                <input type="number" value={formComp.base_qty_kg}
                  onChange={(e) => setFormComp({ ...formComp, base_qty_kg: e.target.value })}
                  placeholder="Ex: 1000" min="1" step="0.1" />
              </div>
              <div>
                <label>Data de Vigência</label>
                <input type="date" value={formComp.effective_date}
                  onChange={(e) => setFormComp({ ...formComp, effective_date: e.target.value })} />
              </div>
            </div>

            <div className={styles.ingredientesBox}>
              <div className={styles.ingredientesHeader}>
                <strong>Ingredientes</strong>
                <button type="button" className={styles.btnAddItem} onClick={addItem}>+ Adicionar Ingrediente</button>
              </div>
              <div className={styles.tabelaWrapper}>
                <table className={styles.tabelaItens}>
                  <thead><tr>
                    <th>Ingrediente</th><th>Proporção (%)</th>
                    <th>Qtd ({formComp.base_qty_kg || '?'} kg base)</th>
                    <th>Preço R$/un</th><th>Custo Total</th><th></th>
                  </tr></thead>
                  <tbody>
                    {itens.map((item, idx) => {
                      const custoItem = (parseFloat(item.quantity_kg) || 0) * (parseFloat(item.price_per_unit) || 0);
                      return (
                        <tr key={idx}>
                          <td>
                            <select value={item.ingredient_id} onChange={(e) => updateItem(idx, 'ingredient_id', e.target.value)}>
                              <option value="">Selecione...</option>
                              {insumos.map(i => <option key={i.id} value={i.id}>{i.name} (R$ {Number(i.current_price).toFixed(4)}/{i.unit})</option>)}
                            </select>
                          </td>
                          <td><input type="number" value={item.proportion_pct} onChange={(e) => updateItem(idx, 'proportion_pct', e.target.value)} placeholder="%" step="0.0001" min="0" max="100" className={styles.inputSmall} /></td>
                          <td><input type="number" value={item.quantity_kg} onChange={(e) => updateItem(idx, 'quantity_kg', e.target.value)} placeholder="kg" step="0.001" min="0" className={styles.inputSmall} /></td>
                          <td><input type="number" value={item.price_per_unit} onChange={(e) => updateItem(idx, 'price_per_unit', e.target.value)} placeholder="R$" step="0.0001" min="0" className={styles.inputSmall} /></td>
                          <td className={styles.custoItem}>{custoItem > 0 ? 'R$ ' + custoItem.toFixed(2) : '—'}</td>
                          <td>{itens.length > 1 && <button type="button" className={styles.btnRemItem} onClick={() => removeItem(idx)}>✕</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={styles.totalRow}>
                      <td><strong>TOTAL</strong></td>
                      <td><strong className={Math.abs(totalPct - 100) < 0.5 ? styles.pctOk : styles.pctWarn}>{totalPct.toFixed(2)}%</strong></td>
                      <td><strong>{totalQty.toFixed(1)} kg</strong></td>
                      <td>—</td>
                      <td><strong>R$ {totalCusto.toFixed(2)}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {totalCusto > 0 && formComp.base_qty_kg && (
                <div className={styles.previewCusto}>
                  <div className={styles.previewItem}>
                    <span>Custo total da base ({formComp.base_qty_kg} kg)</span>
                    <strong>R$ {totalCusto.toFixed(2)}</strong>
                  </div>
                  <div className={styles.previewItem}>
                    <span>Custo por kg MN</span>
                    <strong className={styles.custoDestaque}>R$ {custoPorKg.toFixed(4)}/kg</strong>
                  </div>
                  {formComp.feed_type_id && (() => {
                    const r = racoes.find(r => r.id === formComp.feed_type_id);
                    if (!r || !r.dry_matter_pct) return null;
                    const custoMS = custoPorKg / (Number(r.dry_matter_pct) / 100);
                    return (
                      <div className={styles.previewItem}>
                        <span>Custo por kg MS ({r.dry_matter_pct}% MS)</span>
                        <strong>R$ {custoMS.toFixed(4)}/kg MS</strong>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div style={{marginBottom:'1rem'}}>
              <label style={{fontSize:'0.88rem',fontWeight:600,color:'#444',display:'block',marginBottom:'4px'}}>Observações</label>
              <input type="text" value={formComp.notes}
                onChange={(e) => setFormComp({ ...formComp, notes: e.target.value })}
                placeholder="Ex: Reajuste de preço do milho — fev/2026"
                style={{width:'100%',padding:'10px 12px',border:'1px solid #ddd',borderRadius:'8px',boxSizing:'border-box',fontSize:'0.95rem'}} />
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
          {composicoes.map((c) => (
            <div key={c.id} className={c.is_current ? styles.compCardAtiva : styles.compCardAntiga}>
              <div className={styles.compCardHeader} onClick={() => setExpandedComp(expandedComp === c.id ? null : c.id)}>
                <div className={styles.compCardLeft}>
                  <strong>{c.feed_types ? c.feed_types.name : '—'}</strong>
                  <span className={c.is_current ? styles.badgeGreen : styles.badgeGray}>
                    {c.is_current ? 'Vigente' : 'Histórico'} — v{c.version}
                  </span>
                </div>
                <div className={styles.compCardRight}>
                  <span>Vigência: {new Date(c.effective_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  <strong className={styles.custoDestaque}>R$ {Number(c.cost_per_kg).toFixed(4)}/kg</strong>
                  {canEdit('feed_compositions') && (
                    <button className={styles.btnEditar} onClick={(e) => { e.stopPropagation(); handleEditComp(c); }}>Editar</button>
                  )}
                  {canDelete('feed_compositions') && (
                    <button className={styles.btnDeletar} onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm('Deletar esta composição v' + c.version + '?\n' + (c.is_current ? 'ATENÇÃO: Esta é a composição vigente!' : ''))) return;
                      supabase.from('feed_compositions').delete().eq('id', c.id)
                        .then(({ error }) => { if (error) alert('Erro: ' + error.message); else loadDados(); });
                    }}>Deletar</button>
                  )}
                  <span className={styles.expandIcon}>{expandedComp === c.id ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedComp === c.id && (
                <div className={styles.compCardBody}>
                  {c.notes && <p className={styles.compNotes}>{c.notes}</p>}
                  <table className={styles.tabelaComp}>
                    <thead><tr><th>Ingrediente</th><th>Proporção</th><th>Qtd</th><th>R$/un</th><th>Custo Total</th></tr></thead>
                    <tbody>
                      {(c.feed_composition_items || []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.feed_ingredients ? item.feed_ingredients.name : '—'}</td>
                          <td>{Number(item.proportion_pct).toFixed(2)}%</td>
                          <td>{Number(item.quantity_kg).toFixed(3)} kg</td>
                          <td>R$ {Number(item.price_per_unit).toFixed(4)}</td>
                          <td>R$ {Number(item.total_cost).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className={styles.totalRow}>
                        <td><strong>TOTAL</strong></td><td></td>
                        <td><strong>{Number(c.base_qty_kg).toFixed(0)} kg</strong></td><td></td>
                        <td><strong>R$ {Number(c.total_cost).toFixed(2)}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                  <p className={styles.compResumo}>
                    Base: {Number(c.base_qty_kg).toFixed(0)} kg &nbsp;|&nbsp; Custo total: R$ {Number(c.total_cost).toFixed(2)} &nbsp;|&nbsp; <strong>Custo/kg: R$ {Number(c.cost_per_kg).toFixed(4)}</strong>
                  </p>
                </div>
              )}
            </div>
          ))}
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
  const [aba, setAba] = useState('racoes');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading]);

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  const props = { currentFarm, user, canCreate, canEdit, canDelete };

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🌾 Rações e Insumos</h1>
        </div>
        <div className={styles.abas}>
          <button className={`${styles.aba} ${aba === 'racoes' ? styles.abaAtiva : ''}`} onClick={() => setAba('racoes')}>🌾 Rações</button>
          <button className={`${styles.aba} ${aba === 'insumos' ? styles.abaAtiva : ''}`} onClick={() => setAba('insumos')}>🧪 Insumos</button>
          <button className={`${styles.aba} ${aba === 'composicoes' ? styles.abaAtiva : ''}`} onClick={() => setAba('composicoes')}>📋 Composições</button>
        </div>
        {aba === 'racoes' && <AbaRacoes {...props} />}
        {aba === 'insumos' && <AbaInsumos {...props} />}
        {aba === 'composicoes' && <AbaComposicoes {...props} />}
      </div>
    </Layout>
  );
}
