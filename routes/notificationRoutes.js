const express = require('express')
const auth = require('../middleware/auth')
const { saveSubscription, sendTestNotification, getNotifications, markAsRead } = require('../controllers/notificationController')

const router = express.Router()

router.post('/subscribe', auth, saveSubscription)
router.post('/test', auth, sendTestNotification)
router.get('/', auth, getNotifications)
router.put('/:id/read', auth, markAsRead)

module.exports = router
