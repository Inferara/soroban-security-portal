
export enum ActivityType {
  ReportCreated = 1,
  ReportApproved = 2,
  VulnerabilityCreated = 3,
  VulnerabilityApproved = 4,
  CommentCreated = 5
}

export interface Activity {
  id: number;
  type: ActivityType;
  typeLabel: string;
  entityId: number;
  entityTitle: string;
  loginId?: number;
  actorName: string;
  createdAt: string;
  
  // Entity specific
  protocolName?: string;
  protocolId?: number;
  auditorName?: string;
  auditorId?: number;
  companyName?: string;
  companyId?: number;
  severity?: string;
  
  entityUrl: string;
}

export interface Comment {
  id: number;
  content: string;
  loginId: number;
  userName: string;
  createdAt: string;
  updatedAt?: string;
  entityType: number;
  entityId: number;
  isDeleted: boolean;
}

export interface CreateComment {
  content: string;
  entityType: number;
  entityId: number;
}

export interface UpdateComment {
  id: number;
  content: string;
}

export interface UserFollow {
  id: number;
  loginId: number;
  entityType: number;
  entityId: number;
  entityName: string;
  followedAt: string;
}

export enum FollowEntityType {
  Protocol = 1,
  Auditor = 2,
  Company = 3
}

export enum CommentEntityType {
  Report = 1,
  Vulnerability = 2,
  Protocol = 3,
  Auditor = 4,
  Company = 5
}
