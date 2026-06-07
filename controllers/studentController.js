const Assignment = require('../models/Assignment')
const Material = require('../models/Material')
const Notice = require('../models/Notice')
const Essay = require('../models/Essay')
const Subject = require('../models/Subject')
const User = require('../models/User')

const checkStudent = (req, res, next) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ message: 'Student access required' })
    }
    next()
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

const getStudentDashboard = async (req, res, next) => {
    try {
        checkStudent(req, res, next)

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const classFilter = { class: user.class, division: user.division }

        const [upcomingDeadlines, todayWork, totalAssignments, totalMaterials] = await Promise.all([
            Assignment.find({ ...classFilter, deadline: { $gte: today } })
                .populate('subjectId', 'name code')
                .sort({ deadline: 1 })
                .limit(10),
            Assignment.countDocuments({ ...classFilter, deadline: { $gte: today, $lt: tomorrow } }),
            Assignment.countDocuments(classFilter),
            Material.countDocuments(classFilter),
        ])

        res.json({
            stats: {
                upcomingDeadlines: upcomingDeadlines.length,
                todayWork,
                totalAssignments,
                totalMaterials,
            },
            upcomingDeadlines,
        })
    } catch (error) {
        next(error)
    }
}

// ─── SUBJECTS ─────────────────────────────────────────────────────────────────

// Returns subjects for the student's own class+division
const getStudentSubjects = async (req, res, next) => {
    try {
        checkStudent(req, res, next)

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const subjects = await Subject.find({ class: user.class, division: user.division })
            .populate('teacherId', 'name')
            .sort({ name: 1 })

        res.json({ subjects })
    } catch (error) {
        next(error)
    }
}

// Returns all materials for one subject, enforcing class+division match
const getSubjectMaterials = async (req, res, next) => {
    try {
        checkStudent(req, res, next)

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const subject = await Subject.findById(req.params.id)
        if (!subject) return res.status(404).json({ message: 'Subject not found' })

        // Enforce: student can only access their own class+division subjects
        if (subject.class !== user.class || subject.division !== user.division) {
            return res.status(403).json({ message: 'Access denied: subject not in your class/division' })
        }

        const { category } = req.query
        const filter = { subjectId: req.params.id, class: user.class, division: user.division }
        if (category) filter.category = category

        const materials = await Material.find(filter)
            .populate('subjectId', 'name code')
            .sort({ createdAt: -1 })

        res.json({ materials, subject })
    } catch (error) {
        next(error)
    }
}

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

const getStudentAssignments = async (req, res, next) => {
    try {
        checkStudent(req, res, next)

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const { subjectId } = req.query
        const filter = { class: user.class, division: user.division }
        if (subjectId) filter.subjectId = subjectId

        const assignments = await Assignment.find(filter)
            .populate('subjectId', 'name code')
            .sort({ deadline: -1 })

        res.json({ assignments })
    } catch (error) {
        next(error)
    }
}

// ─── MATERIALS ────────────────────────────────────────────────────────────────

const getStudentMaterials = async (req, res, next) => {
    try {
        checkStudent(req, res, next)

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const { subjectId, category } = req.query
        const filter = { class: user.class, division: user.division }
        if (subjectId) filter.subjectId = subjectId
        if (category) filter.category = category

        const materials = await Material.find(filter)
            .populate('subjectId', 'name code')
            .sort({ createdAt: -1 })

        res.json({ materials })
    } catch (error) {
        next(error)
    }
}

// ─── NOTICES ──────────────────────────────────────────────────────────────────

const getStudentNotices = async (req, res, next) => {
    try {
        checkStudent(req, res, next)

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const notices = await Notice.find({
            $or: [
                { targetClass: { $size: 0 } },
                { targetClass: { $in: [user.class] } },
            ],
        })
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 })

        // Filter in memory for division (handles both empty and matching)
        const filtered = notices.filter(
            (n) =>
                !n.targetDivision ||
                n.targetDivision.length === 0 ||
                n.targetDivision.includes(user.division)
        )

        res.json({ notices: filtered })
    } catch (error) {
        next(error)
    }
}

// ─── ESSAYS ───────────────────────────────────────────────────────────────────

const getStudentEssays = async (req, res, next) => {
    try {
        checkStudent(req, res, next)

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const essays = await Essay.find({ class: user.class, division: user.division })
            .populate('subjectId', 'name code')
            .sort({ deadline: -1 })

        res.json({ essays })
    } catch (error) {
        next(error)
    }
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────

const getCalendar = async (req, res, next) => {
    try {
        checkStudent(req, res, next)

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const { month, year } = req.query
        const now = new Date()
        const startDate = new Date(year || now.getFullYear(), month !== undefined ? month : now.getMonth(), 1)
        const endDate = new Date(year || now.getFullYear(), month !== undefined ? Number(month) + 1 : now.getMonth() + 1, 0)

        const classFilter = { class: user.class, division: user.division }

        const [assignments, essays] = await Promise.all([
            Assignment.find({ ...classFilter, deadline: { $gte: startDate, $lte: endDate } })
                .populate('subjectId', 'name code')
                .sort({ deadline: 1 }),
            Essay.find({ ...classFilter, deadline: { $gte: startDate, $lte: endDate } })
                .populate('subjectId', 'name code')
                .sort({ deadline: 1 }),
        ])

        const events = [
            ...assignments.map((a) => ({
                id: a._id,
                title: a.title,
                date: a.deadline,
                type: 'assignment',
                subject: a.subjectId?.name,
                subjectCode: a.subjectId?.code,
            })),
            ...essays.map((e) => ({
                id: e._id,
                title: e.topic,
                date: e.deadline,
                type: 'essay',
                subject: e.subjectId?.name,
                subjectCode: e.subjectId?.code,
            })),
        ]

        res.json({ events })
    } catch (error) {
        next(error)
    }
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────

const searchContent = async (req, res, next) => {
    try {
        checkStudent(req, res, next)

        const { q } = req.query
        if (!q) return res.status(400).json({ message: 'Search query required' })

        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const classFilter = { class: user.class, division: user.division }
        const searchRegex = new RegExp(q, 'i')

        const [assignments, materials, essays] = await Promise.all([
            Assignment.find({
                ...classFilter,
                $or: [{ title: searchRegex }, { description: searchRegex }],
            })
                .populate('subjectId', 'name code')
                .limit(15),
            Material.find({ ...classFilter, title: searchRegex })
                .populate('subjectId', 'name code')
                .limit(15),
            Essay.find({
                ...classFilter,
                $or: [{ topic: searchRegex }, { instructions: searchRegex }],
            })
                .populate('subjectId', 'name code')
                .limit(10),
        ])

        res.json({ results: { assignments, materials, essays } })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    getStudentDashboard,
    getStudentSubjects,
    getSubjectMaterials,
    getStudentAssignments,
    getStudentMaterials,
    getStudentNotices,
    getStudentEssays,
    getCalendar,
    searchContent,
}
