const express = require("express");
const router = express.Router();
const verifyToken = require("../app/middlewares/verifyToken");
const userController = require("../app/controllers/userController");

router.get("/profile", userController.getProfile);

module.exports = router;
