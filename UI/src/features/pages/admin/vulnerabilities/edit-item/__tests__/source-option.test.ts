import { describe, it, expect } from 'vitest';
import { findSourceOption, EXTERNAL_SOURCE_ID } from '../source-option';
import { VulnerabilitySource } from '../../../../../../api/soroban-security-portal/models/vulnerability';

const external: VulnerabilitySource = { id: EXTERNAL_SOURCE_ID, name: 'External', url: '' };
const approved: VulnerabilitySource = { id: 12, name: 'Blend - Certora', url: '' };
const agentPending: VulnerabilitySource = { id: 77, name: 'SG Forge', url: '' }; // status "new", agent-created
const duplicateA: VulnerabilitySource = { id: 40, name: 'Audit Report', url: '' };
const duplicateB: VulnerabilitySource = { id: 41, name: 'Audit Report', url: '' };

const sources = [approved, agentPending, duplicateA, duplicateB, external];

describe('findSourceOption', () => {
  it('matches an agent-created (unapproved) report by id', () => {
    expect(findSourceOption(sources, 77, 'SG Forge')).toBe(agentPending);
  });

  it('prefers the id over the name when two reports share a name', () => {
    expect(findSourceOption(sources, 41, 'Audit Report')).toBe(duplicateB);
    expect(findSourceOption(sources, 40, 'Audit Report')).toBe(duplicateA);
  });

  it('falls back to the name when no id is available', () => {
    expect(findSourceOption(sources, undefined, 'Blend - Certora')).toBe(approved);
    expect(findSourceOption(sources, null, 'Blend - Certora')).toBe(approved);
  });

  it('falls back to the name when the id is not in the list', () => {
    expect(findSourceOption(sources, 999, 'Blend - Certora')).toBe(approved);
  });

  it('selects External for a finding without a linked report', () => {
    expect(findSourceOption(sources, null, null)).toBe(external);
    expect(findSourceOption(sources, undefined, '')).toBe(external);
    expect(findSourceOption(sources, -1, '')).toBe(external); // the form submits -1 for "no report"
  });

  it('selects External when the saved choice is the External id (0)', () => {
    expect(findSourceOption(sources, EXTERNAL_SOURCE_ID)).toBe(external);
  });

  it('returns null when a report is referenced but cannot be found', () => {
    expect(findSourceOption(sources, 999, 'Gone Report')).toBeNull();
    expect(findSourceOption(sources, undefined, 'Gone Report')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findSourceOption([], 12, 'Blend - Certora')).toBeNull();
    expect(findSourceOption([], null, null)).toBeNull();
  });
});
