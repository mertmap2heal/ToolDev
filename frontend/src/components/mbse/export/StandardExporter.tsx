import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  Download,
  FileText,
  FileCode,
  Settings,
  CheckCircle,
  Loader,
  Info,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { requirementService } from '../../../services/requirement.service'
import { functionService } from '../../../services/function.service'
import { traceabilityService } from '../../../services/traceability.service'
import { useCaseService } from '../../../services/usecase.service'
import type { Requirement, SystemFunction } from 'shared/types/engineering.types'
import type { TraceLink } from 'shared/types/traceability.types'
import type { UseCase } from 'shared/types/usecase.types'
import clsx from 'clsx'

interface StandardExporterProps {
  projectId: string
  projectName?: string
  onClose: () => void
}

type ExportFormat = 'reqif' | 'xmi' | 'sysml-xmi' | 'json-ld' | 'csv'

interface ExportOptions {
  includeRequirements: boolean
  includeFunctions: boolean
  includeTraceLinks: boolean
  includeUseCases: boolean
  includeMetadata: boolean
  flattenHierarchy: boolean
}

/**
 * StandardExporter provides industrial-standard export formats
 * for requirements and model interchange.
 * Supports ReqIF (ISO/IEC 29148), XMI (OMG), and SysML XMI.
 */
