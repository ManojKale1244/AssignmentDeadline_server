const express = require('express')
const auth = require('../middleware/auth')
const {
    checkAdmin,
    createDepartment,
    createClass,
    createTeacher,
    createStudent,
    createSubject,
    assignSubjectToTeacher,
    getStats,
    updateUser,
    deleteUser,
    getActivityLogs,
    listUsers,
    seedDefaultSubjects,
} = require('../controllers/adminController')
const { updateSubject, deleteSubject } = require('../controllers/subjectController')

const router = express.Router()

// All admin routes require authentication and admin role
router.use(auth)
router.use(checkAdmin)

router.post('/departments', createDepartment)
router.post('/classes', createClass)
router.post('/teachers', createTeacher)
router.post('/students', createStudent)
router.post('/subjects', createSubject)
router.post('/subjects/seed', seedDefaultSubjects)
router.put('/subjects/:id', updateSubject)
router.delete('/subjects/:id', deleteSubject)
router.post('/assign-subject', assignSubjectToTeacher)
router.get('/stats', getStats)
router.get('/activities', getActivityLogs)
router.get('/users', listUsers)
router.put('/users/:id', updateUser)
router.delete('/users/:id', deleteUser)

module.exports = router
