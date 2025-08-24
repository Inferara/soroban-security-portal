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
  author?: string;
  lastActionBy?: string;
  lastActionAt?: string;
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
  protocolName?: string;
  companyName?: string;
  auditorName?: string; //TODO change to id?
  sortBy?: 'date' | 'name';
  sortDirection?: 'asc' | 'desc';
}