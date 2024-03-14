const User = require('../app/models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const salt = bcrypt.genSaltSync(10);
const functions = require("../services/function");

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
            image: signupData.image,
            address: signupData.address,
            gender: signupData.gender === '1' ? 'male' : 'female',
            phoneNumber: signupData.phoneNumber,
            role: 'user',
            // slug: slug,
        });
        const token = generateToken(newUser._id);
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
        const token = generateToken(user._id);

        // Trả về thông tin người dùng và token
        return {
            token
        }
    } catch (error) {
        throw error;
    }
}

const generateToken = (userId) => {
    const token = jwt.sign({ userId }, process.env.SECRETKEY, {
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


module.exports = { createNewUser, checkLogin };
