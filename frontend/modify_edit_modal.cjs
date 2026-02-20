const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'components', 'requirements');
const createModalPath = path.join(srcDir, 'CreateRequirementModal.tsx');
const editModalPath = path.join(srcDir, 'EditRequirementModal.tsx');

const createContent = fs.readFileSync(createModalPath, 'utf-8');
let editContent = fs.readFileSync(editModalPath, 'utf-8');

// 1. Extract QuickLinkAdapter and QuickLinkSelector (lines 62-158 approx)
const quickLinkStart = createContent.indexOf('interface QuickLinkAdapter');
const quickLinkEnd = createContent.indexOf('export default function CreateRequirementModal') - 1;
const quickLinkCode = createContent.slice(quickLinkStart, quickLinkEnd);

if (!editContent.includes('interface QuickLinkAdapter')) {
  const editExportStart = editContent.indexOf('export default function EditRequirementModal');
  editContent = editContent.slice(0, editExportStart) + quickLinkCode + '\n' + editContent.slice(editExportStart);
}

// 2. Imports
const adapterImports = `import { stakeholderAdapter } from '../../linkage/adapters/stakeholderAdapter'
import { pbsAdapter } from '../../linkage/adapters/pbsAdapter'
import { interfaceAdapter } from '../../linkage/adapters/interfaceAdapter'
import { hazardAdapter } from '../../linkage/adapters/hazardAdapter'
import { riskAdapter } from '../../linkage/adapters/riskAdapter'
import { documentAdapter } from '../../linkage/adapters/documentAdapter'
import { verificationAdapter } from '../../linkage/adapters/verificationAdapter'
import { changeRequestAdapter } from '../../linkage/adapters/changeRequestAdapter'
import { certificationAdapter } from '../../linkage/adapters/certificationAdapter'
import { complianceAdapter } from '../../linkage/adapters/complianceAdapter'
import { taskAdapter } from '../../linkage/adapters/taskAdapter'
import { issueAdapter } from '../../linkage/adapters/issueAdapter'
import { requirementAdapter } from '../../linkage/adapters/requirementAdapter'
import { LINKAGE_V1 } from '../../config/featureFlags'
`;

if (!editContent.includes('pbsAdapter')) {
  const lastImportIndex = editContent.lastIndexOf('import ');
  const nextLineIndex = editContent.indexOf('\n', lastImportIndex) + 1;
  editContent = editContent.slice(0, nextLineIndex) + adapterImports + editContent.slice(nextLineIndex);
}

if (!editContent.includes('import { linkService }')) {
  editContent = editContent.replace("import { authService } from '../../services/auth.service'", "import { authService } from '../../services/auth.service'\nimport { linkService } from '../../services/link.service'");
}

const targetIconsStr = "X, Plus, Trash2, ChevronDown, ChevronRight, Layers, FileText, Link as LinkIcon, Tag, Activity, FileCheck, Shield, Target, GitBranch, CheckCircle2, AlertTriangle, ClipboardCheck, BarChart3, Info, ArrowRight";
const replaceRegex = /import\s+\{[^}]*\}\s+from\s+'lucide-react'/;
editContent = editContent.replace(replaceRegex, `import { ${targetIconsStr} } from 'lucide-react'`);

// 3. Extract Traceability State Variables
const stateVarsStartPattern = '// Quick Links (LINKAGE_V1)';
const stateVarsStart = createContent.indexOf(stateVarsStartPattern);
const stateVarsEndPattern = '// Fetch lifecycles logic'; // Or queryClient
const stateVarsEnd = createContent.indexOf('const queryClient =', stateVarsStart);
let stateVarsCode = createContent.slice(stateVarsStart, stateVarsEnd);

if (!editContent.includes(stateVarsStartPattern)) {
  const editStateInsertPos = editContent.indexOf('const queryClient = useQueryClient()');
  editContent = editContent.slice(0, editStateInsertPos) + stateVarsCode + '\n  ' + editContent.slice(editStateInsertPos);
}

