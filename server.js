/*global require, console */
var port = 80;
var file = 'data/data.sqlite';

// Require the modules we need
var http = require('http');
var sqlite3 = require("sqlite3").verbose();
var fs = require('fs');
var rq = require('request');

// the db
var db = new sqlite3.Database(file);

//favicon


// Create a http server with a callback handling all requests
var httpServer = http.createServer(function (req, res) {
    var dest, params, temp, temp2, post;

    if (req.method === 'POST') {
        console.log((req));
        console.log(req.headers.referer);
    }


    params = req.url.split('/');
    params = params.slice(1, params.length);
    dest = params.shift();

    params = params.map(function(val){if(val === ''){return undefined}return val;});

    if (dest === 'favicon.ico') {
        var img = fs.readFileSync('include/media/favicon.ico');
        res.writeHead(200, {'Content-Type': 'image/ico' });
        res.end(img, 'binary');
        return;
    }
    if (dest === 'include') {
        temp = params.pop();
        temp2 = params.join('/');
        var file = fs.readFileSync('include/' + temp2 + '/' + temp);
        res.writeHead(200, {'Content-Type': 'plain/text'});
        res.end(file, 'binary');
        return;
    }
    console.log("dest: " + dest);


    // START STUFF HERE
    HTMLStart(res);

    switch (dest) {
        case 'setup':
            headEnd(res);
            createTables();
            res.write('<h1>Tabeller skapade.</h1><a href="/">Tillbaka</a>');
            res.write('<br><img src="favicon.ico"></img>');
            end(res);
            break;
        case 'ovningar':
            if (params[0] === undefined || (params[0] === 'ID' && params[1] === undefined)) {
                db.all("SELECT ID, NAMN FROM OVNINGAR", function(err, rows) {
                    if (rows.length === 0) {
                        res.write('<p>Inga övningar att visa.</p>');
                    } else {
                        res.write('<table>');
                        rows.forEach(function (row) {
                            res.write("<tr><td>" + row.ID + "</td><td>" + row.TEXT + "</tr>");
                        });
                        res.write('</table>');
                    }
                    end(res);
                });
            } else if (params[0] === 'ID' && params[1] !== undefined) {
                var id = Number(params[1]);
                if (!isNaN(id)) {
                    db.all("SELECT ID, NAMN FROM OVNINGAR WHERE ID = " + id, function(err, rows) {
                        if (rows.length === 0) {
                            res.write('<p>Inga övningar att visa.</p>');
                        } else {
                            res.write('<table>');
                            rows.forEach(function (row) {
                                res.write("<tr><td>" + row.ID + "</td><td>" + row.TEXT + "</tr>");
                            });
                            res.write('</table>');
                        }
                        end(res);
                    });
                } else {
                    res.write('<p>ID <code>' + id + '</code> is not a number.</p>');
                    end(res);
                }
            } else if (params[0] === 'new') {
                res.write('<h1>Skapa ny övning</h1>');
                readTemplate('createOvning', res);
                end(res);
            } else {
                res.write('Unhandled param.');
                end(res);
            }
            break;
        default:
            headEnd(res);
            res.write("<h1>Hej Henrik!</h1>");
            end(res);
    }
});

httpServer.listen(port, function () {
    console.log((new Date()) + ' HTTP server is listening on port ' + port);
});

function HTMLStart(res) {
    readTemplate('htmlHead', res);
}

function headEnd(res) {
    res.write('</head><body>');
}

function end(res) {
    res.end('</body></html>');
}

function readTemplate(name, res) {
    var file = fs.readFileSync('templates/' + name + '.html');
    res.write(file, 'binary');
}

function createTables() {
    console.log("creating tables");
    db.run('CREATE TABLE IF NOT EXISTS "PERSON" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE , "NAMN" VARCHAR NOT NULL  UNIQUE )');
    db.run('CREATE TABLE IF NOT EXISTS "OVNINGAR" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE , "NAMN" VARCHAR NOT NULL  UNIQUE )');
    db.run('CREATE TABLE IF NOT EXISTS "PASS" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE , "NAMN" VARCHAR NOT NULL  UNIQUE )');
}
