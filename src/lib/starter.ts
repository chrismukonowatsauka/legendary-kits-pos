import type { Account } from './types';

/** First start on a device: the usual money accounts. Fixed ids, so phone and laptop share them. */
const t = '2026-01-01T00:00:00.000Z';
const acc = (id: string, name: string, type: Account['type']): Account => ({ id, name, type, openingBalance: 0, active: true, updatedAt: t });

export const STARTER = {
  accounts: [acc('acc-cash', 'Cash', 'cash'), acc('acc-bank', 'Bank', 'bank'), acc('acc-ecocash', 'EcoCash', 'mobile'), acc('acc-innbucks', 'InnBucks', 'mobile')],
};
