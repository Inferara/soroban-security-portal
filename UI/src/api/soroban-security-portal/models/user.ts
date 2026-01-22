import { LoginType } from "./client-sso";

export class SelfEditUserItem {
    fullName: string = '';
    image: string = '';
    personalInfo: string = '';
    connectedAccounts: ConnectedAccountItem[] = [];
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
    
    // Public profile fields
    bio?: string;
    expertiseTags?: string[];
    socialLinks?: SocialLinks;
    reputationScore?: number;
    badges?: Badge[];
    isPublic?: boolean;
    followersCount?: number;
    followingCount?: number;
    isFollowing?: boolean; // Current user's relationship to this user
}

export class SocialLinks {
    github?: string;
    twitter?: string;
    linkedin?: string;
    website?: string;
    discord?: string;
}

export class Badge {
    id: string = '';
    name: string = '';
    icon: string = '';
    description?: string;
    color?: string;
}