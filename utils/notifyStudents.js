const User = require('../models/User')
const Notification = require('../models/Notification')

/**
 * Create in-app notifications for all students in a given class+division.
 *
 * @param {Object} options
 * @param {string}   options.title        - Notification title
 * @param {string}   options.message      - Notification body
 * @param {string}   options.type         - 'assignment' | 'material' | 'notice' | 'reminder' | 'general'
 * @param {string}   options.relatedId    - MongoDB ObjectId of the related document (optional)
 * @param {string}   options.relatedModel - Model name e.g. 'Assignment', 'Material', 'Notice' (optional)
 * @param {string[]} options.classes      - Array of class values e.g. ['SY'] or ['SY','TY']
 * @param {string[]} options.divisions    - Array of division values e.g. ['A'] or ['A','B']
 */
const notifyStudents = async ({
    title,
    message,
    type = 'general',
    relatedId = null,
    relatedModel = '',
    classes = [],
    divisions = [],
}) => {
    try {
        // Build student query
        const studentQuery = { role: 'student', isActive: true }

        // If classes are specified, filter by them; otherwise notify all classes
        if (classes.length > 0) {
            studentQuery.class = { $in: classes }
        }

        // If divisions are specified, filter by them; otherwise notify all divisions
        if (divisions.length > 0) {
            studentQuery.division = { $in: divisions }
        }

        const students = await User.find(studentQuery).select('_id')

        if (students.length === 0) return

        // Bulk-create notifications for all matching students
        const notifications = students.map((student) => ({
            userId: student._id,
            title,
            message,
            type,
            read: false,
            relatedId,
            relatedModel,
        }))

        await Notification.insertMany(notifications, { ordered: false })
    } catch (error) {
        // Log but don't throw — notifications should not break the main flow
        console.error('Failed to create student notifications:', error.message)
    }
}

module.exports = { notifyStudents }
