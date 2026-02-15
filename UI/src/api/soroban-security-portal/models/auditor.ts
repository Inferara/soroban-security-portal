export interface AuditorItem {
  id: number;
  name: string;
  description: string;
  image?: string;
  url: string;
  date: Date;
  createdBy: string;
  isVerified?: boolean;
  verificationMethod?: string;
  verificationDate?: Date | null;
}