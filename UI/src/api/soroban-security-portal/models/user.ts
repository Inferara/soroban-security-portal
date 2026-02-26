import { LoginType } from "./client-sso";

export class SelfEditUserItem {
    fullName: string = '';
    image: string = '';
    personalInfo: string = '';
    connectedAccounts: ConnectedAccountItem[] = [];
    bio: string = '';
    website: string = '';
    twitter: string = '';
    github: string = '';
    discord: string = '';
    expertiseTags: string[] = [];
}

export class EditUserItem extends SelfEditUserItem {
    isEnabled: boolean = false;
    email: string = '';
    role: string = '';
}

export class ConnectedAccountItem {
    serviceName: string = '';
    accountId: string = '';
}

export class CreateUserItem extends EditUserItem {
    login: string = '';
    password: string = '';
    created: Date = new Date();
    createdBy: string = '';
}

export class UserItem extends CreateUserItem {
    loginId: number = 0;
    loginType: LoginType = LoginType.GoogleSSO;
}

export const MAX_BIO_LENGTH = 500;
export const MAX_TAG_LENGTH = 30;
export const MAX_TAGS = 15;

export const PREDEFINED_EXPERTISE_TAGS: string[] = [
    // Languages
    'Rust', 'TypeScript', 'JavaScript', 'Solidity', 'Cairo', 'Python', 'Go', 'C++',
    // Ecosystems
    'Soroban', 'Soroban SDK', 'Stellar', 'Ethereum', 'Starknet', 'Polkadot', 'Cosmos', 'Solana', 'BNB Chain',
    // DeFi / Web3
    'DeFi', 'NFT', 'DAO', 'AMM', 'DEX', 'Lending', 'Yield Farming', 'Bridges', 'Layer 2', 'ZK Proofs',
    // Security
    'Smart Contract Auditing', 'Formal Verification', 'Penetration Testing', 'Security Research', 'Bug Bounty',
    // Tools
    'Hardhat', 'Foundry', 'Anchor',
    // Roles
    'Auditor', 'Protocol Designer', 'Educator',
];

// Fix: added /i flag so HTTPS://Twitter.com/... and mixed-case variants pass
export function isValidTwitterUrl(url: string): boolean {
    if (!url) return true;
    return /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[A-Za-z0-9_]{1,15}\/?$/i.test(url);
}

// Fix: added /i flag so HTTPS://GitHub.com/... and mixed-case variants pass
export function isValidGitHubUrl(url: string): boolean {
    if (!url) return true;
    return /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_-]+\/?$/i.test(url);
}

// Fix: check protocol explicitly — rejects javascript:, data:, vbscript: (XSS vectors)
export function isValidWebsiteUrl(url: string): boolean {
    if (!url) return true;
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch { return false; }
}