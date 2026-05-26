/**
 * Find the [data-question="QXX"] card and smooth-scroll to the next sibling
 * card. If there is no next card in the current step, scrolls to the wizard
 * footer (so the "다음" / "제출" button comes into view).
 */
export function scrollToNextQuestion(currentId: string) {
  if (typeof window === 'undefined') return;
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('[data-question]'),
  );
  const idx = cards.findIndex((el) => el.dataset.question === currentId);
  if (idx === -1) return;
  const next: HTMLElement | null =
    cards[idx + 1] ?? document.querySelector('[data-wizard-footer]');
  if (!next) return;
  const top = next.getBoundingClientRect().top + window.scrollY - 16;
  window.scrollTo({ top, behavior: 'smooth' });
}
