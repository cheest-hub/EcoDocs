const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logEvent } = require('../utils/auditLogger');

const getSystemSettings = async (req, res) => {
    try {
        let settings = await prisma.systemSettings.findUnique({
            where: { id: 1 }
        });

        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: { id: 1, companyName: 'EcoDocs' }
            });
        }

        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching system settings', error: error.message });
    }
};

const updateSystemSettings = async (req, res) => {
    const { companyName } = req.body;
    const companyLogo = req.file ? `/uploads/${req.file.filename}` : undefined;

    try {
        const settings = await prisma.systemSettings.upsert({
            where: { id: 1 },
            update: {
                companyName: companyName || undefined,
                companyLogo: companyLogo || undefined
            },
            create: {
                id: 1,
                companyName: companyName || 'EcoDocs',
                companyLogo: companyLogo || null
            }
        });

        await logEvent(req.userId, req.userRole, 'UPDATE_SETTINGS', `Configurações do sistema atualizadas: ${companyName || 'Logo'}`);

        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error updating system settings', error: error.message });
    }
};

const updateProfile = async (req, res) => {
    const { name } = req.body;
    const avatar = req.file ? `/uploads/${req.file.filename}` : undefined;

    try {
        const updatedUser = await prisma.user.update({
            where: { id: parseInt(req.userId) },
            data: {
                username: name || undefined, // Using username as name for now as per previous controller logic
                avatar: avatar || undefined
            }
        });

        await logEvent(req.userId, updatedUser.username, 'UPDATE_PROFILE', 'Usuário atualizou seu perfil');

        res.json({
            id: updatedUser.id,
            username: updatedUser.username,
            name: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
            avatar: updatedUser.avatar || `https://ui-avatars.com/api/?name=${updatedUser.username}`
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};

module.exports = {
    getSystemSettings,
    updateSystemSettings,
    updateProfile
};
