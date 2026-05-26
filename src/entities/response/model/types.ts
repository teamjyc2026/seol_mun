export type ResponseRow = {
  id: string;
  name: string | null;
  phone: string | null;
  affiliation: string | null;
  email: string | null;
  answers: Record<string, unknown>;
  status: 'draft' | 'submitted';
  user_agent: string | null;
  created_at: string;
};
