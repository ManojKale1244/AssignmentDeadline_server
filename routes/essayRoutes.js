const express = require('express')
const auth = require('../middleware/auth')
const { createEssay, listEssays } = require('../controllers/essayController')

const router = express.Router()

router.get('/', auth, listEssays)
router.post('/', auth, createEssay)

module.exports = router
