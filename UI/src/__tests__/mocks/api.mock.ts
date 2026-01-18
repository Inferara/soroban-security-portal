import { vi } from 'vitest';
import { Vulnerability } from '../../api/soroban-security-portal/models/vulnerability';
import { Report } from '../../api/soroban-security-portal/models/report';
import { AuditorItem } from '../../api/soroban-security-portal/models/auditor';
import { ProtocolItem } from '../../api/soroban-security-portal/models/protocol';
import { CompanyItem } from '../../api/soroban-security-portal/models/company';
import { TagItem } from '../../api/soroban-security-portal/models/tag';
import { LoginModel } from '../../api/soroban-security-portal/models/login';

// Mock API responses
export const mockVulnerability: Vulnerability = {
  id: 1,
  title: 'Test Vulnerability',
  description: 'This is a test vulnerability description',
  severity: 'High',
  category: 'Reentrancy',
  status: 'Open',
  reportId: 1,
  date: '2026-01-17T00:00:00',
  createdBy: 'admin',
};

export const mockVulnerabilities: Vulnerability[] = [
  mockVulnerability,
  {
    id: 2,
    title: 'Second Vulnerability',
    description: 'Another vulnerability',
    severity: 'Critical',
    category: 'Access Control',
    status: 'Fixed',
    reportId: 1,
    date: '2026-01-16T00:00:00',
    createdBy: 'admin',
  },
  {
    id: 3,
    title: 'Low Severity Issue',
    description: 'Minor issue',
    severity: 'Low',
    category: 'Gas Optimization',
    status: 'Open',
    reportId: 2,
    date: '2026-01-15T00:00:00',
    createdBy: 'moderator',
  },
];

export const mockReport: Report = {
  id: 1,
  protocolName: 'Test Protocol',
  auditorName: 'Test Auditor',
  reportUrl: 'https://example.com/report.pdf',
  date: '2026-01-17T00:00:00',
  status: 'Approved',
  createdBy: 'admin',
};

export const mockReports: Report[] = [
  mockReport,
  {
    id: 2,
    protocolName: 'Another Protocol',
    auditorName: 'Another Auditor',
    reportUrl: 'https://example.com/report2.pdf',
    date: '2026-01-16T00:00:00',
    status: 'Pending',
    createdBy: 'contributor',
  },
];

export const mockAuditor: AuditorItem = {
  id: 1,
  name: 'Test Auditor',
  url: 'https://auditor.example.com',
  description: 'A trusted security auditor',
  date: '2026-01-17T00:00:00',
  createdBy: 'admin',
};

export const mockAuditors: AuditorItem[] = [
  mockAuditor,
  {
    id: 2,
    name: 'Second Auditor',
    url: 'https://auditor2.example.com',
    description: 'Another security firm',
    date: '2026-01-16T00:00:00',
    createdBy: 'admin',
  },
];

export const mockProtocol: ProtocolItem = {
  id: 1,
  name: 'Test Protocol',
  url: 'https://protocol.example.com',
  description: 'A DeFi protocol',
  companyId: 1,
  date: '2026-01-17T00:00:00',
  createdBy: 'admin',
};

export const mockProtocols: ProtocolItem[] = [
  mockProtocol,
  {
    id: 2,
    name: 'Second Protocol',
    url: 'https://protocol2.example.com',
    description: 'Another protocol',
    companyId: 2,
    date: '2026-01-16T00:00:00',
    createdBy: 'admin',
  },
];

export const mockCompany: CompanyItem = {
  id: 1,
  name: 'Test Company',
  url: 'https://company.example.com',
  description: 'A blockchain company',
  date: '2026-01-17T00:00:00',
  createdBy: 'admin',
};

export const mockCompanies: CompanyItem[] = [
  mockCompany,
  {
    id: 2,
    name: 'Second Company',
    url: 'https://company2.example.com',
    description: 'Another company',
    date: '2026-01-16T00:00:00',
    createdBy: 'admin',
  },
];

