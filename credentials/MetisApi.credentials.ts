import type {
    ICredentialType,
    INodeProperties,
    IAuthenticateGeneric,
    ICredentialTestRequest,
} from 'n8n-workflow';

export class MetisApi implements ICredentialType {
    name = 'metisApi';
    displayName = 'Metis API';

    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            required: true,
        },
    ];

    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                Authorization: '={{$credentials.apiKey}}',
                'X-Metis-Client': 'n8n-node/1.0.0',
                'User-Agent': 'metis-n8n-node/1.0.0',
            },
        },
    };

    test: ICredentialTestRequest = {
        request: {
            url: 'https://api.metisai.ir/api/v1/user/me',
        },
    };
}
