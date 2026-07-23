const Assignment = require('../models/Assignment')
const Material = require('../models/Material')
const Notice = require('../models/Notice')
const Essay = require('../models/Essay')
const Subject = require('../models/Subject')
const User = require('../models/User')
const Department = require('../models/Department')

/**
 * Unified Search API
 * GET /api/search?q=query
 */
const searchAll = async (req, res, next) => {
    try {
        const { q } = req.query
        if (!q) return res.status(400).json({ message: 'Search query required' })

        const role = req.user.role
        const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const searchRegex = new RegExp(escaped, 'i')

        if (role === 'student') {
            const dbUser = req.fullUser || await User.findById(req.user.id).lean()
            if (!dbUser) return res.status(404).json({ message: 'User not found' })

            const classFilter = { class: dbUser.class, division: dbUser.division }

            const [assignments, materials, essays, noticesAll] = await Promise.all([
                Assignment.find({
                    ...classFilter,
                    $or: [{ title: searchRegex }, { description: searchRegex }],
                })
                    .populate('subjectId', 'name code')
                    .limit(10)
                    .lean(),
                Material.find({ ...classFilter, title: searchRegex })
                    .populate('subjectId', 'name code')
                    .limit(10)
                    .lean(),
                Essay.find({
                    ...classFilter,
                    $or: [{ topic: searchRegex }, { instructions: searchRegex }],
                })
                    .populate('subjectId', 'name code')
                    .limit(10)
                    .lean(),
                Notice.find({
                    $and: [
                        {
                            $or: [
                                { targetClass: { $size: 0 } },
                                { targetClass: { $in: [dbUser.class] } },
                            ]
                        },
                        {
                            $or: [
                                { title: searchRegex },
                                { description: searchRegex }
                            ]
                        }
                    ]
                })
                    .populate('createdBy', 'name')
                    .sort({ createdAt: -1 })
                    .limit(20)
                    .lean()
            ])

            // Filter notices by division in memory
            const notices = noticesAll.filter(
                (n) =>
                    !n.targetDivision ||
                    n.targetDivision.length === 0 ||
                    n.targetDivision.includes(dbUser.division)
            ).slice(0, 10)

            // Normalize essays topic to title for consistent client-side reading
            const essaysNormalized = essays.map(e => ({
                ...e,
                title: e.topic || e.title
            }))

            return res.json({ results: { assignments, materials, essays: essaysNormalized, notices } })

        } else if (role === 'teacher') {
            const mySubjects = await Subject.find({ teacherId: req.user.id }).select('_id').lean()
            const mySubjectIds = mySubjects.map((s) => s._id)

            const [assignments, materials, essays, notices] = await Promise.all([
                Assignment.find({
                    subjectId: { $in: mySubjectIds },
                    $or: [{ title: searchRegex }, { description: searchRegex }]
                })
                    .populate('subjectId', 'name code class division')
                    .limit(10)
                    .lean(),
                Material.find({
                    subjectId: { $in: mySubjectIds },
                    title: searchRegex
                })
                    .populate('subjectId', 'name code class division')
                    .limit(10)
                    .lean(),
                Essay.find({
                    subjectId: { $in: mySubjectIds },
                    $or: [{ topic: searchRegex }, { instructions: searchRegex }]
                })
                    .populate('subjectId', 'name code class division')
                    .limit(10)
                    .lean(),
                Notice.find({
                    createdBy: req.user.id,
                    $or: [{ title: searchRegex }, { description: searchRegex }]
                })
                    .limit(10)
                    .lean()
            ])

            // Normalize essays topic to title for consistent client-side reading
            const essaysNormalized = essays.map(e => ({
                ...e,
                title: e.topic || e.title
            }))

            return res.json({ results: { assignments, materials, essays: essaysNormalized, notices } })

        } else if (role === 'admin') {
            const [students, teachers, subjects, departments, notices] = await Promise.all([
                User.find({
                    role: 'student',
                    $or: [{ name: searchRegex }, { email: searchRegex }]
                })
                    .select('name email class division department')
                    .limit(10)
                    .lean(),
                User.find({
                    role: 'teacher',
                    $or: [{ name: searchRegex }, { email: searchRegex }]
                })
                    .select('name email department')
                    .limit(10)
                    .lean(),
                Subject.find({
                    $or: [{ name: searchRegex }, { code: searchRegex }]
                })
                    .populate('teacherId', 'name')
                    .limit(10)
                    .lean(),
                Department.find({
                    name: searchRegex
                })
                    .limit(10)
                    .lean(),
                Notice.find({
                    $or: [{ title: searchRegex }, { description: searchRegex }]
                })
                    .limit(10)
                    .lean()
            ])

            return res.json({ results: { students, teachers, subjects, departments, notices } })
        }

        return res.status(400).json({ message: 'Invalid user role for search' })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    searchAll
}
