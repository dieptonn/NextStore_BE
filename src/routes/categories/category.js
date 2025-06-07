const express = require("express");
const router = express.Router();
const categoryController = require("../../app/controllers/categories/categoryController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/get-all", categoryController.getAll);

module.exports = router;
