const express = require('express');
const { getSystemSettings, updateSystemSettings, updateProfile } = require('../controllers/settingsController');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer config for images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `img-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Somente imagens são permitidas!'));
    }
});

router.get('/system', getSystemSettings);
router.put('/system', verifyToken, isAdmin, upload.single('logo'), updateSystemSettings);
router.put('/profile', verifyToken, upload.single('avatar'), updateProfile);

module.exports = router;
