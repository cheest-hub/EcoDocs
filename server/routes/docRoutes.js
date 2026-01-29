const express = require('express');
const { uploadDocument, getDocuments, getStats, downloadDocument, deleteDocument, reviewDocument, confirmPayment, addAttachment, downloadAttachment, conciliateDocument } = require('../controllers/docController');
const { getLogs } = require('../controllers/auditController');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { uploadDocumentSchema, reviewDocumentSchema } = require('../schemas/docSchemas');

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyToken);

router.post('/upload', upload.single('file'), validateRequest(uploadDocumentSchema), uploadDocument);
router.get('/', getDocuments);
router.get('/stats', getStats);
router.get('/logs', getLogs);
router.post('/:id/review', validateRequest(reviewDocumentSchema), reviewDocument);
router.post('/:id/pay', confirmPayment);
router.get('/:id/download', downloadDocument);
router.delete('/:id', deleteDocument);

// Attachments
router.post('/:id/attachments', upload.single('file'), addAttachment);
router.get('/attachments/:id/download', downloadAttachment);

// Conciliation
router.post('/:id/conciliate', conciliateDocument);

module.exports = router;
