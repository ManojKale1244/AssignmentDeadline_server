const express = require('express')
const multer = require('multer')
const auth = require('../middleware/auth')
const {
    checkTeacher,
    getTeacherDashboard,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getTeacherAssignments,
    uploadMaterial,
    getTeacherMaterials,
    deleteMaterial,
    createNotice,
    getTeacherNotices,
    updateNotice,
    deleteNotice,
    createEssay,
    getTeacherEssays,
    updateEssay,
    deleteEssay,
    getTeacherStudents,
} = require('../controllers/teacherController')

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

// All teacher routes require authentication and teacher role
router.use(auth)
router.use(checkTeacher)

router.get('/dashboard', getTeacherDashboard)

// Students (read-only)
router.get('/students', getTeacherStudents)

// Assignments
router.get('/assignments', getTeacherAssignments)
router.post('/assignments', upload.single('file'), createAssignment)
router.put('/assignments/:id', upload.single('file'), updateAssignment)
router.delete('/assignments/:id', deleteAssignment)

// Materials
router.get('/materials', getTeacherMaterials)
router.post('/materials/upload', upload.single('file'), uploadMaterial)
router.delete('/materials/:id', deleteMaterial)

// Notices
router.get('/notices', getTeacherNotices)
router.post('/notices', createNotice)
router.put('/notices/:id', updateNotice)
router.delete('/notices/:id', deleteNotice)

// Essays
router.get('/essays', getTeacherEssays)
router.post('/essays', createEssay)
router.put('/essays/:id', updateEssay)
router.delete('/essays/:id', deleteEssay)

module.exports = router
