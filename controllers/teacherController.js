const Assignment = require('../models/Assignment')
const Material = require('../models/Material')
const Notice = require('../models/Notice')
const Essay = require('../models/Essay')
const Subject = require('../models/Subject')
const User = require('../models/User')
const { uploadBuffer, deleteAsset } = require('../utils/r2')
const { logActivity } = require('../utils/activityLog')
const { notifyStudents } = require('../utils/notifyStudents')
const { queueRemindersForAssignment, deleteRemindersForAssignment, requeueRemindersForAssignment } = require('../utils/reminders')

const checkTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Teacher access required' })
    }
    next()
}

/**
 * Verifies that the given subjectId belongs to the logged-in teacher.
 * Returns the subject if valid, throws 403/404 otherwise.
 */
const verifySubjectOwnership = async (subjectId, teacherId, res) => {
    const subject = await Subject.findById(subjectId)
    if (!subject) {
        res.status(404).json({ message: 'Subject not found' })
        return null
    }
    if (subject.teacherId.toString() !== teacherId.toString()) {
        res.status(403).json({ message: 'You are not assigned to this subject' })
        return null
    }
    return subject
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

const getTeacherDashboard = async (req, res, next) => {
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // Find all subjects assigned to this teacher to get class & division targets
        const subjects = await Subject.find({ teacherId: req.user.id })
        const classDivs = subjects.map((s) => ({ class: s.class, division: s.division }))

        let totalStudents = 0
        if (classDivs.length > 0) {
            totalStudents = await User.countDocuments({
                role: 'student',
                $or: classDivs,
            })
        }

        const [todayDeadlines, upcomingDeadlines, totalAssignments, totalMaterials, totalNotices] =
            await Promise.all([
                Assignment.countDocuments({ createdBy: req.user.id, deadline: { $gte: today, $lt: tomorrow } }),
                Assignment.countDocuments({ createdBy: req.user.id, deadline: { $gte: tomorrow } }),
                Assignment.countDocuments({ createdBy: req.user.id }),
                Material.countDocuments({ uploadedBy: req.user.id }),
                Notice.countDocuments({ createdBy: req.user.id }),
            ])

        const mySubjects = subjects.length

        res.json({
            stats: {
                todayDeadlines,
                upcomingDeadlines,
                totalAssignments,
                totalMaterials,
                totalNotices,
                mySubjects,
                totalStudents,
            },
        })
    } catch (error) {
        next(error)
    }
}

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

