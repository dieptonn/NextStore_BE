const express = require("express");
const router = express.Router();
const filter = require("../app/controllers/filterController");


router.post("/sort", filter.sort);


module.exports = router;
