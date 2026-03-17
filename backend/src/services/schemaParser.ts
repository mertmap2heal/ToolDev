import fs from 'fs';
import path from 'path';

export interface PrismaModel {
    name: string;
    fields: { name: string; type: string; isList: boolean; isRelation: boolean }[];
}

export class SchemaParser {
    static parseSchema(schemaPath: string): PrismaModel[] {
        if (!fs.existsSync(schemaPath)) {
            console.error(`Schema file not found at: ${schemaPath}`);
            return [];
        }

        const content = fs.readFileSync(schemaPath, 'utf8');
        const models: PrismaModel[] = [];
        const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\}/g;
        let match;

        while ((match = modelRegex.exec(content)) !== null) {
            const modelName = match[1];
            const modelBody = match[2];
            const fields: PrismaModel['fields'] = [];

            const lines = modelBody.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('@@') || trimmed.startsWith('//')) continue;

                // Simple field parsing: name type modifiers [attributes]
                const parts = trimmed.split(/\s+/);
                if (parts.length < 2) continue;

                const fieldName = parts[0];
                const fieldType = parts[1].replace('?', ''); // Remove optional marker
                const isList = fieldType.endsWith('[]');
                const baseType = isList ? fieldType.slice(0, -2) : fieldType;

                // Check if the type is another model (relation)
                // We check if the baseType starts with an uppercase letter as a heuristic for models
                const isRelation = /^[A-Z]/.test(baseType) && !['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'UUID', 'Decimal'].includes(baseType);

                fields.push({
                    name: fieldName,
                    type: baseType,
                    isList,
                    isRelation
                });
            }

            models.push({ name: modelName, fields });
        }

        return models;
    }

    static generateFlowData(models: PrismaModel[]): { nodes: any[]; edges: any[] } {
        const nodes: any[] = [];
        const edges: any[] = [];
        const modelNames = models.map(m => m.name);

        models.forEach((model, index) => {
            // Grid-based automatic layout
            const x = (index % 5) * 400;
            const y = Math.floor(index / 5) * 400;

            nodes.push({
                id: `s-${model.name.toLowerCase()}`,
                type: 'schema',
                position: { x, y },
                data: {
                    label: model.name,
                    fields: model.fields
                        .filter(f => !f.isRelation)
                        .map(f => ({ name: f.name, type: f.type + (f.isList ? '[]' : '') })),
                    metrics: { latency: Math.floor(Math.random() * 20), load: Math.floor(Math.random() * 30), errors: 0 }
                }
            });

            model.fields.forEach(field => {
                if (field.isRelation && modelNames.includes(field.type)) {
                    // Check if edge already exists to avoid duplicates in bi-directional relations
                    const edgeId = `se-${model.name.toLowerCase()}-${field.type.toLowerCase()}`;
                    const reverseEdgeId = `se-${field.type.toLowerCase()}-${model.name.toLowerCase()}`;

                    if (!edges.find(e => e.id === edgeId || e.id === reverseEdgeId)) {
                        edges.push({
                            id: edgeId,
                            source: `s-${model.name.toLowerCase()}`,
                            target: `s-${field.type.toLowerCase()}`,
                            animated: true
                        });
                    }
                }
            });
        });

        return { nodes, edges };
    }
}
