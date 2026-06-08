require('dotenv').config()
const mongoose = require('mongoose')
const Subject = require('./models/Subject')
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
    await mongoose.disconnect()
}

run().catch(console.error)
