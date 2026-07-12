import { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase';
import { collection, query, where, getDocs, getDoc, deleteDoc, doc, runTransaction } from 'firebase/firestore';
import { ORCAMENTO_STATUS, normalizeOrcamentoStatus } from './orcamentoStatus';
import { getMostAdvancedStatus } from './publicOrcamento';

export function useOrcamentos() {
  const [orcamentos, setOrcamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrcamentos = useCallback(async () => {
    setLoading(true);
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, 'orcamentos'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const orcamentosList = [];
      querySnapshot.forEach((docSnap) => {
        orcamentosList.push({ id: docSnap.id, ...docSnap.data() });
      });

      const syncedOrcamentos = await Promise.all(orcamentosList.map(async (orcamento) => {
        if (!orcamento.share_token) return orcamento;

        try {
          const publicSnap = await getDoc(doc(db, 'public_orcamentos', orcamento.share_token));
          if (!publicSnap.exists()) return orcamento;

          const publicData = publicSnap.data();
          return {
            ...orcamento,
            status: getMostAdvancedStatus(orcamento.status, publicData.status),
            public_status: publicData.status,
            public_viewed_at: publicData.viewed_at || null,
            public_responded_at: publicData.responded_at || null,
          };
        } catch (error) {
          console.error('Erro ao sincronizar status publico:', error);
          return orcamento;
        }
      }));

      syncedOrcamentos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrcamentos(syncedOrcamentos);
    } catch (error) {
      console.error('Erro ao buscar orçamentos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    fetchOrcamentos();
    const refreshInterval = window.setInterval(fetchOrcamentos, 60000);
    return () => window.clearInterval(refreshInterval);
  }, [fetchOrcamentos]);

  const addOrcamento = useCallback(async (novoOrcamento) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const now = new Date().toISOString();
      const fallbackNextNumero = Math.max(0, ...orcamentos.map(o => Number(o.numero || 0))) + 1;
      const counterRef = doc(db, 'tenant_counters', user.uid);
      const orcRef = doc(collection(db, 'orcamentos'));
      let newOrcamentoData = null;

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const storedNextNumero = Number(counterSnap.data()?.next_orcamento_number);
        const nextNumero = Number.isFinite(storedNextNumero) && storedNextNumero > 0
          ? Math.max(storedNextNumero, fallbackNextNumero)
          : fallbackNextNumero;

        newOrcamentoData = {
          ...novoOrcamento,
          id: orcRef.id,
          numero: nextNumero,
          status: normalizeOrcamentoStatus(novoOrcamento.status || ORCAMENTO_STATUS.draft),
          user_id: user.uid,
          created_at: now,
          updated_at: now,
          revision_count: 0,
        };

        transaction.set(counterRef, {
          user_id: user.uid,
          next_orcamento_number: nextNumero + 1,
          updated_at: now,
        }, { merge: true });
        const storedOrcamentoData = { ...newOrcamentoData };
        delete storedOrcamentoData.id;
        transaction.set(orcRef, storedOrcamentoData);
      });

      setOrcamentos(prev => [newOrcamentoData, ...prev]);
      return newOrcamentoData;
    } catch (error) {
      console.error('Erro ao adicionar orçamento:', error);
      throw error;
    }
  }, [orcamentos]);

  const updateOrcamento = useCallback(async (id, updates) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const orcRef = doc(db, 'orcamentos', String(id));
      const now = new Date().toISOString();
      let normalizedUpdates = {
        ...updates,
        updated_at: updates.updated_at || now,
      };

      if ('status' in normalizedUpdates) {
        normalizedUpdates.status = normalizeOrcamentoStatus(normalizedUpdates.status);
      }

      let revisionCount = 0;

      await runTransaction(db, async (transaction) => {
        const orcSnap = await transaction.get(orcRef);
        if (!orcSnap.exists()) {
          throw new Error('Orçamento não encontrado.');
        }

        const currentData = orcSnap.data();
        if (currentData.user_id !== user.uid) {
          throw new Error('Sem permissão para alterar este orçamento.');
        }

        revisionCount = Number(currentData.revision_count || 0) + 1;
        const revisionRef = doc(collection(orcRef, 'revisions'));

        transaction.set(revisionRef, {
          user_id: user.uid,
          orcamento_id: String(id),
          revision_number: revisionCount,
          changed_at: now,
          changed_by: user.uid,
          changed_fields: Object.keys(normalizedUpdates).sort(),
          snapshot: currentData,
        });

        normalizedUpdates = {
          ...normalizedUpdates,
          revision_count: revisionCount,
        };

        transaction.update(orcRef, normalizedUpdates);
      });

      setOrcamentos(prev => prev.map(o => o.id === id ? { ...o, ...normalizedUpdates } : o));
      return { id, ...normalizedUpdates, revision_count: revisionCount };
    } catch (error) {
      console.error('Erro ao atualizar orçamento:', error);
      throw error;
    }
  }, []);

  const getOrcamentoRevisions = useCallback(async (id) => {
    try {
      const revisionsSnapshot = await getDocs(collection(db, 'orcamentos', String(id), 'revisions'));
      const revisions = [];
      revisionsSnapshot.forEach((revisionSnap) => {
        revisions.push({ id: revisionSnap.id, ...revisionSnap.data() });
      });
      revisions.sort((a, b) => Number(b.revision_number || 0) - Number(a.revision_number || 0));
      return revisions;
    } catch (error) {
      console.error('Erro ao buscar histórico do orçamento:', error);
      throw error;
    }
  }, []);

  const removeOrcamento = useCallback(async (id) => {
    try {
      await deleteDoc(doc(db, 'orcamentos', String(id)));
      setOrcamentos(prev => prev.filter(o => o.id !== id));
    } catch (error) {
      console.error('Erro ao remover orçamento:', error);
      throw error;
    }
  }, []);

  const getOrcamentoById = useCallback((id) => {
    return orcamentos.find(o => String(o.id) === String(id));
  }, [orcamentos]);

  return { orcamentos, addOrcamento, updateOrcamento, removeOrcamento, getOrcamentoById, getOrcamentoRevisions, loading, refreshOrcamentos: fetchOrcamentos };
}
