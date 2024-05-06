
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../../services/authService')
const { v4: uuidv4 } = require('uuid');

const callbackURL = `${process.env.URL_SERVER}/api/v1/auth/google/callback`;

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL
},
    async function (accessToken, refreshToken, profile, cb) {

        // console.log({ accessToken: accessToken, refreshToken: refreshToken, profile: profile, cb: cb });
        const authType = 'google'
        let dataRaw = {
            name: profile.displayName,
            email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : '',
            image: profile._json.picture,
            googleId: profile.id
        }
        let userToken = await authService.upsertUser(authType, dataRaw);
        console.log(userToken)
        // user.code = uuidv4();
        return cb(null, userToken)
    }
));


// Cấu hình serializeUser
passport.serializeUser(function (user, done) {
    done(null, user); // Lưu trữ toàn bộ đối tượng người dùng vào phiên
});

// Cấu hình deserializeUser (nếu cần)
passport.deserializeUser(function (obj, done) {
    done(null, obj); // Deserialize user từ thông tin lưu trữ trong phiên
});


module.exports = passport;