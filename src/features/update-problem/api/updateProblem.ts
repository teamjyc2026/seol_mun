import { api } from '@/shared/api/axios';
import type { CreateProblemInput } from '@/features/create-problem';

export async function updateProblem(
  id: string,
  input: Partial<CreateProblemInput>,
): Promise<void> {
  await api.patch(`/agent/problems/${id}`, input);
}
