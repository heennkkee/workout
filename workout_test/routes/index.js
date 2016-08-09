var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    var test = "Henrika";
  res.render('index', { title: test });
});

module.exports = router;
