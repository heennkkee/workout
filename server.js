/*global require, console */
var port = 80;
var file = 'data/data.sqlite';

// Require the modules we need
var http = require('http');
var sqlite3 = require("sqlite3").verbose();
var fs = require('fs');
var nodemailer = require('nodemailer');
var cookies = require('cookies');
var md5 = require('md5');
var speakeasy = require('speakeasy');

var jar;
var secret = speakeasy.generateSecret({length: 20});

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'henrik.aronsson.94@gmail.com',
        pass: 'djsuwcsqtizfiiwh'
    }
});

// the db
var db = new sqlite3.Database(file);
db.exec('PRAGMA foreign_keys = ON');

//favicon


// Create a http server with a callback handling all requests
var httpServer = http.createServer(function (req, res) {
    var url, method, dest, params, temp, fileName, postBody = [], postData, getData,
        today = new Date(), holdGeneration = false;

    jar = new cookies(req, res);



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
                case 'logout':
                    db.run('DELETE FROM LOGINS WHERE HASH = ?', jar.get('longCookie'), function (err, rows) {
                        jar.set('shortCookie', 'test', {expires: new Date(2015, 0, 0)});
                        jar.set('longCookie', 'test', {expires: new Date(2015, 0, 0)});
                        res.writeHead(302, {
                            'Location': '/'
                        });
                        end(res);
                    });
                    break;
                case 'validate':
                    var token = speakeasy.totp({
                      secret: secret.base32,
                      encoding: 'base32',
                      step: 300
                    });
                    db.get("SELECT COALESCE(LASTMAIL, datetime('now', 'localtime')) AS 'LASTMAIL', UNUSED_CODES FROM WHITELIST WHERE MAIL = ?", postData.email, function (err, row) {
                        HTMLStart(res);
                        if (row === undefined) {
                            read('validate', {RESULT: '<p class="red">' + postData.email + ' är inte godkännd.</p>'}, res);
                        } else {
                            var lastmail = new Date(row.LASTMAIL);
                            lastmail.setMinutes(lastmail.getMinutes() + Math.pow(row['UNUSED_CODES'], 2) * 5)
                            if (new Date() > lastmail) {
                                db.run("UPDATE WHITELIST SET UNUSED_CODES = UNUSED_CODES + 1, LASTMAIL = datetime('now', 'localtime') WHERE MAIL = ?", postData.email);
                                var mailOptions = {
                                    from: '"Henrik @ Ryggbiffarna" <henrik.aronsson.94@gmail.com>', // sender address
                                    to: postData.email, // list of receivers
                                    subject: 'Verification code', // Subject line
                                    text: 'Validate with code ' + token + ', code is valid for 5 minutes.' // plaintext body
                                };
                                transporter.sendMail(mailOptions, function(error, info){
                                    if(error){
                                        return console.log(error);
                                    }
                                    console.log('Message sent: ' + info.response);
                                });
                                read('validateCode', {RESULT: '', EMAIL: postData.email}, res);
                            } else {
                                read('validate', {RESULT: '<p class="red">Du måste vänta till ' + lastmail + ' innan några fler mail skickas till den addressen.</p>'}, res);
                            }
                        }
                        end(res);
                    });

                    break;
                case 'validateCode':
                    console.log(postData);
                    var tokenValidates = speakeasy.totp.verify({
                      secret: secret.base32,
                      encoding: 'base32',
                      token: postData.code,
                      step: 300
                    });
                    if (tokenValidates) {
                        var hash = md5(today + '|' + postData.code);
                        jar.set('longCookie', hash, {expires: new Date(today.getFullYear() + 10, today.getMonth(), today.getDate())});
                        db.run('INSERT INTO LOGINS (MAIL, HASH) VALUES(?, ?)', postData.email, hash, function (err, row) {
                            res.writeHead(302, {
                                'Location': '/'
                            });
                            end(res);
                        });
                        db.run("UPDATE WHITELIST SET UNUSED_CODES = 0 WHERE MAIL = ?", postData.email);
                    } else {
                        HTMLStart(res);
                        read('validateCode', {RESULT: '<p class="red">Koden validerade inte.</p>', EMAIL: postData.email}, res);
                        end(res);
                    }
                    break;
                case 'editPass':
                    db.run('DELETE FROM PASS_OVNINGAR WHERE PASS_ID = ?', postData.PID, function (err, rows) {
                        db.run('UPDATE PASS SET NAMN = ? WHERE ID = ?', postData.namn, postData.ID);
                        for (x in postData.aktiv) {
                            db.run('INSERT INTO PASS_OVNINGAR (PASS_ID, OVNING_ID) VALUES(?, ?)', postData.PID, postData.aktiv[x]);
                        }
                        res.writeHead(302, {
                            'Location': '/pass'
                        });
                        end(res);
                    })
                    break;
                case 'newPass':
                    var x;
                    db.serialize(function() {
                        db.run('INSERT INTO PASS (NAMN) VALUES(?)', postData.namn, function () {
                            for (x in postData.aktiv) {
                                db.run('INSERT INTO PASS_OVNINGAR (PASS_ID, OVNING_ID) VALUES(?, ?)', this.lastID, postData.aktiv[x]);
                            }
                            res.writeHead(302, {
                                'Location': '/pass'
                            });
                            end(res);
                        });
                    });
                    break;
                case 'newOvning':
                    db.run('INSERT INTO OVNINGAR (NAMN) VALUES(?)', postData.namn, function () {
                        res.writeHead(302, {
                            'Location': '/ovningar'
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
                    db.run("INSERT INTO HISTORIK (PERSON_ID, OVNING_ID, VIKT, ANTAL, DATUM) VALUES(?, ?, ?, ?, datetime('now', 'localtime'))", postData['person_id'], postData['ovning_id'], postData.vikt, postData.antal, function () {
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
            } else if (ext === 'css') {
                header = 'text/css';
            }
            res.writeHead(200, {'Content-Type': header});
            res.end(file, 'binary');
            return;
        }
        console.log("dest: " + dest);

        if (jar.get('shortCookie') !== undefined) {
            console.log('user is OK, proceed', jar.get('shortCookie'));
        } else if (jar.get('longCookie') === undefined) {
            console.log('user need to validate');
            dest = 'validate';
        } else {
            console.log('check against DB if cookie looks OK');
            holdGeneration = true;
            db.serialize(function() {
                db.get("SELECT MAIL, COUNT(*) AS 'count' FROM LOGINS WHERE HASH = ? GROUP BY MAIL", jar.get('longCookie'), function (err, row) {
                    if (row === undefined) {
                        dest = 'validate';
                        HTMLStart(res);
                        switchDest(res, req, dest, params);
                    } else if (row.count > 1) {
                        console.log("returned more than 1 result, clear all and validate.");
                        db.run('DELETE FROM LOGINS WHERE HASH = ?', jar.get('longCookie'), function (err, rows) {
                            jar.set('longCookie', 'test', {expires: new Date(2015, 0, 0)});
                            dest = 'validate';
                            HTMLStart(res);
                            switchDest(res, req, dest, params);
                        });
                    } else {
                        console.log("returned 1 result, casually assume everything is OK");
                        jar.set('shortCookie', row.MAIL, {expires: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)});
                        HTMLStart(res);
                        switchDest(res, req, dest, params);
                    }
                });
            });
        }

        // START STUFF HERE
        if (!holdGeneration) {
            HTMLStart(res);
            switchDest(res, req, dest, params);
        }
    }


});

httpServer.listen(port, function () {
    console.log((new Date()) + ' HTTP server is listening on port ' + port);
});

function switchDest(res, req, dest, params) {
    switch (dest) {
        case 'logout':
            readTemplate('confirmLogout', res);
            end(res);
            break;
        case 'validate':
            if (jar.get('shortCookie')) {
                readTemplate('index', res);
            } else {
                read('validate', {RESULT: ''}, res);
            }
            end(res);
            break;
        case 'pass':
        if (params[0] === 'new') {
            var x, ovningar = '';
            db.all('SELECT * FROM OVNINGAR', function (err, rows) {
                for (x in rows) {
                    ovningar += '<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="' + rows[x].NAMN + '">';
                    ovningar += '<input type="checkbox" id="' + rows[x].NAMN + '" value="' + rows[x].ID + '" name="aktiv" class="mdl-switch__input">';
                    ovningar += '<span class="mdl-switch__label">' + rows[x].NAMN + '</span>';
                    ovningar += '</label>';
                }
                read('newPass', {OVNINGAR: ovningar}, res);
                end(res);
            });
        } else if (params[0] === 'edit') {
            var id = Number(params[1]), passNAMN, passID, aktivaOvningar = [], ovningar = '';
            if (!isNaN(id)) {
                db.all("SELECT p.ID AS 'PID', p.NAMN AS 'PNAMN', o.ID AS 'OID' FROM PASS_OVNINGAR po JOIN PASS p ON po.PASS_ID = p.ID JOIN OVNINGAR o ON po.OVNING_ID = o.ID WHERE p.ID = ?", id, function (err, rows) {
                    passNAMN = rows[0].PNAMN;
                    passID = rows[0].PID;
                    for (x in rows) {
                        aktivaOvningar.push(rows[x].OID);
                    }
                    db.all("SELECT * FROM OVNINGAR", function (err, rows) {
                        for (x in rows) {
                            ovningar += '<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="' + rows[x].NAMN + '">';
                            ovningar += '<input ' + ((aktivaOvningar.indexOf(rows[x].ID) > -1) ? 'checked' : '') + ' type="checkbox" id="' + rows[x].NAMN + '" value="' + rows[x].ID + '" name="aktiv" class="mdl-switch__input">';
                            ovningar += '<span class="mdl-switch__label">' + rows[x].NAMN + '</span>';
                            ovningar += '</label>';
                        }

                        read('editPass', {PID: passID, PNAMN: passNAMN, OVNINGAR: ovningar}, res);
                        end(res);
                    });

                });
            } else {
                res.write('<p>ID <code>' + id + '</code> is not a number.</p>');
                end(res);
            }
        } else {
            var pass = '', x;
            db.all('SELECT * FROM PASS_VIEW', function (err, rows) {
                for (x in rows) {
                    pass += '<tr onclick="edit(' + "'pass'" + ', ' + rows[x].ID + ')" class="pointer"><td class="mdl-data-table__cell--non-numeric">' + rows[x].NAMN + '</td><td class="mdl-data-table__cell--non-numeric">' + rows[x].OVNINGAR + '</td></tr>\n';
                }
                read('showPass', {BODYROWS: pass}, res);
                end(res);
            });
        }
        break;
        case 'setup':
        createTables();
        res.write('<h1>Tabeller skapade.</h1><a href="/">Tillbaka</a>');
        res.write('<br><img src="favicon.ico"></img>');
        end(res);
        break;
        case 'historik':
        var x, y;
        db.all('SELECT * FROM HISTORIK_VIEW ORDER BY DATUM ASC', function (err, rows) {
            writeTable(rows, res);
            end(res);
        });
        break;
        case 'ovningar':
        if (params[0] === 'new') {
            readTemplate('newOvning', res);
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
            db.all("SELECT ID, NAMN FROM OVNINGAR", function(err, rows) {
                var bodyRows = '';
                if (rows.length === 0) {
                    res.write('<p>Inga övningar att visa.</p>');
                } else {
                    rows.forEach(function (row) {
                        bodyRows += '<tr onclick="edit(' + "'ovningar'" + ', ' + row.ID + ')" class="pointer"><td class="mdl-data-table__cell--non-numeric">' + row.NAMN + '</td></tr>\n';
                    });
                    read('showOvningar', {BODYROWS: bodyRows}, res);

                }
                end(res);
            });
        }
        break;
        case '':
        readTemplate('index', res);
        end(res);
        break;
        case 'resultat':
        var check = false, check1 = false, personer = '', ovningar = '', x;
        db.serialize(function () {
            db.all('SELECT ID, NAMN FROM PERSONER WHERE AKTIV = 1', function (err, rows) {
                for (x = 0; x < rows.length; x += 1) {
                    personer += '<option value="' + rows[x].ID + '">' + rows[x].NAMN + '</option>';
                }
                check = true;
                if (check && check1) {
                    read('newHistory', {PERSONER: personer, OVNINGAR: ovningar}, res);
                    end(res);
                }
            });
            db.all('SELECT ID, NAMN FROM OVNINGAR', function (err, rows) {
                for (x = 0; x < rows.length; x += 1) {
                    ovningar += '<option value="' + rows[x].ID + '">' + rows[x].NAMN + '</option>';
                }
                check1 = true;
                if (check && check1) {
                    read('newHistory', {PERSONER: personer, OVNINGAR: ovningar}, res);
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
            db.all("SELECT ID, NAMN, AKTIV FROM PERSONER", function(err, rows) {
                var bodyRows = '';
                if (rows.length === 0) {
                    res.write('<p>Inga personer att visa.</p>');
                } else {
                    rows.forEach(function (row) {
                        bodyRows += '<tr onclick="edit(' + "'personer'" + ', ' + row.ID + ')" class="pointer"><td class="mdl-data-table__cell--non-numeric">' + row.NAMN + '</td><td class="mdl-data-table__cell--non-numeric">' + ((row.AKTIV === 1) ? 'Aktiv' : 'Ej aktiv') + '</td></tr>\n';
                    });
                    read('showPersoner', {BODYROWS: bodyRows}, res);
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

function writeTable(rows, res) {
    var x, y;
    res.write('<table>');
    res.write('<tr>');
    for (x in rows[0]) {
        res.write('<th>' + x + '</th>');
    }
    res.write('</tr>');
    for (x = 0; x < rows.length; x += 1) {
        res.write('<tr>');
        for (y in rows[x]) {
            res.write('<td>' + rows[x][y] + '</td>');
        }
        res.write('</tr>');
    }
    res.write('</table>');
}

function HTMLStart(res) {
    readTemplate('htmlHead', res);
    readTemplate('header', res);
}

function splitQueryString(input) {
    var temp, keyVal, val, x, retObj = {};
    temp = input.split('&');
    for (x = 0; x < temp.length; x += 1) {
        keyVal = temp[x].split('=');
        val = decodeURIComponent(keyVal[1]).replace(/\+/g, ' ').replace(/[^a-zA-Z0-9åÅäÄöÖ\s\.\@\-\_]+/g, '*');
        if (typeof retObj[keyVal[0]] === 'undefined') {
            retObj[keyVal[0]] = val;
        } else if (typeof retObj[keyVal[0]] === 'object') {
            retObj[keyVal[0]].push(val);
        } else {
            retObj[keyVal[0]] = [retObj[keyVal[0]], val];
        }
    }
    return retObj;
}

function end(res) {
    read('footer', {USER: (jar.get('shortCookie') === undefined) ? '-' : jar.get('shortCookie')}, res);
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

        db.run('CREATE TABLE IF NOT EXISTS "PASS" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE ON CONFLICT IGNORE , "NAMN" VARCHAR NOT NULL  UNIQUE ON CONFLICT IGNORE)');
        db.run('INSERT INTO PASS (NAMN) VALUES("Bröst och axlar")');

        db.run('CREATE TABLE IF NOT EXISTS "OVNINGAR" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE ON CONFLICT IGNORE , "NAMN" VARCHAR NOT NULL  UNIQUE ON CONFLICT IGNORE )');
        db.run('INSERT INTO OVNINGAR (NAMN) VALUES("Marklyft")');
        db.run('INSERT INTO OVNINGAR (NAMN) VALUES("Bänkpress")');
        db.run('INSERT INTO OVNINGAR (NAMN) VALUES("Militärpress")');

        db.run('CREATE TABLE IF NOT EXISTS "PASS_OVNINGAR" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL  UNIQUE ON CONFLICT IGNORE, "PASS_ID" INTEGER NOT NULL, "OVNING_ID" INTEGER NOT NULL, FOREIGN KEY("PASS_ID") REFERENCES PASS(ID), FOREIGN KEY("OVNING_ID") REFERENCES OVNINGAR(ID), UNIQUE ("PASS_ID", "OVNING_ID") ON CONFLICT IGNORE)');
        db.run('INSERT INTO PASS_OVNINGAR(PASS_ID, OVNING_ID) VALUES(1, 2)');
        db.run('INSERT INTO PASS_OVNINGAR(PASS_ID, OVNING_ID) VALUES(1, 3)');

        db.run('CREATE TABLE IF NOT EXISTS "HISTORIK" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , "VIKT" DOUBLE NOT NULL , "ANTAL" INTEGER NOT NULL, "PERSON_ID" INTEGER NOT NULL, "OVNING_ID" INTEGER NOT NULL, "DATUM" DATETIME, FOREIGN KEY("PERSON_ID") REFERENCES PERSONER(ID), FOREIGN KEY("OVNING_ID") REFERENCES OVNINGAR(ID))');

        db.run('CREATE TABLE IF NOT EXISTS "LOGINS" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , "MAIL" VARCHAR NOT NULL , "HASH" VARCHAR NOT NULL )');

        db.run('CREATE TABLE IF NOT EXISTS "WHITELIST" ("ID" INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , "MAIL" VARCHAR NOT NULL  UNIQUE , "LASTMAIL" DATETIME, "LASTLASTMAIL" DATETIME)');
        db.run('INSERT INTO WHITELIST(MAIL), VALUES("henrik.aronsson.94@gmail.com")');
        db.run('INSERT INTO WHITELIST(MAIL), VALUES("rolf@blidb.org")');
        db.run('INSERT INTO WHITELIST(MAIL), VALUES("karlmagnus.karlsson@hotmail.com")');
        db.run('INSERT INTO WHITELIST(MAIL), VALUES("magnus.kjellin@hotmail.se")');

        db.run('CREATE VIEW IF NOT EXISTS "HISTORIK_VIEW" AS  SELECT p.NAMN AS "PERSON", o.NAMN AS "OVNING", h.VIKT, h.ANTAL, h.DATUM FROM HISTORIK h JOIN PERSONER p ON h.PERSON_ID = p.ID JOIN OVNINGAR o ON h.OVNING_ID = o.ID');
        db.run('CREATE VIEW IF NOT EXISTS "PASS_VIEW" AS  SELECT p.ID, p.NAMN, GROUP_CONCAT(o.NAMN) AS "OVNINGAR" FROM PASS_OVNINGAR po JOIN PASS p ON po.PASS_ID = p.ID JOIN OVNINGAR o ON po.OVNING_ID = o.ID GROUP BY p.NAMN', function () {
            console.log("tables created.");
        })
    });
}
