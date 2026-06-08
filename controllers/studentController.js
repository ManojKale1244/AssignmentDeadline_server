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

// ─── ASSIGNMENT ATTACHMENT PROXY ──────────────────────────────────────────────

/**
 * Follow redirects for http/https.get (Node built-in doesn't follow them)
 */
const followRedirects = (url, maxRedirects = 5) => {
    return new Promise((resolve, reject) => {
        const https = require('https')
        const http = require('http')
        const protocol = url.startsWith('https') ? https : http

        protocol.get(url, (response) => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                if (maxRedirects <= 0) return reject(new Error('Too many redirects'))
                const redirectUrl = response.headers.location.startsWith('http')
                    ? response.headers.location
                    : new URL(response.headers.location, url).href
                return resolve(followRedirects(redirectUrl, maxRedirects - 1))
            }
            resolve(response)
        }).on('error', reject)
    })
}

const getAssignmentAttachment = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const assignment = await Assignment.findById(req.params.id)
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' })

        // Enforce class+division access
        if (assignment.class !== user.class || assignment.division !== user.division) {
            return res.status(403).json({ message: 'Access denied' })
        }

        if (!assignment.attachment?.url) {
            return res.status(404).json({ message: 'No attachment found' })
        }

        const fileUrl = assignment.attachment.url
        const publicId = assignment.attachment.publicId
        const action = req.query.action || 'download'

        // Build filename from assignment title
        const ext = assignment.attachment.fileType
            ? '.' + assignment.attachment.fileType.replace(/^\./, '')
            : ''
        const safeName = (assignment.title || 'attachment').replace(/[^a-zA-Z0-9_\- ]/g, '').trim()
        const filename = safeName + ext

        // Try fetching the stored Cloudinary URL (follows redirects)
        try {
            const fileRes = await followRedirects(fileUrl)

            if (fileRes.statusCode === 200) {
                const contentType = fileRes.headers['content-type'] || 'application/octet-stream'
                res.setHeader('Content-Type', contentType)
                res.setHeader(
                    'Content-Disposition',
                    action === 'download'
                        ? `attachment; filename="${filename}"`
                        : `inline; filename="${filename}"`
                )
                if (fileRes.headers['content-length']) {
                    res.setHeader('Content-Length', fileRes.headers['content-length'])
                }
                return fileRes.pipe(res)
            }

            if (fileRes.statusCode === 401 || fileRes.headers['x-cld-error'] === 'deny or ACL failure') {
                return res.status(401).json({
                    message: 'PDF/ZIP delivery is restricted on your Cloudinary account. Please go to your Cloudinary Console > Settings > Security > Restricted media types, and ensure "Allow delivery of PDF and ZIP files" is enabled.'
                })
            }

            // If the stored URL failed, try alternative Cloudinary URL formats
            // Sometimes files uploaded as 'auto' end up as 'raw' type
            if (publicId) {
                const altUrl = fileUrl
                    .replace('/image/upload/', '/raw/upload/')
                    .replace('/video/upload/', '/raw/upload/')

                const altRes = await followRedirects(altUrl)
                if (altRes.statusCode === 200) {
                    const contentType = altRes.headers['content-type'] || 'application/octet-stream'
                    res.setHeader('Content-Type', contentType)
                    res.setHeader(
                        'Content-Disposition',
                        action === 'download'
                            ? `attachment; filename="${filename}"`
                            : `inline; filename="${filename}"`
                    )
                    if (altRes.headers['content-length']) {
                        res.setHeader('Content-Length', altRes.headers['content-length'])
                    }
                    return altRes.pipe(res)
                }

                if (altRes.statusCode === 401 || altRes.headers['x-cld-error'] === 'deny or ACL failure') {
                    return res.status(401).json({
                        message: 'PDF/ZIP delivery is restricted on your Cloudinary account. Please go to your Cloudinary Console > Settings > Security > Restricted media types, and ensure "Allow delivery of PDF and ZIP files" is enabled.'
                    })
                }
            }

            return res.status(502).json({ message: 'Failed to fetch file from storage' })
        } catch (fetchErr) {
            console.error('File proxy fetch error:', fetchErr.message)
            return res.status(502).json({ message: 'Failed to fetch file' })
        }
    } catch (error) {
        next(error)
    }
}

module.exports = {
    checkStudent,
    getStudentDashboard,
    getStudentSubjects,
    getSubjectMaterials,
    getStudentAssignments,
    getStudentMaterials,
    getStudentNotices,
    getStudentEssays,
    getCalendar,
    searchContent,
    getAssignmentAttachment,
}
