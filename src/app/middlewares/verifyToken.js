const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authorization = req.header('Authorization');

    if (!authorization) {``
        return res.status(401).json({ error: 'Unauthorized' });
    }
    //get token
    const token = authorization.replace('Bearer ', '');
    // console.log(token);

    //verify token
    try {
        const { userId } = jwt.verify(token, process.env.SECRETKEY);
        // console.log(userId);
        req.user = { userId };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = { verifyToken };