export default function StandardExporter({
  projectId,
  projectName = 'Project',
  onClose,
}: StandardExporterProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('reqif')
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [options, setOptions] = useState<ExportOptions>({
    includeRequirements: true,
    includeFunctions: true,
    includeTraceLinks: true,
    includeUseCases: true,
    includeMetadata: true,
    flattenHierarchy: false,
  })

  // Fetch all data
  const { data: requirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: functions = [], isLoading: loadingFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: traceLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: useCases = [], isLoading: loadingUCs } = useQuery({
    queryKey: ['usecases', projectId],
    queryFn: async () => {
      const response = await useCaseService.getUseCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const generateReqIF = useCallback(() => {
    const timestamp = new Date().toISOString()
    const reqifId = `reqif-${projectId}-${Date.now()}`

    // Build ReqIF XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<REQ-IF xmlns="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd">
  <THE-HEADER>
    <REQ-IF-HEADER IDENTIFIER="${reqifId}">
      <COMMENT>ReqIF export from Requirements Management Tool</COMMENT>
      <CREATION-TIME>${timestamp}</CREATION-TIME>
      <REQ-IF-TOOL-ID>requirements-management-tool</REQ-IF-TOOL-ID>
      <REQ-IF-VERSION>1.0</REQ-IF-VERSION>
      <SOURCE-TOOL-ID>requirements-management-tool</SOURCE-TOOL-ID>
      <TITLE>${projectName} Requirements Export</TITLE>
    </REQ-IF-HEADER>
  </THE-HEADER>
  <CORE-CONTENT>
    <REQ-IF-CONTENT>
      <DATATYPES>
        <DATATYPE-DEFINITION-STRING IDENTIFIER="DT-String" LONG-NAME="String" MAX-LENGTH="4000"/>
        <DATATYPE-DEFINITION-ENUMERATION IDENTIFIER="DT-Priority" LONG-NAME="Priority">
          <SPECIFIED-VALUES>
            <ENUM-VALUE IDENTIFIER="PRI-CRIT" LONG-NAME="Critical"/>
            <ENUM-VALUE IDENTIFIER="PRI-HIGH" LONG-NAME="High"/>
            <ENUM-VALUE IDENTIFIER="PRI-MED" LONG-NAME="Medium"/>
            <ENUM-VALUE IDENTIFIER="PRI-LOW" LONG-NAME="Low"/>
          </SPECIFIED-VALUES>
        </DATATYPE-DEFINITION-ENUMERATION>
        <DATATYPE-DEFINITION-ENUMERATION IDENTIFIER="DT-Status" LONG-NAME="Status">
          <SPECIFIED-VALUES>
            <ENUM-VALUE IDENTIFIER="STAT-DRAFT" LONG-NAME="Draft"/>
            <ENUM-VALUE IDENTIFIER="STAT-REVIEW" LONG-NAME="Under Review"/>
            <ENUM-VALUE IDENTIFIER="STAT-APPROVED" LONG-NAME="Approved"/>
            <ENUM-VALUE IDENTIFIER="STAT-REJECTED" LONG-NAME="Rejected"/>
          </SPECIFIED-VALUES>
        </DATATYPE-DEFINITION-ENUMERATION>
      </DATATYPES>
      <SPEC-TYPES>
        <SPEC-OBJECT-TYPE IDENTIFIER="SOT-Requirement" LONG-NAME="Requirement">
          <SPEC-ATTRIBUTES>
            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="AT-Title" LONG-NAME="Title">
              <TYPE><DATATYPE-DEFINITION-STRING-REF>DT-String</DATATYPE-DEFINITION-STRING-REF></TYPE>
            </ATTRIBUTE-DEFINITION-STRING>
            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="AT-Description" LONG-NAME="Description">
              <TYPE><DATATYPE-DEFINITION-STRING-REF>DT-String</DATATYPE-DEFINITION-STRING-REF></TYPE>
            </ATTRIBUTE-DEFINITION-STRING>
            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="AT-ReqID" LONG-NAME="ID">
              <TYPE><DATATYPE-DEFINITION-STRING-REF>DT-String</DATATYPE-DEFINITION-STRING-REF></TYPE>
            </ATTRIBUTE-DEFINITION-STRING>
            <ATTRIBUTE-DEFINITION-ENUMERATION IDENTIFIER="AT-Priority" LONG-NAME="Priority">
              <TYPE><DATATYPE-DEFINITION-ENUMERATION-REF>DT-Priority</DATATYPE-DEFINITION-ENUMERATION-REF></TYPE>
            </ATTRIBUTE-DEFINITION-ENUMERATION>
            <ATTRIBUTE-DEFINITION-ENUMERATION IDENTIFIER="AT-Status" LONG-NAME="Status">
              <TYPE><DATATYPE-DEFINITION-ENUMERATION-REF>DT-Status</DATATYPE-DEFINITION-ENUMERATION-REF></TYPE>
            </ATTRIBUTE-DEFINITION-ENUMERATION>
          </SPEC-ATTRIBUTES>
        </SPEC-OBJECT-TYPE>
        <SPEC-RELATION-TYPE IDENTIFIER="SRT-TraceLink" LONG-NAME="Trace Link">
          <SPEC-ATTRIBUTES>
            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="AT-LinkType" LONG-NAME="Link Type">
              <TYPE><DATATYPE-DEFINITION-STRING-REF>DT-String</DATATYPE-DEFINITION-STRING-REF></TYPE>
            </ATTRIBUTE-DEFINITION-STRING>
          </SPEC-ATTRIBUTES>
        </SPEC-RELATION-TYPE>
        <SPECIFICATION-TYPE IDENTIFIER="SPT-Specification" LONG-NAME="Requirements Specification"/>
      </SPEC-TYPES>
      <SPEC-OBJECTS>
${options.includeRequirements ? requirements.map((req) => `        <SPEC-OBJECT IDENTIFIER="REQ-${req.id}" LONG-NAME="${escapeXml(req.title)}">
          <TYPE><SPEC-OBJECT-TYPE-REF>SOT-Requirement</SPEC-OBJECT-TYPE-REF></TYPE>
          <VALUES>
            <ATTRIBUTE-VALUE-STRING THE-VALUE="${escapeXml(req.title)}">
              <DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>AT-Title</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>
            </ATTRIBUTE-VALUE-STRING>
            <ATTRIBUTE-VALUE-STRING THE-VALUE="${escapeXml(req.description || '')}">
              <DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>AT-Description</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>
            </ATTRIBUTE-VALUE-STRING>
            <ATTRIBUTE-VALUE-STRING THE-VALUE="${escapeXml(req.requirementId || '')}">
              <DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>AT-ReqID</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>
            </ATTRIBUTE-VALUE-STRING>
          </VALUES>
        </SPEC-OBJECT>`).join('\n') : ''}
      </SPEC-OBJECTS>
      <SPEC-RELATIONS>
${options.includeTraceLinks ? traceLinks.filter(l => l.sourceType === 'requirement' && l.targetType === 'requirement').map((link) => `        <SPEC-RELATION IDENTIFIER="LINK-${link.id}">
          <TYPE><SPEC-RELATION-TYPE-REF>SRT-TraceLink</SPEC-RELATION-TYPE-REF></TYPE>
          <SOURCE><SPEC-OBJECT-REF>REQ-${link.sourceId}</SPEC-OBJECT-REF></SOURCE>
          <TARGET><SPEC-OBJECT-REF>REQ-${link.targetId}</SPEC-OBJECT-REF></TARGET>
        </SPEC-RELATION>`).join('\n') : ''}
      </SPEC-RELATIONS>
      <SPECIFICATIONS>
        <SPECIFICATION IDENTIFIER="SPEC-${projectId}" LONG-NAME="${projectName}">
          <TYPE><SPECIFICATION-TYPE-REF>SPT-Specification</SPECIFICATION-TYPE-REF></TYPE>
          <CHILDREN>
${options.includeRequirements ? buildReqIFHierarchy(requirements, options.flattenHierarchy) : ''}
          </CHILDREN>
        </SPECIFICATION>
      </SPECIFICATIONS>
    </REQ-IF-CONTENT>
  </CORE-CONTENT>
</REQ-IF>`

    return xml
  }, [projectId, projectName, requirements, traceLinks, options])

  const generateXMI = useCallback(() => {
    const timestamp = new Date().toISOString()

    // Build UML XMI
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
         xmlns:uml="http://www.omg.org/spec/UML/20131001"
         xmlns:SysML="http://www.omg.org/spec/SysML/20150709/SysML"
         xmi:version="2.5">
  <xmi:Documentation exporter="Requirements Management Tool" exporterVersion="1.0"/>
  <uml:Model xmi:id="MODEL-${projectId}" name="${escapeXml(projectName)}">
    <packagedElement xmi:type="uml:Package" xmi:id="PKG-Requirements" name="Requirements">
${options.includeRequirements ? requirements.map((req) => `      <packagedElement xmi:type="uml:Class" xmi:id="REQ-${req.id}" name="${escapeXml(req.title)}">
        <ownedComment xmi:type="uml:Comment" xmi:id="CMT-${req.id}" body="${escapeXml(req.description || '')}"/>
        <ownedAttribute xmi:type="uml:Property" xmi:id="ATTR-${req.id}-id" name="requirementId" visibility="public">
          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20131001/PrimitiveTypes.xmi#String"/>
          <defaultValue xmi:type="uml:LiteralString" value="${escapeXml(req.requirementId || '')}"/>
        </ownedAttribute>
        <ownedAttribute xmi:type="uml:Property" xmi:id="ATTR-${req.id}-priority" name="priority" visibility="public">
          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20131001/PrimitiveTypes.xmi#String"/>
          <defaultValue xmi:type="uml:LiteralString" value="${req.priority || ''}"/>
        </ownedAttribute>
        <ownedAttribute xmi:type="uml:Property" xmi:id="ATTR-${req.id}-status" name="status" visibility="public">
          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20131001/PrimitiveTypes.xmi#String"/>
          <defaultValue xmi:type="uml:LiteralString" value="${req.status || ''}"/>
        </ownedAttribute>
      </packagedElement>`).join('\n') : ''}
    </packagedElement>
${options.includeFunctions ? `    <packagedElement xmi:type="uml:Package" xmi:id="PKG-Functions" name="System Functions">
${functions.map((func) => `      <packagedElement xmi:type="uml:Class" xmi:id="FUNC-${func.id}" name="${escapeXml(func.name)}">
        <ownedComment xmi:type="uml:Comment" xmi:id="CMT-${func.id}" body="${escapeXml(func.description || '')}"/>
      </packagedElement>`).join('\n')}
    </packagedElement>` : ''}
${options.includeUseCases ? `    <packagedElement xmi:type="uml:Package" xmi:id="PKG-UseCases" name="Use Cases">
${useCases.map((uc) => `      <packagedElement xmi:type="uml:UseCase" xmi:id="UC-${uc.id}" name="${escapeXml(uc.name)}">
        <ownedComment xmi:type="uml:Comment" xmi:id="CMT-${uc.id}" body="${escapeXml(uc.description || '')}"/>
      </packagedElement>`).join('\n')}
    </packagedElement>` : ''}
${options.includeTraceLinks ? `    <packagedElement xmi:type="uml:Package" xmi:id="PKG-TraceLinks" name="Trace Links">
${traceLinks.map((link) => `      <packagedElement xmi:type="uml:Dependency" xmi:id="LINK-${link.id}" name="${link.linkType}">
        <client xmi:idref="${getElementRef(link.sourceType, link.sourceId)}"/>
        <supplier xmi:idref="${getElementRef(link.targetType, link.targetId)}"/>
      </packagedElement>`).join('\n')}
    </packagedElement>` : ''}
  </uml:Model>
</xmi:XMI>`

    return xml
  }, [projectId, projectName, requirements, functions, useCases, traceLinks, options])

  const generateSysMLXMI = useCallback(() => {
    const timestamp = new Date().toISOString()

    // Build SysML XMI with stereotypes
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
         xmlns:uml="http://www.omg.org/spec/UML/20131001"
         xmlns:SysML="http://www.omg.org/spec/SysML/20150709/SysML"
         xmi:version="2.5">
  <xmi:Documentation exporter="Requirements Management Tool" exporterVersion="1.0"/>
  
  <!-- SysML Profile Application -->
  <SysML:ModelicaProfile xmi:id="PROFILE-SysML"/>
  
  <uml:Model xmi:id="MODEL-${projectId}" name="${escapeXml(projectName)}">
    <profileApplication xmi:type="uml:ProfileApplication" xmi:id="PA-SysML">
      <appliedProfile xmi:type="uml:Profile" href="http://www.omg.org/spec/SysML/20150709/SysML"/>
    </profileApplication>
    
    <!-- Requirements Package (SysML Requirements Diagram) -->
    <packagedElement xmi:type="uml:Package" xmi:id="PKG-Requirements" name="Requirements">
${options.includeRequirements ? requirements.map((req) => `      <!-- SysML Requirement: ${escapeXml(req.title)} -->
      <packagedElement xmi:type="uml:Class" xmi:id="REQ-${req.id}" name="${escapeXml(req.title)}">
        <ownedComment xmi:type="uml:Comment" xmi:id="CMT-${req.id}">
          <body>${escapeXml(req.description || '')}</body>
        </ownedComment>
      </packagedElement>`).join('\n') : ''}
    </packagedElement>
    
    <!-- Blocks Package (SysML Block Definition Diagram) -->
    <packagedElement xmi:type="uml:Package" xmi:id="PKG-Blocks" name="System Blocks">
${options.includeFunctions ? functions.map((func) => `      <!-- SysML Block: ${escapeXml(func.name)} -->
      <packagedElement xmi:type="uml:Class" xmi:id="BLOCK-${func.id}" name="${escapeXml(func.name)}">
        <ownedComment xmi:type="uml:Comment" xmi:id="CMT-BLOCK-${func.id}">
          <body>${escapeXml(func.description || '')}</body>
        </ownedComment>
      </packagedElement>`).join('\n') : ''}
    </packagedElement>
    
    <!-- Use Cases Package -->
${options.includeUseCases ? `    <packagedElement xmi:type="uml:Package" xmi:id="PKG-UseCases" name="Use Cases">
${useCases.map((uc) => `      <packagedElement xmi:type="uml:UseCase" xmi:id="UC-${uc.id}" name="${escapeXml(uc.name)}">
        <ownedComment xmi:type="uml:Comment" xmi:id="CMT-UC-${uc.id}">
          <body>${escapeXml(uc.description || '')}</body>
        </ownedComment>
      </packagedElement>`).join('\n')}
    </packagedElement>` : ''}
    
    <!-- Satisfy and Derive Relationships -->
${options.includeTraceLinks ? `    <packagedElement xmi:type="uml:Package" xmi:id="PKG-Relationships" name="Traceability">
${traceLinks.map((link) => {
      const relType = link.linkType === 'satisfies' ? 'SysML:Satisfy' :
        link.linkType === 'derives' ? 'SysML:DeriveReqt' :
          link.linkType === 'refines' ? 'SysML:Refine' : 'uml:Abstraction'
      return `      <packagedElement xmi:type="${relType}" xmi:id="REL-${link.id}">
        <client xmi:idref="${getElementRef(link.sourceType, link.sourceId)}"/>
        <supplier xmi:idref="${getElementRef(link.targetType, link.targetId)}"/>
      </packagedElement>`
    }).join('\n')}
    </packagedElement>` : ''}
  </uml:Model>
  
  <!-- SysML Stereotypes -->
${options.includeRequirements ? requirements.map((req) => `  <SysML:Requirement xmi:id="STEREO-REQ-${req.id}" base_Class="REQ-${req.id}" 
    id="${escapeXml(req.requirementId || req.id)}" 
    text="${escapeXml(req.description || '')}"/>`).join('\n') : ''}
${options.includeFunctions ? functions.map((func) => `  <SysML:Block xmi:id="STEREO-BLOCK-${func.id}" base_Class="BLOCK-${func.id}"/>`).join('\n') : ''}
</xmi:XMI>`

    return xml
  }, [projectId, projectName, requirements, functions, useCases, traceLinks, options])

  const generateJSONLD = useCallback(() => {
    const data = {
      '@context': {
        '@vocab': 'http://www.omg.org/spec/ReqIF/',
        'req': 'http://example.org/requirements/',
        'func': 'http://example.org/functions/',
        'trace': 'http://example.org/traceability/',
      },
      '@id': `project:${projectId}`,
      '@type': 'RequirementsSpecification',
      name: projectName,
      createdAt: new Date().toISOString(),
      ...(options.includeRequirements && {
        requirements: requirements.map((req) => ({
          '@id': `req:${req.id}`,
          '@type': 'Requirement',
          identifier: req.requirementId,
          title: req.title,
          description: req.description,
          priority: req.priority,
          status: req.status,
          type: req.requirementType,
          verificationMethod: req.verificationMethod,
          verificationStatus: req.verificationStatus,
          ...(req.parentId && { parent: `req:${req.parentId}` }),
        })),
      }),
      ...(options.includeFunctions && {
        functions: functions.map((func) => ({
          '@id': `func:${func.id}`,
          '@type': 'SystemFunction',
          identifier: func.functionId,
          name: func.name,
          description: func.description,
          status: func.status,
          ...(func.sourceReqId && { satisfies: `req:${func.sourceReqId}` }),
        })),
      }),
      ...(options.includeUseCases && {
        useCases: useCases.map((uc) => ({
          '@id': `uc:${uc.id}`,
          '@type': 'UseCase',
          title: uc.name,
          description: uc.description,
          status: uc.status,
        })),
      }),
      ...(options.includeTraceLinks && {
        traceLinks: traceLinks.map((link) => ({
          '@id': `trace:${link.id}`,
          '@type': 'TraceLink',
          linkType: link.linkType,
          source: `${link.sourceType}:${link.sourceId}`,
          target: `${link.targetType}:${link.targetId}`,
          isSuspect: link.isSuspect,
        })),
      }),
    }
    return JSON.stringify(data, null, 2)
  }, [projectId, projectName, requirements, functions, useCases, traceLinks, options])

  const generateCSV = useCallback(() => {
    const lines: string[] = []

    // Requirements CSV
    if (options.includeRequirements) {
      lines.push('# Requirements')
      lines.push('UUID,ID,Title,Description,Type,Priority,Status,VerificationMethod,VerificationStatus,ParentID')
      requirements.forEach((req) => {
        lines.push([
          req.id,
          req.requirementId || '',
          `"${(req.title || '').replace(/"/g, '""')}"`,
          `"${(req.description || '').replace(/"/g, '""')}"`,
          req.requirementType || '',
          req.priority || '',
          req.status || '',
          req.verificationMethod || '',
          req.verificationStatus || '',
          req.parentId || '',
        ].join(','))
      })
      lines.push('')
    }

    if (options.includeFunctions) {
      lines.push('# Functions')
      lines.push('UUID,ID,Name,Description,Status,SourceReqID')
      functions.forEach((func) => {
        lines.push([
          func.id,
          func.functionId || '',
          `"${(func.name || '').replace(/"/g, '""')}"`,
          `"${(func.description || '').replace(/"/g, '""')}"`,
          func.status || '',
          func.sourceReqId || '',
        ].join(','))
      })
      lines.push('')
    }

    if (options.includeTraceLinks) {
      lines.push('# Trace Links')
      lines.push('ID,SourceType,SourceID,TargetType,TargetID,LinkType,IsSuspect')
      traceLinks.forEach((link) => {
        lines.push([
          link.id,
          link.sourceType,
          link.sourceId,
          link.targetType,
          link.targetId,
          link.linkType,
          link.isSuspect ? 'true' : 'false',
        ].join(','))
      })
    }

    return lines.join('\n')
  }, [requirements, functions, traceLinks, options])

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setExportSuccess(false)

    try {
      let content: string
      let filename: string
      let mimeType: string

      switch (selectedFormat) {
        case 'reqif':
          content = generateReqIF()
          filename = `${projectName}-requirements.reqif`
          mimeType = 'application/xml'
          break
        case 'xmi':
          content = generateXMI()
          filename = `${projectName}-model.xmi`
          mimeType = 'application/xml'
          break
        case 'sysml-xmi':
          content = generateSysMLXMI()
          filename = `${projectName}-sysml.xmi`
          mimeType = 'application/xml'
          break
        case 'json-ld':
          content = generateJSONLD()
          filename = `${projectName}-model.jsonld`
          mimeType = 'application/ld+json'
          break
        case 'csv':
          content = generateCSV()
          filename = `${projectName}-data.csv`
          mimeType = 'text/csv'
          break
        default:
          throw new Error('Unknown format')
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [selectedFormat, generateReqIF, generateXMI, generateSysMLXMI, generateJSONLD, generateCSV, projectName])

  const isLoading = loadingReqs || loadingFuncs || loadingLinks || loadingUCs

  const formats: Array<{ id: ExportFormat; name: string; description: string; standard: string; icon: typeof FileCode }> = [
    {
      id: 'reqif',
      name: 'ReqIF',
      description: 'Requirements Interchange Format',
      standard: 'ISO/IEC 29148',
      icon: FileCode,
    },
    {
      id: 'xmi',
      name: 'UML XMI',
      description: 'XML Metadata Interchange for UML',
      standard: 'OMG XMI 2.5',
      icon: FileCode,
    },
    {
      id: 'sysml-xmi',
      name: 'SysML XMI',
      description: 'SysML Model Exchange',
      standard: 'OMG SysML 1.5',
      icon: FileCode,
    },
    {
      id: 'json-ld',
      name: 'JSON-LD',
      description: 'Linked Data JSON format',
      standard: 'W3C JSON-LD',
      icon: FileText,
    },
    {
      id: 'csv',
      name: 'CSV',
      description: 'Comma-separated values',
      standard: 'RFC 4180',
      icon: FileText,
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Download className="text-blue-500" size={24} />
              Standard Export
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Export model data in industry-standard formats
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Data Summary */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-4">
              <span>{requirements.length} requirements</span>
              <span>{functions.length} functions</span>
              <span>{useCases.length} use cases</span>
              <span>{traceLinks.length} trace links</span>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Export Format
            </label>
            <div className="grid grid-cols-1 gap-2">
              {formats.map((format) => {
                const Icon = format.icon
                return (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id)}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                      selectedFormat === format.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    )}
                  >
                    <Icon
                      size={20}
                      className={selectedFormat === format.id ? 'text-blue-500' : 'text-gray-400'}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {format.name}
                      </div>
                      <div className="text-xs text-gray-500">{format.description}</div>
                    </div>
                    <div className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {format.standard}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Export Options */}
          <div>
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <Settings size={14} />
              Export Options
              {showOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showOptions && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.includeRequirements}
                    onChange={(e) => setOptions({ ...options, includeRequirements: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Requirements</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.includeFunctions}
                    onChange={(e) => setOptions({ ...options, includeFunctions: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Functions</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.includeTraceLinks}
                    onChange={(e) => setOptions({ ...options, includeTraceLinks: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Trace Links</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.includeUseCases}
                    onChange={(e) => setOptions({ ...options, includeUseCases: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Use Cases</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.flattenHierarchy}
                    onChange={(e) => setOptions({ ...options, flattenHierarchy: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Flatten Hierarchy (ReqIF only)</span>
                </label>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
            <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-blue-700 dark:text-blue-300">
              {selectedFormat === 'reqif' && 'ReqIF is the industry standard for requirements exchange between tools like IBM DOORS, Polarion, and Jama Connect.'}
              {selectedFormat === 'xmi' && 'XMI enables model interchange with UML tools like Enterprise Architect, MagicDraw, and Papyrus.'}
              {selectedFormat === 'sysml-xmi' && 'SysML XMI includes SysML stereotypes for exchange with Cameo Systems Modeler and Rhapsody.'}
              {selectedFormat === 'json-ld' && 'JSON-LD provides a lightweight linked data format suitable for web APIs and semantic web applications.'}
              {selectedFormat === 'csv' && 'CSV format is compatible with spreadsheet applications like Excel and Google Sheets.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            {exportSuccess && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle size={14} />
                Export completed successfully
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isLoading || isExporting}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={14} />
                  Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getElementRef(type: string, id: string): string {
  switch (type) {
    case 'requirement':
      return `REQ-${id}`
    case 'function':
      return `FUNC-${id}`
    case 'usecase':
      return `UC-${id}`
    default:
      return id
  }
}

function buildReqIFHierarchy(requirements: Requirement[], flatten: boolean): string {
  if (flatten) {
    return requirements
      .map((req) => `            <SPEC-HIERARCHY IDENTIFIER="HIER-${req.id}">
              <OBJECT><SPEC-OBJECT-REF>REQ-${req.id}</SPEC-OBJECT-REF></OBJECT>
            </SPEC-HIERARCHY>`)
      .join('\n')
  }

  // Build hierarchical structure
  const rootReqs = requirements.filter((r) => !r.parentId)
  const childMap = new Map<string, Requirement[]>()
  requirements.forEach((req) => {
    if (req.parentId) {
      const children = childMap.get(req.parentId) || []
      children.push(req)
      childMap.set(req.parentId, children)
    }
  })

  const buildNode = (req: Requirement, indent: number): string => {
    const spaces = '            ' + '  '.repeat(indent)
    const children = childMap.get(req.id) || []

    if (children.length === 0) {
      return `${spaces}<SPEC-HIERARCHY IDENTIFIER="HIER-${req.id}">
${spaces}  <OBJECT><SPEC-OBJECT-REF>REQ-${req.id}</SPEC-OBJECT-REF></OBJECT>
${spaces}</SPEC-HIERARCHY>`
    }

    return `${spaces}<SPEC-HIERARCHY IDENTIFIER="HIER-${req.id}">
${spaces}  <OBJECT><SPEC-OBJECT-REF>REQ-${req.id}</SPEC-OBJECT-REF></OBJECT>
${spaces}  <CHILDREN>
${children.map((child) => buildNode(child, indent + 2)).join('\n')}
${spaces}  </CHILDREN>
${spaces}</SPEC-HIERARCHY>`
  }

  return rootReqs.map((req) => buildNode(req, 0)).join('\n')
}
