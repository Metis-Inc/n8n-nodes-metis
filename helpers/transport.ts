import type { IDataObject, IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

type Ctx = IExecuteFunctions | ILoadOptionsFunctions;

export async function metisRequest(
    this: Ctx,
    method: string,
    path: string,
    body?: unknown,
    qs?: IDataObject,
) {
    const options = {
        method,
        url: `https://api.metisai.ir${path}`,
        headers: {
            'X-Metis-Client': 'n8n-node/1.0.0',
            'User-Agent': 'metis-n8n-node/1.0.0',
        },
        json: true,
        body,
        qs,
    };
    // @ts-ignore n8n runtime provides this helper
    return this.helpers.requestWithAuthentication.call(this, 'metisApi', options);
}

export function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}
