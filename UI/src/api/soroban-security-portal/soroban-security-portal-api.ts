import RestApi from '../rest-api';
import { UserItem, CreateUserItem, EditUserItem, SelfEditUserItem } from './models/user';
import { SettingsItem } from './models/settings';
import { ClientSsoItem } from './models/client-sso';
import { Subscription } from './models/subscription';
import { environment } from './../../environments/environment';
import { User } from "oidc-client-ts"
import { Vulnerability, VulnerabilitySearch, VulnerabilitySeverity, VulnerabilitySource, VulnerabilityStatistics, StatisticsChanges } from './models/vulnerability';
import { AddReport, Report, ReportSearch } from './models/report';
import { AuditorItem } from './models/auditor';
import { ProtocolItem } from './models/protocol';
import { TagItem } from './models/tag';
import { CompanyItem } from './models/company';

// --- TAGS ---
export const getTagsCall = async (): Promise<TagItem[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/tags', 'GET');
    return response.data as TagItem[];
};
export const removeTagCall = async (tagId: number): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/tags/${tagId}`, 'DELETE');
    return response.data as boolean;
};
export const addTagCall = async (tag: TagItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/tags', 'POST', tag);
    return response.data as boolean;
};
export const editTagCall = async (tag: TagItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/tags`, 'PUT', tag);
    return response.data as boolean;
};
export const getTagByIdCall = async (tagId: number): Promise<TagItem> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/tags/${tagId}`, 'GET');
    return response.data as TagItem;
};
// --- FILES ---
export const getFilesCall = async (containerGuid: string): Promise<string[]> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/file/${containerGuid}`, 'GET');
    return response.data as string[];
};
export const deleteFileCall = async (containerGuid: string, fileName: string): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/file/${containerGuid}/${fileName}`, 'DELETE');
    return response.data as boolean;
};

// --- AUDITORS ---
export const getAuditorListDataCall = async (): Promise<AuditorItem[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/auditors', 'GET');
    return response.data as AuditorItem[];
};
export const removeAuditorCall = async (auditorId: number): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/auditors/${auditorId}`, 'DELETE');
    return response.data as boolean;
};
export const addAuditorCall = async (auditor: AuditorItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/auditors', 'POST', auditor);
    return response.data as boolean;
};
export const editAuditorCall = async (auditor: AuditorItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/auditors`, 'PUT', auditor);
    return response.data as boolean;
};
export const getAuditorByIdCall = async (auditorId: number): Promise<AuditorItem> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/auditors/${auditorId}`, 'GET');
    return response.data as AuditorItem;
};
export const getAuditorStatisticsChanges = async (): Promise<StatisticsChanges> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/auditors/statistics/changes', 'GET');
    return response.data as StatisticsChanges;
};

// --- PROTOCOLS ---
export const getProtocolListDataCall = async (): Promise<ProtocolItem[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/protocols', 'GET');
    return response.data as ProtocolItem[];
};
export const removeProtocolCall = async (protocolId: number): Promise<boolean> => {   
    const client = await getRestClient();
    const response = await client.request(`api/v1/protocols/${protocolId}`, 'DELETE');
    return response.data as boolean;
};
export const addProtocolCall = async (protocol: ProtocolItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/protocols', 'POST', protocol);
    return response.data as boolean;
};
export const editProtocolCall = async (protocol: ProtocolItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/protocols`, 'PUT', protocol);
    return response.data as boolean;
};
export const getProtocolByIdCall = async (protocolId: number): Promise<ProtocolItem> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/protocols/${protocolId}`, 'GET');
    return response.data as ProtocolItem;
};
export const getProtocolStatisticsChanges = async (): Promise<StatisticsChanges> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/protocols/statistics/changes', 'GET');
    return response.data as StatisticsChanges;
};

// --- COMPANIES ---
export const getCompanyListDataCall = async (): Promise<CompanyItem[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/companies', 'GET');
    return response.data as CompanyItem[];
};
export const removeCompanyCall = async (companyId: number): Promise<boolean> => {   
    const client = await getRestClient();
    const response = await client.request(`api/v1/companies/${companyId}`, 'DELETE');
    return response.data as boolean;
};
export const addCompanyCall = async (company: CompanyItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/companies', 'POST', company);
    return response.data as boolean;
};
export const editCompanyCall = async (company: CompanyItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/companies`, 'PUT', company);
    return response.data as boolean;
};
export const getCompanyByIdCall = async (companyId: number): Promise<CompanyItem> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/companies/${companyId}`, 'GET');
    return response.data as CompanyItem;
};

