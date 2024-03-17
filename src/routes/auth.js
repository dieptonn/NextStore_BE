const express = require('express');
const router = express.Router();
const authController = require('../app/controllers/authController');
const passport = require('../app/controllers/passport');


router.post('/login', authController.login);
router.post('/signup', authController.signup);

router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: `${process.env.URL_CLIENT}/login` }),
    function (req, res) {
        // Successful authentication, redirect home.
        console.log(req.user)
        res.redirect(process.env.URL_CLIENT);
    });

// router.post('/login-success', authController.loginSuccess)

module.exports = router;
