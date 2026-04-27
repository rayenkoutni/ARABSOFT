export const PROJECT_STATUS_LABELS = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé'
};

export const PROJECT_STATUS_COLORS = {
  EN_ATTENTE: 'bg-yellow-500',
  EN_COURS: 'bg-blue-500',
  TERMINE: 'bg-green-500'
};

export const PRIORITY_LABELS = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute'
};

export const PRIORITY_COLORS = {
  LOW: 'bg-slate-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-red-500'
};

export const REQUEST_STATUS_CONFIG = {
  BROUILLON: { label: 'Brouillon', style: { backgroundColor: '#F3F4F6', color: '#374151' } },
  EN_ATTENTE_CHEF: { label: 'En attente Chef', style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
  EN_ATTENTE_RH: { label: 'En attente RH', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
  APPROUVE: { label: 'Approuvé', style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
  REJETE: { label: 'Rejeté', style: { backgroundColor: '#FEE2E2', color: '#991B1B' } },
};

export const REQUEST_TYPE_LABELS = {
  CONGE: 'Congé',
  AUTORISATION: 'Autorisation',
  DOCUMENT: 'Document',
  PRET: 'Prêt',
};
