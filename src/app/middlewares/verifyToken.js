const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
    const authorization = req.header('Authorization');

    if (!authorization) {
        ``
        return res.status(401).json({error: 'Unauthorized'});
    }
    //get token
    const token = authorization.replace('Bearer ', '');
    // console.log(token);

    //verify token
    try {
        const {user} = jwt.verify(token, process.env.SECRETKEY);

        const userId = user._id
        // console.log(userId);

        const userConfirm = await User.findById(userId)

        if (userConfirm) {
            next();
        } else {
            return res.send('User not found')
        }
    } catch (error) {
        return res.status(401).json({error: 'Invalid token'});
    }
};

const generateAccessToken = async () => {
    try {
        if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
            throw new Error("MISSING_API_CREDENTIALS");
        }
        const auth = Buffer.from(
            process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET,
        ).toString("base64");
        const response = await fetch(`${process.env.base}/v1/oauth2/token`, {
            method: "POST",
            body: "grant_type=client_credentials",
            headers: {
                Authorization: `Basic ${auth}`,
            },
        });

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Failed to generate Access Token:", error);
    }
};

module.exports = {verifyToken, generateAccessToken};
