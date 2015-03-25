var express = require('express');
var https = require('https');
var fs = require('fs');
var path = require('path');
var session = require('express-session');
var bodyParser = require('body-parser');
var hash = require('./pass').hash;
var multer = require('multer');
var serveIndex = require('serve-index');
var serveStatic = require('serve-static');
var logger = require('morgan');

// This line is from the Node.js HTTPS documentation.
var options = {
  key: fs.readFileSync('cert/server.key'),
  cert: fs.readFileSync('cert/server.crt')
};

// Create a service (the app object is just a callback).
var app = express();

app.use(logger(':remote-addr :method :url     :response-time ms'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

var sqlite3 = require('sqlite3');
var db = new sqlite3.Database('./database.sqlite3');

function userInsert(user, pass, priv){
  //TODO: Sanitization
  var cmd = 'INSERT INTO "users" ("username", "password", "salt", "priv") '
  hash(pass, function(err, salt, hash){
    if (err) throw err;
    var t0 = 'SELECT "'+user+'", "'+hash+'", "'+salt+'", '+priv+' '; 
    var t1 = 'WHERE NOT EXISTS(SELECT 1 FROM "users" WHERE username= "'+user+'");';
    db.run(cmd+t0+t1);
  });
}

function eventInsert(name, start, end, admin){
  //TODO: Sanitization
  var cmd = 'INSERT INTO "events" ("name", "start", "end", "admin") '
  var t0 = 'SELECT "'+name+'", time("'+start+'"), time("'+end+'"), "'+admin+'"'; 
  var t1 = 'WHERE NOT EXISTS(SELECT 1 FROM "events" WHERE name= "'+name+'");'; // DEBUG
  db.run(cmd+t0+t1); //DEBUG
  //db.run(cmd+t0);
}

function challengeInsert(name, flag, value, eventid) {
  var cmd = 'INSERT INTO challenges (name, baseflag, value, eventid) ';
  cmd += 'SELECT "'+name+'", "'+flag+'", "'+value+'", "'+eventid+'" ';
  cmd += 'WHERE NOT EXISTS(SELECT 1 FROM "challenges" WHERE name= "'+name+'");';
  db.run(cmd);
}

userInsert('guest','guest',0)
userInsert('admin','admin',1)
userInsert('admin2', 'admin',1)
userInsert('supervisor','supervisor',2)

eventInsert("ctf1", "now", "now", "admin");
eventInsert("ctf2", "now", "now", "admin");
eventInsert("oldctf", "01-15-1994 15:00", "now", "admin2");

challengeInsert("sooperhard1", "lol123", "500", "1");
challengeInsert("sooperhard1again", "lol123", "500", "1");
challengeInsert("sooperhard2", "lol123", "500", "2");
challengeInsert("sooperhard2again", "lol123", "500", "2");
challengeInsert("sooperhard3", "lol123", "500", "3");
challengeInsert("sooperhard3again", "lol123", "500", "3");

function getUser(username, fn) {
  db.get('SELECT username, password, salt, priv, score FROM users WHERE username = ?', username, function(err, row) {
    if (!row) return fn(err);
    //console.log('Query returned with username: %s', row.username);
    return fn(null, row);
  });
}

function getEvent(name, fn) {
  db.get('SELECT name, start, end, admin FROM events WHERE name = ?', name, function(err, row) {
    if (!row) return fn(err);
    return fn(null, row);
  });
}

function getEvents(fn, user) {
  if (user.priv == 0) {
    //Might be broken? check for `now` as a keyword
    db.all('SELECT id, name, start, end, admin FROM events WHERE start < time(\'now\')', function(err, row) {
      if (!row) return fn(err);
      return fn(null, row);
    });
  } else {
    db.all('SELECT id, name, start, end, admin FROM events', function(err, row) {
      if (!row) return fn(err);
      return fn(null, row);
    });
  }
}

function getEventById(fn, id, user) {
  if (user.priv == 0) {
    //Might be broken? check for `now` as a keyword
    db.get('SELECT id, name, start, end, admin FROM events WHERE start < time(\'now\') AND id = ?', id, function(err, row) {
      if (!row) return fn(err);
      return fn(null, row);
    });
  } else {
    db.get('SELECT id, name, start, end, admin FROM events WHERE id = ?', id, function(err, row) {
      if (!row) return fn(err);
      return fn(null, row);
    });
  }
}

function getChallenges(fn, eventID, user) {
  if (user.priv >= 0) {
    //Make * more specific
    db.all('SELECT * FROM challenges WHERE NOT EXISTS (SELECT 1 FROM solves WHERE solves.username = ? AND solves.chalid = challenges.id) AND eventid = ?', user.username, eventID, function(err, row) {
      if (!row) return fn(err);
      return fn(null, row);
    });
  } 
}

function checkChallenge(fn, chalid, user, sub) {
  if (user.priv >= 0) {
    //sanitize
    db.get('SELECT baseflag,secureflag FROM "challenges" WHERE id = ?', chalid, function(err, row) {
      if (!row) return fn(err);
      if (sub == row.baseflag) {
        db.get('SELECT * FROM solves WHERE chalid = ? AND username = ?', chalid, user.username, function (err, row2) {
          if (row2) return fn(err);
          if (!row2) {
            db.run('INSERT INTO solves (chalid, username, time) VALUES (?, ?, time("now") )', chalid, user.username);
            db.run('UPDATE users SET score = score + (SELECT value FROM challenges WHERE id = (SELECT chalid FROM solves WHERE username = ? ORDER BY time DESC LIMIT 1)) WHERE username = ?', user.username, user.username);
            db.get('SELECT * FROM solves WHERE chalid = ? AND username = ?', chalid, user.username, function (err, row3) {
              if (!row) return fn(err);
              return fn(null, row3);
            });
          }
        }); 
      }
    });
  }
}

function authenticate(name, pass, fn) {
  if (!module.parent) console.log('Authenticating %s:%s', name, pass);
  // MAKE PASSWORD CONSTRAINTS HERE
  // query the db for the given username
  getUser(name,function(err, user) {
    // apply the same algorithm to the POSTed password, applying
    // the hash against the pass / salt, if there is a match we
    // found the user
    if(!user) return fn(null)
    hash(pass, user.salt, function(err, hash){
      if (err) return fn(err);
      if (hash == user.password) return fn(null, user);
      fn(new Error('invalid password'));
    });
  });
}

function restrictCommon(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/');
  }
}

function restrictAdmin(req, res, next) {
  if (req.session.user && parseInt(req.session.user.priv) > 0 ) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/');
  }
}

