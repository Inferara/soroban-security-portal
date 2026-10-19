export interface PersonalNote {
    id: number;
    vulnerabilityId: number;
    content: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    description: string;
    severity: string;
}

export interface UpsertPersonalNoteRequest {
    content: string;
}
