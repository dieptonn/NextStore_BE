const User = require('../app/models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const salt = bcrypt.genSaltSync(10);
const functions = require("../services/function");
const { v4: uuidv4 } = require('uuid');


const createNewUser = async (signupData) => {
    try {

        let maxId = await functions.getMaxID(User);
        if (!maxId) {
            maxId = 0;
        }
        const _id = Number(maxId) + 1;

        const hashPassword = await hashUserPassword(signupData.password);
        newUser = await User.create({
            _id: _id,
            name: signupData.name,
            email: signupData.email,
            password: hashPassword,
            authType: 'local',
            image: signupData.image,
            address: signupData.address,
            gender: signupData.gender === '1' ? 'male' : 'female',
            phoneNumber: signupData.phoneNumber,
            role: 'user',
            // slug: slug,
        });
        const token = generateToken(newUser);
        return {
            token,
        };
    } catch (error) {
        throw error;
    }
};

const checkLogin = async (loginData) => {
    try {
        // Kiểm tra thông tin đăng nhập
        const user = await User.findOne({ email: loginData.username });

        if (!user) {
            return res.send('Invalid email or password');
        }

        // Kiểm tra mật khẩu
        const isPasswordValid = await bcrypt.compare(
            loginData.password,
            user.password,
        );
        // console.log(isPasswordValid);

        if (!isPasswordValid) {
            return res.send('Invalid email or password');
        }

        // Tạo token
        const token = generateToken(user);

        // Trả về thông tin người dùng và token
        return {
            token
        }
    } catch (error) {
        throw error;
    }
}

const generateToken = (user) => {
    const token = jwt.sign({ user }, process.env.SECRETKEY, {
        expiresIn: '1d',
    });
    return token;
};

const hashUserPassword = async (password) => {
    try {
        const hashPassword = await bcrypt.hashSync(password, salt);
        return hashPassword;
    } catch (error) {
        throw error;
    }
};

const loginSuccessService = (id, tokenLogin) => new Promise(async (resolve, reject) => {
    try {
        const newTokenLogin = uuidv4()
        let response = await User.findOne({
            where: { id, tokenLogin },
            raw: true
        })
        const token = response && jwt.sign({ id: response.id, email: response.email, role: response.role }, 'hip06', { expiresIn: '5d' })
        resolve({
            err: token ? 0 : 3,
            msg: token ? 'OK' : 'User not found or fail to login !',
            token
        })
        if (response) {
            await User.update({
                tokenLogin: newTokenLogin
            }, {
                where: { id }
            })
        }

    } catch (error) {
        reject({
            err: 2,
            msg: 'Fail at auth server ' + error
        })
    }
})

const upsertUser = async (authType, dataRaw) => {
    try {

        let user = null
        let maxId = await functions.getMaxID(User);
        if (!maxId) {
            maxId = 0;
        }
        const _id = Number(maxId) + 1;

        if (authType === 'google') {
            user = await User.findOne({
                email: dataRaw.email,
                authType: authType
            }).exec()

            if (!user) {
                user = await User.create({
                    _id: _id,
                    name: dataRaw.name,
                    email: dataRaw.email,
                    image: dataRaw.image,
                    authType: authType,
                })
            }
        }

        const token = jwt.sign({ user }, process.env.SECRETKEY, {
            expiresIn: '1d',
        });
        // console.log(token)
        return token;

    } catch (error) {
        return error
    }
}

module.exports = { createNewUser, checkLogin, loginSuccessService, upsertUser };
