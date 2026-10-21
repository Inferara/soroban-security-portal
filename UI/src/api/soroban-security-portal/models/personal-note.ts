export interface PersonalNote {
    id: number;
    vulnerabilityId: number;
    content: string;
    createdAt: string;
    updatedAt: string;
    /** False when the vulnerability was hidden or deleted; title/description/severity are then empty. */
    isVulnerabilityAvailable: boolean;
    title: string;
    description: string;
    severity: string;
}

export interface UpsertPersonalNoteRequest {
    content: string;
}
