
const { z } = require('zod');

const uploadDocumentSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        category: z.enum(['ADTO', 'PAGAMENTO', 'OUTROS']).optional(),
        value: z.string().optional().transform(val => parseFloat(val) || 0),
        supplier: z.string().optional(),
        costCenter: z.string().optional(),
        justification: z.string().optional(),
        tags: z.string().optional()
    })
});

const reviewDocumentSchema = z.object({
    params: z.object({
        id: z.string().transform(val => parseInt(val))
    }),
    body: z.object({
        status: z.enum(['APROVADO', 'REJEITADO']),
        comment: z.string().optional()
    })
});

module.exports = {
    uploadDocumentSchema,
    reviewDocumentSchema
};
