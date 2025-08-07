import { LoginType } from "./client-sso";

export class EditUserItem {
    isEnabled: boolean = false;
    fullName: string = '';
    email: string = '';
    role: string = '';
    image: string = '';
    personalInfo: string = '';
    connectedAccounts: ConnectedAccountItem[] = [];
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