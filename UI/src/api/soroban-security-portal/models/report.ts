export interface Report {
  id: number;
  name: string;
  image?: string;
  date: string;
  project: string;
  auditor: string;
  status?: string;
  author?: string;
  lastActionBy?: string;
  lastActionAt?: string;
} 

export interface AddReport {
  id: number;
  title: string;
  project: string;
  auditor: string;
  date: string;
  url: string;
}

export interface ReportSearch {
  searchText?: string;
  from?: string;
  to?: string;
  project?: string;
  auditor?: string;
  sortBy?: 'date' | 'name';
  sortDirection?: 'asc' | 'desc';
}