/*global require, console */
var port = 80;
var file = 'data/data.sqlite';

// Require the modules we need
var http = require('http');
var sqlite3 = require("sqlite3").verbose();
var fs = require('fs');

// the db
var db = new sqlite3.Database(file);
db.exec('PRAGMA foreign_keys = ON');

//favicon


// Create a http server with a callback handling all requests
var httpServer = http.createServer(function (req, res) {
    var url, method, dest, params, temp, fileName, postBody = [], postData, getData;

    url = req.url.split('?')[0];
    getData = url.split('?');
    getData.shift();
    method = req.method;

    if (method === 'POST') {
        req.on('data', function (chunk) {
            postBody.push(chunk);
        }).on('end', function() {
            //console.log("postData: ", Buffer.concat(postBody).toString());
            postData = splitQueryString(Buffer.concat(postBody).toString());
            switch (postData.command) {
                case 'newOvning':
                    db.run('INSERT INTO OVNINGAR (NAMN) VALUES(?)', postData.namn, function () {
                        res.writeHead(302, {
                            'Location': '/ovningar'
                            // 'Location': '/ovningar/edit/' + this.lastID
                        });
                        res.end();
                    });
                    break;
                case 'editOvning':
                    db.run('UPDATE OVNINGAR SET NAMN = ? WHERE ID = ?', postData.namn, postData.id, function () {
                        res.writeHead(302, {
                            'Location': '/ovningar'
                        });
                        res.end();
                    });
                    break;
                case 'newPerson':
                    db.run('INSERT INTO PERSONER (NAMN) VALUES(?)', postData.namn, function () {
                        res.writeHead(302, {
                            'Location': '/personer'
                        });
                        res.end();
                    });
                    break;
                case 'editPerson':
                    db.run('UPDATE PERSONER SET NAMN = ?, AKTIV = ? WHERE ID = ?', postData.namn, ((postData.aktiv === undefined) ? 0 : 1), postData.id, function () {
                        res.writeHead(302, {
                            'Location': '/personer'
                        });
                        res.end();
                    });
                    break;
                case 'addHistory':
                    db.run("INSERT INTO HISTORY (PERSON_ID, OVNING_ID, VIKT, ANTAL, DATUM) VALUES(?, ?, ?, ?, datetime('now', 'localtime'))", postData['person_id'], postData['ovning_id'], postData.vikt, postData.antal, function () {
                        res.writeHead(302, {
                            'Location': req.headers.referer
                        });
                        res.end();
                    })
                    break;
                default:
                    res.writeHead(302, {
                        'Location': req.headers.referer
                    });
                    res.end();
            }
        });

    } else {
        params = url.split('/');
        params = params.slice(1, params.length);

        //our destination url
        dest = params.shift();

        //Filter the parameters to be undefined instead of stupid stuff
        params = params.map(function(val){if(val === ''){return undefined}return val;});

        if (dest === 'favicon.ico') {
            var img = fs.readFileSync('include/media/favicon.ico');
            res.writeHead(200, {'Content-Type': 'image/ico' });
            res.end(img, 'binary');
            return;
        } else if (dest === 'include') {
            fileName = params.pop();
            var file = fs.readFileSync('include/' + params.join('/') + '/' + fileName);
            var ext = fileName.split('.')[1];
            var header = 'plain/text';

            if (ext === 'svg') {
                header = 'image/svg+xml';
            }
            res.writeHead(200, {'Content-Type': header});
            res.end(file, 'binary');
            return;
        }
        console.log("dest: " + dest);


        // START STUFF HERE
        HTMLStart(res);

        switch (dest) {
            case 'setup':
            createTables();
            res.write('<h1>Tabeller skapade.</h1><a href="/">Tillbaka</a>');
            res.write('<br><img src="favicon.ico"></img>');
            end(res);
            break;
            case 'historik':
                var x;
                db.all('SELECT * FROM HISTORIK_VIEW ORDER BY DATUM ASC', function (err, rows) {
                    res.write('<table>');
                    res.write('<tr>');
                    for (x in rows[0]) {
                        res.write('<th>' + x + '</th>');
                    }
                    res.write('</tr>');
                    for (x = 0; x < rows.length; x += 1) {
                        console.log(rows[x]);
                        res.write('<tr><td>' + rows[x].Person + '</td><td>' + rows[x].Ovning + '</td><td>' + rows[x].VIKT + '</td><td>' + rows[x].ANTAL + '</td><td>' + rows[x].DATUM + '</td></tr>');
                    }
                    res.write('</table>');
                    end(res);
                });
                break;
            case 'ovningar':
            if (params[0] === 'new') {
                readTemplate('createOvning', res);
                end(res);
            } else if (params[0] === 'edit') {
                var id = Number(params[1]);
                if (!isNaN(id)) {
                    db.get('SELECT NAMN FROM OVNINGAR WHERE ID = ?', [id], function (err, row) {
                        read('editOvning', {'ID': id, 'NAMN': row.NAMN}, res);
                        end(res);
                    });
                } else {
                    res.write('<p>ID <code>' + id + '</code> is not a number.</p>');
                    end(res);
                }
            } else {
                readTemplate('ovningar', res);
                db.all("SELECT ID, NAMN FROM OVNINGAR", function(err, rows) {
                    if (rows.length === 0) {
                        res.write('<p>Inga övningar att visa.</p>');
                    } else {
                        res.write('<table>');
                        rows.forEach(function (row) {
                            console.log(row);
                            res.write("<tr><td>" + row.ID + "</td><td>" + row.NAMN + "</td><td><a class='pointer' href='/ovningar/edit/" + row.ID + "'><i class='me material-icons'>mode_edit</i></a></td></tr>");
                        });
                        res.write('</table>');
                    }
                    end(res);
                });
            }
                break;
            case '':
                res.write('startpage');
                end(res);
                break;
            case 'gym':
                var check = false, check1 = false, personer = '', ovningar = '', x;
                db.serialize(function () {
                    db.all('SELECT ID, NAMN FROM PERSONER WHERE AKTIV = 1', function (err, rows) {
                        for (x = 0; x < rows.length; x += 1) {
                            personer += '<option value="' + rows[x].ID + '">' + rows[x].NAMN + '</option>';
                        }
                        check = true;
                        if (check && check1) {
                            read('addHistory', {PERSONER: personer, OVNINGAR: ovningar}, res);
                            end(res);
                        }
                    });
                    db.all('SELECT ID, NAMN FROM OVNINGAR', function (err, rows) {
                        for (x = 0; x < rows.length; x += 1) {
                            ovningar += '<option value="' + rows[x].ID + '">' + rows[x].NAMN + '</option>';
                        }
                        check1 = true;
                        if (check && check1) {
                            read('addHistory', {PERSONER: personer, OVNINGAR: ovningar}, res);
                            end(res);
                        }
                    });

                });
                break;
            case 'personer':
                if (params[0] === 'new') {
                    readTemplate('newPerson', res);
                    end(res);
                } else if (params[0] === 'edit') {
                    id = Number(params[1]);
                    if (!isNaN(id)) {
                        db.get('SELECT NAMN, AKTIV FROM PERSONER WHERE ID = ?', id, function (err, row) {
                            read('editPerson', {ID: id, NAMN: row.NAMN, AKTIV: ((row.AKTIV === 1) ? 'checked' : '')}, res);
                            end(res);
                        });
                    } else {
                        res.write('<p>ID <code>' + id + '</code> is not a number.</p>');
                        end(res);
                    }
                } else {
                    readTemplate('personer', res);
                    db.all("SELECT ID, NAMN, AKTIV FROM PERSONER", function(err, rows) {
                        if (rows.length === 0) {
                            res.write('<p>Inga personer registrerade.</p>');
                        } else {
                            res.write('<table>');
                            rows.forEach(function (row) {
                                console.log(row);
                                res.write("<tr><td>" + row.ID + "</td><td>" + row.NAMN + "</td>" +
                                "<td>- " + ((row.AKTIV === 1) ? 'Aktiv' : 'Ej aktiv') + "</td>" +
                                "<td><a class='pointer' href='/personer/edit/" + row.ID + "'><i class='me material-icons'>mode_edit</i></a></tr>");
                            });
                            res.write('</table>');
                        }
                        end(res);
                    });
                }
                break;
            default:
            res.write("<h1>Such 404, very wow.</h1>");
            end(res);
        }
    }


});

