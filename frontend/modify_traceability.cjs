const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'components', 'requirements');
const editModalPath = path.join(srcDir, 'EditRequirementModal.tsx');
const createModalPath = path.join(srcDir, 'CreateRequirementModal.tsx');

let editContent = fs.readFileSync(editModalPath, 'utf-8');
const createContent = fs.readFileSync(createModalPath, 'utf-8');

// Get new traceability tab from CreateReq
const newStartMarker = '{/* ═══════════════════════════════════════════════════════\n                Traceability Tab — Enterprise (INCOSE / DO-178C / DO-254)';
const newEndMarker = '{/* Properties Tab */}';
const newStartIndex = createContent.indexOf(newStartMarker);
const newEndIndex = createContent.indexOf(newEndMarker, newStartIndex);

if (newStartIndex === -1 || newEndIndex === -1) {
    console.error("Could not find new traceability section in CreateRequirementModal");
    process.exit(1);
}
// Add newline to separate blocks nicely
const newTraceabilityCode = createContent.slice(newStartIndex, newEndIndex) + '\n            ';

// Find old traceability tab in EditReq
const oldStartMarker = "{/* ══════════════ Traceability Tab ══════════════ */}";
const oldEndMarker = "{/* ══════════════ Properties Tab ══════════════ */}";

const oldStartIndex = editContent.indexOf(oldStartMarker);
const oldEndIndex = editContent.indexOf(oldEndMarker, oldStartIndex);

if (oldStartIndex === -1 || oldEndIndex === -1) {
    console.error("Could not find old traceability section in EditRequirementModal");
    process.exit(1);
}

// Replace
editContent = editContent.slice(0, oldStartIndex) + newTraceabilityCode + editContent.slice(oldEndIndex);
fs.writeFileSync(editModalPath, editContent);
console.log("Successfully replaced Traceability Tab UI!");
