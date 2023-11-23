const authRouter = require('./auth');
const homeRouter = require('./home');

function route(app) {
    app.use('/api/v1/auth', authRouter);
    app.use('/api/v1/home', homeRouter);
}

module.exports = route;
