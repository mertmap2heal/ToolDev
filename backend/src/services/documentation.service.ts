import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface DocumentGenerationRequest {
  projectId: string
  format: 'pdf' | 'markdown' | 'word'
  sections?: string[]
}

export const documentationService = {
  async generateDocument(request: DocumentGenerationRequest): Promise<string> {
    // ...existing code...
    const { projectId, format, sections = ['all'] } = request;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: true,
        functions: true,
        architectures: true,
        verifications: true,
        traceLinks: true,
      },
    });
    if (!project) throw new Error('Project not found');
    let content = '';
    if (sections.includes('all') || sections.includes('overview')) content += generateOverview(project);
    if (sections.includes('all') || sections.includes('requirements')) content += generateRequirementsSection(project.requirements);
    if (sections.includes('all') || sections.includes('functions')) content += generateFunctionsSection(project.functions);
    if (sections.includes('all') || sections.includes('architecture')) content += generateArchitectureSection(project.architectures);
    if (sections.includes('all') || sections.includes('verification')) content += generateVerificationSection(project.verifications);
    if (sections.includes('all') || sections.includes('traceability')) content += generateTraceabilitySection(project.traceLinks);
    return content;
  },

  // List all documents for a project
  async listDocuments(projectId: string) {
    return prisma.document.findMany({ where: { projectId } });
  },

  // Get a single document
  async getDocument(projectId: string, id: string) {
    return prisma.document.findFirst({ where: { projectId, id } });
  },

  // Create a new document
  async createDocument(projectId: string, docData: any) {
    return prisma.document.create({
      data: {
        ...docData,
        projectId,
      },
    });
  },

  // Update a document
  async updateDocument(projectId: string, id: string, docData: any) {
    return prisma.document.update({
      where: { id },
      data: {
        ...docData,
        projectId,
      },
    });
  },

  // Delete a document
  async deleteDocument(projectId: string, id: string) {
    return prisma.document.delete({ where: { id } });
  },
}

function generateOverview(project: any): string {
  return `# ${project.name}

## Project Overview

**Domain:** ${project.domain}
**Status:** ${project.status}
**Progress:** ${project.progress}%

${project.description || ''}

---
`
}

function generateRequirementsSection(requirements: any[]): string {
  if (requirements.length === 0) {
    return `## Requirements

No requirements defined yet.

---
`
  }

  let content = `## Requirements

`
  requirements.forEach((req, index) => {
    content += `### REQ-${index + 1}: ${req.title}

**Priority:** ${req.priority}
**Status:** ${req.status}

${req.description}

---
`
  })

  return content
}

function generateFunctionsSection(functions: any[]): string {
  if (functions.length === 0) {
    return `## System Functions

No system functions defined yet.

---
`
  }

  let content = `## System Functions

`
  functions.forEach((func, index) => {
    content += `### FUNC-${index + 1}: ${func.name}

${func.description}

${func.sourceReqId ? `**Source Requirement:** REQ-${func.sourceReqId}` : ''}

---
`
  })

  return content
}

function generateArchitectureSection(architectures: any[]): string {
  if (architectures.length === 0) {
    return `## Architecture

No architecture defined yet.

---
`
  }

  let content = `## Architecture

`
  architectures.forEach((arch, index) => {
    content += `### ARCH-${index + 1}: ${arch.name}

${arch.description}

---
`
  })

  return content
}

function generateVerificationSection(verifications: any[]): string {
  if (verifications.length === 0) {
    return `## Verification Plans

No verification plans defined yet.

---
`
  }

  let content = `## Verification Plans

`
  verifications.forEach((verif, index) => {
    content += `### VER-${index + 1}: ${verif.name}

${verif.description}

---
`
  })

  return content
}

function generateTraceabilitySection(traceLinks: any[]): string {
  if (traceLinks.length === 0) {
    return `## Traceability Matrix

No traceability links defined yet.

---
`
  }

  let content = `## Traceability Matrix

| Source | Link Type | Target |
|--------|-----------|--------|
`

  traceLinks.forEach((link) => {
    content += `| ${link.sourceType} (${link.sourceId}) | ${link.linkType} | ${link.targetType} (${link.targetId}) |\n`
  })

  return content
}
