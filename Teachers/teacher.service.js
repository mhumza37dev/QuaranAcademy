const config = require('../config.json');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const sendEmail = require('../_helpers/send-email');
const db = require('../_helpers/db');
const {
    error
} = require('console');


ObjectId = require('mongodb').ObjectID;


// const { param } = require('./user.controller');



// Social provider karna hai.....

module.exports = {
    refreshToken,
    revokeToken,
    register,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    create,
    update,
    delete: _delete,
};

async function authenticate({
    email,
    password,
    ipAddress
}) {
    const account = await db.Teacher.findOne({
        email
    });

    if (!account || !bcrypt.compareSync(password, account.passwordHash)) {
        throw 'Email or password is incorrect';
    } //else if (account.role_ids.includes("admin") === false) {
    //throw 'you are not admin';}
    else { // authentication successful so generate jwt and refresh tokens
        const jwtToken = generateJwtToken(account);
        const refreshToken = generateRefreshToken(account, ipAddress);
        // save refresh token
        await refreshToken.save();
        // return basic details and tokens
        return {
            // ...basicDetails(account),
            account,
            jwtToken,
            refreshToken: refreshToken.token
        };
    }
}





async function refreshToken({
    token,
    ipAddress
}) {
    const refreshToken = await getRefreshToken(token);
    const {
        account
    } = refreshToken;

    // replace old refresh token with a new one and save
    const newRefreshToken = generateRefreshToken(account, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();
    await newRefreshToken.save();

    // generate new jwt
    const jwtToken = generateJwtToken(account);

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}

async function revokeToken({
    token,
    ipAddress
}) {
    const refreshToken = await getRefreshToken(token);

    // revoke token and save
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}

function randomOtpString(n) {
    var add = 1,
        max = 12 - add; // 12 is the min safe number Math.random() can generate without it starting to pad the end with zeros.   

    if (n > max) {
        return generate(max) + generate(n - max);
    }

    max = Math.pow(10, n + add);
    var min = max / 10; // Math.pow(10, n) basically
    var number = Math.floor(Math.random() * (max - min + 1)) + min;

    return ("" + number).substring(add);
}

async function register(params, origin) {
    // validate
    if (await db.Teacher.findOne({
            email: params.email
        })) {
        // send already registered error in email to prevent account enumeration
        // return await sendAlreadyRegisteredEmail(params.email, origin);
        throw "Email is already in use";
    } else if (await db.Teacher.findOne({
            mobile: params.mobile
        })) {
        // send already registered error in email to prevent account enumeration
        // return await sendAlreadyRegisteredEmail(params.email, origin);
        throw "Phone Number is already in use";
    }

    // create account object
    const account = new db.Teacher(params);
    account.otp = randomOtpString(6);

    // first registered account is an admin
    // const isFirstAccount = (await db.Teacher.countDocuments({})) === 0;

    // account.role = params.role
    // account.status = params.status;
    // account.social_provider = null;
    // account.provider_id = "null";
    // account.mobile = params.mobile

    // hash password
    account.passwordHash = hash(params.password);

    // save account
    await account.save();

}





async function forgotPassword({
    email
}, origin) {
    const account = await db.Teacher.findOne({
        email
    });

    // always return ok response to prevent email enumeration
    if (!account) return;

    // create reset token that expires after 24 hours
    account.otp = randomOtpString(6)
    await account.save();

    // send email
    await sendPasswordResetEmail(account, origin);
}

async function validateResetToken(params) {
    const account = await db.Teacher.findOne(params);
    console.log("....")

    if (!account) throw 'Invalid token';
}

async function resetPassword(params) {
    const account = await db.Teacher.findOne({
        // 'email': params.email,
        'otp': params.otp
    });

    if (!account) throw 'Invalid token';

    // update password and remove reset token
    account.passwordHash = hash(params.password);
    account.updated_at = Date.now();
    // account.resetToken = {
    //     token: randomOtpString(),
    //     expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    // };
    account.otp = undefined;
    await account.save();
}

async function getAll() {
    const accounts = await db.Teacher.find();
    return accounts.map(x => basicDetails(x));
}

async function getById(id) {
    const account = await getAccount(id);
    return basicDetails(account);
}

async function create(params) {
    // validate
    if (await db.Teacher.findOne({
            email: params.email
        })) {
        throw 'Email "' + params.email + '" is already registered';
    }

    const account = new db.Teacher(params);
    account.verified = Date.now();

    // hash password
    account.passwordHash = hash(params.password);

    // save account
    await account.save();

    return basicDetails(account);
}

async function update(id, params, token) {
    const account = await getAccount(id);

    // validate (if email was changed)
    if (params.email && account.email !== params.email && await db.Teacher.findOne({
            email: params.email
        })) {
        throw 'Email "' + params.email + '" is already taken';
    }

    // hash password if it was entered
    if (params.password) {
        params.passwordHash = hash(params.password);
    }

    // copy params to account and save
    Object.assign(account, params);
    account.updated_at = Date.now();
    await account.save();

    return basicDetails(account);
}

// async function _delete(id) {
//     const account = await getAccount(id);
//     if (account.status === "blocked") {
//         throw "User is already blocked."
//     }

//     // await account.remove();
//     account.deleted_at = Date.now();
//     account.status = "blocked";
//     await account.save();
// }

// helper functions
async function _delete(id) {
    const account = await getAccount(id);
    if (account.status === "blocked") {
        throw "Teacher is already blocked."
    }

    // await account.remove();
    account.deleted_at = Date.now();
    account.status = "blocked";
    await account.save();
}
async function getAccount(id) {
    if (!db.isValidId(id)) throw 'Account not found';
    const account = await db.Teacher.findById(id);
    if (!account) throw 'Account not found';
    return account;
}


async function getRefreshToken(token) {
    const refreshToken = await db.RefreshToken.findOne({
        token
    }).populate('account');
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

function hash(password) {
    return bcrypt.hashSync(password, 10);
}

function generateJwtToken(account) {
    // create a jwt token containing the account id that expires in 15 minutes
    return jwt.sign({
        sub: account.id,
        id: account.id
    }, config.secret, {
        expiresIn: '15m'
    });
}

function generateRefreshToken(account, ipAddress) {
    // create a refresh token that expires in 7 days
    return new db.RefreshToken({
        account: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByIp: ipAddress
    });
}

function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account) {
    const {
        id,
        title,
        firstName,
        lastName,
        email,
        role,
        created,
        updated,
    } = account;
    return {
        id,
        title,
        firstName,
        lastName,
        email,
        role,
        created,
        updated,
    };
}





async function sendPasswordResetEmail(account, origin) {
    let message;
    if (origin) {
        const resetUrl = `${origin}/account/reset-password?token=${account.otp}`;
        message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>`;
    } else {
        console.log(account.otp)
        message = `<p>Please use the below token to reset your password with the <code>/account/reset-password</code> api route:</p>
                   <p><code>${account.otp}</code></p>`;
    }
}