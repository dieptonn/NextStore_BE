const express = require("express");
const router = express.Router();
const cookerController = require("../../app/controllers/categories/cookerController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/showProduct", verifyToken.verifyToken, cookerController.showProduct);

module.exports = router;
