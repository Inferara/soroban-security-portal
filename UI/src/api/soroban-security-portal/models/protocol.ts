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