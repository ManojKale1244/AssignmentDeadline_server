const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Assignment = require('./models/Assignment');
const Subject = require('./models/Subject');
const User = require('./models/User');

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Find a teacher user
    const teacher = await User.findOne({ role: 'teacher' });
    if (!teacher) {
        console.log('No teacher found in database.');
        await mongoose.disconnect();
        return;
    }
    console.log(`Found teacher: ${teacher.name} (${teacher.email}), ID: ${teacher._id}`);

    // Find teacher's subjects
    const subjects = await Subject.find({ teacherId: teacher._id });
    console.log(`Teacher's subjects: ${subjects.length}`);
    for (const s of subjects) {
        console.log(`- Subject: ${s.name} (${s.code}) Class: ${s.class} Div: ${s.division}`);
    }
    const mySubjectIds = subjects.map(s => s._id);

    // Find assignments
    const assignmentsCreated = await Assignment.find({ createdBy: teacher._id });
    console.log(`Assignments created by teacher: ${assignmentsCreated.length}`);
    for (const a of assignmentsCreated) {
        console.log(`- Title: ${a.title}, Deadline: ${a.deadline}, SubjectId: ${a.subjectId}`);
    }

    const assignmentsFiltered = await Assignment.find({ subjectId: { $in: mySubjectIds } });
    console.log(`Assignments by subjectId in mySubjectIds: ${assignmentsFiltered.length}`);

    await mongoose.disconnect();
    console.log('Disconnected.');
}

run().catch(console.error);
