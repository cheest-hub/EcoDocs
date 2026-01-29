const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const logEvent = async (userId, userName, action, details = '', ipAddress = null) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId: parseInt(userId),
                userName,
                action,
                details,
                ipAddress
            }
        });
        console.log(`[AUDIT] ${action} by ${userName} (${userId}) [IP: ${ipAddress}]: ${details}`);
    } catch (error) {
        console.error('Audit Log Error:', error.message);
    }
};

module.exports = { logEvent };
