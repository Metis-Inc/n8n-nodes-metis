export type ProviderWithTag = { name: string; model: string; tags: string[] };
export type MetaResponse = { generationProviders: Record<string, ProviderWithTag[]> };

export function flattenGenerationProviders(meta: MetaResponse): ProviderWithTag[] {
    const result: ProviderWithTag[] = [];
    for (const key of Object.keys(meta.generationProviders || {})) {
        for (const p of meta.generationProviders[key] || []) {
            result.push({ name: p.name, model: p.model, tags: p.tags || [] });
        }
    }
    return result.filter((p) => !p.tags?.includes('disabled'));
}

export function parseProviderValue(value: string): { name: string; model: string } {
    const [name, model] = value.split(':::');
    return { name, model };
}

export function buildArgsFromSchemaGroups(schemaArgs: any): Record<string, any> {
    const out: Record<string, any> = {};
    function put(entries: Array<{ name: string; value: any }>, transform?: (v: any) => any) {
        for (const e of entries || []) {
            if (!e?.name) continue;
            out[e.name] = transform ? transform(e.value) : e.value;
        }
    }
    put(schemaArgs?.strings, (v) => String(v));
    put(schemaArgs?.links, (v) => String(v));
    put(schemaArgs?.integers, (v) => (v === '' || v === undefined ? undefined : Number.parseInt(String(v), 10)));
    put(schemaArgs?.floats, (v) => (v === '' || v === undefined ? undefined : Number.parseFloat(String(v))));
    put(schemaArgs?.booleans, (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : v));
    function parseJSONMaybe(v: any) {
        if (typeof v !== 'string') return v;
        try { return JSON.parse(v); } catch { return v; }
    }
    put(schemaArgs?.objects, parseJSONMaybe);
    put(schemaArgs?.arrays, parseJSONMaybe);
    put(schemaArgs?.enums, (v) => v);
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
}
