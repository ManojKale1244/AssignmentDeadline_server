const express = require('express')
const auth = require('../middleware/auth')
const {
    checkStudent,
    getStudentDashboard,
    getStudentSubjects,
    getSubjectMaterials,
    getStudentAssignments,
    getStudentMaterials,
    getStudentNotices,
    getStudentEssays,
    getCalendar,
    searchContent,
} = require('../controllers/studentController')

const router = express.Router()

router.use(auth)
router.use(checkStudent)

router.get('/dashboard', getStudentDashboard)
router.get('/subjects', getStudentSubjects)
router.get('/subjects/:id/materials', getSubjectMaterials)
router.get('/assignments', getStudentAssignments)
router.get('/materials', getStudentMaterials)
router.get('/notices', getStudentNotices)
router.get('/essays', getStudentEssays)
router.get('/calendar', getCalendar)
router.get('/search', searchContent)

module.exports = router
