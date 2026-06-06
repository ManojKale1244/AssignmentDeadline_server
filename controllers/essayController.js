const Essay = require('../models/Essay')
const { logActivity } = require('../utils/activityLog')

const createEssay = async (req, res, next) => {
    try {
        const {
            topic,
            instructions,
            wordLimit,
            subjectId,
            deadline,
            class: essayClass,
            division,
        } = req.body

        if (!topic || !wordLimit || !subjectId || !deadline || !essayClass || !division) {
            return res.status(400).json({ message: 'All essay fields are required' })
        }

        const essay = await Essay.create({
            topic,
            instructions: instructions || '',
            wordLimit: Number(wordLimit),
            subjectId,
            deadline: new Date(deadline),
            createdBy: req.user.id,
            class: essayClass,
            division,
        })

        await logActivity(req.user.id, 'create', 'Essay', essay._id)
        res.status(201).json({ essay })
    } catch (error) {
        next(error)
    }
}

const listEssays = async (req, res, next) => {
    try {
        const { subjectId, class: essayClass, division } = req.query
        const query = {}

        if (subjectId) query.subjectId = subjectId
        if (essayClass) query.class = essayClass
        if (division) query.division = division

        const essays = await Essay.find(query)
            .populate('subjectId', 'name code')
            .sort({ deadline: 1 })
            .limit(200)

        res.json({ essays })
    } catch (error) {
        next(error)
    }
}

module.exports = { createEssay, listEssays }
