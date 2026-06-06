const express = require('express')
const multer = require('multer')
const { register, login, me, updateProfile, uploadProfilePhoto } = require('../controllers/authController')
const auth = require('../middleware/auth')

const router = express.Router()

const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype?.startsWith('image/')) {
            cb(null, true)
        } else {
            cb(new Error('Only image files are allowed'))
        }
    },
})

router.post('/register', register)
router.post('/login', login)
router.get('/me', auth, me)
router.put('/profile', auth, updateProfile)
router.post('/profile/avatar', auth, avatarUpload.single('photo'), uploadProfilePhoto)

module.exports = router
