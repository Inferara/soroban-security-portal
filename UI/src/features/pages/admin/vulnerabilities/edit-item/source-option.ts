import { VulnerabilitySource } from '../../../../../api/soroban-security-portal/models/vulnerability';

// The "External" pseudo-report the sources endpoint appends for findings without a linked report.
export const EXTERNAL_SOURCE_ID = 0;

/**
 * Picks the Report (source) option the edit form should preselect for a finding.
 *
 * Order of preference:
 *  1. by report id - the only stable key. Report names are not unique, and agent-created
 *     (not yet approved) reports share the list with approved ones, so a name match can land
 *     on the wrong row or on nothing at all (issue #195);
 *  2. by report name - for anything that only carries a name;
 *  3. "External" (id 0) - when the finding has no linked report. A plain `if (id)` check used
 *     to drop this case because the External id is falsy.
 */
export const findSourceOption = (
  sourceList: VulnerabilitySource[],
  sourceId?: number | null,
  sourceName?: string | null,
): VulnerabilitySource | null => {
  if (sourceId != null && sourceId > 0) {
    const byId = sourceList.find(s => s.id === sourceId);
    if (byId) return byId;
  }

  if (sourceName) {
    const byName = sourceList.find(s => s.name === sourceName);
    if (byName) return byName;
  }

  const hasReport = (sourceId != null && sourceId > 0) || !!sourceName;
  if (!hasReport) {
    return sourceList.find(s => s.id === EXTERNAL_SOURCE_ID) ?? null;
  }

  return null;
};