function restrictSuper(req, res, next) {
  if (req.session.user && parseInt(req.session.user.priv) > 1 ) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/');
  }
}

app.get('/login', function(req, res) {
    if (req.session.user) { res.redirect("/events"); }
    //console.log('GET:  %s   /', req.connection.remoteAddress);
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', function(req, res) {
    if (req.session.user) { res.redirect("/events"); }
    //console.log('GET:  %s   /', req.connection.remoteAddress);
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.post('/register', function(req,res) {
    if (req.body.username && req.body.password && req.body.passwordagain)
    {
      if (req.body.passwordagain == req.body.password) {
        userInsert(req.body.username, req.body.password, 0);
        res.redirect('/login');
      }
    }

    res.redirect('/register');
});

app.get('/events', restrictCommon, function(req,res) {
  if (req.session.user.priv == 2) {
    res.sendFile(path.join(__dirname, 'views', 'eventsSuper.html'));
  } else if (req.session.user.priv == 1) {
    res.sendFile(path.join(__dirname, 'views', 'eventsAdmin.html'));
  } else {
    res.sendFile(path.join(__dirname, 'views', 'eventsCommon.html'));
  }
});

app.post('/events', restrictSuper, function(req,res) {
  if (req.body.name) {
    eventInsert(req.body.name, req.body.start, req.body.stop, req.body.admin);
  }
  res.redirect('/events');
});

app.get('/api/common/events/', restrictCommon, function(req,res) {
  getEvents(function(err, row) {
    res.send(row);
  }, req.session.user);
});

app.get('/api/admin/events/', restrictAdmin, function(req,res) {
  getEvents(function(err, row) {
    res.send(row);
  }, req.session.user);
});

app.post('/api/super/addevent', restrictSuper, function(req,res) {
  if (req.body.name && req.body.start && req.body.end) {
    if ( getUser(req.body.admin, function(err, row) {return row;}) != 0) {
      eventInsert(req.body.name, req.body.start, req.body.end, req.body.admin);
      res.send("good");
    }
  } else {
    res.send('nope');
  }
});

app.post('/api/admin/challenges', restrictAdmin, function(req, res) {
  getEventById(function(err, row) {
    if (!row) { res.send({}); } else {
      getChallenges(function(err, row) {
        res.send(row);
      }, row.id, req.session.user);
    }
  }, req.body.eventid, req.session.user);
});

app.post('/api/common/challenges', restrictCommon, function(req, res) {
  getEventById(function(err, row) {
    if (!row) { res.send({}); } else {
      getChallenges(function(err, row) {
        res.send(row);
      }, row.id, req.session.user);
    }
  }, req.body.eventid, req.session.user);
});

app.post('/api/submit', restrictCommon, function(req, res) {
  var sub = req.body.submission;
  var chalid = req.body.chalid;
  checkChallenge(function (err, row) {
    res.send(row);
  }, chalid, req.session.user, sub);
});

app.post('/api/getscores', restrictCommon, function(req, res) {
  var username = req.session.user.username;
  var userscore = 0;
  var eid = req.body.eventid;
  db.all("select r.username, s.value, r.time from solves as r join challenges as s on s.id = r.chalid where s.eventid = ? order by r.username, r.time asc", eid, function(err, rows) {
  if (rows[0] != null) {
    if (rows[0]['username']==username) userscore = rows[0]['value'];
    for (i = 1; i < rows.length; i++) {
      if (rows[i]['username'] == rows[i-1]['username']) {
        rows[i]['value'] += rows[i-1]['value'];
      }

      if (rows[i]['username'] == username && rows[i]['value'] > userscore) {
        userscore = rows[i]['value'];
      }
    }
    res.send({'userscore':userscore, 'data': rows});
  }
  else {
    res.send({'userscore':0, 'data': []})
  }
 });
});

app.post('/api/score', restrictCommon, function(req, res) {
  var eid = req.body.eventid;
  var username = req.session.user.username;
});

app.get('/user', restrictCommon, function(req, res) {
  var s = getUser(req.query.name, function(err, row) {
    if (row) {
      res.send(''+row.score);
    } else res.send("User not found :[");
  });
});

app.get('/admin', restrictAdmin, function(req, res) {
  res.send('ohhai admingai');
});

app.post('/login', function(req, res){
  //console.log('POST: %s   /', req.connection.remoteAddress);

  //TODO: Sanitize input :3
  authenticate(req.body.username, req.body.password, function(err, user){
    if (user) {
      console.log('AUTH: %s   /             user: %s', req.connection.remoteAddress,user.username);
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(function(){
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.username;
        res.redirect('/events');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.'
      res.redirect('/login');
    }
  });
});

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.get('/', function(req, res) {
  if (req.session.user) { 
    res.sendFile(path.join(__dirname, 'views', 'home.html'));
  } else {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  }
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.get('*', function(req, res) { // all other requests
    res.redirect('/');
});

// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(3003);