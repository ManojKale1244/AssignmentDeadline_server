const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Department = require('../models/Department')
const Subject = require('../models/Subject')
const Assignment = require('../models/Assignment')
const Material = require('../models/Material')
const Notice = require('../models/Notice')
const ActivityLog = require('../models/ActivityLog')
const { logActivity } = require('../utils/activityLog')
const { DEFAULT_SUBJECTS } = require('../utils/subjectDefaults')
const { sendEmail, buildWelcomeEmail } = require('../utils/email')

const checkAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' })
    }
    next()
}

const createDepartment = async (req, res, next) => {
    try {
        const { name } = req.body

        if (!name) {
            return res.status(400).json({ message: 'Department name required' })
        }

        const existing = await Department.findOne({ name })
        if (existing) {
            return res.status(409).json({ message: 'Department already exists' })
        }

        const department = await Department.create({ name, createdBy: req.user.id })
        await logActivity(req.user.id, 'create_department', 'Department', department._id)

        res.status(201).json({ department })
    } catch (error) {
        next(error)
    }
}

const createClass = async (req, res, next) => {
    try {
        const { name } = req.body

        if (!name) {
            return res.status(400).json({ message: 'Class name required' })
        }

        res.status(201).json({ message: 'Class created', class: name })
    } catch (error) {
        next(error)
    }
}

const createTeacher = async (req, res, next) => {
    try {
        const { name, email, password, department } = req.body

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password required' })
        }

        const existing = await User.findOne({ email })
        if (existing) {
            return res.status(409).json({ message: 'Email already registered' })
        }

        const hashed = await bcrypt.hash(password, 10)
        const teacher = await User.create({
            name,
            email,
            password: hashed,
            role: 'teacher',
            department,
        })

        await logActivity(req.user.id, 'create_teacher', 'User', teacher._id)

        // Send welcome email asynchronously (non-blocking)
        const portalUrl = process.env.CLIENT_URL?.split(',')[0] || 'http://localhost:5173'
        const welcomeEmail = buildWelcomeEmail({
            userName: teacher.name,
            userEmail: teacher.email,
            role: teacher.role,
            portalUrl,
        })
        sendEmail({
            to: teacher.email,
            subject: welcomeEmail.subject,
            html: welcomeEmail.html,
            text: welcomeEmail.text,
        }).then((result) => {
            if (!result?.skipped) {
                console.log(`✅ Welcome email sent to ${teacher.email}`)
            }
        }).catch(() => {})

        res.status(201).json({ teacher })
    } catch (error) {
        next(error)
    }
}

const createStudent = async (req, res, next) => {
    try {
        const { name, email, password, class: userClass, division, department } = req.body

        if (!name || !email || !password || !userClass || !division || !department) {
            return res.status(400).json({ message: 'All fields required' })
        }

        const existing = await User.findOne({ email })
        if (existing) {
            return res.status(409).json({ message: 'Email already registered' })
        }

        const hashed = await bcrypt.hash(password, 10)
        const student = await User.create({
            name,
            email,
            password: hashed,
            role: 'student',
            class: userClass,
            division,
            department,
        })

        await logActivity(req.user.id, 'create_student', 'User', student._id)

        // Send welcome email asynchronously (non-blocking)
        const portalUrl = process.env.CLIENT_URL?.split(',')[0] || 'http://localhost:5173'
        const welcomeEmail = buildWelcomeEmail({
            userName: student.name,
            userEmail: student.email,
            role: student.role,
            portalUrl,
        })
        sendEmail({
            to: student.email,
            subject: welcomeEmail.subject,
            html: welcomeEmail.html,
            text: welcomeEmail.text,
        }).then((result) => {
            if (!result?.skipped) {
                console.log(`✅ Welcome email sent to ${student.email}`)
            }
        }).catch(() => {})

        res.status(201).json({ student })
    } catch (error) {
        next(error)
    }
}

const createSubject = async (req, res, next) => {
    try {
        const { name, code, teacherId, class: userClass, division, department } = req.body

        if (!name || !code || !teacherId || !userClass || !division || !department) {
            return res.status(400).json({ message: 'All fields required' })
        }

        const teacher = await User.findOne({ _id: teacherId, role: 'teacher' })
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' })
        }

        const classes = Array.isArray(userClass) ? userClass : [userClass]
        const divisions = Array.isArray(division) ? division : [division]

        const createdSubjects = []
        const skippedSubjects = []

        for (const cls of classes) {
            for (const div of divisions) {
                const existing = await Subject.findOne({ code, class: cls, division: div })
                if (existing) {
                    skippedSubjects.push(`${cls}-${div}`)
                    continue
                }

                const subject = await Subject.create({
                    name,
                    code,
                    teacherId,
                    class: cls,
                    division: div,
                    department,
                })
                await logActivity(req.user.id, 'create_subject', 'Subject', subject._id)
                createdSubjects.push(subject)
            }
        }

        if (createdSubjects.length === 0) {
            return res.status(400).json({ 
                message: `Subject combination(s) ${skippedSubjects.join(', ')} already registered.` 
            })
        }

        res.status(201).json({ 
            subject: createdSubjects[0],
            created: createdSubjects,
            message: `Registered ${createdSubjects.length} subject(s) successfully.`
        })
    } catch (error) {
        next(error)
    }
}

