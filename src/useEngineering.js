import { useCallback, useEffect, useState } from 'react';
import { auth, db, storage } from './firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  DEFAULT_PROFESSIONAL_PROFILE,
  LOCKED_DOCUMENT_STATUSES,
  compressImageFile,
  createLocalId,
  getNextDocumentVersion,
  normalizeDocumentDraft,
} from './engineeringDocuments';

const getCurrentUser = () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado.');
  return user;
};

const buildTenantMeta = (user, now = new Date().toISOString()) => ({
  user_id: user.uid,
  owner_id: user.uid,
  tenant_id: user.uid,
  organization_id: user.uid,
  updated_by: user.uid,
  updated_at: now,
});

export function useEngineering() {
  const [professionalProfile, setProfessionalProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEngineeringData = useCallback(async () => {
    setLoading(true);
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const [profileSnap, projectsSnap, documentsSnap] = await Promise.all([
        getDoc(doc(db, 'professional_profiles', user.uid)),
        getDocs(query(collection(db, 'engineering_projects'), where('user_id', '==', user.uid))),
        getDocs(query(collection(db, 'engineering_documents'), where('user_id', '==', user.uid))),
      ]);

      setProfessionalProfile(profileSnap.exists()
        ? { id: profileSnap.id, ...DEFAULT_PROFESSIONAL_PROFILE, ...profileSnap.data() }
        : { id: user.uid, ...DEFAULT_PROFESSIONAL_PROFILE, email: user.email || '' });

      const projectsList = [];
      projectsSnap.forEach((projectSnap) => {
        const data = projectSnap.data();
        if (!data.deleted_at) {
          projectsList.push({ id: projectSnap.id, ...data });
        }
      });
      projectsList.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
      setProjects(projectsList);

      const documentsList = [];
      documentsSnap.forEach((documentSnap) => {
        const data = documentSnap.data();
        if (!data.deleted_at) {
          documentsList.push({ id: documentSnap.id, ...data });
        }
      });
      documentsList.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
      setDocuments(documentsList);
    } catch (error) {
      console.error('Erro ao carregar dados de engenharia:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEngineeringData().catch(() => {});
  }, [fetchEngineeringData]);

  const saveProfessionalProfile = useCallback(async (profile) => {
    const user = getCurrentUser();
    const now = new Date().toISOString();
    const payload = {
      ...DEFAULT_PROFESSIONAL_PROFILE,
      ...profile,
      ...buildTenantMeta(user, now),
      created_at: profile.created_at || now,
    };

    await setDoc(doc(db, 'professional_profiles', user.uid), payload, { merge: true });
    setProfessionalProfile({ id: user.uid, ...payload });
    return { id: user.uid, ...payload };
  }, []);

  const addProject = useCallback(async (project) => {
    const user = getCurrentUser();
    const now = new Date().toISOString();
    const payload = {
      ...project,
      ...buildTenantMeta(user, now),
      created_by: user.uid,
      created_at: now,
      deleted_at: null,
    };

    const projectRef = await addDoc(collection(db, 'engineering_projects'), payload);
    const savedProject = { id: projectRef.id, ...payload };
    setProjects(prev => [savedProject, ...prev]);
    return savedProject;
  }, []);

  const updateProject = useCallback(async (projectId, updates) => {
    const user = getCurrentUser();
    const now = new Date().toISOString();
    const payload = {
      ...updates,
      ...buildTenantMeta(user, now),
    };

    await updateDoc(doc(db, 'engineering_projects', String(projectId)), payload);
    setProjects(prev => prev.map(project => (
      project.id === projectId ? { ...project, ...payload } : project
    )));
    return { id: projectId, ...payload };
  }, []);

  const saveDocument = useCallback(async (documentDraft) => {
    const user = getCurrentUser();
    const now = new Date().toISOString();
    const normalizedDraft = normalizeDocumentDraft(documentDraft);

    if (!normalizedDraft.id) {
      const payload = {
        ...normalizedDraft,
        ...buildTenantMeta(user, now),
        created_by: user.uid,
        created_at: now,
        deleted_at: null,
      };
      delete payload.id;
      const documentRef = await addDoc(collection(db, 'engineering_documents'), payload);
      const savedDocument = { id: documentRef.id, ...payload };
      setDocuments(prev => [savedDocument, ...prev]);
      return savedDocument;
    }

    const documentRef = doc(db, 'engineering_documents', String(normalizedDraft.id));
    let updatedDocument = null;

    await runTransaction(db, async (transaction) => {
      const documentSnap = await transaction.get(documentRef);
      if (!documentSnap.exists()) {
        throw new Error('Documento técnico não encontrado.');
      }

      const currentData = documentSnap.data();
      if (currentData.owner_id !== user.uid) {
        throw new Error('Sem permissão para editar este documento.');
      }

      const shouldVersion = LOCKED_DOCUMENT_STATUSES.includes(currentData.status);
      const nextVersion = shouldVersion ? getNextDocumentVersion(currentData.version) : (normalizedDraft.version || currentData.version || '1.0');
      const nextStatus = shouldVersion ? 'rascunho' : normalizedDraft.status;
      const payload = {
        ...normalizedDraft,
        ...buildTenantMeta(user, now),
        status: nextStatus,
        version: nextVersion,
      };
      delete payload.id;

      if (shouldVersion) {
        const versionRef = doc(collection(documentRef, 'versions'));
        transaction.set(versionRef, {
          ...buildTenantMeta(user, now),
          document_id: String(normalizedDraft.id),
          version: currentData.version || '1.0',
          reason: 'Nova edição criada a partir de documento bloqueado.',
          snapshot: currentData,
          created_at: now,
          created_by: user.uid,
        });
      }

      transaction.update(documentRef, payload);
      updatedDocument = { id: normalizedDraft.id, ...currentData, ...payload };
    });

    setDocuments(prev => prev.map(documentItem => (
      documentItem.id === normalizedDraft.id ? updatedDocument : documentItem
    )));
    return updatedDocument;
  }, []);

  const uploadDocumentPhoto = useCallback(async ({ file, documentId, localDraftId }) => {
    const user = getCurrentUser();
    if (!storage) {
      throw new Error('Firebase Storage não está configurado.');
    }

    const compressedFile = await compressImageFile(file);
    const safeDocumentId = documentId || localDraftId || `draft-${Date.now()}`;
    const photoId = createLocalId();
    const storagePath = `engineering/${user.uid}/documents/${safeDocumentId}/${photoId}.jpg`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, compressedFile, {
      contentType: 'image/jpeg',
      customMetadata: {
        owner_id: user.uid,
      },
    });
    const downloadUrl = await getDownloadURL(storageRef);

    return {
      id: photoId,
      url: downloadUrl,
      storage_path: storagePath,
      name: compressedFile.name,
      size: compressedFile.size,
      content_type: 'image/jpeg',
      created_at: new Date().toISOString(),
      created_by: user.uid,
    };
  }, []);

  return {
    professionalProfile,
    projects,
    documents,
    loading,
    refreshEngineeringData: fetchEngineeringData,
    saveProfessionalProfile,
    addProject,
    updateProject,
    saveDocument,
    uploadDocumentPhoto,
  };
}
