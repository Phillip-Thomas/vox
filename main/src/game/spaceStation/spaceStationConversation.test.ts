import { describe, expect, it } from 'vitest';
import {
  authoredReply,
  buildFactBlock,
  buildSystemPrompt,
  buildVendorFacts,
  fixtureReply,
  greetingTurn,
  MAX_PLAYER_INPUT,
  MAX_REPLY_CHARS,
  sanitisePlayerInput,
  validateReply,
  VENDOR_REPLY_SCHEMA
} from './spaceStationConversation.ts';
import { buildSpaceStationDescriptor } from './spaceStationDescriptor.ts';
import { buildSpaceStationVendors } from './spaceStationVendors.ts';

const descriptor = buildSpaceStationDescriptor({ system: { x: -19, y: -17 }, index: 0 });
const vendors = buildSpaceStationVendors(descriptor);
const vendor = vendors[0];

describe('the fact table is bounded', () => {
  it('carries only what a trader can see from their own counter', () => {
    const facts = buildVendorFacts(vendor);
    expect(facts.designation).toBe(vendor.designation);
    expect(facts.stock.length).toBeGreaterThan(0);
    // No world state, no canon, no station lore — the shape itself is the boundary.
    expect(Object.keys(facts).sort()).toEqual(
      ['designation', 'grievance', 'manner', 'name', 'recent', 'stock', 'trade', 'want'].sort()
    );
  });

  it('produces a prompt that never mentions anything beyond the stall', () => {
    const prompt = buildSystemPrompt(buildVendorFacts(vendor));
    expect(prompt).toContain(vendor.designation);
    expect(prompt).toMatch(/not your line of work/i);
    // The instruction that does the containment work must actually be present.
    expect(prompt).toMatch(/do not know anything else/i);
  });

  it('keeps the volatile shelf out of the cacheable character sheet', () => {
    const facts = buildVendorFacts(vendor);
    const system = buildSystemPrompt(facts);
    const shelf = buildFactBlock(facts);
    // Prices change constantly; if they were in the system prompt the cache would
    // be invalidated on every single turn.
    expect(system).not.toMatch(/credits/);
    expect(shelf).toMatch(/credits/);
  });
});

describe('reply validation', () => {
  const ok = { line: 'ore is twelve today, and it will not stay there.', mood: 'neutral' };

  it('accepts a well-formed reply and tags it as model output', () => {
    const reply = validateReply(ok);
    expect(reply?.line).toBe(ok.line);
    expect(reply?.source).toBe('model');
  });

  it('rejects markdown, lists and tag leakage rather than cleaning them up', () => {
    expect(validateReply({ ...ok, line: '**ore** is twelve' })).toBeNull();
    expect(validateReply({ ...ok, line: '- ore\n- water' })).toBeNull();
    expect(validateReply({ ...ok, line: '<thinking>hm</thinking> ore is twelve' })).toBeNull();
    expect(validateReply({ ...ok, line: 'ore | water | polymer' })).toBeNull();
  });

  it('rejects an over-long reply', () => {
    expect(validateReply({ ...ok, line: 'a'.repeat(MAX_REPLY_CHARS + 1) })).toBeNull();
  });

  it('rejects empty, missing and malformed shapes', () => {
    expect(validateReply(null)).toBeNull();
    expect(validateReply('a string')).toBeNull();
    expect(validateReply({ line: '   ', mood: 'neutral' })).toBeNull();
    expect(validateReply({ line: 'fine' })).toBeNull();
    expect(validateReply({ ...ok, mood: 'furious' })).toBeNull();
  });

  it('constrains the schema to exactly two fields', () => {
    expect(Object.keys(VENDOR_REPLY_SCHEMA.properties)).toEqual(['line', 'mood']);
    expect(VENDOR_REPLY_SCHEMA.additionalProperties).toBe(false);
    expect(VENDOR_REPLY_SCHEMA.required).toEqual(['line', 'mood']);
  });
});

describe('player input', () => {
  it('collapses whitespace and caps length', () => {
    expect(sanitisePlayerInput('  what   is   this  ')).toBe('what is this');
    expect(sanitisePlayerInput('x'.repeat(500))).toHaveLength(MAX_PLAYER_INPUT);
  });
});

describe('authored fallback', () => {
  it('always produces a usable reply, whatever it is asked', () => {
    for (const question of ['how much', 'who are you', 'what do you sell', 'why did it change', '???', '']) {
      const reply = authoredReply(vendor, question);
      expect(reply.line.length).toBeGreaterThan(0);
      expect(reply.line.length).toBeLessThanOrEqual(MAX_REPLY_CHARS);
      expect(reply.source).toBe('authored');
    }
  });

  it('answers a price question with an actual price from the shelf', () => {
    const reply = authoredReply(vendor, 'how much for that');
    expect(reply.line).toMatch(/\d/);
  });

  it('deflects anything outside the trader’s world', () => {
    const reply = authoredReply(vendor, 'who built this station');
    expect(reply.line).toMatch(/not my line of work/);
  });
});

describe('fixture replies', () => {
  it('are deterministic for the same vendor and question', () => {
    const a = fixtureReply(vendor, 'what have you got');
    const b = fixtureReply(vendor, 'what have you got');
    expect(a).toEqual(b);
    expect(a.source).toBe('fixture');
  });

  it('differ across questions and across vendors', () => {
    const lines = new Set([
      fixtureReply(vendor, 'what have you got').line,
      fixtureReply(vendor, 'how much').line,
      fixtureReply(vendor, 'why so expensive').line,
      fixtureReply(vendors[1], 'what have you got').line
    ]);
    expect(lines.size).toBeGreaterThan(1);
  });

  it('always pass the same validation the model output must pass', () => {
    for (const v of vendors.slice(0, 6)) {
      for (const question of ['hello', 'price', 'what is this', 'anything cheaper']) {
        const reply = fixtureReply(v, question);
        expect(validateReply({ line: reply.line, mood: reply.mood })).not.toBeNull();
      }
    }
  });
});

describe('greeting', () => {
  it('is authored and comes from the vendor', () => {
    const turn = greetingTurn(vendor);
    expect(turn.speaker).toBe('vendor');
    expect(turn.source).toBe('authored');
    expect(turn.text).toBe(vendor.persona.greeting);
  });
});
