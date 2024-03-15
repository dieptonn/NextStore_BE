const express = require('express');
const router = express.Router();
const authController = require('../app/controllers/authController');
const passport = require('../app/middlewares/passport');


router.post('/login', authController.login);
router.post('/signup', authController.signup);

router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', (err, profile) => {
        req.user = profile
        next()
    })(req, res, next)
}, (req, res) => {
    res.redirect(`${process.env.URL_CLIENT}/login-success/${req.user?.id}/${req.user.tokenLogin}`)
})

router.post('/login-success', authController.loginSuccess)

module.exports = router;
