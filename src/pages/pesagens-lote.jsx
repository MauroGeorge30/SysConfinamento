import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import styles from '../styles/PesagensLote.module.css';

export default function PesagensLote() {
  const router = useRouter();
  const { user, loading: authLoading, currentFarm } = useAuth();
  const { canCreate, canDelete } = usePermissions();

  const [pesagens, setPesagens] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtroLote, setFiltroLote] = useState('');

  const hoje = new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    lot_id: '',
    weighing_date: hoje,
    head_weighed: '',
    avg_weight_kg: '',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user && currentFarm) loadDados();
  }, [user, authLoading, currentFarm]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const [{ data: lotesData }, { data: pesData, error: pesError }] = await Promise.all([
        supabase.from('lots')
          .select('id, lot_code, category, head_count, avg_entry_weight, entry_date, target_gmd, pen_id, pens(pen_number)')
          .eq('farm_id', currentFarm.id)
          .eq('status', 'active')
          .order('lot_code'),
        supabase.from('lot_weighings')
          .select('*, lots(lot_code, category, avg_entry_weight, entry_date, target_gmd)')
          .eq('farm_id', currentFarm.id)
          .order('weighing_date', { ascending: false })
          .limit(300),
      ]);
      if (pesError) throw pesError;
      setLotes(lotesData || []);
      setPesagens(pesData || []);
    } catch (error) {
      alert('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ lot_id: '', weighing_date: hoje, head_weighed: '', avg_weight_kg: '', notes: '' });
    setShowForm(false);
  };

  // Busca última pesagem do lote selecionado
  const ultimaPesagemDoLote = (lot_id) => {
    return pesagens
      .filter(p => p.lot_id === lot_id)
      .sort((a, b) => new Date(b.weighing_date) - new Date(a.weighing_date))[0] || null;
  };

  const calcGMD = (pesoAtual, pesoBase, dataBase, dataPesagem) => {
    if (!pesoBase || !dataBase || !dataPesagem) return null;
    const dias = Math.floor((new Date(dataPesagem) - new Date(dataBase)) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return null;
    return (pesoAtual - pesoBase) / dias;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lot_id) return alert('Selecione o lote.');
    if (!formData.head_weighed || isNaN(formData.head_weighed) || Number(formData.head_weighed) <= 0)
      return alert('Número de cabeças inválido.');
    if (!formData.avg_weight_kg || isNaN(formData.avg_weight_kg) || Number(formData.avg_weight_kg) <= 0)
      return alert('Peso médio inválido.');

    setLoading(true);
    try {
      const lote = lotes.find(l => l.id === formData.lot_id);
      const ultima = ultimaPesagemDoLote(formData.lot_id);

      // GMD desde última pesagem (ou desde entrada)
      const baseP = ultima ? Number(ultima.avg_weight_kg) : Number(lote?.avg_entry_weight);
      const baseD = ultima ? ultima.weighing_date : lote?.entry_date;
      const gmd = calcGMD(Number(formData.avg_weight_kg), baseP, baseD, formData.weighing_date);

      const { error } = await supabase.from('lot_weighings').insert([{
        lot_id: formData.lot_id,
        farm_id: currentFarm.id,
        weighing_date: formData.weighing_date,
        head_weighed: parseInt(formData.head_weighed),
        avg_weight_kg: parseFloat(formData.avg_weight_kg),
        gmd_kg: gmd !== null ? parseFloat(gmd.toFixed(4)) : null,
        notes: formData.notes || null,
        registered_by: user.id,
      }]);
      if (error) throw error;
      alert('✅ Pesagem de lote registrada!');
      resetForm();
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja remover esta pesagem?')) return;
    try {
      const { error } = await supabase.from('lot_weighings').delete().eq('id', id);
      if (error) throw error;
      loadDados();
    } catch (error) {
      alert('❌ Erro: ' + error.message);
    }
  };

  if (authLoading || !user) return <div className="loading">Carregando...</div>;

  // Lote selecionado no formulário (preview)
  const loteSelecionado = lotes.find(l => l.id === formData.lot_id);
  const ultimaLoteSel = loteSelecionado ? ultimaPesagemDoLote(formData.lot_id) : null;
  const basePreviewPeso = ultimaLoteSel ? Number(ultimaLoteSel.avg_weight_kg) : Number(loteSelecionado?.avg_entry_weight);
  const basePreviewData = ultimaLoteSel ? ultimaLoteSel.weighing_date : loteSelecionado?.entry_date;
  const gmdPreview = formData.avg_weight_kg && loteSelecionado
    ? calcGMD(Number(formData.avg_weight_kg), basePreviewPeso, basePreviewData, formData.weighing_date)
    : null;
  const diasConfinado = loteSelecionado?.entry_date
    ? Math.floor((new Date(formData.weighing_date) - new Date(loteSelecionado.entry_date)) / (1000 * 60 * 60 * 24))
    : null;

  // Filtro
  const pesagensFiltradas = pesagens.filter(p =>
    !filtroLote || p.lots?.lot_code?.toLowerCase().includes(filtroLote.toLowerCase())
  );

  // Cards de resumo
  const totalPesagens = pesagens.length;
  const pesagensHoje = pesagens.filter(p => p.weighing_date === hoje).length;
  const gmdsValidos = pesagens.filter(p => p.gmd_kg != null);
  const mediaGMD = gmdsValidos.length > 0
    ? gmdsValidos.reduce((acc, p) => acc + Number(p.gmd_kg), 0) / gmdsValidos.length
    : null;

  const getGmdClass = (gmd, meta) => {
    if (gmd == null) return '';
    if (meta && gmd >= meta) return styles.gmdOtimo;
    if (meta && gmd >= meta * 0.85) return styles.gmdBom;
    return styles.gmdAbaixo;
  };

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.abas}>
          <a href="/pesagens" className={styles.aba}>⚖️ Individual</a>
          <span className={`${styles.aba} ${styles.abaAtiva}`}>📦 Por Lote</span>
        </div>

        <div className={styles.header}>
          <h1>⚖️ Pesagens por Lote</h1>
          {canCreate('lot_weighings') && (
            <button className={styles.btnAdd} onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? 'Cancelar' : '+ Registrar Pesagem'}
            </button>
          )}
        </div>

        {/* Cards de resumo */}
        <div className={styles.resumo}>
          <div className={styles.resumoCard}>
            <span>Total de Pesagens</span>
            <strong>{totalPesagens}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Pesagens Hoje</span>
            <strong>{pesagensHoje}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>GMD Médio Geral</span>
            <strong>{mediaGMD != null ? `${mediaGMD.toFixed(3)} kg/d` : '-'}</strong>
          </div>
          <div className={styles.resumoCard}>
            <span>Lotes Ativos</span>
            <strong>{lotes.length}</strong>
          </div>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className={styles.formCard}>
            <h2>➕ Nova Pesagem de Lote</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.row}>
                <div>
                  <label>Lote *</label>
                  <select
                    value={formData.lot_id}
                    onChange={(e) => setFormData({ ...formData, lot_id: e.target.value })}
                    required
                  >
                    <option value="">Selecione o lote</option>
                    {lotes.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.lot_code} — {l.category} — Baia {l.pens?.pen_number} ({l.head_count} cab)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Data da Pesagem *</label>
                  <input
                    type="date"
                    value={formData.weighing_date}
                    onChange={(e) => setFormData({ ...formData, weighing_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div>
                  <label>Cabeças Pesadas *</label>
                  <input
                    type="number"
                    value={formData.head_weighed}
                    onChange={(e) => setFormData({ ...formData, head_weighed: e.target.value })}
                    placeholder="Ex: 50"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label>Peso Médio (kg) *</label>
                  <input
                    type="number"
                    value={formData.avg_weight_kg}
                    onChange={(e) => setFormData({ ...formData, avg_weight_kg: e.target.value })}
                    placeholder="Ex: 380.5"
                    step="0.1"
                    min="0"
                    required
                  />
                </div>
              </div>

              {/* Preview do GMD */}
              {loteSelecionado && (
                <div className={styles.preview}>
                  <div className={styles.previewItem}>
                    <span>Peso entrada do lote</span>
                    <strong>{Number(loteSelecionado.avg_entry_weight).toFixed(1)} kg</strong>
                  </div>
                  {ultimaLoteSel && (
                    <div className={styles.previewItem}>
                      <span>Última pesagem ({new Date(ultimaLoteSel.weighing_date + 'T00:00:00').toLocaleDateString('pt-BR')})</span>
                      <strong>{Number(ultimaLoteSel.avg_weight_kg).toFixed(1)} kg</strong>
                    </div>
                  )}
                  {diasConfinado != null && (
                    <div className={styles.previewItem}>
                      <span>Dias confinados</span>
                      <strong>{diasConfinado} dias</strong>
                    </div>
                  )}
                  {gmdPreview != null && (
                    <div className={styles.previewItem}>
                      <span>GMD estimado ({ultimaLoteSel ? 'desde última pesagem' : 'desde entrada'})</span>
                      <strong className={
                        loteSelecionado.target_gmd && gmdPreview >= loteSelecionado.target_gmd
                          ? styles.gmdOtimo
                          : loteSelecionado.target_gmd && gmdPreview >= loteSelecionado.target_gmd * 0.85
                          ? styles.gmdBom : styles.gmdAbaixo
                      }>
                        {gmdPreview.toFixed(3)} kg/dia
                        {loteSelecionado.target_gmd && (
                          <em> (meta: {Number(loteSelecionado.target_gmd).toFixed(3)})</em>
                        )}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.row}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Observações</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observações opcionais..."
                  />
                </div>
              </div>

              <div className={styles.formAcoes}>
                <button type="button" className={styles.btnCancelar} onClick={resetForm}>Cancelar</button>
                <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Registrar Pesagem'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Filtro */}
        <div className={styles.filtros}>
          <input
            type="text"
            placeholder="Buscar por código do lote..."
            value={filtroLote}
            onChange={(e) => setFiltroLote(e.target.value)}
            className={styles.inputBusca}
          />
          {filtroLote && (
            <button className={styles.btnLimpar} onClick={() => setFiltroLote('')}>✕ Limpar</button>
          )}
        </div>

        {/* Tabela */}
        {loading ? (
          <p className={styles.vazio}>Carregando...</p>
        ) : pesagensFiltradas.length === 0 ? (
          <p className={styles.vazio}>Nenhuma pesagem de lote registrada.</p>
        ) : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lote</th>
                  <th>Categoria</th>
                  <th>Cabeças</th>
                  <th>Peso Entrada</th>
                  <th>Peso Médio</th>
                  <th>Ganho Total</th>
                  <th>GMD</th>
                  <th>Meta GMD</th>
                  <th>Obs</th>
                  {canDelete('lot_weighings') && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {pesagensFiltradas.map((p) => {
                  const entradaPeso = p.lots?.avg_entry_weight ? Number(p.lots.avg_entry_weight) : null;
                  const ganhoTotal = entradaPeso != null ? Number(p.avg_weight_kg) - entradaPeso : null;
                  const meta = p.lots?.target_gmd ? Number(p.lots.target_gmd) : null;
                  const gmd = p.gmd_kg != null ? Number(p.gmd_kg) : null;

                  return (
                    <tr key={p.id}>
                      <td>{new Date(p.weighing_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                      <td><strong>{p.lots?.lot_code || '-'}</strong></td>
                      <td>{p.lots?.category || '-'}</td>
                      <td>{p.head_weighed}</td>
                      <td>{entradaPeso != null ? `${entradaPeso.toFixed(1)} kg` : '-'}</td>
                      <td><strong>{Number(p.avg_weight_kg).toFixed(1)} kg</strong></td>
                      <td>
                        {ganhoTotal != null && (
                          <span className={ganhoTotal >= 0 ? styles.ganhoPositivo : styles.ganhoNegativo}>
                            {ganhoTotal >= 0 ? '+' : ''}{ganhoTotal.toFixed(1)} kg
                          </span>
                        )}
                      </td>
                      <td>
                        {gmd != null ? (
                          <span className={getGmdClass(gmd, meta)}>
                            {gmd.toFixed(3)} kg/d
                          </span>
                        ) : '-'}
                      </td>
                      <td>{meta != null ? `${meta.toFixed(3)} kg/d` : '-'}</td>
                      <td className={styles.tdObs}>{p.notes || '-'}</td>
                      {canDelete('lot_weighings') && (
                        <td>
                          <button className={styles.btnDeletar} onClick={() => handleDelete(p.id)}>
                            Deletar
                          </button>
                        </td>
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
