import type {
    INodeType,
    INodeTypeDescription,
    INodeExecutionData,
    IExecuteFunctions,
    IDataObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { metisRequest } from '../helpers/transport';

export class MetisMessageChatbot implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Metis: Message Chatbot',
        name: 'metisMessageChatbot',
        group: ['transform'],
        icon: 'file:metis.png',
        version: 1,
        description: 'Create or reuse a chat session and send a message',
        defaults: { name: 'Metis: Message Chatbot' },
        credentials: [{ name: 'metisApi', required: true }],
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Bot ID',
                name: 'botId',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'bot_abc123',
            },
            {
                displayName: 'Session ID',
                name: 'sessionId',
                type: 'string',
                default: '',
                description: 'If empty, a new session will be created.',
            },
            {
                displayName: 'Message Type',
                name: 'messageType',
                type: 'options',
                options: [
                    { name: 'USER', value: 'USER' },
                    { name: 'TOOL', value: 'TOOL' },
                ],
                default: 'USER',
            },
            {
                displayName: 'Content',
                name: 'content',
                type: 'string',
                typeOptions: { rows: 5 },
                default: '',
            },
        ],
    };

    methods = {};

    async execute(this: IExecuteFunctions) {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const botId = this.getNodeParameter('botId', i) as string;
                let sessionId = (this.getNodeParameter('sessionId', i) as string) || '';
                const messageType = this.getNodeParameter('messageType', i) as string;
                const content = this.getNodeParameter('content', i) as string;

                if (!sessionId) {
                    const sessionResp = (await metisRequest.call(
                        this,
                        'POST',
                        '/api/v1/chat/sessions',
                        { botId, user: null, initialMessages: null },
                    )) as IDataObject;
                    sessionId = (sessionResp?.id as string) || '';
                    if (!sessionId) throw new NodeOperationError(this.getNode(), 'Failed to create session');
                }

                const msgResp = (await metisRequest.call(
                    this,
                    'POST',
                    `/api/v2/chat/sessions/${encodeURIComponent(sessionId)}/message`,
                    { message: { type: messageType, content } },
                )) as IDataObject;

                returnData.push({ json: msgResp });
            } catch (err) {
                throw new NodeOperationError(this.getNode(), (err as Error).message);
            }
        }

        return this.prepareOutputData(returnData);
    }
}
