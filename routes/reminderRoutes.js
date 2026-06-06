const express = require('express')
const auth = require('../middleware/auth')
const {
    listReminders,
    createReminder,
    cancelReminder,
} = require('../controllers/reminderController')

const router = express.Router()

router.get('/', auth, listReminders)
router.post('/', auth, createReminder)
router.delete('/:id', auth, cancelReminder)

module.exports = router
