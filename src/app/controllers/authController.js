const User = require('../models/User');
const authService = require('../../services/authService');
const {response} = require('express');
const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const loginData = req.body;
    try {
        const data = await authService.checkLogin(loginData);
        console.log(data.token)
        return res.status(200).json({
            status: 'success',
            data
        });
    } catch (error) {
        return res.send({'Login failed, error': error});
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

const loginSuccess = async (req, res) => {
    const {id, tokenLogin} = req?.body
    try {
        if (!id || !tokenLogin) res.status(400).json({
            err: 1,
            msg: 'Missing inputs'
        })
        let response = await authService.loginSuccessService(id, tokenLogin)
        res.status(200).json(response)

    } catch (error) {
        res.status(500).json({
            err: -1,
            msg: 'Fail at auth controller ' + error
        })
    }
}

module.exports = {login, signup, loginSuccess};
