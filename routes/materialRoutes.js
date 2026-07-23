const express = require('express')
const multer = require('multer')
const auth = require('../middleware/auth')
const {
    createMaterial,
    listMaterials,
    getMaterial,
    deleteMaterial,
    downloadMaterialAttachment,
} = require('../controllers/materialController')

const ALLOWED_MIMETYPES = [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
]

const router = express.Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
            return cb(new Error('Only PDF, PPT, DOC, PNG, and JPG files are allowed'), false)
        }
        cb(null, true)
    },
})

router.get('/', auth, listMaterials)
router.get('/:id', auth, getMaterial)
router.get('/:id/download', auth, downloadMaterialAttachment)
router.post('/', auth, upload.single('file'), createMaterial)
router.delete('/:id', auth, deleteMaterial)

module.exports = router
