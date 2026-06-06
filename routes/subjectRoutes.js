const express = require('express')
const auth = require('../middleware/auth')
const {
    createSubject,
    listSubjects,
    getSubject,
    getMySubjects,
    getSubjectsForStudent,
    updateSubject,
    deleteSubject,
} = require('../controllers/subjectController')

const router = express.Router()

router.get('/', auth, listSubjects)
router.get('/mine', auth, getMySubjects)           // teacher's own subjects
router.get('/for-student', auth, getSubjectsForStudent) // student's class+division subjects
router.get('/:id', auth, getSubject)
router.post('/', auth, createSubject)
router.put('/:id', auth, updateSubject)
router.delete('/:id', auth, deleteSubject)

module.exports = router
