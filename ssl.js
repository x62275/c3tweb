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

var api = require('./api');
var pages = require('./pages');
var dbprocedures = require('./dbprocedures');
var sessionhandler = require('./sessionhandler');

dbprocedures.debugData();

//Pages
app.get('/', pages.home);

app.get('/login', pages.login);

app.get('/register', pages.register);

app.get('/events', sessionhandler.restrictCommon, pages.events);

//API
app.post('/register', api.register);

app.post('/events', sessionhandler.restrictSuper, api.createEvent);

app.get('/api/events/', sessionhandler.restrictCommon, api.getEvents);

app.post('/api/super/addevent', sessionhandler.restrictSuper, api.addEvent);

app.post('/api/challenges', sessionhandler.restrictCommon, api.getChallenges);

app.post('/api/submit', sessionhandler.restrictCommon, api.submitChallenge);

//Session Handling
app.post('/login', sessionhandler.processLogin);

app.get('/logout', sessionhandler.processLogout);

//Database
app.post('/api/getscores', sessionhandler.restrictCommon, dbprocedures.getScores);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.get('*', function(req, res) { // all other requests
    res.redirect('/');
});

// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(3003);