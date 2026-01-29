
const errorHandler = (err, req, res, next) => {
    console.error(err.stack); // Logar o erro completo internamente para debug

    // Resposta padrão
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    // Tratamento específico para erros conhecidos se necessário (ex: Prisma, Zod)
    if (err.name === 'ZodError') {
        return res.status(400).json({
            message: 'Erro de validação',
            errors: err.errors // Retorna detalhes do Zod
        });
    }

    res.status(statusCode).json({
        message: err.message || 'Erro Interno do Servidor',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

module.exports = errorHandler;
