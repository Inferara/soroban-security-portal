export class ClientSsoItem {
    clientSsoId: number = 0;
    name: string = '';
    loginType: LoginType = LoginType.GoogleSSO;
    settings: Record<string, string> = {};
}

export enum LoginType {
    Password = 'Password',
    GoogleSSO = 'SsoGoogle',
}

export class ClientSsoSettingItem {
    parameterId: number = 0; 
    parameterName: string = ''; 
    parameterCode: string = ''; 
    required: boolean = false; 
    parameterType: ParameterType = ParameterType.Text;
}

export enum ParameterType {
    Text = 1,
    CheckBox = 2
}

export const ClientSsoSettings = [
    {
        loginType: LoginType.GoogleSSO,
        settings: [
            {
                parameterId: 0,
                parameterName: 'Domain',
                parameterCode: 'Domain',
                required: true,
                parameterType: ParameterType.Text,
            },
            {
                parameterId: 1,
                parameterName: 'Allowed login for users from this domain group...',
                parameterCode: 'Group',
                required: false,
                parameterType: ParameterType.Text,
            },
            {
                parameterId: 2,
                parameterName: 'Create user as Admin',
                parameterCode: 'AutoAdmin',
                required: false,
                parameterType: ParameterType.CheckBox,
            },
        ],
    },
    {
        loginType: LoginType.GoogleSSO,
        settings: [
            {
                parameterId: 0,
                parameterName: 'Domain',
                parameterCode: 'Domain',
                required: true,
                parameterType: ParameterType.Text,
            },
            {
                parameterId: 1,
                parameterName: 'Regex for allowed email (with ; separator)',
                parameterCode: 'EmailRegex',
                required: false,
                parameterType: ParameterType.Text,
            },
            {
                parameterId: 2,
                parameterName: 'Create user as Admin',
                parameterCode: 'AutoAdmin',
                required: true,
                parameterType: ParameterType.CheckBox,
            },
        ],
    },
];