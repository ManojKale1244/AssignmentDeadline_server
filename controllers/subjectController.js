const Subject = require('../models/Subject')
const { logActivity } = require('../utils/activityLog')

const createSubject = async (req, res, next) => {
    try {
        const { name, code, teacherId, class: subjectClass, division, department } = req.body

        if (!name || !code || !teacherId || !subjectClass || !division || !department) {
            return res.status(400).json({ message: 'All subject fields are required' })
        }

        const subject = await Subject.create({
            name,
            code,
            teacherId,
            class: subjectClass,
            division,
            department,
        })

        await logActivity(req.user.id, 'create', 'Subject', subject._id)
        res.status(201).json({ subject })
    } catch (error) {
        next(error)
    }
}

const listSubjects = async (req, res, next) => {
    try {
        const { class: subjectClass, division, department, teacherId } = req.query
        const query = {}

        if (subjectClass) query.class = subjectClass
        if (division) query.division = division
        if (department) query.department = department
        if (teacherId) query.teacherId = teacherId

        const subjects = await Subject.find(query)
            .populate('teacherId', 'name email')
            .sort({ name: 1 })
            .limit(200)

        res.json({ subjects })
    } catch (error) {
        next(error)
    }
}

const getSubject = async (req, res, next) => {
    try {
        const subject = await Subject.findById(req.params.id).populate('teacherId', 'name email')
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' })
        }
        res.json({ subject })
    } catch (error) {
        next(error)
    }
}

// Returns only subjects assigned to the currently logged-in teacher
const getMySubjects = async (req, res, next) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Teacher access required' })
        }

        const subjects = await Subject.find({ teacherId: req.user.id })
            .populate('teacherId', 'name email')
            .sort({ class: 1, name: 1 })

        res.json({ subjects })
    } catch (error) {
        next(error)
    }
}

// Returns subjects for a student's class + division
const getSubjectsForStudent = async (req, res, next) => {
    try {
        const { class: studentClass, division } = req.query
        if (!studentClass || !division) {
            return res.status(400).json({ message: 'class and division query params required' })
        }

        const subjects = await Subject.find({ class: { $in: [studentClass, 'ALL'] }, division })
            .populate('teacherId', 'name')
            .sort({ name: 1 })

        res.json({ subjects })
    } catch (error) {
        next(error)
    }
}

// Admin: update a subject
const updateSubject = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' })
        }

        const subject = await Subject.findById(req.params.id)
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' })
        }

        const { name, code, teacherId, class: subjectClass, division, department } = req.body
        if (name !== undefined) subject.name = name
        if (code !== undefined) subject.code = code
        if (teacherId !== undefined) subject.teacherId = teacherId
        if (subjectClass !== undefined) subject.class = subjectClass
        if (division !== undefined) subject.division = division
        if (department !== undefined) subject.department = department

        await subject.save()
        await logActivity(req.user.id, 'update', 'Subject', subject._id)
        res.json({ subject })
    } catch (error) {
        next(error)
    }
}

// Admin: delete a subject
const deleteSubject = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' })
        }

        const subject = await Subject.findById(req.params.id)
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' })
        }

        await subject.deleteOne()
        await logActivity(req.user.id, 'delete', 'Subject', subject._id)
        res.json({ message: 'Subject deleted' })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    createSubject,
    listSubjects,
    getSubject,
    getMySubjects,
    getSubjectsForStudent,
    updateSubject,
    deleteSubject,
}
