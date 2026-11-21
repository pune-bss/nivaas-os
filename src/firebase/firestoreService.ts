import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './config';
import { handleFirestoreError, OperationType } from './errorHandler';
import { AuditLog } from '../types/crm';

export function subscribeTenantCollection<T extends { id: string }>(
  companyId: string,
  subcollection: string,
  onData: (items: T[]) => void,
  extraConstraints: QueryConstraint[] = [],
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `companies/${companyId}/${subcollection}`;
  const colRef = collection(db, path);
  const q = query(colRef, where('companyId', '==', companyId), ...extraConstraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.isDeleted) {
          items.push({ id: docSnap.id, ...data } as T);
        }
      });
      onData(items);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export async function createTenantDoc<T extends Record<string, unknown>>(
  companyId: string,
  subcollection: string,
  payload: T,
  customId?: string
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Authenticated session required.');
  const path = `companies/${companyId}/${subcollection}`;
  const docPayload = {
    ...payload,
    companyId,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDeleted: false,
  };

  try {
    if (customId) {
      await setDoc(doc(db, path, customId), docPayload);
      return customId;
    }
    const refDoc = await addDoc(collection(db, path), docPayload);
    return refDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTenantDoc(
  companyId: string,
  subcollection: string,
  docId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const path = `companies/${companyId}/${subcollection}/${docId}`;
  try {
    await updateDoc(doc(db, `companies/${companyId}/${subcollection}`, docId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function softDeleteTenantDoc(
  companyId: string,
  subcollection: string,
  docId: string,
  label?: string
): Promise<void> {
  const path = `companies/${companyId}/${subcollection}/${docId}`;
  try {
    await updateDoc(doc(db, `companies/${companyId}/${subcollection}`, docId), {
      isDeleted: true,
      updatedAt: serverTimestamp(),
    });
    await writeAuditEvent({
      companyId,
      eventType: 'soft_delete',
      targetPath: path,
      details: `Soft-deleted ${subcollection} record ${label || docId}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getTenantDoc<T>(
  companyId: string,
  subcollection: string,
  docId: string
): Promise<T | null> {
  const path = `companies/${companyId}/${subcollection}/${docId}`;
  try {
    const snap = await getDoc(doc(db, `companies/${companyId}/${subcollection}`, docId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as T;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function listTenantDocs<T>(
  companyId: string,
  subcollection: string,
  extraConstraints: QueryConstraint[] = []
): Promise<T[]> {
  const path = `companies/${companyId}/${subcollection}`;
  try {
    const q = query(collection(db, path), where('companyId', '==', companyId), ...extraConstraints);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as unknown as T & { isDeleted?: boolean }))
      .filter((d) => !d.isDeleted);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function writeAuditEvent(params: {
  companyId?: string;
  eventType: AuditLog['eventType'];
  targetPath?: string;
  details: string;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const payload = {
    companyId: params.companyId || '',
    actorUid: uid,
    actorEmail: auth.currentUser?.email || '',
    eventType: params.eventType,
    targetPath: (params.targetPath || '').slice(0, 250),
    details: params.details.slice(0, 500),
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDeleted: false,
  };

  try {
    await addDoc(collection(db, 'platform/auditLogs/items'), payload);
    if (params.companyId) {
      await addDoc(collection(db, `companies/${params.companyId}/auditLogs`), payload);
    }
  } catch {
    // Non-blocking audit logging should not crash user flow if permission differs for non-admins
  }
}

export async function uploadCompanyFile(
  companyId: string,
  folder: 'properties' | 'kyc' | 'documents' | 'branding',
  file: File
): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File exceeds the 10 MB maximum upload limit.');
  }
  const isAllowed = file.type.startsWith('image/') || file.type === 'application/pdf';
  if (!isAllowed) {
    throw new Error('Only image files and PDFs are permitted.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = ref(storage, `companies/${companyId}/${folder}/${Date.now()}_${safeName}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return await getDownloadURL(storageRef);
}
