const express = require("express");
const router = express.Router();
const televisionController = require("../../app/controllers/categories/televisionController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/showProduct", televisionController.showProduct);

module.exports = router;
