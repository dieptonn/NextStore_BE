const express = require("express");
const router = express.Router();
const fridgeController = require("../../app/controllers/categories/fridgeController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/showProduct", verifyToken.verifyToken, fridgeController.showProduct);

module.exports = router;
