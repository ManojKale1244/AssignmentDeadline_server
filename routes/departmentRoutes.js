const express = require('express')
const auth = require('../middleware/auth')
const { createDepartment, listDepartments } = require('../controllers/departmentController')

const router = express.Router()

// Public route — used by the registration page (no token needed)
router.get('/public', listDepartments)

router.get('/', auth, listDepartments)
router.post('/', auth, createDepartment)

module.exports = router