// --- REPORTS ---
export const addReportCall = async (report: AddReport | FormData): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/reports/add', 'POST', report);
    return response.data as boolean;
};
export const getReportListDataCall = async (): Promise<Report[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/reports', 'GET');
    return response.data as Report[];
};
export const getAllReportListDataCall = async (): Promise<Report[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/reports/all', 'GET');
    return response.data as Report[];
};
export const removeReportCall = async (reportId: number): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/reports/${reportId}`, 'DELETE');
    return response.data as boolean;
};
export const approveReportCall = async (reportId: number): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/reports/${reportId}/approve`, 'POST');
    return response.data as boolean;
};
export const rejectReportCall = async (reportId: number): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/reports/${reportId}/reject`, 'POST');
    return response.data as boolean;
};
export const getReportsCall = async (reportSearch?: ReportSearch): Promise<Report[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/reports', 'POST', reportSearch);
    return response.data as Report[];
};
export const getReportByIdCall = async (reportId: number): Promise<Report> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/reports/${reportId}`, 'GET');
    return response.data as Report;
};
export const editReportCall = async (report: Report): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/reports/${report.id}`, 'PUT', report);
    return response.data as boolean;
};
export const getReportStatisticsChanges = async (): Promise<StatisticsChanges> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/reports/statistics/changes', 'GET');
    return response.data as StatisticsChanges;
};

// --- VULNERABILITIES ---
export const getSeveritiesCall = async (): Promise<VulnerabilitySeverity[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/vulnerabilities/severities', 'GET');
    return response.data as VulnerabilitySeverity[];
};
export const getSourceCall = async (): Promise<VulnerabilitySource[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/vulnerabilities/sources', 'GET');
    return response.data as VulnerabilitySource[];
};
export const getVulnerabilitiesCall = async (vulnerabilitySearch?: VulnerabilitySearch): Promise<Vulnerability[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/vulnerabilities', 'POST', vulnerabilitySearch);
    return response.data as Vulnerability[];
};
export const getVulnerabilitiesStatistics = async (): Promise<VulnerabilityStatistics> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/vulnerabilities/statistics', 'GET');
    return response.data as VulnerabilityStatistics;
};
export const getVulnerabilitiesStatisticsChanges = async (): Promise<StatisticsChanges> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/vulnerabilities/statistics/changes', 'GET');
    return response.data as StatisticsChanges;
};
export const getVulnerabilitiesTotalCall = async (vulnerabilitySearch?: VulnerabilitySearch): Promise<number> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/vulnerabilities/total', 'POST', vulnerabilitySearch);
    return response.data as number;
};
export const addVulnerabilityCall = async (vulnerability: Vulnerability | FormData): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/vulnerabilities/add', 'POST', vulnerability);
    return response.data as boolean;
};
export const approveVulnerabilityCall = async (vulnerabilityId: number): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/vulnerabilities/${vulnerabilityId}/approve`, 'POST');
    return response.data as boolean;
};
export const rejectVulnerabilityCall = async (vulnerabilityId: number): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/vulnerabilities/${vulnerabilityId}/reject`, 'POST');
    return response.data as boolean;
};
export const removeVulnerabilityCall = async (vulnerabilityId: number): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/vulnerabilities/${vulnerabilityId}`, 'DELETE');
    return response.data as boolean;
};
export const getVulnerabilityListDataCall = async (): Promise<Vulnerability[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/vulnerabilities', 'GET');
    return response.data as Vulnerability[];
};
export const getVulnerabilityByIdCall = async (vulnerabilityId: number): Promise<Vulnerability> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/vulnerabilities/${vulnerabilityId}`, 'GET');
    return response.data as Vulnerability;
};
export const editVulnerabilityCall = async (vulnerability: Vulnerability | FormData): Promise<boolean> => {
    const client = await getRestClient();
    let vulnerabilityId: number;
    let body: FormData;

    if (vulnerability instanceof FormData) {
        // Extract vulnerability JSON string from FormData
        const vulnStr = vulnerability.get('vulnerability') as string;
        vulnerabilityId = JSON.parse(vulnStr).id;
        body = vulnerability;
    } else {
        vulnerabilityId = vulnerability.id;
        body = new FormData();
        body.append('vulnerability', JSON.stringify(vulnerability));
    }

    const response = await client.request(
        `api/v1/vulnerabilities/${vulnerabilityId}`,
        'PUT',
        body
    );
    return response.data as boolean;
};
// --- USERS ---
export const changePasswordCall = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/user/changePassword', 'POST', {oldPassword, newPassword});
    return response.data as boolean;
};
export const getUserByIdCall = async (loginId: number): Promise<UserItem | null | undefined> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/user/${loginId}`, 'GET');
    return response.data as UserItem;
};
export const getUserListDataCall = async (): Promise<UserItem[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/user', 'GET');
    return response.data as UserItem[];
};
export const userEnabledCall = async (loginId: number): Promise<void> => {
    const client = await getRestClient();
    await client.request(`api/v1/user/${loginId}/enable`, 'POST');
};
export const userDisableCall = async (loginId: number): Promise<void> => {
    const client = await getRestClient();
    await client.request(`api/v1/user/${loginId}/disable`, 'POST');
};
export const createUserCall = async (createUserItem: CreateUserItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/user', 'POST', createUserItem);
    return response.data as boolean;
};
export const editUserCall = async (loginId: number, userItem: EditUserItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/user/${loginId}`, 'PUT', userItem);
    return response.data as boolean;
}
export const selfEditUserCall = async (loginId: number, userItem: SelfEditUserItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/user/self/${loginId}`, 'PUT', userItem);
    return response.data as boolean;
}
export const removeUserCall = async (userId: number): Promise<void> => {
    const client = await getRestClient();
    await client.request(`api/v1/user/${userId}`, 'DELETE');
};
// --- SETTINGS ---
export const rebootCall = async (): Promise<void> => {
    const client = await getRestClient();
    await client.request('api/v1/settings/reboot', 'POST', undefined, true);
};
export const saveSettingsCall = async (settings: SettingsItem[]): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/settings', 'POST', settings);
    return response.data as boolean;
};
export const getSettingsListCall = async (): Promise<SettingsItem[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/settings', 'GET');
    return response.data as SettingsItem[];
}
// --- SSO ---
export const getSsoClientsListDataCall = async (): Promise<ClientSsoItem[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/sso/clients', 'GET');
    return response.data as ClientSsoItem[];
}
export const getSsoClientByIdCall = async (ssoClientId: number): Promise<ClientSsoItem> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/sso/clients/${ssoClientId}`, 'GET');
    return response.data as ClientSsoItem;
}
export const removeSsoClientCall = async (ssoClientId: number): Promise<void> => {
    const client = await getRestClient();
    await client.request(`api/v1/sso/clients/${ssoClientId}`, 'DELETE');
}
export const createSsoClientCall = async (ssoClientItem: ClientSsoItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/sso/clients', 'POST', ssoClientItem);
    return response.data as boolean;
}
export const editSsoClientCall = async (ssoClientItem: ClientSsoItem): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/sso/clients/${ssoClientItem.clientSsoId}`, 'PUT', ssoClientItem);
    return response.data as boolean;
}

// --- SUBSCRIPTION ---
export const subscribeEmailCall = async (email: string): Promise<boolean> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/subscriptions/subscribe', 'POST', { email });
    return response.data as boolean;
};

export const getSubscriptionsListCall = async (): Promise<Subscription[]> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/subscriptions', 'GET');
    return response.data as Subscription[];
};

// Rest client
const getRestClient = async (): Promise<RestApi> => {
    const accessToken = getAccessToken()
    const restClient = new RestApi(environment.apiUrl, `Bearer ${accessToken}`);
    return restClient;
};

const getAccessToken = () => {
    const oidcStorage = sessionStorage.getItem(`oidc.user:${environment.apiUrl}/api/v1/connect:${environment.clientId}`)
    if (!oidcStorage) {
        return null;
    }
    return User.fromStorageString(oidcStorage).access_token;
}