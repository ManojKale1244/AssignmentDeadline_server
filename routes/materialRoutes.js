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
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
]

const ALLOWED_EXTENSIONS = [
    'pdf', 'ppt', 'pptx', 'doc', 'docx', 'png', 'jpg', 'jpeg',
    'zip', 'rar', '7z', 'tar', 'gz',
    'py', 'js', 'jsx', 'ts', 'tsx', 'cpp', 'c', 'h', 'hpp', 'java',
    'html', 'css', 'json', 'ipynb', 'txt', 'sql', 'sh', 'bat'
]

const router = express.Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 40 * 1024 * 1024 }, // 40 MB max
    fileFilter: (req, file, cb) => {
        const ext = (file.originalname.split('.').pop() || '').toLowerCase()
        if (
            ALLOWED_MIMETYPES.includes(file.mimetype) ||
            ALLOWED_EXTENSIONS.includes(ext) ||
            file.mimetype.startsWith('text/') ||
            file.mimetype.startsWith('application/x-') ||
            file.mimetype.includes('code') ||
            file.mimetype.includes('zip')
        ) {
            return cb(null, true)
        }
        cb(new Error('Invalid file type. Allowed: PDF, PPT, DOC, Images, ZIP, RAR, and Source Code files.'), false)
    },
})

router.get('/', auth, listMaterials)
router.get('/:id', auth, getMaterial)
router.get('/:id/download', auth, downloadMaterialAttachment)
router.post('/', auth, upload.single('file'), createMaterial)
router.delete('/:id', auth, deleteMaterial)

module.exports = router
