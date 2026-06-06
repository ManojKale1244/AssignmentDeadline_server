const { ActivityLog } = require('../models')

const logActivity = async (userId, action, targetModel, targetId) => {
    try {
        await ActivityLog.create({ userId, action, targetModel, targetId })
    } catch {
        // non-blocking audit trail
    }
}

module.exports = { logActivity }
