const Assignment = require('../models/Assignment')
const User = require('../models/User')
const { uploadBuffer, deleteAsset } = require('../utils/cloudinary')
const { queueAssignmentReminders, REMINDER_TYPES } = require('../utils/reminders')
const { logActivity } = require('../utils/activityLog')

const mapAttachment = (file, result) => ({
    url: result.secure_url,
    publicId: result.public_id,
    fileType: result.format || file.mimetype || '',
})

const createAssignment = async (req, res, next) => {
    try {
        const { title, description, subjectId, class: assignmentClass, division, deadline } =
            req.body

        if (!title || !subjectId || !assignmentClass || !division || !deadline) {
            return res.status(400).json({
                message: 'Title, subject, class, division, and deadline required',
            })
        }

        let attachment = {}
        const upload = req.file || req.files?.[0]
        if (upload) {
            const result = await uploadBuffer(upload.buffer, {
                folder: 'edutrack/assignments',
                resource_type: 'auto',
            })
            attachment = mapAttachment(upload, result)
        }

        const assignment = await Assignment.create({
            title,
            description: description || '',
            subjectId,
            class: assignmentClass,
            division,
            deadline: new Date(deadline),
            attachment,
            createdBy: req.user.id,
            remindersSet: REMINDER_TYPES.map((type) => ({ type, sent: false })),
        })

        const creator = await User.findById(req.user.id)
        await queueAssignmentReminders(assignment, creator)
        await logActivity(req.user.id, 'create', 'Assignment', assignment._id)

        res.status(201).json({ assignment })
    } catch (error) {
        next(error)
    }
}

const listAssignments = async (req, res, next) => {
    try {
        const { subjectId, class: assignmentClass, division, q } = req.query
        const query = {}

        if (subjectId) query.subjectId = subjectId
        if (assignmentClass) query.class = assignmentClass
        if (division) query.division = division
        if (q) {
            const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(escaped, 'i')
            query.$or = [{ title: regex }, { description: regex }]
        }

        const assignments = await Assignment.find(query)
            .populate('subjectId', 'name code')
            .sort({ deadline: 1 })
            .limit(200)

        res.json({ assignments })
    } catch (error) {
        next(error)
    }
}

const getAssignment = async (req, res, next) => {
    try {
        const assignment = await Assignment.findById(req.params.id).populate(
            'subjectId',
            'name code class division'
        )
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' })
        }

        res.json({ assignment })
    } catch (error) {
        next(error)
    }
}

const updateAssignment = async (req, res, next) => {
    try {
        const { title, description, subjectId, class: assignmentClass, division, deadline } =
            req.body

        const assignment = await Assignment.findById(req.params.id)
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' })
        }

        if (title !== undefined) assignment.title = title
        if (description !== undefined) assignment.description = description
        if (subjectId !== undefined) assignment.subjectId = subjectId
        if (assignmentClass !== undefined) assignment.class = assignmentClass
        if (division !== undefined) assignment.division = division
        if (deadline !== undefined) assignment.deadline = new Date(deadline)

        const upload = req.file || req.files?.[0]
        if (upload) {
            if (assignment.attachment?.publicId) {
                await deleteAsset(assignment.attachment.publicId)
            }
            const result = await uploadBuffer(upload.buffer, {
                folder: 'edutrack/assignments',
                resource_type: 'auto',
            })
            assignment.attachment = mapAttachment(upload, result)
        }

        await assignment.save()
        await logActivity(req.user.id, 'update', 'Assignment', assignment._id)

        res.json({ assignment })
    } catch (error) {
        next(error)
    }
}

const deleteAssignment = async (req, res, next) => {
    try {
        const assignment = await Assignment.findById(req.params.id)
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' })
        }

        if (assignment.attachment?.publicId) {
            await deleteAsset(assignment.attachment.publicId)
        }

        await assignment.deleteOne()
        await logActivity(req.user.id, 'delete', 'Assignment', assignment._id)

        res.json({ message: 'Assignment deleted' })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    createAssignment,
    listAssignments,
    getAssignment,
    updateAssignment,
    deleteAssignment,
}