httpServer.listen(port, function () {
    console.log((new Date()) + ' HTTP server is listening on port ' + port);
});

function HTMLStart(res) {
    readTemplate('htmlHead', res);
    readTemplate('header', res);
}

function splitQueryString(input) {
    var temp, temp2, x, retObj = {};
    temp = input.split('&');
    for (x = 0; x < temp.length; x += 1) {
        temp2 = temp[x].split('=');
        retObj[temp2[0]] = decodeURIComponent(temp2[1]).replace(/\+/g, ' ').replace(/[^a-zA-Z0-9åÅäÄöÖ\s]+/g, '*');
    }
    return retObj;
}

function end(res) {
    readTemplate('footer', res);
    res.end('</div></body></html>');
}

function readTemplate(name, res) {
    var file = fs.readFileSync('include/html/' + name + '.html');
    res.write(file, 'binary');
}

function read(name, replaces, res) {
    var x, regex, file = fs.readFileSync('include/html/' + name + '.html');
    file = file.toString();
    for (x in replaces) {
        regex = new RegExp('#' + x + '#', 'g');
        file = file.replace(regex, replaces[x]);
    }
    res.write(file);
}

function createTables() {
    console.log("creating tables");
    db.serialize(function () {

        db.run('CREATE TABLE IF NOT EXISTS "PERSONER" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE ON CONFLICT IGNORE , "NAMN" VARCHAR NOT NULL  UNIQUE ON CONFLICT IGNORE, "AKTIV" INTEGER DEFAULT 1)');
        db.run('INSERT INTO PERSONER (NAMN) VALUES("Henrik")');

        db.run('CREATE TABLE IF NOT EXISTS "OVNINGAR" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE ON CONFLICT IGNORE , "NAMN" VARCHAR NOT NULL  UNIQUE ON CONFLICT IGNORE )');
        db.run('INSERT INTO OVNINGAR (NAMN) VALUES("Marklyft")');
        db.run('INSERT INTO OVNINGAR (NAMN) VALUES("Bänkpress")');

        db.run('CREATE TABLE IF NOT EXISTS "HISTORIK" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , "VIKT" DOUBLE NOT NULL , "ANTAL" INTEGER NOT NULL, "PERSON_ID" INTEGER NOT NULL, "OVNING_ID" INTEGER NOT NULL, "DATUM" DATETIME, FOREIGN KEY("PERSON_ID") REFERENCES PERSONER(ID), FOREIGN KEY("OVNING_ID") REFERENCES OVNINGAR(ID))');

        db.run('CREATE VIEW IF NOT EXISTS "historik_view" AS  SELECT p.NAMN AS "Person", o.NAMN AS "Ovning", h.VIKT, h.ANTAL, h.DATUM FROM HISTORIK h JOIN PERSONER p ON h.PERSON_ID = p.ID JOIN OVNINGAR o ON h.OVNING_ID = o.ID');

        db.run('CREATE TABLE IF NOT EXISTS "PASS" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE ON CONFLICT IGNORE , "NAMN" VARCHAR NOT NULL  UNIQUE ON CONFLICT IGNORE )', function () {
            console.log("tables created");
        });
    });
}
