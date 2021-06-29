const config = require('../config.json');
const mongoose = require('mongoose');
const connectionOptions = {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
};
mongoose.connect(process.env.MONGODB_URI || config.connectionString, connectionOptions);
mongoose.Promise = global.Promise;

module.exports = {
    Admin: require('../Admin/admin.model'),
    Student: require('../Student/student.model'),
    Teacher: require('../Teacher/teacher.model'),
    Course: require('../course/course.model'),
    per: require('../Permissions/permission.model'),
    Cms: require('../cms/cms.model'),
    Attendance: require('../attendance/attendance.model'),
    Setting: require('../setting/setting.model'),
    Payment: require('../Payment/payment.model'),
    role: require('../Roles/role.model'),
    class: require('../Class/class.model'),
    RefreshToken: require('../accounts/refresh-token.model'),
    isValidId
};

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}