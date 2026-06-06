const Notice = require('../models/Notice')
const { logActivity } = require('../utils/activityLog')

const createNotice = async (req, res, next) => {
    try {
        const { title, description, type, targetClass, targetDivision } = req.body

        if (!title) {
            return res.status(400).json({ message: 'Title required' })
        }

        const notice = await Notice.create({
            title,
            description: description || '',
            type: type || 'general',
            targetClass: targetClass || [],
            targetDivision: targetDivision || [],
            createdBy: req.user.id,
        })

        await logActivity(req.user.id, 'create', 'Notice', notice._id)
        res.status(201).json({ notice })
    } catch (error) {
        next(error)
    }
}

const listNotices = async (req, res, next) => {
    try {
        const { type, class: targetClass, division } = req.query
        const query = {}

        if (type) query.type = type
        if (targetClass) query.targetClass = targetClass
        if (division) query.targetDivision = division

        const notices = await Notice.find(query).sort({ createdAt: -1 }).limit(200)
        res.json({ notices })
    } catch (error) {
        next(error)
    }
}

module.exports = { createNotice, listNotices }
