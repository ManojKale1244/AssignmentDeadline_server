const express = require('express')
const multer = require('multer')
const auth = require('../middleware/auth')
const {
    createAssignment,
    listAssignments,
    getAssignment,
    updateAssignment,
    deleteAssignment,
} = require('../controllers/assignmentController')

const router = express.Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
})

router.get('/', auth, listAssignments)
router.get('/:id', auth, getAssignment)
router.post('/', auth, upload.single('file'), createAssignment)
router.put('/:id', auth, upload.single('file'), updateAssignment)
router.delete('/:id', auth, deleteAssignment)

module.exports = router
