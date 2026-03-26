import { useEffect, useState, useMemo } from 'react';
import { getProtocolsWithMetricsCall, getCompanyListDataCall, getAuditorListDataCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ProtocolItem, ProtocolWithMetrics } from '../../../../../api/soroban-security-portal/models/protocol';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';

export const useProtocols = () => {
    const [protocolsWithMetrics, setProtocolsWithMetrics] = useState<ProtocolWithMetrics[]>([]);
    const [filteredProtocols, setFilteredProtocols] = useState<ProtocolWithMetrics[]>([]);
    const [companiesList, setCompaniesList] = useState<CompanyItem[]>([]);
    const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [selectedProtocols, setSelectedProtocols] = useState<ProtocolItem[]>([]);
    const [selectedCompanies, setSelectedCompanies] = useState<CompanyItem[]>([]);
    const [selectedAuditors, setSelectedAuditors] = useState<AuditorItem[]>([]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [protocolsData, companiesData, auditorsData] = await Promise.all([
                getProtocolsWithMetricsCall(),
                getCompanyListDataCall(),
                getAuditorListDataCall()
            ]);
            setProtocolsWithMetrics(protocolsData);
            setCompaniesList(companiesData);
            setAuditorsList(auditorsData);
        } catch (err) {
            console.error('Failed to fetch protocols data:', err);
            setError('Failed to load protocols. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const lowerSearch = searchText.toLowerCase();
        const filtered = protocolsWithMetrics.filter(pm => {
            const p = pm.protocol;

            // 1. Explicit multi-select filters
            if (selectedProtocols.length > 0 && !selectedProtocols.some(sp => sp.id === p.id)) {
                return false;
            }

            if (selectedCompanies.length > 0 && !selectedCompanies.some(sc => sc.name === pm.companyName)) {
                return false;
            }

            if (selectedAuditors.length > 0 && !selectedAuditors.some(sa => pm.auditors.includes(sa.name))) {
                return false;
            }

            // 2. Broad search text filter
            if (!lowerSearch) return true;

            const matchesName = p.name.toLowerCase().includes(lowerSearch);
            const matchesDesc = p.description && p.description.toLowerCase().includes(lowerSearch);
            const matchesCompany = pm.companyName.toLowerCase().includes(lowerSearch);
            const matchesAuditor = pm.auditors.some(a => a.toLowerCase().includes(lowerSearch));

            return matchesName || matchesDesc || matchesCompany || matchesAuditor;
        });
        setFilteredProtocols(filtered);
    }, [searchText, protocolsWithMetrics, selectedProtocols, selectedCompanies, selectedAuditors]);

    // Pre-calculate metrics map for quick lookup
    interface ProtocolMetrics {
        reportsCount: number;
        vulnerabilitiesCount: number;
        fixedCount: number;
        fixRate: number;
        companyName: string;
        auditors: string[];
    }

    const metricsMap = useMemo(() => {
        const map = new Map<number, ProtocolMetrics>();
        protocolsWithMetrics.forEach(pm => {
            map.set(pm.protocol.id, {
                reportsCount: pm.reportsCount,
                vulnerabilitiesCount: pm.vulnerabilitiesCount,
                fixedCount: pm.fixedCount,
                fixRate: pm.fixRate,
                companyName: pm.companyName,
                auditors: pm.auditors
            });
        });
        return map;
    }, [protocolsWithMetrics]);

    const getProtocolMetrics = (protocolId: number): ProtocolMetrics => {
        return metricsMap.get(protocolId) || {
            reportsCount: 0,
            vulnerabilitiesCount: 0,
            fixedCount: 0,
            fixRate: 0,
            companyName: 'N/A',
            auditors: []
        };
    };

    return {
        protocols: filteredProtocols.map(pm => pm.protocol), // Maintain compatibility with component
        protocolsList: protocolsWithMetrics.map(pm => pm.protocol),
        companiesList,
        auditorsList,
        loading,
        error,
        searchText,
        setSearchText,
        selectedProtocols,
        setSelectedProtocols,
        selectedCompanies,
        setSelectedCompanies,
        selectedAuditors,
        setSelectedAuditors,
        getProtocolMetrics,
        refresh: fetchData
    };
};
