const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getProfile = async (req, res) => {
    const authorization = req.header('Authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({message: 'Token không hợp lệ hoặc thiếu header Authorization'});
    }

    const token = authorization.replace('Bearer ', '');

    try {
        const {user} = jwt.verify(token, process.env.SECRETKEY);

        const userId = user._id;

        const userInfo = await User.findById(userId);

        return res.status(200).json({
            status: 'success',
            data: userInfo
        });

    } catch (err) {
        return res.status(403).json({message: 'Token lỗi hoặc hết hạn', error: err.message});
    }
};


module.exports = {getProfile};
