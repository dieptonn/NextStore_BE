const User = require('../models/User');
const authService = require('../../services/authService');
const { response } = require('express');
const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const loginData = req.body;
    try {
        const data = await authService.checkLogin(loginData);
        return res.status(200).json({
            status: 'success',
            data
        });
    } catch (error) {
        return res.send({ 'Login failed, error': error });
    }
};

const signup = async (req, res) => {
    const signupData = req.body;
    // console.log(signupData);
    try {
        const data = await authService.createNewUser(signupData);
        return res.status(200).json({
            status: 'success',
            data,
        });
    } catch (error) {
        return res.send({
            'Please double check your information, maybe this account has been registered before': error
        }
        );
    }
};

module.exports = { login, signup };
