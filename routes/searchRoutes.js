const express = require('express')
const auth = require('../middleware/auth')
const attachUser = require('../middleware/attachUser')
const { searchAll } = require('../controllers/searchController')

const router = express.Router()

router.get('/', auth, attachUser, searchAll)

module.exports = router
