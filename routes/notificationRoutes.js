const express = require('express')
const auth = require('../middleware/auth')
const { saveSubscription, sendTestNotification, getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController')

const router = express.Router()

router.post('/subscribe', auth, saveSubscription)
router.post('/test', auth, sendTestNotification)
router.get('/', auth, getNotifications)
router.put('/read-all', auth, markAllAsRead)
router.put('/:id/read', auth, markAsRead)

module.exports = router
