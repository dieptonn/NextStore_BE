const { ObjectId } = require('mongoose').Types;
const User = require('../models/User');

const createUser = async ({ 
        email,
        name, 
        hashPassword,
        image,
        address,
        gender ,
        phoneNumber,
        role,
 }) => {

    let normalizedGender = 'unknown';
    if (gender === '1') {
        normalizedGender = 'male';
    } else if (gender === '2') {
        normalizedGender = 'female';
    }

    const user = await User.create({ 
        email,
        name,
        password: hashPassword,
        image,
        address,
        gender: normalizedGender,
        phoneNumber,
        role: 'user',
     });
    return user;
};

const findUser = async (condition) => {
    if (ObjectId.isValid(condition)) {
        const user = await User.findById(condition);
        return user;
    }

    if (typeof condition === 'object' && condition !== null) {
        const user = await User.findOne(condition);
        return user;
    }

    return null;
};

const updateUser = async (userId, data) => {
    const user = await User.findByIdAndUpdate(userId, data, { new: true });
    return user;
};

const deleteUser = async (userId) => {
    await User.findByIdAndDelete(userId);
};

module.exports = { createUser, findUser, updateUser, deleteUser };
