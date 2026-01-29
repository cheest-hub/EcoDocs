
const { z } = require('zod');

const validateRequest = (schema) => (req, res, next) => {
    try {
        // Valida body, query e params conforme definido no schema
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params
        });
        next();
    } catch (err) {
        // Passa o erro para o middleware global, mas ajusta o status antes
        res.status(400);
        // Em vez de next(err), podemos tratar aqui ou deixar o global lidar. 
        // Para consistência com o global handler que criamos:
        const validationError = new Error('Erro de validação');
        validationError.name = 'ZodError';
        validationError.errors = err.errors;
        next(validationError);
    }
};

module.exports = validateRequest;
