const express = require('express')
const auth = require('../middleware/auth')
const { createNotice, listNotices } = require('../controllers/noticeController')

const router = express.Router()

router.get('/', auth, listNotices)
router.post('/', auth, createNotice)

module.exports = router
