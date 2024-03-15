const GGUser = require('../models/GGUser');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const callbackURL = `http://localhost:${process.env.PORT}/api/v1/auth/google/callback`;

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL
},
    // function (accessToken, refreshToken, profile, cb) {
    //     GGUser.findOrCreate({ googleId: profile.id }, function (err, user) {
    //         return cb(null, profile);
    //     });
    // }
    function (accessToken, refreshToken, profile, cb) {
        return cb(null, profile);
    }
));


module.exports = passport;