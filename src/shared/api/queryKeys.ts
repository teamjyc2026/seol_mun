export const queryKeys = {
  survey: ['survey'] as const,
  response: (id: string) => ['response', id] as const,
};
