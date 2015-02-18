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

function dbInsert(user, pass, priv){
  var cmd = 'INSERT INTO "users" ("username", "password", "salt", "priv") '
  hash(pass, function(err, salt, hash){
    if (err) throw err;
    var t0 = 'SELECT "'+user+'", "'+hash+'", "'+salt+'", '+priv+' '; 
    var t1 = 'WHERE NOT EXISTS(SELECT 1 FROM "users" WHERE username= "'+user+'");';
    db.run(cmd+t0+t1);
  });
}
dbInsert('guest','guest',0)
dbInsert('admin','admin',1)

function getUser(username, fn){
  db.get('SELECT username, password, salt, priv FROM users WHERE username = ?', username, function(err, row) {
    if (!row) return fn(err);
    //console.log('Query returned with username: %s', row.username);
    return fn(null, row);
  });
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

app.use(multer({
    dest: '../../private/',
    rename: function (fieldname, filename) {
        return filename.replace(/\W+/g, '-').toLowerCase();
    }
}));

app.all('/private/*', function(req, res, next) {
  restrictAdmin(req re)
  if (req.session.user) {
    next(); // allow the next route to run
  } else {
    console.log('GET:  %s   /private/     UNAUTHORIZED', req.connection.remoteAddress);
    // require the user to log in
    res.redirect("/"); 
  }
});
app.use('/private/content', express.static(path.join(__dirname, '../../private')));
app.use('/private/content', serveIndex(path.join(__dirname, '../../private'), {'icons': true}));

app.all('/o/*', function(req, res, next) {
  if (req.session.user && req.session.user.priv == '1') {
    next(); // allow the next route to run
  } else {
    console.log(req.session.user);
    console.log('GET:  %s   /o/           UNAUTHORIZED', req.connection.remoteAddress);
    // require the user to log in
    res.redirect("/"); 
  }
});
app.use('/o/g', express.static(path.join(__dirname, '../../o')));

app.use('/o/g', serveIndex(path.join(__dirname, '../../o'), {'icons': true}));

app.get('/', function(req, res) {
    //console.log('GET:  %s   /', req.connection.remoteAddress);
    res.sendFile(path.join(__dirname, 'views', 'main.html'));
});

app.post('/', function(req, res){
  //console.log('POST: %s   /', req.connection.remoteAddress);
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
        res.redirect('/upload');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.'
      res.redirect('/');
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

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.post('/api/upload', restrict, function (req, res) {
    //console.log("POST: " + req.files.userFile.originalname);
    res.send({file: req.files.userFile.originalname, savedAs: req.files.userFile.name});
});

app.get('/upload', restrict, function (req, res){
    //console.log('GET:  %s   /upload       user: %s', req.connection.remoteAddress, req.session.user.username);
    res.render('upload');
});

app.get('/download', restrict, function (req, res){
    //console.log('GET:  %s   /download     user: %s', req.connection.remoteAddress, req.session.user.username);
    if(req.session.user && req.session.user.priv == '1') res.send('<html><body><a href="/o/g">good stuff</a><br><a href="/private/content">other stuff</a>')
    else res.redirect('/private/content');
});

app.get('/register', function(req, res) {
  res.send('<!DOCTYPE html><html><head><title>register</title></head><body><form method="POST">'+
    'user: <input type="text" name="user"><br>pass: <input type="password" name="pass"><br><button type="submit">register</button>'+
    '</form></body></html>')
});

app.post('/register', function(req, res) {
  res.send('Unable to create user; this process is not implemented.');
});

app.get('*', function(req, res) { // all other requests
    res.redirect('/');
});

// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(3003);