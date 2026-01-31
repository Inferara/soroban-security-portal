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
}

export class UserSearchResult {
    loginId: number = 0;
    login: string = '';
    fullName: string = '';
    image?: string;
}