const createAssignment = async (req, res, next) => {
    try {
        const { title, description, subjectId, deadline, remindersSet, class: targetClass, division: targetDivision } = req.body

        if (!title || !subjectId) {
            return res.status(400).json({ message: 'Title and subject are required' })
        }

        const subject = await verifySubjectOwnership(subjectId, req.user.id, res)
        if (!subject) return

        let attachment = {}
        if (req.file) {
            const uploadResult = await uploadBuffer(req.file.buffer, {
                folder: 'edutrack/assignments',
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
            })
            attachment = {
                url: uploadResult.url,
                publicId: uploadResult.key,
                fileType: uploadResult.format || req.file.mimetype || '',
            }
        }

        let parsedReminders = []
        if (remindersSet) {
            try {
                parsedReminders = typeof remindersSet === 'string' ? JSON.parse(remindersSet) : remindersSet
            } catch (e) {
                parsedReminders = remindersSet
            }
        }

        let divisionsToCreate = [targetDivision || subject.division]
        if (targetDivision === 'both' || targetDivision === 'all') {
            const teacherSubjects = await Subject.find({
                code: subject.code,
                class: targetClass || subject.class,
                teacherId: req.user.id
            }).select('division')

            divisionsToCreate = teacherSubjects.length > 0
                ? [...new Set(teacherSubjects.map(s => s.division))]
                : [subject.division]
        }
        const createdAssignments = []

        for (const div of divisionsToCreate) {
            const targetSubject = await Subject.findOne({
                code: subject.code,
                class: targetClass || subject.class,
                division: div,
                teacherId: req.user.id
            })

            const assignment = await Assignment.create({
                title,
                description,
                subjectId: targetSubject ? targetSubject._id : subjectId,
                class: targetClass || subject.class,
                division: div,
                deadline: deadline ? new Date(deadline) : null,
                attachment,
                createdBy: req.user.id,
                remindersSet: parsedReminders,
            })
            await logActivity(req.user.id, 'create_assignment', 'Assignment', assignment._id)
            createdAssignments.push(assignment)
        }

        const deadlineMsg = deadline ? `. Deadline: ${new Date(deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''
        await notifyStudents({
            title: 'New Assignment Posted',
            message: `"${title}" has been assigned${deadlineMsg}.`,
            type: 'assignment',
            relatedId: createdAssignments[0]._id,
            relatedModel: 'Assignment',
            classes: [targetClass || subject.class],
            divisions: divisionsToCreate,
        })

        // Queue automatic email reminders (7d, 3d, 1d, 6h) for ALL students
        for (const assignment of createdAssignments) {
            await queueRemindersForAssignment(assignment)
        }

        res.status(201).json({ assignment: createdAssignments[0], created: createdAssignments })
    } catch (error) {
        next(error)
    }
}

const updateAssignment = async (req, res, next) => {
    try {
        const { id } = req.params
        const { title, description, deadline, attachment: bodyAttachment, remindersSet } = req.body

        const assignment = await Assignment.findOne({ _id: id, createdBy: req.user.id })
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' })
        }

        if (title !== undefined) assignment.title = title
        if (description !== undefined) assignment.description = description
        if (deadline !== undefined) assignment.deadline = deadline ? new Date(deadline) : null

        let parsedReminders = undefined
        if (remindersSet !== undefined) {
            try {
                parsedReminders = typeof remindersSet === 'string' ? JSON.parse(remindersSet) : remindersSet
            } catch (e) {
                parsedReminders = remindersSet
            }
        }
        if (parsedReminders !== undefined) assignment.remindersSet = parsedReminders

        // Handle attachment
        if (req.file) {
            if (assignment.attachment?.publicId) {
                await deleteAsset(assignment.attachment.publicId)
            }
            const uploadResult = await uploadBuffer(req.file.buffer, {
                folder: 'edutrack/assignments',
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
            })
            assignment.attachment = {
                url: uploadResult.url,
                publicId: uploadResult.key,
                fileType: uploadResult.format || req.file.mimetype || '',
            }
        } else if (bodyAttachment !== undefined) {
            try {
                assignment.attachment = typeof bodyAttachment === 'string' ? JSON.parse(bodyAttachment) : bodyAttachment
            } catch (e) {
                // ignore
            }
        }

        await assignment.save()
        await logActivity(req.user.id, 'update_assignment', 'Assignment', assignment._id)

        // If deadline was changed, re-queue reminders for all students
        if (deadline !== undefined) {
            await requeueRemindersForAssignment(assignment)
        }

        const updatedAssignment = await Assignment.findById(assignment._id).populate('subjectId', 'name code class division')
        res.json({ assignment: updatedAssignment })
    } catch (error) {
        next(error)
    }
}

const deleteAssignment = async (req, res, next) => {
    try {
        const { id } = req.params

        const assignment = await Assignment.findOne({ _id: id, createdBy: req.user.id })
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' })
        }

        if (assignment.attachment?.publicId) {
            await deleteAsset(assignment.attachment.publicId)
        }

        // Clean up pending reminders for this assignment
        await deleteRemindersForAssignment(id)

        await Assignment.findByIdAndDelete(id)
        await logActivity(req.user.id, 'delete_assignment', 'Assignment', id)
        res.json({ message: 'Assignment deleted' })
    } catch (error) {
        next(error)
    }
}

const getTeacherAssignments = async (req, res, next) => {
    try {
        // Get all subjects this teacher owns
        const mySubjects = await Subject.find({ teacherId: req.user.id }).select('_id')
        const mySubjectIds = mySubjects.map((s) => s._id)

        const { subjectId, class: userClass, division } = req.query
        const filter = { subjectId: { $in: mySubjectIds } }
        if (subjectId) filter.subjectId = subjectId
        if (userClass) filter.class = userClass
        if (division) filter.division = division

        const assignments = await Assignment.find(filter)
            .populate('subjectId', 'name code class division')
            .sort({ deadline: -1 })

        res.json({ assignments })
    } catch (error) {
        next(error)
    }
}

// ─── MATERIALS ────────────────────────────────────────────────────────────────

const uploadMaterial = async (req, res, next) => {
    try {
        const { title, category, subjectId, class: targetClass, division: targetDivision } = req.body

        if (!title || !category || !subjectId) {
            return res.status(400).json({ message: 'Title, category, and subject are required' })
        }

        if (!req.file) {
            return res.status(400).json({ message: 'File is required' })
        }

        const subject = await verifySubjectOwnership(subjectId, req.user.id, res)
        if (!subject) return

        // Upload file to Cloudflare R2
        const uploadResult = await uploadBuffer(req.file.buffer, {
            folder: 'edutrack/materials',
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
        })

        let divisionsToCreate = [targetDivision || subject.division]
        if (targetDivision === 'both' || targetDivision === 'all') {
            const teacherSubjects = await Subject.find({
                code: subject.code,
                class: targetClass || subject.class,
                teacherId: req.user.id
            }).select('division')

            divisionsToCreate = teacherSubjects.length > 0
                ? [...new Set(teacherSubjects.map(s => s.division))]
                : [subject.division]
        }
        const createdMaterials = []

        for (const div of divisionsToCreate) {
            const targetSubject = await Subject.findOne({
                code: subject.code,
                class: targetClass || subject.class,
                division: div,
                teacherId: req.user.id
            })

            const material = await Material.create({
                title,
                category,
                subjectId: targetSubject ? targetSubject._id : subjectId,
                fileUrl: uploadResult.url,
                publicId: uploadResult.key,
                fileType: uploadResult.format || req.file.mimetype || '',
                uploadedBy: req.user.id,
                class: targetClass || subject.class,
                division: div,
            })
            await logActivity(req.user.id, 'upload_material', 'Material', material._id)
            createdMaterials.push(material)
        }

        // Notify students in the target class+division(s)
        await notifyStudents({
            title: 'New Study Material Uploaded',
            message: `"${title}" (${category.replace('_', ' ')}) has been uploaded for ${subject.name || 'your subject'}.`,
            type: 'material',
            relatedId: createdMaterials[0]._id,
            relatedModel: 'Material',
            classes: [targetClass || subject.class],
            divisions: divisionsToCreate,
        })

        res.status(201).json({ material: createdMaterials[0], created: createdMaterials })
    } catch (error) {
        next(error)
    }
}

const getTeacherMaterials = async (req, res, next) => {
    try {
        const mySubjects = await Subject.find({ teacherId: req.user.id }).select('_id')
        const mySubjectIds = mySubjects.map((s) => s._id)

        const { subjectId, category } = req.query
        const filter = { subjectId: { $in: mySubjectIds } }
        if (subjectId) filter.subjectId = subjectId
        if (category) filter.category = category

        const materials = await Material.find(filter)
            .populate('subjectId', 'name code class division')
            .sort({ createdAt: -1 })

        res.json({ materials })
    } catch (error) {
        next(error)
    }
}

const deleteMaterial = async (req, res, next) => {
    try {
        const { id } = req.params

        const material = await Material.findOne({ _id: id, uploadedBy: req.user.id })
        if (!material) {
            return res.status(404).json({ message: 'Material not found' })
        }

        if (material.publicId) {
            await deleteAsset(material.publicId)
        }

        await Material.findByIdAndDelete(id)
        await logActivity(req.user.id, 'delete_material', 'Material', id)
        res.json({ message: 'Material deleted' })
    } catch (error) {
        next(error)
    }
}

// ─── NOTICES ──────────────────────────────────────────────────────────────────

const createNotice = async (req, res, next) => {
    try {
        const { title, description, type, targetClass, targetDivision } = req.body

        if (!title) {
            return res.status(400).json({ message: 'Title required' })
        }

        const notice = await Notice.create({
            title,
            description,
            type,
            targetClass: targetClass || [],
            targetDivision: targetDivision || [],
            createdBy: req.user.id,
        })

        await logActivity(req.user.id, 'create_notice', 'Notice', notice._id)

        // Notify students — notices may target specific classes/divisions or all
        const noticeClasses = Array.isArray(targetClass) ? targetClass : (targetClass ? [targetClass] : [])
        const noticeDivisions = Array.isArray(targetDivision) ? targetDivision : (targetDivision ? [targetDivision] : [])
        await notifyStudents({
            title: 'New Notice',
            message: `${title}${description ? ': ' + description.slice(0, 100) : ''}`,
            type: 'notice',
            relatedId: notice._id,
            relatedModel: 'Notice',
            classes: noticeClasses,
            divisions: noticeDivisions,
        })

        res.status(201).json({ notice })
    } catch (error) {
        next(error)
    }
}

const getTeacherNotices = async (req, res, next) => {
    try {
        const notices = await Notice.find({ createdBy: req.user.id })
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 })

        res.json({ notices })
    } catch (error) {
        next(error)
    }
}

const updateNotice = async (req, res, next) => {
    try {
        const { id } = req.params
        const { title, description, type, targetClass, targetDivision } = req.body

        const notice = await Notice.findOne({ _id: id, createdBy: req.user.id })
        if (!notice) {
            return res.status(404).json({ message: 'Notice not found' })
        }

        if (title !== undefined) notice.title = title
        if (description !== undefined) notice.description = description
        if (type !== undefined) notice.type = type
        if (targetClass !== undefined) notice.targetClass = targetClass
        if (targetDivision !== undefined) notice.targetDivision = targetDivision

        await notice.save()
        await logActivity(req.user.id, 'update_notice', 'Notice', notice._id)
        res.json({ notice })
    } catch (error) {
        next(error)
    }
}

const deleteNotice = async (req, res, next) => {
    try {
        const { id } = req.params

        const notice = await Notice.findOne({ _id: id, createdBy: req.user.id })
        if (!notice) {
            return res.status(404).json({ message: 'Notice not found' })
        }

        await Notice.findByIdAndDelete(id)
        await logActivity(req.user.id, 'delete_notice', 'Notice', id)
        res.json({ message: 'Notice deleted' })
    } catch (error) {
        next(error)
    }
}

// ─── ESSAYS ───────────────────────────────────────────────────────────────────

const createEssay = async (req, res, next) => {
    try {
        const { title, description, subjectId, deadline, wordLimit } = req.body

        if (!title || !subjectId || !deadline) {
            return res.status(400).json({ message: 'Title, subject, and deadline are required' })
        }

        const subject = await verifySubjectOwnership(subjectId, req.user.id, res)
        if (!subject) return

        const essay = await Essay.create({
            topic: title,
            instructions: description || '',
            wordLimit: wordLimit || 500,
            subjectId,
            class: subject.class,
            division: subject.division,
            deadline,
            createdBy: req.user.id,
        })

        await logActivity(req.user.id, 'create_essay', 'Essay', essay._id)
        res.status(201).json({ essay })
    } catch (error) {
        next(error)
    }
}

const getTeacherEssays = async (req, res, next) => {
    try {
        const mySubjects = await Subject.find({ teacherId: req.user.id }).select('_id')
        const mySubjectIds = mySubjects.map((s) => s._id)

        const { subjectId } = req.query
        const filter = { subjectId: { $in: mySubjectIds } }
        if (subjectId) filter.subjectId = subjectId

        const essays = await Essay.find(filter)
            .populate('subjectId', 'name code class division')
            .sort({ deadline: -1 })

        res.json({ essays })
    } catch (error) {
        next(error)
    }
}

const updateEssay = async (req, res, next) => {
    try {
        const { id } = req.params
        const { title, description, deadline, wordLimit } = req.body

        const essay = await Essay.findOne({ _id: id, createdBy: req.user.id })
        if (!essay) {
            return res.status(404).json({ message: 'Essay not found' })
        }

        if (title !== undefined) essay.topic = title
        if (description !== undefined) essay.instructions = description
        if (deadline !== undefined) essay.deadline = deadline
        if (wordLimit !== undefined) essay.wordLimit = wordLimit

        await essay.save()
        await logActivity(req.user.id, 'update_essay', 'Essay', essay._id)
        res.json({ essay })
    } catch (error) {
        next(error)
    }
}

const deleteEssay = async (req, res, next) => {
    try {
        const { id } = req.params

        const essay = await Essay.findOne({ _id: id, createdBy: req.user.id })
        if (!essay) {
            return res.status(404).json({ message: 'Essay not found' })
        }

        await Essay.findByIdAndDelete(id)
        await logActivity(req.user.id, 'delete_essay', 'Essay', id)
        res.json({ message: 'Essay deleted' })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    checkTeacher,
    getTeacherDashboard,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getTeacherAssignments,
    uploadMaterial,
    getTeacherMaterials,
    deleteMaterial,
    createNotice,
    getTeacherNotices,
    updateNotice,
    deleteNotice,
    createEssay,
    getTeacherEssays,
    updateEssay,
    deleteEssay,
}