export const mockTag: TagItem = {
  id: 1,
  name: 'soroban',
  date: '2026-01-17T00:00:00',
  createdBy: 'admin',
};

export const mockTags: TagItem[] = [
  mockTag,
  { id: 2, name: 'stellar', date: '2026-01-16T00:00:00', createdBy: 'admin' },
  { id: 3, name: 'defi', date: '2026-01-15T00:00:00', createdBy: 'admin' },
];

export const mockUser: LoginModel = {
  loginId: 1,
  userName: 'testuser',
  email: 'test@example.com',
  role: 1, // Admin
  createdBy: 'system',
  isAvatarManuallySet: false,
};

export const mockUsers: LoginModel[] = [
  mockUser,
  {
    loginId: 2,
    userName: 'moderator',
    email: 'mod@example.com',
    role: 2, // Moderator
    createdBy: 'admin',
    isAvatarManuallySet: true,
  },
];

// Mock API functions
export const createMockApi = () => ({
  // Vulnerabilities
  getVulnerabilitiesCall: vi.fn().mockResolvedValue(mockVulnerabilities),
  getVulnerabilityByIdCall: vi.fn().mockResolvedValue(mockVulnerability),
  removeVulnerabilityCall: vi.fn().mockResolvedValue(undefined),
  approveVulnerabilityCall: vi.fn().mockResolvedValue(undefined),
  rejectVulnerabilityCall: vi.fn().mockResolvedValue(undefined),

  // Reports
  getReportsCall: vi.fn().mockResolvedValue(mockReports),
  getReportByIdCall: vi.fn().mockResolvedValue(mockReport),
  removeReportCall: vi.fn().mockResolvedValue(undefined),
  approveReportCall: vi.fn().mockResolvedValue(undefined),
  rejectReportCall: vi.fn().mockResolvedValue(undefined),

  // Auditors
  getAuditorListDataCall: vi.fn().mockResolvedValue(mockAuditors),
  getAuditorByIdCall: vi.fn().mockResolvedValue(mockAuditor),
  addAuditorCall: vi.fn().mockResolvedValue(mockAuditor),
  updateAuditorCall: vi.fn().mockResolvedValue(mockAuditor),
  removeAuditorCall: vi.fn().mockResolvedValue(undefined),

  // Protocols
  getProtocolListDataCall: vi.fn().mockResolvedValue(mockProtocols),
  getProtocolByIdCall: vi.fn().mockResolvedValue(mockProtocol),
  addProtocolCall: vi.fn().mockResolvedValue(mockProtocol),
  updateProtocolCall: vi.fn().mockResolvedValue(mockProtocol),
  removeProtocolCall: vi.fn().mockResolvedValue(undefined),

  // Companies
  getCompanyListDataCall: vi.fn().mockResolvedValue(mockCompanies),
  getCompanyByIdCall: vi.fn().mockResolvedValue(mockCompany),
  addCompanyCall: vi.fn().mockResolvedValue(mockCompany),
  updateCompanyCall: vi.fn().mockResolvedValue(mockCompany),
  removeCompanyCall: vi.fn().mockResolvedValue(undefined),

  // Tags
  getTagListDataCall: vi.fn().mockResolvedValue(mockTags),
  getTagByIdCall: vi.fn().mockResolvedValue(mockTag),
  addTagCall: vi.fn().mockResolvedValue(mockTag),
  updateTagCall: vi.fn().mockResolvedValue(mockTag),
  removeTagCall: vi.fn().mockResolvedValue(undefined),

  // Users
  getUsersCall: vi.fn().mockResolvedValue(mockUsers),
  getUserByIdCall: vi.fn().mockResolvedValue(mockUser),
  addUserCall: vi.fn().mockResolvedValue(mockUser),
  updateUserCall: vi.fn().mockResolvedValue(mockUser),
  removeUserCall: vi.fn().mockResolvedValue(undefined),
});

// Helper to mock the entire API module
export const mockApiModule = () => {
  const mocks = createMockApi();

  vi.mock('../../api/soroban-security-portal/soroban-security-portal-api', () => mocks);

  return mocks;
};
