import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { KnowledgeArticle } from '../types';
import type { KnowledgeFormData } from '../validation/schemas';
import { toAppError } from '../utils/errors';
import { callFunction } from './callables';
import { mapKnowledge } from './mappers';

export async function listKnowledge(): Promise<KnowledgeArticle[]> {
  try {
    const snap = await getDocs(query(collection(db, 'knowledgeBase'), limit(500)));
    return snap.docs
      .map(mapKnowledge)
      .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  } catch (error) {
    throw toAppError(error);
  }
}

/** Create (no id) or update (with id) an article. Deactivation is `active: false`; nothing is hard-deleted. */
export async function saveKnowledge(data: KnowledgeFormData, id?: string): Promise<{ id: string }> {
  return callFunction('saveKnowledgeArticleAdmin', { ...data, ...(id ? { id } : {}) });
}
