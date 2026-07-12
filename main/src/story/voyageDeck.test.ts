import { describe, expect, it } from 'vitest';
import { applyChoice, createDeckRun, nextCard } from './voyageDeck.ts';
import { CH1_ECHO_LINES, VOYAGE_DECK } from './storyScript.ts';

/** Deterministic rng from a fixed sequence. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('voyageDeck', () => {
  it('a run always contains the full spine, in order', () => {
    const run = createDeckRun(VOYAGE_DECK, seq([0.1, 0.7]));
    const spineOrder = run.queue.filter(id => VOYAGE_DECK.spine.includes(id));
    expect(spineOrder).toEqual([...VOYAGE_DECK.spine]);
  });

  it('draws exactly poolDraws distinct pool cards', () => {
    const run = createDeckRun(VOYAGE_DECK, seq([0.9, 0.0]));
    const poolCards = run.queue.filter(id => VOYAGE_DECK.pool.includes(id));
    expect(poolCards.length).toBe(VOYAGE_DECK.poolDraws);
    expect(new Set(poolCards).size).toBe(VOYAGE_DECK.poolDraws);
  });

  it('different rngs produce different pool pathways', () => {
    const a = createDeckRun(VOYAGE_DECK, seq([0.05, 0.05]));
    const b = createDeckRun(VOYAGE_DECK, seq([0.95, 0.95]));
    expect(a.queue.join(',')).not.toBe(b.queue.join(','));
  });

  it('the deck is configured for the wider run (poolDraws 3, maxCards 9)', () => {
    expect(VOYAGE_DECK.poolDraws).toBe(3);
    expect(VOYAGE_DECK.maxCards).toBe(9);
    expect(VOYAGE_DECK.spine).toEqual(['dispenser', 'question', 'diagnostic']);
    expect(VOYAGE_DECK.pool.length).toBe(7);
  });

  it('choices inject their follow-ups at the front of the queue, once, under the cap', () => {
    const run = createDeckRun(VOYAGE_DECK, seq([0.0, 0.0]));
    const first = nextCard(run, VOYAGE_DECK)!;
    expect(first.id).toBe('dispenser');
    const option = applyChoice(run, VOYAGE_DECK, 'dispenser', 'report');
    expect(option?.unlocks).toContain('commendation');
    expect(run.queue[0]).toBe('commendation');
    // re-choosing cannot double-inject
    applyChoice(run, VOYAGE_DECK, 'dispenser', 'report');
    expect(run.queue.filter(id => id === 'commendation').length).toBe(1);
    // total run length respects the cap
    expect(run.drawn.length + run.queue.length).toBeLessThanOrEqual(VOYAGE_DECK.maxCards);
  });

  it('the question card carries a body variant keyed to the dispenser choice', () => {
    const question = VOYAGE_DECK.cards.question;
    expect(question.bodyVariants).toBeDefined();
    expect(question.bodyVariants!['dispenser:unlock']).toBeTruthy();
    expect(question.bodyVariants!['dispenser:unlock']).not.toBe(question.body);
  });

  it('the requested options carry asides in the watcher idiom', () => {
    const aside = (cardId: string, optionId: string) =>
      VOYAGE_DECK.cards[cardId].options.find(o => o.id === optionId)?.aside;
    for (const [cardId, optionId] of [
      ['dispenser', 'unlock'], ['question', 'unknown'], ['window', 'look'],
      ['thermal', 'raise'], ['bell', 'withhold'], ['lights', 'dimall'], ['bell2', 'retire']
    ] as const) {
      const text = aside(cardId, optionId);
      expect(text, `${cardId}:${optionId}`).toBeTruthy();
      expect(text!.startsWith('(') && text!.endsWith(')'), `${cardId}:${optionId}`).toBe(true);
    }
  });

  it('the old ration card is gone; the dispenser replaces it', () => {
    expect(VOYAGE_DECK.cards.ration).toBeUndefined();
    expect(VOYAGE_DECK.cards.dispenser).toBeDefined();
  });

  it('the run exhausts to null (the bridge is the caller\'s duty)', () => {
    const run = createDeckRun(VOYAGE_DECK, seq([0.5, 0.5]));
    let card = nextCard(run, VOYAGE_DECK);
    let guard = 0;
    while (card && guard++ < 20) {
      // always pick the first option — no unlock storms in this path guaranteed
      applyChoice(run, VOYAGE_DECK, card.id, card.options[0].id);
      card = nextCard(run, VOYAGE_DECK);
    }
    expect(card).toBeNull();
    expect(VOYAGE_DECK.cards[VOYAGE_DECK.bridge]).toBeDefined();
    expect(VOYAGE_DECK.cards[VOYAGE_DECK.bridge].options.length).toBe(1);
  });

  it('every option echo line exists and every unlock resolves to a card', () => {
    for (const card of Object.values(VOYAGE_DECK.cards)) {
      for (const option of card.options) {
        expect(CH1_ECHO_LINES[option.echoLineId], `${card.id}:${option.id}`).toBeTruthy();
        for (const unlocked of option.unlocks ?? []) {
          expect(VOYAGE_DECK.cards[unlocked]).toBeDefined();
        }
      }
    }
  });
});
