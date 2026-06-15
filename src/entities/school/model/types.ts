export type School = {
  id: string;
  name: string;
  description: string | null;
  grade: string | null;
  year: number | null;
  created_at: string;
};

export type SchoolWithCounts = School & {
  sourceCount: number;
  readySourceCount: number;
};
