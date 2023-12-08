const express = require("express");
const router = express.Router();
const robotController = require("../../app/controllers/categories/robotController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/showProduct", verifyToken.verifyToken, robotController.showProduct);

module.exports = router;
