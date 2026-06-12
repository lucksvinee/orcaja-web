import { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

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
      orcamentosList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrcamentos(orcamentosList);
    } catch (error) {
      console.error('Erro ao buscar orçamentos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    fetchOrcamentos();
  }, [fetchOrcamentos]);

  const addOrcamento = useCallback(async (novoOrcamento) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const nextNumero = orcamentos.length > 0 ? Math.max(...orcamentos.map(o => o.numero || 0)) + 1 : 1;
      const docRef = await addDoc(collection(db, 'orcamentos'), {
        ...novoOrcamento,
        numero: nextNumero,
        user_id: user.uid,
        created_at: new Date().toISOString()
      });
      const newOrcamentoData = { id: docRef.id, numero: nextNumero, ...novoOrcamento, user_id: user.uid, created_at: new Date().toISOString() };
      setOrcamentos(prev => [newOrcamentoData, ...prev]);
      return newOrcamentoData;
    } catch (error) {
      console.error('Erro ao adicionar orçamento:', error);
      throw error;
    }
  }, [orcamentos]);

  const updateOrcamento = useCallback(async (id, updates) => {
    try {
      const orcRef = doc(db, 'orcamentos', String(id));
      await updateDoc(orcRef, updates);
      setOrcamentos(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
      return { id, ...updates };
    } catch (error) {
      console.error('Erro ao atualizar orçamento:', error);
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

  return { orcamentos, addOrcamento, updateOrcamento, removeOrcamento, getOrcamentoById, loading, refreshOrcamentos: fetchOrcamentos };
}