import { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';

export function useClientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const q = query(collection(db, 'clientes'), where('user_id', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const clientesList = [];
      querySnapshot.forEach((docSnap) => {
        clientesList.push({ id: docSnap.id, ...docSnap.data() });
      });
      clientesList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setClientes(clientesList);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    fetchClientes();
  }, [fetchClientes]);

  const addCliente = useCallback(async (novoCliente) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = await addDoc(collection(db, 'clientes'), { 
        ...novoCliente, 
        user_id: user.uid,
        created_at: new Date().toISOString()
      });
      const newClienteData = { id: docRef.id, ...novoCliente, user_id: user.uid, created_at: new Date().toISOString() };
      setClientes(prev => [newClienteData, ...prev]);
      return newClienteData;
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      throw error;
    }
  }, []);

  const removeCliente = useCallback(async (id) => {
    try {
      await deleteDoc(doc(db, 'clientes', String(id)));
      setClientes(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Erro ao remover cliente:', error);
      throw error;
    }
  }, []);

  const getClienteById = useCallback((id) => {
    return clientes.find(c => String(c.id) === String(id));
  }, [clientes]);

  return { clientes, addCliente, removeCliente, getClienteById, loading, refreshClientes: fetchClientes };
}