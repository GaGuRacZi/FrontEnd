import { LEGAL_DOCUMENTS } from './legalDocuments';
import type { TermDefinition, TermId } from './types';

export interface TermsRepository {
  getTerm(termId: TermId): Promise<TermDefinition | null>;
  getTerms(): Promise<TermDefinition[]>;
}

function copyTerm(term: TermDefinition) {
  return { ...term };
}

const ACTIVE_LEGAL_DOCUMENTS = LEGAL_DOCUMENTS.filter(
  ({ status }) => status === 'active',
);

export class LocalTermsRepository implements TermsRepository {
  async getTerm(termId: TermId) {
    const term = ACTIVE_LEGAL_DOCUMENTS.find(({ id }) => id === termId);
    return term ? copyTerm(term) : null;
  }

  async getTerms() {
    return ACTIVE_LEGAL_DOCUMENTS.map(copyTerm);
  }
}

export const termsRepository: TermsRepository = new LocalTermsRepository();
