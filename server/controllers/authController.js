const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { generateToken } = require('../middleware/authMiddleware');

const prisma = new PrismaClient();

const register = async (req, res) => {
    const { username, email, password, role } = req.body;

    try {
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username }
                ]
            }
        });

        if (existingUser) return res.status(400).json({ message: 'User or Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                role: role || 'VIEWER'
            }
        });

        const token = generateToken(user.id, user.role);

        const { logEvent } = require('../utils/auditLogger');
        const getIp = require('../utils/getIp');
        await logEvent(user.id, user.username, 'CREATE_USER', `Novo usuário: ${user.username} (${user.role})`, getIp(req));

        res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
};

const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });

        const token = generateToken(user.id, user.role);

        const { logEvent } = require('../utils/auditLogger');
        const getIp = require('../utils/getIp');
        await logEvent(user.id, user.username, 'LOGIN', 'Usuário realizou login no sistema', getIp(req));

        res.status(200).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                name: user.username,
                avatar: user.avatar || `https://ui-avatars.com/api/?name=${user.username}`
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

const getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, email: true, role: true, avatar: true } // Exclude password
        });
        // Add avatar URL for frontend compatibility
        const usersWithAvatar = users.map(u => ({
            ...u,
            avatar: u.avatar || `https://ui-avatars.com/api/?name=${u.username}`
        }));
        res.json(usersWithAvatar);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const userToDelete = await prisma.user.findUnique({ where: { id: parseInt(id) } });
        await prisma.user.delete({ where: { id: parseInt(id) } });

        const { logEvent } = require('../utils/auditLogger');
        const getIp = require('../utils/getIp');
        await logEvent(req.userId, 'SISTEMA', 'DELETE_USER', `Usuário removido: ${userToDelete?.username || id}`, getIp(req));

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
};

module.exports = { register, login, getUsers, deleteUser };
