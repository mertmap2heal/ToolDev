/**
 * Parameter Export Service
 * Generates parameter sets in aerospace/embedded engineering formats.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const PDFDocument: any = require('pdfkit')
// eslint-disable-next-line @typescript-eslint/no-require-imports
import ExcelJS from 'exceljs'


export interface ExportParameter {
  parameterId?: string | null
  name: string
  description?: string | null
  dataType?: string | null
  defaultValue?: string | null
  unit?: string | null
  tolerance?: string | null
  minValue?: string | null
  maxValue?: string | null
  status?: string
  version?: string
  tags?: string[] | null
  formula?: string | null
}

export interface ExportMeta {
  filename: string
  contentType: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1')
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function header(comment: string, params: ExportParameter[]): string {
  const now = new Date().toISOString()
  return `${comment} Auto-generated parameter file\n${comment} Generated: ${now}\n${comment} Parameters: ${params.length}\n`
}

// ---------------------------------------------------------------------------
// MATLAB script (.m)
// Running this script in MATLAB also creates parameters.mat via save()
// ---------------------------------------------------------------------------
export function formatMATLAB(params: ExportParameter[]): string {
  const lines: string[] = [
    '% Auto-generated parameter file',
    `% Generated: ${new Date().toISOString()}`,
    `% Parameters: ${params.length}`,
    '% Running this script populates the MATLAB workspace and saves parameters.mat',
    '',
  ]

  for (const p of params) {
    const varName = sanitizeName(p.name)
    const value = p.defaultValue ?? '0'
    const unit = p.unit ? ` [${p.unit}]` : ''
    const desc = p.description ? ` - ${p.description}` : ''
    lines.push(`% ${p.parameterId ?? varName}${desc}`)
    if (p.minValue !== null && p.minValue !== undefined) {
      lines.push(`% Min: ${p.minValue}${unit}  Max: ${p.maxValue ?? ''}${unit}${p.tolerance ? `  Tolerance: ${p.tolerance}${unit}` : ''}`)
    }
    lines.push(`${varName} = ${value};${unit ? ` % ${unit.trim()}` : ''}${p.status && p.status !== 'draft' ? ` [${p.status}]` : ''}`.trimEnd())
    lines.push('')
  }

  lines.push('')
  lines.push("% Persist workspace to parameters.mat")
  lines.push("save('parameters.mat');")
  lines.push("disp(['Saved ', num2str(" + (params.length > 0 ? `length({${params.map(p => `'${sanitizeName(p.name)}'`).join(', ')}})` : '0') + "), ' parameters to parameters.mat']);")

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Simulink Data Dictionary script (create_parameters_sldd.m)
// Generates a MATLAB script that uses Simulink.data.dictionary API to create
// parameters.sldd. Run in MATLAB/Simulink R2014a or later.
// ---------------------------------------------------------------------------
export function formatSimulinkDictScript(params: ExportParameter[]): string {
  const lines: string[] = [
    '% Auto-generated Simulink Data Dictionary creation script',
    `% Generated: ${new Date().toISOString()}`,
    `% Parameters: ${params.length}`,
    '% Run this script in MATLAB to create parameters.sldd',
    '% Requires Simulink R2014a or later',
    '',
    "ddFile = 'parameters.sldd';",
    '',
    '% Remove existing file so we always start fresh',
    "if exist(ddFile, 'file')",
    '    delete(ddFile);',
    'end',
    '',
    '% Create data dictionary and get Design Data section',
    'dd  = Simulink.data.dictionary.create(ddFile);',
    "dds = getSection(dd, 'Design Data');",
    '',
  ]

  for (const p of params) {
    const varName = sanitizeName(p.name)
    const value   = p.defaultValue ?? '0'
    const dt      = (p.dataType ?? '').toLowerCase()
    const isBool  = dt === 'boolean' || dt === 'bool'
    const isStr   = dt === 'string'  || dt === 'text'

    const unit  = p.unit        ? ` [${p.unit}]`         : ''
    const desc  = p.description ? ` ${p.description}`    : ''
    lines.push(`% ${p.parameterId ?? varName}${desc}${unit}`)

    if (isStr) {
      lines.push(`p = Simulink.Parameter('${value.replace(/'/g, "''")}');`)
    } else if (isBool) {
      lines.push(`p = Simulink.Parameter(${value.toLowerCase() === 'true' ? 'true' : 'false'});`)
    } else {
      lines.push(`p = Simulink.Parameter(${value});`)
      if (p.minValue !== null && p.minValue !== undefined) lines.push(`p.Min = ${p.minValue};`)
      if (p.maxValue !== null && p.maxValue !== undefined) lines.push(`p.Max = ${p.maxValue};`)
    }
    if (p.unit)        lines.push(`p.DocUnits = '${p.unit.replace(/'/g, "''")}';`)
    if (p.description) lines.push(`p.Description = '${p.description.replace(/'/g, "''")}';`)
    lines.push(`addEntry(dds, '${varName}', p);`)
    lines.push('')
  }

  lines.push('% Save and close')
  lines.push('saveChanges(dd);')
  lines.push("disp(['Created ' ddFile ' with " + params.length + " parameter(s)']);")

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// MATLAB workspace file script (create_parameters_mat.m)
// Generates a MATLAB script that saves parameters to parameters.mat.
// Simpler than the full MATLAB export — focused on workspace + mat file only.
// ---------------------------------------------------------------------------
export function formatMATScript(params: ExportParameter[]): string {
  const lines: string[] = [
    '% Auto-generated MATLAB workspace script',
    `% Generated: ${new Date().toISOString()}`,
    `% Parameters: ${params.length}`,
    '% Run this script to load parameters into the workspace and save parameters.mat',
    '',
  ]

  for (const p of params) {
    const varName = sanitizeName(p.name)
    const value   = p.defaultValue ?? '0'
    const unit    = p.unit        ? ` [${p.unit}]`      : ''
    const desc    = p.description ? ` - ${p.description}` : ''
    lines.push(`% ${varName}${desc}${unit}`)
    lines.push(`${varName} = ${value};`)
    lines.push('')
  }

  lines.push("save('parameters.mat');")
  lines.push("disp(['Saved " + params.length + " parameter(s) to parameters.mat']);")

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Python module (parameters.py)
// ---------------------------------------------------------------------------
export function formatPython(params: ExportParameter[]): string {
  const lines: string[] = [
    '"""',
    'Auto-generated parameter module',
    `Generated: ${new Date().toISOString()}`,
    `Parameters: ${params.length}`,
    '"""',
    '',
    'from dataclasses import dataclass',
    'from typing import Optional',
    '',
    '',
    '@dataclass',
    'class Parameter:',
    '    name: str',
    '    value: float',
    '    unit: str = ""',
    '    description: str = ""',
    '    min_value: Optional[float] = None',
    '    max_value: Optional[float] = None',
    '    tolerance: Optional[float] = None',
    '',
    '',
    '# ---------------------------------------------------------------------------',
    '# Parameter definitions',
    '# ---------------------------------------------------------------------------',
    '',
  ]

  for (const p of params) {
    const varName = sanitizeName(p.name).toUpperCase()
    const value = p.defaultValue ?? '0'
    const unit = p.unit ?? ''
    const desc = (p.description ?? '').replace(/'/g, "\\'")
    const minVal = p.minValue !== null && p.minValue !== undefined ? p.minValue : 'None'
    const maxVal = p.maxValue !== null && p.maxValue !== undefined ? p.maxValue : 'None'
    const tol = p.tolerance !== null && p.tolerance !== undefined ? p.tolerance : 'None'

    lines.push(`${varName} = Parameter(`)
    lines.push(`    name='${p.name}',`)
    lines.push(`    value=${value},`)
    if (unit) lines.push(`    unit='${unit}',`)
    if (desc) lines.push(`    description='${desc}',`)
    if (minVal !== 'None') lines.push(`    min_value=${minVal},`)
    if (maxVal !== 'None') lines.push(`    max_value=${maxVal},`)
    if (tol !== 'None') lines.push(`    tolerance=${tol},`)
    lines.push(')')
    lines.push('')
  }

  lines.push('')
  lines.push('# Dictionary for programmatic access')
  lines.push('PARAMETERS = {')
  for (const p of params) {
    const varName = sanitizeName(p.name).toUpperCase()
    lines.push(`    '${p.name}': ${varName},`)
  }
  lines.push('}')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// C/C++ header (parameters.h)
// ---------------------------------------------------------------------------
export function formatCHeader(params: ExportParameter[]): string {
  const guard = 'PARAMETERS_H'
  const lines: string[] = [
    '/**',
    ' * Auto-generated parameter header',
    ` * Generated: ${new Date().toISOString()}`,
    ` * Parameters: ${params.length}`,
    ' *',
    ' * DO NOT EDIT — regenerate from the engineering tool',
    ' */',
    '',
    `#ifndef ${guard}`,
    `#define ${guard}`,
    '',
    '#ifdef __cplusplus',
    'extern "C" {',
    '#endif',
    '',
    '/* Parameter definitions */',
    '',
  ]

  for (const p of params) {
    const macroName = sanitizeName(p.name).toUpperCase()
    const value = p.defaultValue ?? '0'
    const unit = p.unit ? ` [${p.unit}]` : ''
    const desc = p.description ? ` ${p.description}` : ''
    const tol = p.tolerance ? ` ±${p.tolerance}${unit}` : ''

    lines.push(`/** ${p.parameterId ?? macroName}:${desc}${tol} */`)
    if (p.minValue !== null && p.minValue !== undefined) {
      lines.push(`#define ${macroName}_MIN    ${p.minValue}`)
      lines.push(`#define ${macroName}_MAX    ${p.maxValue ?? p.minValue}`)
    }
    lines.push(`#define ${macroName}         ${value}${unit ? `  /* ${unit.trim()} */` : ''}`)
    lines.push('')
  }

  lines.push('#ifdef __cplusplus')
  lines.push('}')
  lines.push('#endif')
  lines.push('')
  lines.push(`#endif /* ${guard} */`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Ada package specification (parameters.ads)
// Uses Ada range types/subtypes for numeric parameters that have min/max.
// ---------------------------------------------------------------------------
export function formatAda(params: ExportParameter[]): string {
  const lines: string[] = [
    '--  Auto-generated parameter package specification',
    `--  Generated: ${new Date().toISOString()}`,
    `--  Parameters: ${params.length}`,
    '--  DO NOT EDIT -- regenerate from the engineering tool',
    '',
    'package Parameters is',
    '',
    '   pragma Pure;',
    '',
  ]

  for (const p of params) {
    const constName = sanitizeName(p.name)
    const value = p.defaultValue ?? '0'
    const unit = p.unit ? ` [${p.unit}]` : ''
    const tol = p.tolerance ? ` tolerance: ${p.tolerance}` : ''

    lines.push(`   --  ${p.parameterId ?? constName}${unit}${tol}`)
    if (p.description) lines.push(`   --  ${p.description}`)

    const hasRange = p.minValue !== null && p.minValue !== undefined &&
                     p.maxValue !== null && p.maxValue !== undefined

    const dt = (p.dataType ?? '').toLowerCase()
    const isInteger = dt === 'integer' || dt === 'int' || dt === 'int8' || dt === 'int16' || dt === 'int32' || dt === 'uint8' || dt === 'uint16' || dt === 'uint32'
    const isFloat   = !isInteger && dt !== 'boolean' && dt !== 'bool' && dt !== 'string' && dt !== 'text'
    const isBool    = dt === 'boolean' || dt === 'bool'
    const isString  = dt === 'string' || dt === 'text'

    if (hasRange && isInteger) {
      // Ada integer range type: type T_Name is range Min .. Max;
      const typeName = `T_${constName}`
      lines.push(`   type ${typeName} is range ${p.minValue} .. ${p.maxValue};`)
      lines.push(`   ${constName} : constant ${typeName} := ${value};`)
    } else if (hasRange && isFloat) {
      // Ada float subtype with range constraint
      const typeName = `T_${constName}`
      lines.push(`   subtype ${typeName} is Float range ${p.minValue} .. ${p.maxValue};`)
      lines.push(`   ${constName} : constant ${typeName} := ${value};`)
    } else if (isBool) {
      lines.push(`   ${constName} : constant Boolean := ${value.toLowerCase() === 'true' ? 'True' : 'False'};`)
    } else if (isString) {
      lines.push(`   ${constName} : constant String := "${value}";`)
    } else {
      lines.push(`   ${constName} : constant Float := ${value};`)
    }
    lines.push('')
  }

  lines.push('end Parameters;')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// JSON (parameters.json)
// ---------------------------------------------------------------------------
export function formatJSON(params: ExportParameter[]): string {
  const obj = {
    _meta: {
      generated: new Date().toISOString(),
      count: params.length,
    },
    parameters: params.map(p => ({
      id: p.parameterId,
      name: p.name,
      description: p.description ?? null,
      dataType: p.dataType ?? null,
      value: p.defaultValue ?? null,
      unit: p.unit ?? null,
      tolerance: p.tolerance ?? null,
      minValue: p.minValue ?? null,
      maxValue: p.maxValue ?? null,
      status: p.status ?? 'draft',
      version: p.version ?? '1.0',
      tags: p.tags ?? [],
      formula: p.formula ?? null,
    })),
  }
  return JSON.stringify(obj, null, 2)
}

// ---------------------------------------------------------------------------
// YAML (parameters.yaml)
// ---------------------------------------------------------------------------
export function formatYAML(params: ExportParameter[]): string {
  const lines: string[] = [
    '# Auto-generated parameter file',
    `# Generated: ${new Date().toISOString()}`,
    `# Parameters: ${params.length}`,
    '',
    'parameters:',
  ]

  for (const p of params) {
    lines.push(`  - name: "${p.name}"`)
    if (p.parameterId) lines.push(`    id: "${p.parameterId}"`)
    if (p.description) lines.push(`    description: "${p.description.replace(/"/g, '\\"')}"`)
    if (p.dataType) lines.push(`    data_type: "${p.dataType}"`)
    lines.push(`    value: ${p.defaultValue ?? 'null'}`)
    if (p.unit) lines.push(`    unit: "${p.unit}"`)
    if (p.tolerance) lines.push(`    tolerance: ${p.tolerance}`)
    if (p.minValue !== null && p.minValue !== undefined) lines.push(`    min: ${p.minValue}`)
    if (p.maxValue !== null && p.maxValue !== undefined) lines.push(`    max: ${p.maxValue}`)
    lines.push(`    status: "${p.status ?? 'draft'}"`)
    lines.push(`    version: "${p.version ?? '1.0'}"`)
    if (p.tags && p.tags.length > 0) {
      lines.push('    tags:')
      for (const tag of p.tags) lines.push(`      - "${tag}"`)
    }
    if (p.formula) lines.push(`    formula: "${p.formula.replace(/"/g, '\\"')}"`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// CSV (parameters.csv)
// ---------------------------------------------------------------------------
export function formatCSV(params: ExportParameter[]): string {
  const cols = ['id', 'name', 'description', 'data_type', 'value', 'unit', 'tolerance', 'min', 'max', 'status', 'version', 'tags', 'formula']
  const escape = (v: string | null | undefined) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const rows = [cols.join(',')]
  for (const p of params) {
    rows.push([
      escape(p.parameterId),
      escape(p.name),
      escape(p.description),
      escape(p.dataType),
      escape(p.defaultValue),
      escape(p.unit),
      escape(p.tolerance),
      escape(p.minValue),
      escape(p.maxValue),
      escape(p.status),
      escape(p.version),
      escape(Array.isArray(p.tags) ? p.tags.join(';') : null),
      escape(p.formula),
    ].join(','))
  }

  return rows.join('\n')
}

// ---------------------------------------------------------------------------
// XML (parameters.xml)
// ---------------------------------------------------------------------------
export function formatXML(params: ExportParameter[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- Auto-generated parameter file — ${new Date().toISOString()} -->`,
    `<ParameterSet count="${params.length}">`,
  ]

  for (const p of params) {
    lines.push(`  <Parameter id="${escapeXml(p.parameterId ?? '')}" name="${escapeXml(p.name)}">`)
    if (p.description) lines.push(`    <Description>${escapeXml(p.description)}</Description>`)
    if (p.dataType) lines.push(`    <DataType>${escapeXml(p.dataType)}</DataType>`)
    lines.push(`    <Value>${escapeXml(p.defaultValue ?? '')}</Value>`)
    if (p.unit) lines.push(`    <Unit>${escapeXml(p.unit)}</Unit>`)
    if (p.tolerance) lines.push(`    <Tolerance>${escapeXml(p.tolerance)}</Tolerance>`)
    if (p.minValue !== null && p.minValue !== undefined) lines.push(`    <MinValue>${escapeXml(p.minValue)}</MinValue>`)
    if (p.maxValue !== null && p.maxValue !== undefined) lines.push(`    <MaxValue>${escapeXml(p.maxValue)}</MaxValue>`)
    lines.push(`    <Status>${escapeXml(p.status ?? 'draft')}</Status>`)
    lines.push(`    <Version>${escapeXml(p.version ?? '1.0')}</Version>`)
    if (p.formula) lines.push(`    <Formula>${escapeXml(p.formula)}</Formula>`)
    if (p.tags && p.tags.length > 0) {
      lines.push('    <Tags>')
      for (const tag of p.tags) lines.push(`      <Tag>${escapeXml(tag)}</Tag>`)
      lines.push('    </Tags>')
    }
    lines.push('  </Parameter>')
  }

  lines.push('</ParameterSet>')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// XTCE (XML Telemetric and Command Exchange — NASA/CCSDS standard)
// Used by NASA COSMOS, OpenMCT, YAMCS, etc.
// ---------------------------------------------------------------------------
export function formatXTCE(params: ExportParameter[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- XTCE parameter file — generated ${new Date().toISOString()} -->`,
    '<SpaceSystem name="Parameters"',
    '  xmlns="http://www.omg.org/spec/XTCE/20180204"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://www.omg.org/spec/XTCE/20180204 https://www.omg.org/spec/XTCE/20180204/SpaceSystem.xsd">',
    '',
    '  <TelemetryMetaData>',
    '    <ParameterTypeSet>',
  ]

  // Collect unique types
  const typesSeen = new Set<string>()
  for (const p of params) {
    const dt = (p.dataType ?? 'float').toLowerCase()
    const typeName = `${dt}Type`
    if (!typesSeen.has(typeName)) {
      typesSeen.add(typeName)
      if (dt === 'integer' || dt === 'int') {
        lines.push(`      <IntegerParameterType name="${typeName}" signed="true"/>`)
      } else if (dt === 'boolean' || dt === 'bool') {
        lines.push(`      <BooleanParameterType name="${typeName}"/>`)
      } else if (dt === 'string' || dt === 'text') {
        lines.push(`      <StringParameterType name="${typeName}"/>`)
      } else {
        lines.push(`      <FloatParameterType name="${typeName}" sizeInBits="64"/>`)
      }
    }
  }

  lines.push('    </ParameterTypeSet>')
  lines.push('')
  lines.push('    <ParameterSet>')

  for (const p of params) {
    const safeName = sanitizeName(p.name)
    const dt = (p.dataType ?? 'float').toLowerCase()
    const typeName = `${dt}Type`
    const desc = p.description ? ` shortDescription="${escapeXml(p.description)}"` : ''
    lines.push(`      <Parameter name="${escapeXml(safeName)}" parameterTypeRef="${typeName}"${desc}>`)
    lines.push('        <ParameterProperties>')
    lines.push(`          <DefaultAlarm>`)
    if (p.minValue !== null && p.minValue !== undefined) {
      lines.push(`            <StaticAlarmRanges>`)
      lines.push(`              <WarningRange minInclusive="${escapeXml(p.minValue)}" maxInclusive="${escapeXml(p.maxValue ?? '')}"/>`)
      lines.push(`            </StaticAlarmRanges>`)
    }
    lines.push('          </DefaultAlarm>')
    lines.push('        </ParameterProperties>')
    lines.push('      </Parameter>')
  }

  lines.push('    </ParameterSet>')
  lines.push('  </TelemetryMetaData>')
  lines.push('</SpaceSystem>')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// AUTOSAR ARXML (R4 — parameter component interface with SW-DATA-CONSTR)
// ---------------------------------------------------------------------------
export function formatAUTOSAR(params: ExportParameter[]): string {
  const now = new Date().toISOString()
  // Collect params that have range constraints — need SW-DATA-CONSTR entries
  const constrained = params.filter(p =>
    (p.minValue !== null && p.minValue !== undefined) ||
    (p.maxValue !== null && p.maxValue !== undefined)
  )

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- AUTOSAR ARXML parameter file — generated ${now} -->`,
    '<!-- DO NOT EDIT — regenerate from the engineering tool -->',
    '<AUTOSAR xmlns="http://autosar.org/schema/r4.0"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://autosar.org/schema/r4.0 AUTOSAR_4-0-3.xsd">',
    '  <AR-PACKAGES>',
    '    <AR-PACKAGE>',
    '      <SHORT-NAME>ParameterSet</SHORT-NAME>',
    '      <ELEMENTS>',
  ]

  // ── SW-DATA-CONSTR entries (physical constraints per parameter) ─────────
  if (constrained.length > 0) {
    lines.push('        <DATA-CONSTRS>')
    for (const p of constrained) {
      const safeName = sanitizeName(p.name)
      lines.push('          <DATA-CONSTR>')
      lines.push(`            <SHORT-NAME>DC_${escapeXml(safeName)}</SHORT-NAME>`)
      lines.push('            <DATA-CONSTR-RULES>')
      lines.push('              <DATA-CONSTR-RULE>')
      lines.push('                <PHYS-CONSTRS>')
      if (p.minValue !== null && p.minValue !== undefined) {
        lines.push(`                  <LOWER-LIMIT INTERVAL-TYPE="CLOSED">${escapeXml(p.minValue)}</LOWER-LIMIT>`)
      }
      if (p.maxValue !== null && p.maxValue !== undefined) {
        lines.push(`                  <UPPER-LIMIT INTERVAL-TYPE="CLOSED">${escapeXml(p.maxValue)}</UPPER-LIMIT>`)
      }
      lines.push('                </PHYS-CONSTRS>')
      lines.push('              </DATA-CONSTR-RULE>')
      lines.push('            </DATA-CONSTR-RULES>')
      lines.push('          </DATA-CONSTR>')
    }
    lines.push('        </DATA-CONSTRS>')
  }

  // ── CALPRM (calibration parameter) definitions ──────────────────────────
  lines.push('        <PARAMETER-DATA-PROTOTYPE-SET>')

  for (const p of params) {
    const safeName = sanitizeName(p.name)
    const hasConstraint = (p.minValue !== null && p.minValue !== undefined) ||
                          (p.maxValue !== null && p.maxValue !== undefined)
    lines.push('          <PARAMETER-DATA-PROTOTYPE>')
    lines.push(`            <SHORT-NAME>${escapeXml(safeName)}</SHORT-NAME>`)
    if (p.description) lines.push(`            <DESC><L-2 L="EN">${escapeXml(p.description)}</L-2></DESC>`)
    if (hasConstraint) {
      lines.push('            <SW-DATA-DEF-PROPS>')
      lines.push('              <SW-DATA-DEF-PROPS-VARIANTS>')
      lines.push('                <SW-DATA-DEF-PROPS-CONDITIONAL>')
      lines.push(`                  <DATA-CONSTR-REF DEST="DATA-CONSTR">/ParameterSet/DC_${escapeXml(safeName)}</DATA-CONSTR-REF>`)
      lines.push('                </SW-DATA-DEF-PROPS-CONDITIONAL>')
      lines.push('              </SW-DATA-DEF-PROPS-VARIANTS>')
      lines.push('            </SW-DATA-DEF-PROPS>')
    }
    lines.push('            <INIT-VALUE>')
    lines.push(`              <NUMERICAL-VALUE-SPECIFICATION><VALUE>${escapeXml(p.defaultValue ?? '0')}</VALUE></NUMERICAL-VALUE-SPECIFICATION>`)
    lines.push('            </INIT-VALUE>')
    if (p.unit) lines.push(`            <SW-CALPRM-AXIS-UNIT>${escapeXml(p.unit)}</SW-CALPRM-AXIS-UNIT>`)
    lines.push('          </PARAMETER-DATA-PROTOTYPE>')
  }

  lines.push('        </PARAMETER-DATA-PROTOTYPE-SET>')
  lines.push('      </ELEMENTS>')
  lines.push('    </AR-PACKAGE>')
  lines.push('  </AR-PACKAGES>')
  lines.push('</AUTOSAR>')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// ROS2 parameter YAML with ParameterDescriptor fields (parameters_ros.yaml)
// Structured format supports type, description, min_value, max_value.
// Usage: ros2 run <pkg> <node> --ros-args --params-file parameters_ros.yaml
// ---------------------------------------------------------------------------
export function formatROSYAML(params: ExportParameter[]): string {
  const lines: string[] = [
    '# Auto-generated ROS2 parameter file',
    `# Generated: ${new Date().toISOString()}`,
    `# Parameters: ${params.length}`,
    '# Usage: ros2 run <pkg> <node> --ros-args --params-file parameters_ros.yaml',
    '# Each parameter uses the extended descriptor format for rclcpp::ParameterValue',
    '',
    '/**:',
    '  ros__parameters:',
  ]

  for (const p of params) {
    const safeName = sanitizeName(p.name).toLowerCase()
    const value = p.defaultValue ?? '0'

    // Map to ROS2 parameter types
    let rosType = 'double'
    if (p.dataType) {
      const dt = p.dataType.toLowerCase()
      if (dt === 'integer' || dt === 'int') rosType = 'integer'
      else if (dt === 'boolean' || dt === 'bool') rosType = 'bool'
      else if (dt === 'string' || dt === 'text') rosType = 'string'
      else if (dt === 'float') rosType = 'double'
    }

    const hasRange = (p.minValue !== null && p.minValue !== undefined) ||
                     (p.maxValue !== null && p.maxValue !== undefined)
    const header = p.description || p.unit || p.tolerance
      ? `    # ${[p.description, p.unit ? `unit: ${p.unit}` : null, p.tolerance ? `tolerance: ${p.tolerance}` : null].filter(Boolean).join(' | ')}`
      : null

    if (header) lines.push(header)
    lines.push(`    ${safeName}:`)
    lines.push(`      value: ${value}`)
    lines.push(`      type: ${rosType}`)
    if (p.description) lines.push(`      description: "${p.description.replace(/"/g, '\\"')}"`)
    if (p.unit) lines.push(`      unit: "${p.unit}"`)
    if (hasRange && rosType !== 'bool' && rosType !== 'string') {
      if (p.minValue !== null && p.minValue !== undefined) {
        lines.push(`      min_value: ${p.minValue}`)
      }
      if (p.maxValue !== null && p.maxValue !== undefined) {
        lines.push(`      max_value: ${p.maxValue}`)
      }
    }
    if (p.tolerance) lines.push(`      # tolerance: ${p.tolerance}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// DDS IDL v4 (parameters.idl) with @unit and @range annotations
// Used by RTI Connext, OpenDDS, FastDDS (OMG DDS RTPS middleware)
// ---------------------------------------------------------------------------
export function formatDDSIDL(params: ExportParameter[]): string {
  const lines: string[] = [
    '// Auto-generated DDS IDL parameter definition',
    `// Generated: ${new Date().toISOString()}`,
    `// Parameters: ${params.length}`,
    '// Conforms to OMG DDS IDL v4 with @unit and @range annotations',
    '',
    '#ifndef PARAMETERS_IDL',
    '#define PARAMETERS_IDL',
    '',
    'module Parameters {',
    '',
    '  @topic',
    '  struct ParameterSet {',
  ]

  for (const p of params) {
    const safeName = sanitizeName(p.name).toLowerCase()
    const value = p.defaultValue ?? '0'
    const desc = p.description ? ` ${p.description}` : ''

    // Map dataType to IDL primitive
    let idlType = 'double'
    if (p.dataType) {
      const dt = p.dataType.toLowerCase()
      if (dt === 'integer' || dt === 'int' || dt === 'int32') idlType = 'long'
      else if (dt === 'int8') idlType = 'octet'
      else if (dt === 'int16') idlType = 'short'
      else if (dt === 'int64') idlType = 'long long'
      else if (dt === 'uint8' || dt === 'uint16' || dt === 'uint32') idlType = 'unsigned long'
      else if (dt === 'boolean' || dt === 'bool') idlType = 'boolean'
      else if (dt === 'string' || dt === 'text') idlType = 'string'
      else if (dt === 'float') idlType = 'float'
    }

    const isNumeric = idlType !== 'boolean' && idlType !== 'string'
    const hasRange = isNumeric &&
      (p.minValue !== null && p.minValue !== undefined) &&
      (p.maxValue !== null && p.maxValue !== undefined)

    // Comment line with description
    lines.push(`    // ${p.parameterId ?? safeName}:${desc}`)

    // @unit annotation (OMG IDL v4 standard annotation)
    if (p.unit) lines.push(`    @unit("${p.unit}")`)

    // @range annotation — supported by RTI Connext and FastDDS
    if (hasRange) lines.push(`    @range(min=${p.minValue}, max=${p.maxValue})`)

    // Tolerance in comment (no standard IDL annotation for tolerance)
    if (p.tolerance) lines.push(`    // tolerance: ${p.tolerance}`)

    lines.push(`    @default(${idlType === 'string' ? `"${value}"` : value})`)
    lines.push(`    ${idlType} ${safeName};`)
    lines.push('')
  }

  lines.push('  };')
  lines.push('')
  lines.push('};')
  lines.push('')
  lines.push('#endif // PARAMETERS_IDL')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Export metadata (filename + content-type per format)
// ---------------------------------------------------------------------------
export function getExportMeta(format: string): ExportMeta {
  const map: Record<string, ExportMeta> = {
    matlab:        { filename: 'parameters.m',            contentType: 'text/plain' },
    simulink:      { filename: 'create_parameters_sldd.m',  contentType: 'text/plain' },
    mat:           { filename: 'create_parameters_mat.m',   contentType: 'text/plain' },
    python:        { filename: 'parameters.py',           contentType: 'text/x-python' },
    c_header:      { filename: 'parameters.h',            contentType: 'text/plain' },
    ada:           { filename: 'parameters.ads',          contentType: 'text/plain' },
    json:          { filename: 'parameters.json',         contentType: 'application/json' },
    yaml:          { filename: 'parameters.yaml',         contentType: 'application/x-yaml' },
    csv:           { filename: 'parameters.csv',          contentType: 'text/csv' },
    xml:           { filename: 'parameters.xml',          contentType: 'application/xml' },
    xtce:          { filename: 'parameters.xtce',         contentType: 'application/xml' },
    autosar:       { filename: 'parameters.arxml',        contentType: 'application/xml' },
    ros:           { filename: 'parameters_ros.yaml',     contentType: 'application/x-yaml' },
    dds:           { filename: 'parameters.idl',          contentType: 'text/plain' },
    excel:         { filename: 'parameters.xlsx',         contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    pdf:           { filename: 'parameters.pdf',          contentType: 'application/pdf' },
  }
  return map[format] ?? { filename: `parameters.${format}`, contentType: 'text/plain' }
}

// ---------------------------------------------------------------------------
// Excel export
// ---------------------------------------------------------------------------

async function formatExcel(params: ExportParameter[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Engineering Tool'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Parameters', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'Parameter ID', key: 'parameterId', width: 20 },
    { header: 'Name',         key: 'name',         width: 32 },
    { header: 'Description',  key: 'description',  width: 48 },
    { header: 'Data Type',    key: 'dataType',      width: 14 },
    { header: 'Value',        key: 'defaultValue',  width: 16 },
    { header: 'Unit',         key: 'unit',          width: 10 },
    { header: 'Tolerance',    key: 'tolerance',     width: 12 },
    { header: 'Min',          key: 'minValue',      width: 10 },
    { header: 'Max',          key: 'maxValue',      width: 10 },
    { header: 'Formula',      key: 'formula',       width: 36 },
    { header: 'Tags',         key: 'tags',          width: 20 },
    { header: 'Status',       key: 'status',        width: 12 },
    { header: 'Version',      key: 'version',       width: 10 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 22

  for (const p of params) {
    const row = sheet.addRow({
      parameterId:  p.parameterId ?? '',
      name:         p.name,
      description:  p.description ?? '',
      dataType:     p.dataType ?? '',
      defaultValue: p.defaultValue ?? '',
      unit:         p.unit ?? '',
      tolerance:    p.tolerance ?? '',
      minValue:     p.minValue ?? '',
      maxValue:     p.maxValue ?? '',
      formula:      p.formula ?? '',
      tags:         Array.isArray(p.tags) ? p.tags.join('; ') : '',
      status:       p.status ?? 'draft',
      version:      p.version ?? '',
    })

    // Colour-code status cell
    const statusCell = row.getCell('status')
    if (p.status === 'approved') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
      statusCell.font = { color: { argb: 'FF065F46' } }
    } else if (p.status === 'obsolete') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      statusCell.font = { color: { argb: 'FF6B7280' } }
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
      statusCell.font = { color: { argb: 'FF92400E' } }
    }

    // Formula cell — italic purple
    if (p.formula) {
      row.getCell('formula').font = { italic: true, color: { argb: 'FF7C3AED' } }
    }
  }

  // Auto-filter on header row
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: sheet.columns.length } }

  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>
}

// ---------------------------------------------------------------------------
// PDF report export
// ---------------------------------------------------------------------------

async function formatPDF(params: ExportParameter[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Parameters Report' } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const ACCENT = '#4F46E5'
    const MUTED  = '#6B7280'
    const TEXT   = '#111827'
    const BORDER = '#E5E7EB'

    // ── Title ──
    doc.fillColor(ACCENT).fontSize(20).font('Helvetica-Bold')
       .text('Parameters Report', 50, 50)
    doc.fillColor(MUTED).fontSize(10).font('Helvetica')
       .text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} · ${params.length} parameter${params.length !== 1 ? 's' : ''}`, 50, 76)

    doc.moveTo(50, 96).lineTo(545, 96).strokeColor(ACCENT).lineWidth(1.5).stroke()
    doc.y = 104

    const statusColors: Record<string, string> = {
      approved: '#065F46',
      obsolete: '#6B7280',
      draft:    '#92400E',
    }

    for (let i = 0; i < params.length; i++) {
      const p = params[i]

      // Avoid orphan headings — start new page if near bottom
      if (doc.y > 720) doc.addPage()

      const startY = doc.y

      // Parameter name + ID
      doc.fillColor(TEXT).fontSize(12).font('Helvetica-Bold')
         .text(p.name, 50, startY, { continued: false })

      if (p.parameterId) {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica')
           .text(`ID: ${p.parameterId}`, 50)
      }

      if (p.description) {
        doc.fillColor(MUTED).fontSize(10).font('Helvetica')
           .text(p.description, 50, doc.y, { width: 495 })
      }

      // Key-value pairs
      const fields: Array<[string, string | undefined | null]> = [
        ['Type',      p.dataType],
        ['Value',     p.defaultValue],
        ['Unit',      p.unit],
        ['Tolerance', p.tolerance],
        ['Min / Max', p.minValue || p.maxValue ? `${p.minValue ?? '—'} / ${p.maxValue ?? '—'}` : null],
        ['Formula',   p.formula],
        ['Tags',      Array.isArray(p.tags) && p.tags.length ? p.tags.join(', ') : null],
      ]

      for (const [label, value] of fields) {
        if (!value) continue
        doc.fillColor(MUTED).fontSize(9).font('Helvetica-Bold')
           .text(`${label}: `, 60, doc.y, { continued: true })
        doc.fillColor(TEXT).font('Helvetica')
           .text(value, { continued: false, width: 435 })
      }

      // Status badge
      const statusColor = statusColors[p.status ?? 'draft'] ?? MUTED
      doc.fillColor(statusColor).fontSize(8).font('Helvetica-Bold')
         .text(`[${(p.status ?? 'DRAFT').toUpperCase()}]`, 50)

      // Separator line between parameters
      if (i < params.length - 1) {
        doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4)
           .strokeColor(BORDER).lineWidth(0.5).stroke()
        doc.y += 10
      }
    }

    doc.end()
  })
}

// ---------------------------------------------------------------------------
// Dispatcher — text formats (sync), binary formats (async)
// ---------------------------------------------------------------------------

/** Binary-only formats that need async handling */
export const BINARY_EXPORT_FORMATS = ['excel', 'pdf'] as const
export type BinaryExportFormat = typeof BINARY_EXPORT_FORMATS[number]

/**
 * Export to a text-based format. Returns a string synchronously.
 * Use exportParametersBinary for Excel and PDF.
 */
export function exportParameters(format: string, params: ExportParameter[]): string {
  switch (format) {
    case 'matlab':    return formatMATLAB(params)
    case 'simulink':  return formatSimulinkDictScript(params)
    case 'mat':       return formatMATScript(params)
    case 'python':    return formatPython(params)
    case 'c_header':  return formatCHeader(params)
    case 'ada':       return formatAda(params)
    case 'json':      return formatJSON(params)
    case 'yaml':      return formatYAML(params)
    case 'csv':       return formatCSV(params)
    case 'xml':       return formatXML(params)
    case 'xtce':      return formatXTCE(params)
    case 'autosar':   return formatAUTOSAR(params)
    case 'ros':       return formatROSYAML(params)
    case 'dds':       return formatDDSIDL(params)
    default:          throw new Error(`Unknown text export format: ${format}`)
  }
}

/**
 * Export to a binary format (Excel, PDF). Returns a Buffer asynchronously.
 */
export async function exportParametersBinary(format: string, params: ExportParameter[]): Promise<Buffer> {
  switch (format) {
    case 'excel': return formatExcel(params)
    case 'pdf':   return formatPDF(params)
    default:      throw new Error(`Unknown binary export format: ${format}`)
  }
}

export const SUPPORTED_EXPORT_FORMATS = [
  'matlab', 'simulink', 'mat', 'python', 'c_header', 'ada',
  'json', 'yaml', 'csv', 'xml', 'xtce', 'autosar', 'ros', 'dds',
  'excel', 'pdf',
] as const

export const TEXT_EXPORT_FORMATS = [
  'matlab', 'simulink', 'mat', 'python', 'c_header', 'ada',
  'json', 'yaml', 'csv', 'xml', 'xtce', 'autosar', 'ros', 'dds',
] as const

export type ExportFormat = typeof SUPPORTED_EXPORT_FORMATS[number]
