export interface Report {
  id: number;
  name: string;
  image?: string;
  date: string;
  status?: string;
  author?: string;
  lastActionBy?: string;
  lastActionAt?: string;
} 

export interface AddReport {
  id: number;
  title: string;
  url: string;
}

export interface ReportSearch {
  searchText?: string;
  from?: string;
  to?: string;
  sortBy?: 'date' | 'name';
  sortDirection?: 'asc' | 'desc';
}