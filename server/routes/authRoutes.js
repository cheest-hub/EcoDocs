const express = require('express');
const { register, login, getUsers, deleteUser } = require('../controllers/authController');
const { getLogs } = require('../controllers/auditController');
const router = express.Router();

const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/users', verifyToken, isAdmin, getUsers);
router.delete('/users/:id', verifyToken, isAdmin, deleteUser);
router.get('/audit', verifyToken, isAdmin, getLogs);

module.exports = router;
