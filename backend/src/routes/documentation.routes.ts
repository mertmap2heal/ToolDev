import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { documentationService } from '../services/documentation.service'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Generate documentation (existing)
router.post('/generate', async (req, res) => {
  try {
    const { projectId, format, sections } = req.body
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project ID is required' })
    }
    const content = await documentationService.generateDocument({ projectId, format: format || 'markdown', sections: sections || ['all'] })
    res.json({ success: true, data: { content, format: format || 'markdown' } })
  } catch (error) {
    console.error('Generate documentation error:', error)
    res.status(500).json({ success: false, error: error.message || 'Internal server error' })
  }
})

// List all documents for a project
router.get('/projects/:projectId/documents', async (req, res) => {
  try {
    const { projectId } = req.params;
    const docs = await documentationService.listDocuments(projectId);
    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a single document
router.get('/projects/:projectId/documents/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const doc = await documentationService.getDocument(projectId, id);
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new document
router.post('/projects/:projectId/documents', async (req, res) => {
  try {
    const { projectId } = req.params;
    const docData = req.body;
    const doc = await documentationService.createDocument(projectId, docData);
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a document
router.put('/projects/:projectId/documents/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const docData = req.body;
    const doc = await documentationService.updateDocument(projectId, id, docData);
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a document
router.delete('/projects/:projectId/documents/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;
    await documentationService.deleteDocument(projectId, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router
