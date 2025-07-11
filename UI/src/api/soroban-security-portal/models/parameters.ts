export class ContentParameter {
    name: string = ''; 
    code: string = ''; 
    value: string = ''; 
    extension?: string = ''; 
}

export class Parameter {
    parameterId: number = 0; 
    parameterName: string = ''; 
    parameterCode: string = ''; 
    parameterHint?: string = ''; 
    parameterNote?: string = ''; 
    parameterType: ParameterType = ParameterType.Text; 
    parameterIsRequired?: boolean = true; 
    parameterExtension?: string = undefined;
    parameterDefault?: string = ''; 
    parameterDefinition?: object | undefined = undefined; 
    parameterVisibleCheck?: (parameters: Record<string, string>) => boolean = () => true; 
}

export enum ParameterType {
    Text = 1,
    TextArea = 2,
    Password = 3,
    AgentsList = 4,
    Handlebars = 5,
    Python = 6,
    CSharp = 7,
    Number = 8,
    CheckBoxList = 9,
    ComboBox = 10,
    File = 11,
    Connection = 12,
    AutoComplete = 13,
    Cron = 14,
    UserSelection = 15,
    ReadOnly = 16,
    PgSql = 17,
    MsSql = 18,
    AzureSpeechVoice = 19,
    AzureAiSearchIndex = 20,
    VectorDbConnection = 21,
    Prompt = 22,
    Json = 23,
    AccessType = 24,
    DateTime = 25,
    Duration = 26,
    CallType = 27,
    NodeJs = 28,
}