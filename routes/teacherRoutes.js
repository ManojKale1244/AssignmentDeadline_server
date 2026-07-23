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
} = require('../controllers/teacherController')

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

// All teacher routes require authentication and teacher role
router.use(auth)
router.use(checkTeacher)

router.get('/dashboard', getTeacherDashboard)

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
