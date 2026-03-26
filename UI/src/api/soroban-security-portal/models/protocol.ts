export interface ProtocolItem {
  id: number;
  name: string;
  description?: string;
  image?: string;
  url: string;
  date: Date;
  companyId?: number;
  createdBy: string;
}

export interface ProtocolWithMetrics {
  protocol: ProtocolItem;
  reportsCount: number;
  vulnerabilitiesCount: number;
  fixedCount: number;
  fixRate: number;
  companyName: string;
  auditors: string[];
}