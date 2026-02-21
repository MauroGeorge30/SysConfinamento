import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/Ocorrencias.module.css';

const TIPOS = [
  { value: 'morte', label: '💀 Morte', color: '#c62828', bg: '#ffebee' },
  { value: 'refugo', label: '🔄 Refugo', color: '#6a1b9a', bg: '#f3e5f5' },
  { value: 'doenca', label: '🤒 Doença', color: '#e65100', bg: '#fff3e0' },
  { value: 'cocho', label: '🪣 Cocho', color: '#1565c0', bg: '#e3f2fd' },
  { value: 'bebedouro', label: '💧 Bebedouro', color: '#00695c', bg: '#e0f2f1' },
  { value: 'lama', label: '🟤 Lama', color: '#4e342e', bg: '#efebe9' },
  { value: 'outro', label: '📋 Outro', color: '#555', bg: '#f5f5f5' },
];

const getTipo = (value) => TIPOS.find(t => t.value === value) || TIPOS[TIPOS.length - 1];

export default function Ocorrencias() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete } = usePermissions();

  const [ocorrencias, setOcorrencias] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [baias, setBaias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroData, setFiltroData] = useState('');

  const hoje = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const [formData, setFormData] = useState({
    occurrence_date: hoje,
    lot_id: '', pen_id: '',
    type: 'morte',
    quantity: 1,
    description: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: ocData, error: ocError }, { data: lotesData }, { data: baiasData }] = await Promise.all([
        supabase.from('occurrences')
          .select('*, lots(lot_code), pens(pen_number)')
          .eq('farm_id', currentFarm.id)
          .order('occurrence_date', { ascending: false })
          .limit(300),
        supabase.from('lots').select('id, lot_code, pen_id').eq('farm_id', currentFarm.id).eq('status', 'active').order('lot_code'),
        supabase.from('pens').select('id, pen_number').eq('farm_id', currentFarm.id).eq('status', 'active').order('pen_number'),
      ]);
      if (ocError) throw ocError;
      setOcorrencias(ocData || []);
      setLotes(lotesData || []);
      setBaias(baiasData || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ occurrence_date: hoje, lot_id: '', pen_id: '', type: 'morte', quantity: 1, description: '' });
    setShowForm(false);
  };

  // Ao selecionar lote, auto-preenche baia
  const handleLoteChange = (lotId) => {
    const lote = lotes.find(l => l.id === lotId);
    setFormData(prev => ({ ...prev, lot_id: lotId, pen_id: lote?.pen_id || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.type) return alert('Selecione o tipo de ocorrência.');
    if (!formData.quantity || parseInt(formData.quantity) < 1) return alert('Quantidade inválida.');

    const qtd = parseInt(formData.quantity);
    const ehBaixa = ['morte', 'refugo'].includes(formData.type);
    const loteVinculado = lotes.find(l => l.id === formData.lot_id);

    // Validar: não pode dar baixa de mais cabeças do que tem no lote
    if (ehBaixa && loteVinculado && qtd > loteVinculado.head_count) {
      return alert(`❌ Quantidade (${qtd}) maior que cabeças disponíveis no lote ${loteVinculado.lot_code} (${loteVinculado.head_count} cab.). Verifique.`);
    }

    // Confirmar baixa com impacto
    if (ehBaixa && loteVinculado) {
      const novoTotal = loteVinculado.head_count - qtd;
      const ok = confirm(
        `⚠️ Confirmar ${qtd} ${formData.type}(s) no lote ${loteVinculado.lot_code}?\n\n` +
        `Cabeças: ${loteVinculado.head_count} → ${novoTotal}\n` +
        `A ocupação da baia será atualizada automaticamente.`
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('occurrences').insert([{
        farm_id: currentFarm.id,
        lot_id: formData.lot_id || null,
        pen_id: formData.pen_id || null,
        occurrence_date: formData.occurrence_date,
        type: formData.type,
        quantity: qtd,
        description: formData.description || null,
        registered_by: user.id,
      }]);
      if (error) throw error;
      alert(ehBaixa && loteVinculado
        ? `✅ Ocorrência registrada! Lote ${loteVinculado.lot_code} atualizado para ${loteVinculado.head_count - qtd} cabeças.`
        : '✅ Ocorrência registrada!'
      );
      resetForm();
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const oc = ocorrencias.find(o => o.id === id);
    const ehBaixa = oc && ['morte', 'refugo'].includes(oc.type);
    const msg = ehBaixa && oc.lots?.lot_code
      ? `Remover esta ocorrência?\n\nIsso vai REVERTER a baixa e devolver ${oc.quantity} cabeça(s) ao lote ${oc.lots.lot_code}.`
      : 'Remover esta ocorrência?';
    if (!confirm(msg)) return;
    try {
      const { error } = await supabase.from('occurrences').delete().eq('id', id);
      if (error) throw error;
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  const filtradas = ocorrencias.filter(o => {
    const tipoMatch = !filtroTipo || o.type === filtroTipo;
    const dataMatch = !filtroData || o.occurrence_date === filtroData;
    return tipoMatch && dataMatch;
  });

  const totalHoje = ocorrencias.filter(o => o.occurrence_date === hoje);
  const mortesTotal = ocorrencias.filter(o => o.type === 'morte').reduce((acc, o) => acc + o.quantity, 0);
  const refugoTotal = ocorrencias.filter(o => o.type === 'refugo').reduce((acc, o) => acc + o.quantity, 0);
  const doencaTotal = ocorrencias.filter(o => o.type === 'doenca').reduce((acc, o) => acc + o.quantity, 0);

  if (loading && ocorrencias.length === 0) return <Layout><div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div></Layout>;

  return (
    <Layout>
      <div className={styles.container}>

        <div className={styles.header}>
          <h1>🚨 Ocorrências</h1>
          {canCreate('occurrences') !== false && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? 'Cancelar' : '+ Registrar Ocorrência'}
            </button>
          )}
        </div>

        {/* Cards resumo */}
        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Ocorrências Hoje</span>
            <strong>{totalHoje.length}</strong>
          </div>
          <div className={styles.resumoCard} style={{ borderLeftColor: '#c62828' }}>
            <span>Mortes (total)</span>
            <strong style={{ color: '#c62828' }}>{mortesTotal}</strong>
          </div>
          <div className={styles.resumoCard} style={{ borderLeftColor: '#6a1b9a' }}>
            <span>Refugos (total)</span>
            <strong style={{ color: '#6a1b9a' }}>{refugoTotal}</strong>
          </div>
          <div className={styles.resumoCard} style={{ borderLeftColor: '#e65100' }}>
            <span>Doenças (total)</span>
            <strong style={{ color: '#e65100' }}>{doencaTotal}</strong>
          </div>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className={styles.formCard}>
            <h2>🚨 Registrar Ocorrência</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Data *</label>
                  <input type="date" value={formData.occurrence_date} onChange={e => setFormData({ ...formData, occurrence_date: e.target.value })} required />
                </div>
                <div>
                  <label>Tipo *</label>
                  <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} required>
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Lote</label>
                  <select value={formData.lot_id} onChange={e => handleLoteChange(e.target.value)}>
                    <option value="">— Sem lote —</option>
                    {lotes.map(l => <option key={l.id} value={l.id}>{l.lot_code}</option>)}
                  </select>
                </div>
                <div>
                  <label>Baia (auto-preenchida pelo lote)</label>
                  <select value={formData.pen_id} onChange={e => setFormData({ ...formData, pen_id: e.target.value })}>
                    <option value="">— Sem baia —</option>
                    {baias.map(b => <option key={b.id} value={b.id}>{b.pen_number}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.row}>
                <div>
                  <label>Quantidade *</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    min="1"
                    max={['morte','refugo'].includes(formData.type) && formData.lot_id
                      ? lotes.find(l => l.id === formData.lot_id)?.head_count || undefined
                      : undefined}
                    required
                  />
                </div>
                <div>
                  <label>Descrição / Observações</label>
                  <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Animal encontrado morto pela manhã, tosse seca..." />
                </div>
              </div>

              {/* Aviso de impacto para morte/refugo */}
              {['morte', 'refugo'].includes(formData.type) && formData.lot_id && (() => {
                const lote = lotes.find(l => l.id === formData.lot_id);
                const qtd = parseInt(formData.quantity) || 0;
                if (!lote) return null;
                const novoTotal = lote.head_count - qtd;
                const invalido = qtd > lote.head_count;
                return (
                  <div style={{
                    background: invalido ? '#ffebee' : '#fff8e1',
                    border: `1px solid ${invalido ? '#ef9a9a' : '#ffe082'}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '1rem',
                    fontSize: '0.88rem',
                    color: invalido ? '#c62828' : '#795548',
                  }}>
                    {invalido
                      ? `❌ Quantidade maior que cabeças no lote (${lote.head_count} cab.)`
                      : `⚠️ Baixa definitiva: lote ${lote.lot_code} passará de ${lote.head_count} → ${novoTotal} cabeças. A baia será atualizada automaticamente.`
                    }
                  </div>
                );
              })()}
              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ background: '#c62828' }}>{loading ? 'Salvando...' : 'Registrar Ocorrência'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className={styles.filtros}>
          <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} className={styles.inputData} />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {(filtroTipo || filtroData) && (
            <button className={styles.btnLimpar} onClick={() => { setFiltroTipo(''); setFiltroData(''); }}>✕ Limpar</button>
          )}
          <span style={{ color: '#888', fontSize: '0.9rem' }}>{filtradas.length} registro(s)</span>
        </div>

        {/* Tabela */}
        {filtradas.length === 0 ? (
          <div className={styles.vazio}>
            <p style={{ fontSize: '2rem' }}>✅</p>
            <p>Nenhuma ocorrência registrada.</p>
          </div>
        ) : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Lote</th>
                  <th>Baia</th>
                  <th>Qtd</th>
                  <th>Descrição</th>
                  {canDelete && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(o => {
                  const tipo = getTipo(o.type);
                  return (
                    <tr key={o.id}>
                      <td>{new Date(o.occurrence_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td>
                        <span style={{ background: tipo.bg, color: tipo.color, padding: '3px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {tipo.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.88rem' }}>{o.lots?.lot_code || '—'}</td>
                      <td style={{ fontSize: '0.88rem' }}>{o.pens?.pen_number || '—'}</td>
                      <td><strong>{o.quantity}</strong></td>
                      <td style={{ fontSize: '0.88rem', color: '#555' }}>{o.description || '—'}</td>
                      {canDelete && (
                        <td><button className={styles.btnDeletar} onClick={() => handleDelete(o.id)}>Deletar</button></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
