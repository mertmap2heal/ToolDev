/**
 * Parameter Type Registry Service
 *
 * Returns a merged list of:
 *   1. BUILT_IN_TYPES — standard engineering types defined here, never stored in DB
 *   2. Project-specific custom types stored in the ParameterType table
 *
 * Each type carries a `translations` map showing how the canonical name maps
 * to each export format's native type system.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface ParameterTypeTranslations {
  c_header?: string
  matlab?: string
  python?: string
  ada?: string
  simulink?: string
  ros?: string
  dds?: string
  autosar?: string
  xtce?: string
}

export interface ValueFormat {
  template?: string    // structural pattern, e.g. "[x, y, z]" or "[[r0c0,...],...]"
  example?: string     // concrete filled-in example
  hint?: string        // free-text description of how to enter values
  pattern?: string     // regex string for validation
  dimensions?: string  // e.g. "3x1", "4x4", "3"
  structure?: 'scalar' | 'array' | 'matrix'
}

export interface ParameterTypeRecord {
  id: string
  projectId: string | null   // null for built-ins
  name: string
  description: string | null
  color: string | null
  translations: ParameterTypeTranslations | null
  valueFormat?: ValueFormat | null
  builtIn: boolean
  createdAt: string | null
}

// ---------------------------------------------------------------------------
// Built-in type catalogue
// ---------------------------------------------------------------------------
// Built-in types have no valueFormat — their value constraints are well-known from the type name
export const BUILT_IN_TYPES: Omit<ParameterTypeRecord, 'projectId' | 'createdAt'>[] = [
  // --- Floating-point -------------------------------------------------------
  {
    id: 'builtin:float16',
    name: 'float16',
    description: '16-bit half-precision floating-point (IEEE 754). Common in ML and GPU workloads.',
    color: '#7dd3fc',
    builtIn: true,
    translations: { c_header: '_Float16', matlab: 'half', python: 'numpy.float16', ada: 'N/A', simulink: 'N/A', ros: 'N/A', dds: 'N/A', autosar: 'N/A', xtce: 'float16' },
  },
  {
    id: 'builtin:float32',
    name: 'float32',
    description: '32-bit single-precision floating-point (IEEE 754). Default real type in most embedded/Simulink workflows.',
    color: '#0ea5e9',
    builtIn: true,
    translations: { c_header: 'float', matlab: 'single', python: 'numpy.float32', ada: 'Float', simulink: 'single', ros: 'float32', dds: 'float', autosar: 'float', xtce: 'float32' },
  },
  {
    id: 'builtin:float64',
    name: 'float64',
    description: '64-bit double-precision floating-point (IEEE 754). Default floating-point in Python and MATLAB.',
    color: '#0284c7',
    builtIn: true,
    translations: { c_header: 'double', matlab: 'double', python: 'float', ada: 'Long_Float', simulink: 'double', ros: 'float64', dds: 'double', autosar: 'double', xtce: 'float64' },
  },

  // --- Signed integers ------------------------------------------------------
  {
    id: 'builtin:int8',
    name: 'int8',
    description: '8-bit signed integer. Range: −128 to 127.',
    color: '#86efac',
    builtIn: true,
    translations: { c_header: 'int8_t', matlab: 'int8', python: 'numpy.int8', ada: 'Integer range -128 .. 127', simulink: 'int8', ros: 'int8', dds: 'octet', autosar: 'sint8', xtce: 'int8' },
  },
  {
    id: 'builtin:int16',
    name: 'int16',
    description: '16-bit signed integer. Range: −32 768 to 32 767.',
    color: '#4ade80',
    builtIn: true,
    translations: { c_header: 'int16_t', matlab: 'int16', python: 'numpy.int16', ada: 'Short_Integer', simulink: 'int16', ros: 'int16', dds: 'short', autosar: 'sint16', xtce: 'int16' },
  },
  {
    id: 'builtin:int32',
    name: 'int32',
    description: '32-bit signed integer. Range: −2 147 483 648 to 2 147 483 647.',
    color: '#22c55e',
    builtIn: true,
    translations: { c_header: 'int32_t', matlab: 'int32', python: 'int', ada: 'Integer', simulink: 'int32', ros: 'int32', dds: 'long', autosar: 'sint32', xtce: 'int32' },
  },
  {
    id: 'builtin:int64',
    name: 'int64',
    description: '64-bit signed integer.',
    color: '#16a34a',
    builtIn: true,
    translations: { c_header: 'int64_t', matlab: 'int64', python: 'int', ada: 'Long_Integer', simulink: 'int64', ros: 'int64', dds: 'long long', autosar: 'sint64', xtce: 'int64' },
  },

  // --- Unsigned integers ----------------------------------------------------
  {
    id: 'builtin:uint8',
    name: 'uint8',
    description: '8-bit unsigned integer. Range: 0 to 255. Common for raw bytes and image channels.',
    color: '#fcd34d',
    builtIn: true,
    translations: { c_header: 'uint8_t', matlab: 'uint8', python: 'numpy.uint8', ada: 'Interfaces.Unsigned_8', simulink: 'uint8', ros: 'uint8', dds: 'octet', autosar: 'uint8', xtce: 'uint8' },
  },
  {
    id: 'builtin:uint16',
    name: 'uint16',
    description: '16-bit unsigned integer. Range: 0 to 65 535.',
    color: '#fbbf24',
    builtIn: true,
    translations: { c_header: 'uint16_t', matlab: 'uint16', python: 'numpy.uint16', ada: 'Interfaces.Unsigned_16', simulink: 'uint16', ros: 'uint16', dds: 'unsigned short', autosar: 'uint16', xtce: 'uint16' },
  },
  {
    id: 'builtin:uint32',
    name: 'uint32',
    description: '32-bit unsigned integer. Range: 0 to 4 294 967 295.',
    color: '#f59e0b',
    builtIn: true,
    translations: { c_header: 'uint32_t', matlab: 'uint32', python: 'numpy.uint32', ada: 'Interfaces.Unsigned_32', simulink: 'uint32', ros: 'uint32', dds: 'unsigned long', autosar: 'uint32', xtce: 'uint32' },
  },
  {
    id: 'builtin:uint64',
    name: 'uint64',
    description: '64-bit unsigned integer.',
    color: '#d97706',
    builtIn: true,
    translations: { c_header: 'uint64_t', matlab: 'uint64', python: 'numpy.uint64', ada: 'Interfaces.Unsigned_64', simulink: 'uint64', ros: 'uint64', dds: 'unsigned long long', autosar: 'uint64', xtce: 'uint64' },
  },

  // --- Other ----------------------------------------------------------------
  {
    id: 'builtin:boolean',
    name: 'boolean',
    description: 'Logical true/false value.',
    color: '#a78bfa',
    builtIn: true,
    translations: { c_header: 'bool', matlab: 'logical', python: 'bool', ada: 'Boolean', simulink: 'boolean', ros: 'bool', dds: 'boolean', autosar: 'boolean', xtce: 'boolean' },
  },
  {
    id: 'builtin:string',
    name: 'string',
    description: 'Variable-length text. Not directly supported in some real-time formats (Simulink, AUTOSAR).',
    color: '#f472b6',
    builtIn: true,
    translations: { c_header: 'char*', matlab: 'char', python: 'str', ada: 'String', simulink: 'N/A', ros: 'string', dds: 'string', autosar: 'N/A', xtce: 'string' },
  },
  {
    id: 'builtin:enum',
    name: 'enum',
    description: 'Enumerated named constants. Maps to integer-backed enumerations in code generators.',
    color: '#818cf8',
    builtIn: true,
    translations: { c_header: 'enum', matlab: 'Simulink.IntEnumType', python: 'Enum', ada: 'type T is (...)', simulink: 'Simulink.IntEnumType', ros: 'int32', dds: 'enum', autosar: 'enumeration', xtce: 'enumeration' },
  },
  {
    id: 'builtin:complex64',
    name: 'complex64',
    description: '64-bit complex number (two float32 components). Common in signal processing.',
    color: '#94a3b8',
    builtIn: true,
    translations: { c_header: '_Complex float', matlab: 'single (complex)', python: 'numpy.complex64', ada: 'N/A', simulink: 'single', ros: 'N/A', dds: 'N/A', autosar: 'N/A', xtce: 'N/A' },
  },
  {
    id: 'builtin:complex128',
    name: 'complex128',
    description: '128-bit complex number (two float64 components).',
    color: '#64748b',
    builtIn: true,
    translations: { c_header: '_Complex double', matlab: 'double (complex)', python: 'complex', ada: 'N/A', simulink: 'double', ros: 'N/A', dds: 'N/A', autosar: 'N/A', xtce: 'N/A' },
  },
]

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listParameterTypes(projectId: string): Promise<ParameterTypeRecord[]> {
  const custom = await prisma.parameterType.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
  })

  const builtIns: ParameterTypeRecord[] = BUILT_IN_TYPES.map(t => ({
    ...t,
    projectId: null,
    valueFormat: null,
    createdAt: null,
  }))

  const customRecords: ParameterTypeRecord[] = custom.map(t => ({
    id: t.id,
    projectId: t.projectId,
    name: t.name,
    description: t.description,
    color: t.color,
    translations: t.translations as ParameterTypeTranslations | null,
    valueFormat: t.valueFormat as ValueFormat | null,
    builtIn: false,
    createdAt: t.createdAt.toISOString(),
  }))

  return [...builtIns, ...customRecords]
}

export async function createParameterType(
  projectId: string,
  data: { name: string; description?: string; color?: string; translations?: Record<string, string>; valueFormat?: ValueFormat }
): Promise<ParameterTypeRecord> {
  const t = await prisma.parameterType.create({
    data: {
      projectId,
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      color: data.color ?? null,
      translations: data.translations ?? undefined,
      valueFormat: data.valueFormat ?? undefined,
    },
  })
  return {
    id: t.id,
    projectId: t.projectId,
    name: t.name,
    description: t.description,
    color: t.color,
    translations: t.translations as ParameterTypeTranslations | null,
    builtIn: false,
    createdAt: t.createdAt.toISOString(),
  }
}

export async function updateParameterType(
  id: string,
  projectId: string,
  data: { name?: string; description?: string; color?: string; translations?: Record<string, string>; valueFormat?: ValueFormat | null }
): Promise<ParameterTypeRecord> {
  const t = await prisma.parameterType.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
      ...(data.color !== undefined ? { color: data.color || null } : {}),
      ...(data.translations !== undefined ? { translations: data.translations } : {}),
      ...(data.valueFormat !== undefined ? { valueFormat: data.valueFormat ?? undefined } : {}),
    },
  })
  if (t.projectId !== projectId) throw new Error('Not found')
  return {
    id: t.id,
    projectId: t.projectId,
    name: t.name,
    description: t.description,
    color: t.color,
    translations: t.translations as ParameterTypeTranslations | null,
    builtIn: false,
    createdAt: t.createdAt.toISOString(),
  }
}

export async function deleteParameterType(id: string, projectId: string): Promise<void> {
  const t = await prisma.parameterType.findUnique({ where: { id } })
  if (!t || t.projectId !== projectId) throw new Error('Not found')
  await prisma.parameterType.delete({ where: { id } })
}

/** Count how many parameters in the project currently use this type name. */
export async function countTypeUsage(projectId: string, typeName: string): Promise<number> {
  return prisma.parameter.count({ where: { projectId, dataType: typeName } })
}