// 4. TraceLink handlers
const addTraceLinkFn = 'const handleBatchAddTraceLinks = () => {\n    if (quickLinksRequirements.length === 0) return\n    const newLinks = quickLinksRequirements\n      .filter(id => !traceLinks.some(l => l.targetId === id && l.linkType === selectedRelationshipType))\n      .map(id => {\n        const label = quickLinksLabels[id] || id.slice(0, 8)\n        return {\n          targetId: id,\n          targetType: \'requirement\',\n          linkType: selectedRelationshipType,\n          rationale: relationshipRationale,\n          targetDisplayId: label,\n        }\n      })\n    setTraceLinks(prev => [...prev, ...newLinks])\n    setQuickLinksRequirements([])\n    setRelationshipRationale(\'\')\n  }';
const rmTraceLinkFn = 'const handleRemoveTraceLink = (targetId: string, linkType: string) => {\n    setTraceLinks(prev => prev.filter(l => !(l.targetId === targetId && l.linkType === linkType)))\n  }';

if (!editContent.includes('handleBatchAddTraceLinks')) {
  const submitStart = editContent.indexOf('const handleSubmit = (e: React.FormEvent) => {');
  const handlers = [addTraceLinkFn, rmTraceLinkFn].join('\n\n  ') + '\n\n  ';
  editContent = editContent.slice(0, submitStart) + handlers + editContent.slice(submitStart);
}

// 5. Replace Traceability Tab in JSX
const activeTabPattern = /\{\/\* Traceability Tab \*\/\}[\s\S]*?activeTab === 'traceability'[\s\S]*?<\/div>\s+\)\}/;
const createPatternForExtraction = /\{\/\* \u2550{55}[\s\S]*?activeTab === 'traceability'[\s\S]*?<\/div>\s+\)\}/;

const matchInfo = createContent.match(createPatternForExtraction);
if (matchInfo) {
  editContent = editContent.replace(activeTabPattern, matchInfo[0]);
}

// 6. Form Submission Link Logic
const linkLogicCode = `
      // Trace links logic
      if (response.success && response.data && LINKAGE_V1) {
        const updatedReq = response.data
        const linkPromises: Promise<any>[] = []
        
        quickLinksPbs.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'pbs_component',
              targetId,
              linkType: 'allocated_to',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksInterfaces.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'interface',
              targetId,
              linkType: 'related_interface',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksHazards.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'hazard',
              targetId,
              linkType: 'mitigates',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksRisks.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'risk',
              targetId,
              linkType: 'mitigates',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksVerification.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'test_case',
              targetId,
              linkType: 'verified_by',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksDocuments.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'document',
              targetId,
              linkType: 'documented_in',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksChangeRequests.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'change_request',
              targetId,
              linkType: 'changes_via',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksIssues.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'issue',
              targetId,
              linkType: 'tracked_by',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksTasks.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'task',
              targetId,
              linkType: 'implemented_by',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksCertification.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'cert_objective',
              targetId,
              linkType: 'cert_objective',
              rationale: linkRationale || undefined,
            })
          )
        )
        quickLinksCompliance.forEach((targetId) =>
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: 'compliance_rule',
              targetId,
              linkType: 'complies_with',
              rationale: linkRationale || undefined,
            })
          )
        )
        
        traceLinks.forEach((link) => {
          linkPromises.push(
            linkService.createLink(projectId, {
              sourceType: 'requirement',
              sourceId: updatedReq.id,
              targetType: link.targetType,
              targetId: link.targetId,
              linkType: link.linkType,
              rationale: link.rationale || undefined,
            })
          )
        })

        if (linkPromises.length > 0) {
          Promise.allSettled(linkPromises).then(() => {
            queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
            queryClient.invalidateQueries({ queryKey: ['links'] })
            onClose()
          })
          return
        }
      }
`;

if (!editContent.includes('linkPromises.push(')) {
  const hookPoint = "console.log('Update successful:', response)";
  const injectIndex = editContent.indexOf(hookPoint);
  if (injectIndex > -1) {
    const insertPos = injectIndex + hookPoint.length;
    editContent = editContent.slice(0, insertPos) + '\n' + linkLogicCode + editContent.slice(insertPos);
  }
}

fs.writeFileSync(editModalPath, editContent);
console.log('Successfully aligned Traceability tab.');
