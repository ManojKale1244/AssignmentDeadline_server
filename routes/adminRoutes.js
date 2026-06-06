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
    adminDeleteSubject,
    adminUpdateSubject,
} = require('../controllers/adminController')

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
router.put('/subjects/:id', adminUpdateSubject)
router.delete('/subjects/:id', adminDeleteSubject)
router.post('/assign-subject', assignSubjectToTeacher)
router.get('/stats', getStats)
router.get('/activities', getActivityLogs)
router.get('/users', listUsers)
router.put('/users/:id', updateUser)
router.delete('/users/:id', deleteUser)

module.exports = router
