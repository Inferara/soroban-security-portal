export interface Report {
  id: number;
  name: string;
  image?: string;
  date: string;
  protocolId: number;
  protocolName: string;
  companyId: number;
  companyName: string;
  auditorId: number;
  auditorName: string;
  status?: string;
  createdBy: number;
  lastActionBy?: string;
  lastActionAt?: string;
  mdFile?: string; // Markdown content
} 

export interface AddReport {
  id: number;
  title: string;
  protocolId: number;
  auditorId: number;
  date: string;
  url: string;
}

export interface ReportSearch {
  searchText?: string;
  from?: string;
  to?: string;
  protocolId?: number;
  protocolName?: string;
  companyId?: number;
  companyName?: string;
  auditorId?: number;
  auditorName?: string;
  sortBy?: 'date' | 'name';
  sortDirection?: 'asc' | 'desc';
}