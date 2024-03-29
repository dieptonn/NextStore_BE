const express = require("express");
const router = express.Router();
const exportCsv = require("../app/controllers/exportCsv");
const verifyToken = require("../app/middlewares/verifyToken");

router.get("/priceExtraction", exportCsv.priceExtraction);



module.exports = router;
