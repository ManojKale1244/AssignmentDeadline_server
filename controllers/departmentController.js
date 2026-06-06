const Department = require('../models/Department')
const { logActivity } = require('../utils/activityLog')

const createDepartment = async (req, res, next) => {
    try {
        const { name, code } = req.body
        if (!name || !code) {
            return res.status(400).json({ message: 'Name and code required' })
        }

        const department = await Department.create({
            name,
            code,
            createdBy: req.user.id,
        })

        await logActivity(req.user.id, 'create', 'Department', department._id)
        res.status(201).json({ department })
    } catch (error) {
        next(error)
    }
}

const listDepartments = async (req, res, next) => {
    try {
        const departments = await Department.find().sort({ name: 1 }).limit(200)
        res.json({ departments })
    } catch (error) {
        next(error)
    }
}

module.exports = { createDepartment, listDepartments }
