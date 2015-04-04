var path = require('path');

exports.login = function(req, res) {
    if (req.session.user) { res.redirect("/events"); }
    //console.log('GET:  %s   /', req.connection.remoteAddress);
    res.sendFile(path.join(__dirname, '../views', 'login.html'));
}

exports.register = function(req, res) {
    if (req.session.user) { res.redirect("/events"); }
    //console.log('GET:  %s   /', req.connection.remoteAddress);
    res.sendFile(path.join(__dirname, '../views', 'register.html'));
}

exports.events = function(req,res) {
  if (req.session.user.priv == 2) {
    res.sendFile(path.join(__dirname, '../views', 'eventsSuper.html'));
  } else if (req.session.user.priv == 1) {
    res.sendFile(path.join(__dirname, '../views', 'eventsAdmin.html'));
  } else {
    res.sendFile(path.join(__dirname, '../views', 'eventsCommon.html'));
  }
}

exports.home = function(req, res) {
  if (req.session.user) { 
    res.sendFile(path.join(__dirname, '../views', 'home.html'));
  } else {
    res.sendFile(path.join(__dirname, '../views', 'index.html'));
  }
}

exports.admin = function(req, res) {
  if (req.session.user) { 
    res.sendFile(path.join(__dirname, '../views', 'admin.html'));
  } else {
    res.sendFile(path.join(__dirname, '../views', 'index.html'));
  }
}

exports.super = function(req, res) {
  if (req.session.user) { 
    res.sendFile(path.join(__dirname, '../views', 'super.html'));
  } else {
    res.sendFile(path.join(__dirname, '../views', 'index.html'));
  }
}
