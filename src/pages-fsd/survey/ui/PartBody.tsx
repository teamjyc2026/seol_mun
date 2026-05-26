'use client';

import {
  LongText,
  MultiChoice,
  QuestionCard,
  RankPicker,
  ScaleField,
  SelectChoice,
  ShortText,
  SingleChoice,
  questions,
  type Part,
  type Question,
} from '@/entities/survey';
import { ConsentStep } from '@/features/consent-agreement';

function FieldByType({ type }: { type: Question['type'] }) {
  switch (type) {
    case 'single':
      return <SingleChoice />;
    case 'select':
      return <SelectChoice />;
    case 'multi':
      return <MultiChoice />;
    case 'short':
      return <ShortText />;
    case 'long':
      return <LongText />;
    case 'scale':
      return <ScaleField />;
    case 'rank':
      return <RankPicker />;
    default:
      return null;
  }
}

export function PartBody({ part }: { part: Part }) {
  if (part.id === 'CONSENT') {
    return <ConsentStep />;
  }
  return (
    <>
      {part.questionIds.map((id) => {
        const q = questions[id];
        return (
          <QuestionCard key={id} question={q}>
            <QuestionCard.Header />
            <QuestionCard.Title />
            <QuestionCard.Helper />
            <QuestionCard.Field>
              <FieldByType type={q.type} />
            </QuestionCard.Field>
            <QuestionCard.Error />
          </QuestionCard>
        );
      })}
    </>
  );
}
