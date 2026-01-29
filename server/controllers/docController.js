const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');

const prisma = new PrismaClient();

const generateUniqueCode = () => {
    const now = new Date();
    // Adjust for local time if possible, but UTC is safer for servers. 
    // Let's use simple ISO UTC for consistency or manual formatting for "local-ish" appearance
    // User probably wants readable numbers.

    const pad = (n) => n.toString().padStart(2, '0');

    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();

    return `${year}${month}${day}-${hours}${minutes}-${randomSuffix}`;
};

const uploadDocument = asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validação de tipo de arquivo
    const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
        fs.unlinkSync(req.file.path); // Remove arquivo inválido
        return res.status(400).json({
            error: 'Tipo de arquivo não permitido. Use PDF, JPG, PNG ou XLSX.'
        });
    }

    if (req.file.size > MAX_FILE_SIZE) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
            error: 'Arquivo muito grande. Tamanho máximo: 10MB'
        });
    }

    // Bloqueio de upload para papéis de leitura ou específicos
    if (['CONTABILIDADE', 'GESTOR'].includes(req.userRole)) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Sua função não permite a criação de novos lançamentos.' });
    }

    const { title, description, category, value, supplier, costCenter, justification, tags } = req.body;
    // Validação de campos obrigatórios é feita pelo Zod middleware agora

    const userId = parseInt(req.userId);
    if (isNaN(userId)) {
        fs.unlinkSync(req.file.path);
        return res.status(401).json({ error: 'Usuário inválido' });
    }

    const newDoc = await prisma.document.create({
        data: {
            title: title || req.file.originalname,
            description,
            path: req.file.path,
            mimeType: req.file.mimetype,
            size: req.file.size,
            ownerId: userId,
            // Campos Financeiros
            category: category || 'OUTROS',
            value: value ? parseFloat(value) : 0,
            supplier,
            costCenter,
            justification,
            status: 'PENDENTE',
            paymentStatus: 'A_PAGAR',
            tags: {
                create: tags ? tags.split(',').map(tag => ({ name: tag.trim() })) : []
            }
        },
        include: {
            tags: true,
            owner: {
                select: { id: true, username: true, email: true, role: true }
            }
        }
    });

    const docWithUser = {
        ...newDoc,
        code: newDoc.uniqueCode,
        url: `http://${req.headers.host}/api/docs/${newDoc.id}/download`,
        uploadedBy: {
            ...newDoc.owner,
            name: newDoc.owner.username
        },
        owner: {
            ...newDoc.owner,
            name: newDoc.owner.username
        }
    };

    const { logEvent } = require('../utils/auditLogger');
    const getIp = require('../utils/getIp');
    await logEvent(userId, docWithUser.uploadedBy.name, 'UPLOAD', `Documento enviado: ${docWithUser.title} (${docWithUser.category}, R$ ${docWithUser.value})`, getIp(req));

    res.status(201).json(docWithUser);
});

const getDocuments = asyncHandler(async (req, res) => {
    const docs = await prisma.document.findMany({
        include: {
            tags: true,
            owner: {
                select: { id: true, username: true, email: true, role: true }
            },
            attachments: true
        },
        orderBy: { createdAt: 'desc' }
    });

    const docsWithUser = docs.map(doc => ({
        ...doc,
        code: doc.uniqueCode,
        url: `http://${req.headers.host}/api/docs/${doc.id}/download`,
        attachments: doc.attachments.map(att => ({
            ...att,
            url: `http://${req.headers.host}/api/docs/attachments/${att.id}/download`
        })),
        uploadedBy: {
            ...doc.owner,
            name: doc.owner.username
        },
        owner: {
            ...doc.owner,
            name: doc.owner.username
        }
    }));

    res.json(docsWithUser);
});

const reviewDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, comment } = req.body;

    // Validação de entrada já feita pelo Zod (status)
    // ID validado pelo Zod se adicionarmos schema para params, mas por enquanto vamos confiar ou adicionar check simples se necessário. 
    // Review Schema tem id como numero transformado.

    // Apenas FINANCEIRO ou ADMIN
    if (!['FINANCEIRO', 'ADMIN'].includes(req.userRole)) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: parseInt(req.userId) } });

    const doc = await prisma.document.update({
        where: { id: parseInt(id) },
        data: {
            status,
            reviewComment: comment,
            reviewedBy: currentUser?.username || req.userId.toString(),
            approvedAt: status === 'APROVADO' ? new Date() : null
        },
        include: {
            tags: true,
            owner: {
                select: { id: true, username: true, email: true, role: true }
            },
            attachments: true
        }
    });

    const docWithUser = {
        ...doc,
        code: doc.uniqueCode,
        url: `http://${req.headers.host}/api/docs/${doc.id}/download`,
        attachments: doc.attachments.map(att => ({
            ...att,
            url: `http://${req.headers.host}/api/docs/attachments/${att.id}/download`
        })),
        uploadedBy: {
            ...doc.owner,
            name: doc.owner.username
        },
        owner: {
            ...doc.owner,
            name: doc.owner.username
        }
    };

    const { logEvent } = require('../utils/auditLogger');
    const getIp = require('../utils/getIp');
    await logEvent(req.userId, currentUser?.username || 'Sistema', status, `Documento ${docWithUser.code} ${status === 'APROVADO' ? 'aprovado' : 'rejeitado'}. Comentário: ${comment || 'N/A'}`, getIp(req));

    res.json(docWithUser);
});

const confirmPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { date } = req.body;

    // Apenas GESTOR ou ADMIN
    if (!['GESTOR', 'ADMIN'].includes(req.userRole)) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: parseInt(req.userId) } });

    const doc = await prisma.document.update({
        where: { id: parseInt(id) },
        data: {
            paymentStatus: 'PAGO',
            paymentDate: new Date(date),
            liquidatedBy: currentUser?.username || req.userId.toString()
        },
        include: {
            tags: true,
            owner: {
                select: { id: true, username: true, email: true, role: true }
            },
            attachments: true
        }
    });

    const docWithUser = {
        ...doc,
        code: doc.uniqueCode,
        url: `http://${req.headers.host}/api/docs/${doc.id}/download`,
        attachments: doc.attachments.map(att => ({
            ...att,
            url: `http://${req.headers.host}/api/docs/attachments/${att.id}/download`
        })),
        uploadedBy: {
            ...doc.owner,
            name: doc.owner.username
        },
        owner: {
            ...doc.owner,
            name: doc.owner.username
        }
    };

    const { logEvent } = require('../utils/auditLogger');
    const getIp = require('../utils/getIp');
    await logEvent(req.userId, currentUser?.username || 'Gestor', 'PAGAMENTO', `Pagamento confirmado para o documento ${docWithUser.code}`, getIp(req));

    res.json(docWithUser);
});

const getStats = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const totalDocs = await prisma.document.count({
        where: { ownerId: userId }
    });

    const storageStats = await prisma.document.aggregate({
        where: { ownerId: userId },
        _sum: { size: true }
    });

    // For activity, we'll just count recent docs (last 7 days) as a placeholder for now
    const recentActivity = await prisma.document.count({
        where: {
            ownerId: userId,
            createdAt: {
                gte: new Date(new Date().setDate(new Date().getDate() - 7))
            }
        }
    });

    res.json({
        totalDocs,
        usedStorage: storageStats._sum.size || 0,
        activity: recentActivity
    });
});

const deleteDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    const document = await prisma.document.findUnique({
        where: { id: parseInt(id) },
    });

    if (!document) {
        return res.status(404).json({ message: 'Document not found' });
    }

    if (document.ownerId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    // Delete file from disk
    try {
        await fsPromises.access(document.path);
        await fsPromises.unlink(document.path);
    } catch (err) {
        // File doesn't exist or deletion failed, log internally but continue to delete record
        console.error('File unlink failed or file not found:', err);
    }

    // Delete relations first manually or rely on cascade if configured but safe to be explicit
    await prisma.version.deleteMany({ where: { documentId: parseInt(id) } });
    await prisma.tag.deleteMany({ where: { documentId: parseInt(id) } });
    await prisma.document.delete({ where: { id: parseInt(id) } });

    const { logEvent } = require('../utils/auditLogger');
    const getIp = require('../utils/getIp');
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    await logEvent(userId, currentUser?.username || 'Sistema', 'DELETE', `Documento excluído: ${document.title} (ID: ${id})`, getIp(req));

    res.json({ message: 'Document deleted successfully' });
});

const downloadDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    const document = await prisma.document.findUnique({
        where: { id: parseInt(id) },
    });

    if (!document) {
        return res.status(404).json({ message: 'Document not found' });
    }

    // Allow Owner OR (Admin/Gestor/Financeiro/Contabilidade)
    if (document.ownerId !== userId && !['ADMIN', 'GESTOR', 'FINANCEIRO', 'CONTABILIDADE'].includes(req.userRole)) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    if (fs.existsSync(document.path)) {
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${document.title}"`);
        const fileStream = fs.createReadStream(document.path);
        fileStream.pipe(res);
    } else {
        res.status(404).json({ message: 'File not found on server' });
    }
});

const addAttachment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const doc = await prisma.document.findUnique({ where: { id: parseInt(id) } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (doc.status === 'CONCILIADO') {
        return res.status(403).json({ error: 'Cannot add attachments to a conciliated document' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: parseInt(req.userId) } });

    const attachment = await prisma.attachment.create({
        data: {
            documentId: parseInt(id),
            path: req.file.path,
            name: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedBy: currentUser?.username || req.userId.toString()
        }
    });

    const { logEvent } = require('../utils/auditLogger');
    const getIp = require('../utils/getIp');
    await logEvent(req.userId, currentUser?.username || 'SYSTEM', 'ATTACHMENT', `Anexo adicionado ao documento ${id}: ${attachment.name}`, getIp(req));

    res.status(201).json({
        ...attachment,
        url: `http://${req.headers.host}/api/docs/attachments/${attachment.id}/download`
    });
});

const downloadAttachment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const attachment = await prisma.attachment.findUnique({
        where: { id: parseInt(id) },
    });

    if (!attachment) return res.status(404).json({ message: 'Attachment not found' });

    const document = await prisma.document.findUnique({
        where: { id: attachment.documentId },
    });

    // Allow Owner OR (Admin/Gestor/Financeiro/Contabilidade)
    if (document.ownerId !== parseInt(req.userId) && !['ADMIN', 'GESTOR', 'FINANCEIRO', 'CONTABILIDADE'].includes(req.userRole)) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    if (fs.existsSync(attachment.path)) {
        res.setHeader('Content-Type', attachment.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${attachment.name}"`);
        fs.createReadStream(attachment.path).pipe(res);
    } else {
        res.status(404).json({ message: 'File not found on server' });
    }
});

const conciliateDocument = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Apenas GESTOR ou ADMIN
    if (!['GESTOR', 'ADMIN'].includes(req.userRole)) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: parseInt(req.userId) } });

    const doc = await prisma.document.update({
        where: { id: parseInt(id) },
        data: {
            status: 'CONCILIADO',
            conciliatedAt: new Date(),
            conciliatedBy: currentUser?.username || req.userId.toString()
        },
        include: {
            tags: true,
            owner: {
                select: { id: true, username: true, email: true, role: true }
            },
            attachments: true
        }
    });

    const docWithUser = {
        ...doc,
        code: doc.uniqueCode,
        url: `http://${req.headers.host}/api/docs/${doc.id}/download`,
        attachments: doc.attachments.map(att => ({
            ...att,
            url: `http://${req.headers.host}/api/docs/attachments/${att.id}/download`
        })),
        uploadedBy: {
            ...doc.owner,
            name: doc.owner.username
        },
        owner: {
            ...doc.owner,
            name: doc.owner.username
        }
    };

    const { logEvent } = require('../utils/auditLogger');
    const getIp = require('../utils/getIp');
    await logEvent(req.userId, currentUser?.username || 'Gestor', 'CONCILIADO', `Documento ${docWithUser.code} conciliado e finalizado.`, getIp(req));

    res.json(docWithUser);
});

module.exports = { uploadDocument, getDocuments, getStats, deleteDocument, downloadDocument, reviewDocument, confirmPayment, addAttachment, downloadAttachment, conciliateDocument };
