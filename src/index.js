require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const multer = require("multer");
const route = require("./routes");
const cors = require("cors");
const session = require('express-session');
const passport = require('passport');

const db = require("./config/db");
const {verifyToken} = require("./app/middlewares/verifyToken");
db.connect();

const app = express();
const port = process.env.PORT || 8080;
const upload = multer();

app.use(
    cors({
        origin: [
            "https://next-store-kohl.vercel.app",
            "http://localhost:3000",
            "https://admindashboard-red.vercel.app",
            "http://169.254.223.87:3001",
            "http://localhost:3001",
            "http://localhost:8081",
            "exp://192.168.0.101:8081"
        ],
        methods: "GET, HEAD, PUT, PATCH, POST, DELETE",
    })
);
app.use(upload.none());

app.use(
    express.urlencoded({
        extended: true,
    })
);
app.use(express.json());

app.use(session({
    secret: 'diepton012707',
    resave: false,
    saveUninitialized: false
}));

// app.use(passport.initialize());
// app.use(passport.session());

route(app);

app.listen(port, () => {
    console.log(`App listening on port http://localhost:${port}`);
});
