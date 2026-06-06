const express = require('express')
const auth = require('../middleware/auth')
const { createDepartment, listDepartments } = require('../controllers/departmentController')

const router = express.Router()

router.get('/', auth, listDepartments)
router.post('/', auth, createDepartment)

module.exports = router