const assignSubjectToTeacher = async (req, res, next) => {
    try {
        const { subjectId, teacherId } = req.body

        if (!subjectId || !teacherId) {
            return res.status(400).json({ message: 'Subject ID and Teacher ID required' })
        }

        const subject = await Subject.findById(subjectId)
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' })
        }

        const teacher = await User.findOne({ _id: teacherId, role: 'teacher' })
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' })
        }

        subject.teacherId = teacherId
        await subject.save()

        await logActivity(req.user.id, 'assign_subject', 'Subject', subject._id)

        res.json({ subject })
    } catch (error) {
        next(error)
    }
}

const getStats = async (req, res, next) => {
    try {
        const [
            totalUsers,
            totalTeachers,
            totalStudents,
            totalDepartments,
            totalSubjects,
            totalAssignments,
            totalMaterials,
            totalNotices,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'teacher' }),
            User.countDocuments({ role: 'student' }),
            Department.countDocuments(),
            Subject.countDocuments(),
            Assignment.countDocuments(),
            Material.countDocuments(),
            Notice.countDocuments(),
        ])

        res.json({
            stats: {
                totalUsers,
                totalTeachers,
                totalStudents,
                totalDepartments,
                totalSubjects,
                totalAssignments,
                totalMaterials,
                totalNotices,
            },
        })
    } catch (error) {
        next(error)
    }
}

const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params
        const { name, email, role, class: userClass, division, department, isActive } = req.body

        const user = await User.findById(id)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        if (name !== undefined) user.name = name
        if (email !== undefined) user.email = email
        if (role !== undefined) user.role = role
        if (userClass !== undefined) user.class = userClass
        if (division !== undefined) user.division = division
        if (department !== undefined) user.department = department
        if (isActive !== undefined) user.isActive = isActive

        await user.save()
        await logActivity(req.user.id, 'update_user', 'User', user._id)

        res.json({ user })
    } catch (error) {
        next(error)
    }
}

const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params

        const user = await User.findById(id)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        await User.findByIdAndDelete(id)
        await logActivity(req.user.id, 'delete_user', 'User', id)

        res.json({ message: 'User deleted' })
    } catch (error) {
        next(error)
    }
}

const getActivityLogs = async (req, res, next) => {
    try {
        const logs = await ActivityLog.find()
            .populate('userId', 'name email role')
            .sort({ createdAt: -1 })
            .limit(25)
        res.json({ logs })
    } catch (error) {
        next(error)
    }
}

const listUsers = async (req, res, next) => {
    try {
        const { role, department } = req.query
        const filter = {}
        if (role) filter.role = role
        if (department) filter.department = department
        const users = await User.find(filter).sort({ createdAt: -1 })
        res.json({ users })
    } catch (error) {
        next(error)
    }
}

const seedDefaultSubjects = async (req, res, next) => {
    try {
        const { class: userClass, division, department, teacherId } = req.body

        if (!userClass || !division || !department || !teacherId) {
            return res.status(400).json({ message: 'class, division, department, and teacherId required' })
        }

        const subjectList = DEFAULT_SUBJECTS[userClass]
        if (!subjectList) {
            return res.status(400).json({ message: 'Invalid class. Use SY, TY, or LY' })
        }

        const teacher = await User.findOne({ _id: teacherId, role: 'teacher' })
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' })
        }

        const created = []
        const skipped = []

        for (const subDef of subjectList) {
            const code = `${subDef.code}-${division}`
            const existing = await Subject.findOne({ code, class: userClass, division })
            if (existing) {
                skipped.push(subDef.name)
                continue
            }
            const subject = await Subject.create({
                name: subDef.name,
                code,
                teacherId,
                class: userClass,
                division,
                department,
            })
            await logActivity(req.user.id, 'seed_subject', 'Subject', subject._id)
            created.push(subject)
        }

        res.status(201).json({
            message: `Seeded ${created.length} subject(s). Skipped ${skipped.length} (already exist).`,
            created,
            skipped,
        })
    } catch (error) {
        next(error)
    }
}

module.exports = {
    checkAdmin,
    createDepartment,
    createClass,
    createTeacher,
    createStudent,
    createSubject,
    assignSubjectToTeacher,
    getStats,
    updateUser,
    deleteUser,
    getActivityLogs,
    listUsers,
    seedDefaultSubjects,
}

