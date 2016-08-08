/* Globals require */
var port = 80;

// Require the modules we need
var http = require('http');

// Create a http server with a callback handling all requests
var httpServer = http.createServer(function(req, res) {
  console.log((new Date()) + ' Received request for ' + req.url);
  res.writeHead(200, {'Content-type': 'text/HTML'});
  res.end('<html><head></head><body><h1>Hej</h1></body></html>');
});

httpServer.listen(port, function() {
  console.log((new Date()) + ' HTTP server is listening on port ' + port);
});
