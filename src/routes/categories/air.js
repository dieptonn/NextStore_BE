const express = require("express");
const router = express.Router();
const airController = require("../../app/controllers/categories/airController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/showProduct", verifyToken.verifyToken, airController.showProduct);

module.exports = router;
