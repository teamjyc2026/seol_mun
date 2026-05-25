'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { getSurvey } from '../api/getSurvey';

export function useSurveyQuery() {
  return useQuery({
    queryKey: queryKeys.survey,
    queryFn: getSurvey,
    staleTime: Infinity,
  });
}
