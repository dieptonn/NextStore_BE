const express = require("express");
const router = express.Router();
const washingMachineController = require("../../app/controllers/categories/washingMachineController");
const verifyToken = require("../../app/middlewares/verifyToken");

router.get("/showProduct", verifyToken.verifyToken, washingMachineController.showProduct);
router.post("/showProductDetail", washingMachineController.showProductDetail);

module.exports = router;
