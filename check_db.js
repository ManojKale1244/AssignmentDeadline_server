require('dotenv').config()
const mongoose = require('mongoose')
const Subject = require('./models/Subject')
const User = require('./models/User')
const Assignment = require('./models/Assignment')
const Material = require('./models/Material')

async function run() {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('DB Connected')
    const subjects = await Subject.find().populate('teacherId')
    console.log(`Found ${subjects.length} subjects:`)
    for (const s of subjects) {
        const assignmentsCount = await Assignment.countDocuments({ subjectId: s._id })
        const materialsCount = await Material.countDocuments({ subjectId: s._id })
        console.log(`- ${s.name} (${s.code}) [ID: ${s._id}]: class=${s.class}, div=${s.division}, teacher=${s.teacherId?.name || 'none'}. Assignments: ${assignmentsCount}, Materials: ${materialsCount}`)
    }

    const users = await User.find()
    console.log(`\nFound ${users.length} users:`)
    for (const u of users) {
        console.log(`- ${u.name} (${u.email}) [ID: ${u._id}]: role=${u.role}, class=${u.class}, div=${u.division}`)
    }

    const assignments = await Assignment.find().populate('subjectId')
    console.log(`\nFound ${assignments.length} assignments:`)
    for (const a of assignments) {
        console.log(`- ${a.title} [ID: ${a._id}]: class=${a.class}, div=${a.division}, subject=${a.subjectId?.name || 'none'} (${a.subjectId?.code || 'none'}), deadline=${a.deadline?.toISOString()}`)
    }

    await mongoose.disconnect()
}

run().catch(console.error)
