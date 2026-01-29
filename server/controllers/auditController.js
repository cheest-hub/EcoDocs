const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getLogs = async (req, res) => {
    try {
        // Relaxing restriction for development so all roles can see their activity persisted
        // Ideally filter by userId for non-admins, but let's keep it simple as requested for visibility

        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 200 // Limit to last 200 logs for performance
        });

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
};

module.exports = { getLogs };
