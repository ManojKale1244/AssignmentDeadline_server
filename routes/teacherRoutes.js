const express = require('express')
const auth = require('../middleware/auth')
const {
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

const router = express.Router()

// All teacher routes require authentication
router.use(auth)

router.get('/dashboard', getTeacherDashboard)

// Assignments
router.get('/assignments', getTeacherAssignments)
router.post('/assignments', createAssignment)
router.put('/assignments/:id', updateAssignment)
router.delete('/assignments/:id', deleteAssignment)

// Materials
router.get('/materials', getTeacherMaterials)
router.post('/materials/upload', uploadMaterial)
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
