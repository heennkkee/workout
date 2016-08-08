/*global require, console */
var port = 80;
var file = 'data/data.sqlite';

// Require the modules we need
var http = require('http');
var sqlite3 = require("sqlite3").verbose();
var favicon = require('serve-favicon');
var finalhandler = require('finalhandler');

// the db
var db = new sqlite3.Database(file);

//favicon
var favicon = favicon(__dirname + '/media/favicon.ico');

// Create a http server with a callback handling all requests
var httpServer = http.createServer(function (req, res) {
    console.log((new Date()) + ' Received request for ' + req.url);

    var done = finalhandler(req, res);
    var params, dest;

    favicon(req, res, function onNext(err) {
      if (err) return done(err);
      var params = req.url.split('/');
      params = params.slice(1, params.length);
      dest = params.shift();
      console.log(dest);
      res.write("<html><head>");
      res.write("<title>Gymapp</title>");
      if (dest === 'setup') {
          createTables();
          res.end('</head><body><h1>Tabeller skapade.</h1><a href="/">Tillbaka</a></body></html>');
      } else {
          res.write("</head><body>");
          res.write("<h1>Hej Henrik!</h1>");
          res.write("<table>");
          db.all("SELECT ID, TEXT FROM data", function(err, rows) {
              rows.forEach(function (row) {
                  res.write("<tr><td>" + row.ID + "</td><td>" + row.TEXT + "</tr>");
              });
              res.end('</body></html>');
          });
      }
    });
});

httpServer.listen(port, function () {
    console.log((new Date()) + ' HTTP server is listening on port ' + port);
});

function createTables() {
    console.log("creating tables");
    db.run('CREATE TABLE IF NOT EXISTS "PERSON" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE , "NAMN" VARCHAR NOT NULL  UNIQUE )');
    db.run('CREATE TABLE IF NOT EXISTS "OVNINGAR" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE , "NAMN" VARCHAR NOT NULL  UNIQUE )');
}
