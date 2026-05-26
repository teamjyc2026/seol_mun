export type GiftValue = 'oliveyoung' | 'cu';

export type ResponseRow = {
  id: string;
  name: string | null;
  phone: string | null;
  affiliation: string | null;
  email: string | null;
  answers: Record<string, unknown>;
  gift: GiftValue | null;
  status: 'draft' | 'submitted';
  user_agent: string | null;
  created_at: string;
};

export const giftLabel: Record<GiftValue, string> = {
  oliveyoung: '올리브영 5,000원',
  cu: '편의점 5,000원',
};
