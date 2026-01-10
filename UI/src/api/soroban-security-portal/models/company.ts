export interface CompanyItem {
  id: number;
  name: string;
  description?: string;
  image?: string;
  url: string;
  date: Date;
  createdBy: string;
}