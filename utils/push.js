const webpush = require('web-push')

const configurePush = () => {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (publicKey && privateKey) {
        webpush.setVapidDetails(
            process.env.BASE_URL || 'http://localhost:5000',
            publicKey,
            privateKey
        )
        return true
    }

    return false
}

const pushReady = configurePush()

const sendPush = async (subscription, payload) => {
    if (!pushReady) {
        return { skipped: true }
    }

    return webpush.sendNotification(subscription, JSON.stringify(payload))
}

module.exports = {
    sendPush,
    isPushReady: () => pushReady,
}
