import type {
    INodeType,
    INodeTypeDescription,
    INodeExecutionData,
    IExecuteFunctions,
    ILoadOptionsFunctions,
    IDataObject,
    INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { metisRequest, sleep } from '../helpers/transport';
import { flattenGenerationProviders, parseProviderValue, buildArgsFromGuided, buildArgsFromSchemaGroups } from '../helpers/utils';

type LoadOption = { name: string; value: string };

type ArgDef = {
    name: string;
    type: 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'ARRAY' | 'OBJECT' | 'ENUM';
    required: boolean;
    defaultValue: any;
    description: string;
    validationRules?: {
        allowedValues?: any[] | null;
        minValue?: number | null;
        maxValue?: number | null;
        minLength?: number | null;
        maxLength?: number | null;
        pattern?: string | null;
    };
    isLink?: boolean;
};

function pickSchemaMap(meta: IDataObject, providerName: string, providerModel: string): ArgDef[] {
    const map = (meta?.argumentSchemaMap as IDataObject) || {};
    const key = `${providerName}/${providerModel}`;
    const arr = (map[key] as IDataObject[]) || [];
    return arr.map((d) => ({
        name: String(d.name),
        type: String(d.type) as ArgDef['type'],
        required: Boolean(d.required),
        defaultValue: (d as any).defaultValue,
        description: String(d.description || ''),
        validationRules: (d.validationRules || undefined) as ArgDef['validationRules'],
        isLink: Boolean((d as any).isLink),
    }));
}

async function fetchArgSchema(thisArg: ILoadOptionsFunctions | IExecuteFunctions, providerModel: string): Promise<ArgDef[]> {
    const { name, model } = parseProviderValue(providerModel);
    const schema = (await metisRequest.call(
        thisArg,
        'GET',
        `/api/v1/meta/models-argument-schema/${encodeURIComponent(name)}/${encodeURIComponent(model)}?scope=generation`,
    )) as IDataObject;
    return pickSchemaMap(schema, name, model);
}

function toOptionsFromArgs(args: ArgDef[], predicate: (a: ArgDef) => boolean): INodePropertyOptions[] {
    return args
        .filter(predicate)
        .map((a) => ({
            name: `${a.name}${a.required ? ' *' : ''}`,
            value: a.name,
            description: a.description || undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function findEnumValues(args: ArgDef[], argName: string): INodePropertyOptions[] {
    const def = args.find((a) => a.name === argName && a.type === 'ENUM');
    const vals = (def?.validationRules?.allowedValues as any[]) || [];
    return vals.map((v) => ({ name: String(v), value: v }));
}

export class MetisCreateGeneration implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Metis: Create Generation',
        name: 'metisCreateGeneration',
        group: ['transform'],
        icon: 'file:metis.png',
        version: 1,
        description: 'Create a generation task with Metis and optionally wait for completion',
        defaults: { name: 'Metis: Create Generation' },
        credentials: [{ name: 'metisApi', required: true }],
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            {
                displayName: 'Provider / Model',
                name: 'providerModel',
                type: 'options',
                typeOptions: { loadOptionsMethod: 'getGenerationProviders' },
                default: '',
                required: true,
                description: 'Example: openai/gpt-image-1',
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getOperations',
                    loadOptionsDependsOn: ['providerModel'],
                },
                default: '',
                required: true,
            },
            {
                displayName: 'Args Mode',
                name: 'argsMode',
                type: 'options',
                options: [
                    { name: 'Schema', value: 'schema' },
                    { name: 'Guided (Generic)', value: 'guided' },
                    { name: 'JSON', value: 'json' },
                ],
                default: 'schema',
            },

            {
                displayName: 'Args (Schema-Based)',
                name: 'schemaArgs',
                type: 'fixedCollection',
                typeOptions: { multipleValues: true },
                default: {},
                displayOptions: { show: { argsMode: ['schema'] } },
                options: [
                    {
                        name: 'strings',
                        displayName: 'String Args',
                        values: [
                            {
                                displayName: 'Name',
                                name: 'name',
                                type: 'options',
                                typeOptions: {
                                    loadOptionsMethod: 'getArgNamesString',
                                    loadOptionsDependsOn: ['providerModel'],
                                },
                                default: '',
                            },
                            { displayName: 'Value', name: 'value', type: 'string', default: '' },
                        ],
                    },
                    {
                        name: 'links',
                        displayName: 'Link Args (URL strings)',
                        values: [
                            {
                                displayName: 'Name',
                                name: 'name',
                                type: 'options',
                                typeOptions: {
                                    loadOptionsMethod: 'getArgNamesLink',
                                    loadOptionsDependsOn: ['providerModel'],
                                },
                                default: '',
                            },
                            { displayName: 'Value', name: 'value', type: 'string', default: 'https://' },
                        ],
                    },
                    {
                        name: 'integers',
                        displayName: 'Integer Args',
                        values: [
                            {
                                displayName: 'Name',
                                name: 'name',
                                type: 'options',
                                typeOptions: {
                                    loadOptionsMethod: 'getArgNamesInteger',
                                    loadOptionsDependsOn: ['providerModel'],
                                },
                                default: '',
                            },
                            { displayName: 'Value', name: 'value', type: 'number', default: 0 },
                        ],
                    },
                    {
                        name: 'floats',
                        displayName: 'Float Args',
                        values: [
                            {
                                displayName: 'Name',
                                name: 'name',
                                type: 'options',
                                typeOptions: {
                                    loadOptionsMethod: 'getArgNamesFloat',
                                    loadOptionsDependsOn: ['providerModel'],
                                },
                                default: '',
                            },
                            { displayName: 'Value', name: 'value', type: 'number', default: 0 },
                        ],
                    },
                    {
                        name: 'booleans',
                        displayName: 'Boolean Args',
                        values: [
                            {
                                displayName: 'Name',
                                name: 'name',
                                type: 'options',
                                typeOptions: {
                                    loadOptionsMethod: 'getArgNamesBoolean',
                                    loadOptionsDependsOn: ['providerModel'],
                                },
                                default: '',
                            },
                            { displayName: 'Value', name: 'value', type: 'boolean', default: false },
                        ],
                    },
                    {
                        name: 'objects',
                        displayName: 'Object Args (JSON)',
                        values: [
                            {
                                displayName: 'Name',
                                name: 'name',
                                type: 'options',
                                typeOptions: {
                                    loadOptionsMethod: 'getArgNamesObject',
                                    loadOptionsDependsOn: ['providerModel'],
                                },
                                default: '',
                            },
                            {
                                displayName: 'Value (JSON)',
                                name: 'value',
                                type: 'string',
                                typeOptions: { rows: 4 },
                                default: '{}',
                            },
                        ],
                    },
                    {
                        name: 'arrays',
                        displayName: 'Array Args (JSON)',
                        values: [
                            {
                                displayName: 'Name',
                                name: 'name',
                                type: 'options',
                                typeOptions: {
                                    loadOptionsMethod: 'getArgNamesArray',
                                    loadOptionsDependsOn: ['providerModel'],
                                },
                                default: '',
                            },
                            {
                                displayName: 'Value (JSON Array)',
                                name: 'value',
                                type: 'string',
                                typeOptions: { rows: 3 },
                                default: '[]',
                            },
                        ],
                    },
                    {
                        name: 'enums',
                        displayName: 'Enum Args',
                        values: [
                            {
                                displayName: 'Name',
                                name: 'name',
                                type: 'options',
                                typeOptions: {
                                    loadOptionsMethod: 'getArgNamesEnum',
                                    loadOptionsDependsOn: ['providerModel'],
                                },
                                default: '',
                            },
                            {
                                displayName: 'Value',
                                name: 'value',
                                type: 'options',
                                typeOptions: {
                                    loadOptionsMethod: 'getEnumValues',
                                    loadOptionsDependsOn: ['name', 'providerModel'],
                                },
                                default: '',
                            },
                        ],
                    },
                ],
            },

            {
                displayName: 'Guided Args',
                name: 'guided',
                type: 'fixedCollection',
                typeOptions: { multipleValues: true },
                default: {},
                displayOptions: { show: { argsMode: ['guided'] } },
                options: [
                    {
                        name: 'strings',
                        displayName: 'String Fields',
                        values: [
                            { displayName: 'Name', name: 'name', type: 'string', default: '' },
                            { displayName: 'Value', name: 'value', type: 'string', default: '' },
                        ],
                    },
                    {
                        name: 'integers',
                        displayName: 'Integer Fields',
                        values: [
                            { displayName: 'Name', name: 'name', type: 'string', default: '' },
                            { displayName: 'Value', name: 'value', type: 'number', default: 0 },
                        ],
                    },
                    {
                        name: 'floats',
                        displayName: 'Float Fields',
                        values: [
                            { displayName: 'Name', name: 'name', type: 'string', default: '' },
                            { displayName: 'Value', name: 'value', type: 'number', default: 0 },
                        ],
                    },
                    {
                        name: 'booleans',
                        displayName: 'Boolean Fields',
                        values: [
                            { displayName: 'Name', name: 'name', type: 'string', default: '' },
                            { displayName: 'Value', name: 'value', type: 'boolean', default: false },
                        ],
                    },
                    {
                        name: 'links',
                        displayName: 'Link Fields (URL strings)',
                        values: [
                            { displayName: 'Name', name: 'name', type: 'string', default: '' },
                            { displayName: 'Value', name: 'value', type: 'string', default: 'https://' },
                        ],
                    },
                    {
                        name: 'objects',
                        displayName: 'Object Fields (JSON)',
                        values: [
                            { displayName: 'Name', name: 'name', type: 'string', default: '' },
                            { displayName: 'Value (JSON)', name: 'value', type: 'string', typeOptions: { rows: 4 }, default: '{}' },
                        ],
                    },
                    {
                        name: 'arrays',
                        displayName: 'Array Fields (JSON)',
                        values: [
                            { displayName: 'Name', name: 'name', type: 'string', default: '' },
                            { displayName: 'Value (JSON Array)', name: 'value', type: 'string', typeOptions: { rows: 3 }, default: '[]' },
                        ],
                    },
                    {
                        name: 'additionalArgsJson',
                        displayName: 'Additional Args (JSON, merged)',
                        values: [
                            { displayName: 'JSON', name: 'additionalArgsJson', type: 'string', typeOptions: { rows: 5 }, default: '' },
                        ],
                    },
                ],
            },

            {
                displayName: 'Args (JSON)',
                name: 'argsJson',
                type: 'string',
                typeOptions: { rows: 10 },
                default: '{}',
                displayOptions: { show: { argsMode: ['json'] } },
            },

            {
                displayName: 'Completion Strategy',
                name: 'completionStrategy',
                type: 'options',
                options: [
                    { name: 'Polling', value: 'polling' },
                    { name: 'Webhook', value: 'webhook' },
                ],
                default: 'polling',
            },
            {
                displayName: 'Webhook',
                name: 'webhookFixed',
                type: 'fixedCollection',
                default: {},
                displayOptions: { show: { completionStrategy: ['webhook'] } },
                options: [
                    {
                        name: 'webhook',
                        displayName: 'Webhook Config',
                        values: [
                            { displayName: 'URL', name: 'url', type: 'string', default: '' },
                            {
                                displayName: 'Method',
                                name: 'method',
                                type: 'options',
                                options: [
                                    { name: 'POST', value: 'POST' },
                                    { name: 'GET', value: 'GET' },
                                    { name: 'PUT', value: 'PUT' },
                                    { name: 'PATCH', value: 'PATCH' },
                                ],
                                default: 'POST',
                            },
                            {
                                displayName: 'Headers',
                                name: 'headers',
                                type: 'fixedCollection',
                                typeOptions: { multipleValues: true },
                                default: {},
                                options: [
                                    {
                                        name: 'header',
                                        displayName: 'Header',
                                        values: [
                                            { displayName: 'Key', name: 'key', type: 'string', default: '' },
                                            { displayName: 'Value', name: 'value', type: 'string', default: '' },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                displayName: 'Wait for Completion',
                name: 'waitForCompletion',
                type: 'boolean',
                default: true,
            },
            {
                displayName: 'Poll Interval (seconds)',
                name: 'pollInterval',
                type: 'number',
                typeOptions: { minValue: 1 },
                default: 5,
                displayOptions: { show: { waitForCompletion: [true], completionStrategy: ['polling'] } },
            },
            {
                displayName: 'Timeout (minutes)',
                name: 'timeoutMinutes',
                type: 'number',
                typeOptions: { minValue: 1 },
                default: 30,
                displayOptions: { show: { waitForCompletion: [true], completionStrategy: ['polling'] } },
            },
        ],
    };

    methods = {
        loadOptions: {
            async getGenerationProviders(this: ILoadOptionsFunctions): Promise<LoadOption[]> {
                const meta = (await metisRequest.call(this, 'GET', '/api/v1/meta')) as IDataObject;
                const flat = flattenGenerationProviders(meta as any);
                const options = flat.map((p) => ({
                    name: `${p.name}/${p.model}`,
                    value: `${p.name}:::${p.model}`,
                }));
                options.sort((a, b) => a.name.localeCompare(b.name));
                return options;
            },

            async getOperations(this: ILoadOptionsFunctions): Promise<LoadOption[]> {
                const providerModel = this.getCurrentNodeParameter('providerModel') as string;
                if (!providerModel) return [];
                const { name, model } = parseProviderValue(providerModel);
                const meta = (await metisRequest.call(this, 'GET', '/api/v1/meta')) as IDataObject;
                const flat = flattenGenerationProviders(meta as any);
                const found = flat.find((p) => p.name === name && p.model === model);
                const tags = found?.tags || [];
                return tags.map((t) => ({ name: t, value: t }));
            },

            async getArgNamesString(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const pm = this.getCurrentNodeParameter('providerModel') as string;
                if (!pm) return [];
                const args = await fetchArgSchema(this, pm);
                return toOptionsFromArgs(args, (a) => a.type === 'STRING' && !a.isLink);
            },
            async getArgNamesLink(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const pm = this.getCurrentNodeParameter('providerModel') as string;
                if (!pm) return [];
                const args = await fetchArgSchema(this, pm);
                return toOptionsFromArgs(args, (a) => a.type === 'STRING' && a.isLink === true);
            },
            async getArgNamesInteger(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const pm = this.getCurrentNodeParameter('providerModel') as string;
                if (!pm) return [];
                const args = await fetchArgSchema(this, pm);
                return toOptionsFromArgs(args, (a) => a.type === 'INTEGER');
            },
            async getArgNamesFloat(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const pm = this.getCurrentNodeParameter('providerModel') as string;
                if (!pm) return [];
                const args = await fetchArgSchema(this, pm);
                return toOptionsFromArgs(args, (a) => a.type === 'FLOAT');
            },
            async getArgNamesBoolean(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const pm = this.getCurrentNodeParameter('providerModel') as string;
                if (!pm) return [];
                const args = await fetchArgSchema(this, pm);
                return toOptionsFromArgs(args, (a) => a.type === 'BOOLEAN');
            },
            async getArgNamesObject(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const pm = this.getCurrentNodeParameter('providerModel') as string;
                if (!pm) return [];
                const args = await fetchArgSchema(this, pm);
                return toOptionsFromArgs(args, (a) => a.type === 'OBJECT');
            },
            async getArgNamesArray(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const pm = this.getCurrentNodeParameter('providerModel') as string;
                if (!pm) return [];
                const args = await fetchArgSchema(this, pm);
                return toOptionsFromArgs(args, (a) => a.type === 'ARRAY');
            },
            async getArgNamesEnum(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const pm = this.getCurrentNodeParameter('providerModel') as string;
                if (!pm) return [];
                const args = await fetchArgSchema(this, pm);
                return toOptionsFromArgs(args, (a) => a.type === 'ENUM');
            },
            async getEnumValues(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const pm = this.getCurrentNodeParameter('providerModel') as string;
                const argName = this.getCurrentNodeParameter('name') as string;
                if (!pm || !argName) return [];
                const args = await fetchArgSchema(this, pm);
                return findEnumValues(args, argName);
            },
        },
    };

    async execute(this: IExecuteFunctions) {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const providerModel = this.getNodeParameter('providerModel', i) as string;
                const operation = this.getNodeParameter('operation', i) as string;
                const argsMode = this.getNodeParameter('argsMode', i) as 'schema' | 'guided' | 'json';
                const { name: providerName, model: providerModelName } = parseProviderValue(providerModel);

                let args: Record<string, any> = {};
                if (argsMode === 'json') {
                    const raw = this.getNodeParameter('argsJson', i) as string;
                    try { args = raw ? JSON.parse(raw) : {}; } catch { throw new NodeOperationError(this.getNode(), 'Invalid JSON in Args (JSON)'); }
                } else if (argsMode === 'guided') {
                    const guided = this.getNodeParameter('guided', i, {}) as IDataObject;
                    args = buildArgsFromGuided(guided);
                } else {
                    const schemaArgs = this.getNodeParameter('schemaArgs', i, {}) as IDataObject;
                    args = buildArgsFromSchemaGroups(schemaArgs);
                }

                const completionStrategy = this.getNodeParameter('completionStrategy', i) as 'polling' | 'webhook';
                let webhook: IDataObject | undefined;
                if (completionStrategy === 'webhook') {
                    const wf = this.getNodeParameter('webhookFixed.webhook', i, {}) as IDataObject;
                    const url = (wf?.url as string) || '';
                    if (!url) throw new NodeOperationError(this.getNode(), 'Webhook URL is required when strategy=Webhook');
                    const method = ((wf?.method as string) || 'POST').toUpperCase();
                    let headers: Record<string, string> | undefined;
                    const hdrs = (wf as any)?.headers?.header as Array<{ key: string; value: string }>;
                    if (Array.isArray(hdrs) && hdrs.length) {
                        headers = {};
                        for (const h of hdrs) if (h.key) headers[h.key] = h.value ?? '';
                    }
                    webhook = { url, method, headers };
                }

                const createBody: IDataObject = {
                    model: { name: providerName, model: providerModelName } as IDataObject,
                    operation,
                    args,
                    webhook,
                };

                const created = (await metisRequest.call(this, 'POST', '/api/v2/generate', createBody)) as IDataObject;
                const waitForCompletion = this.getNodeParameter('waitForCompletion', i) as boolean;

                if (!waitForCompletion || completionStrategy === 'webhook') {
                    returnData.push({ json: created });
                    continue;
                }

                const pollInterval = (this.getNodeParameter('pollInterval', i) as number) || 5;
                const timeoutMinutes = (this.getNodeParameter('timeoutMinutes', i) as number) || 30;
                const deadline = Date.now() + timeoutMinutes * 60 * 1000;

                const taskId = (created?.id as string) || '';
                if (!taskId) throw new NodeOperationError(this.getNode(), 'Generation created but no task id returned');

                let finalTask: IDataObject = created;
                while (Date.now() < deadline) {
                    const t = (await metisRequest.call(
                        this,
                        'GET',
                        `/api/v2/generate/${encodeURIComponent(taskId)}`,
                    )) as IDataObject;

                    const status = String(t?.status || '').toUpperCase();
                    if (['COMPLETED', 'ERROR', 'CANCELLED'].includes(status)) {
                        finalTask = t;
                        break;
                    }
                    await sleep(pollInterval * 1000);
                }

                returnData.push({ json: finalTask });
            } catch (err) {
                throw new NodeOperationError(this.getNode(), (err as Error).message);
            }
        }

        return this.prepareOutputData(returnData);
    }
}
