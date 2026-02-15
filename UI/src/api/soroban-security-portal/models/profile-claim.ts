export interface ProfileClaimRequest {
  id: number;
  entityType: 'protocol' | 'auditor';
  entityId: number;
  userId: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  verificationMethod?: string;
  verificationData?: string | null;
  createdAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: number | null;
  reason?: string | null;
}
