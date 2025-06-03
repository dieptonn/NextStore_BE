const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getProfile = async (req, res) => {

    const authorization = req.header('Authorization');

    const token = authorization.replace('Bearer ', '');
    // console.log(token);

    const {user} = jwt.verify(token, process.env.SECRETKEY);

    const userId = user._id

    const userInfo = await User.findById(userId)
    console.log(userInfo);

    return res.status(200).json({
        status: 'success',
        data: userInfo
    });
};


module.exports = {getProfile};
