var dbprocedures = require('./dbprocedures');
var hash = require('./pass').hash;

exports.authenticate = function(name, pass, fn) {
  // if (!module.parent) console.log('Authenticating %s:%s', name, pass);
  // MAKE PASSWORD CONSTRAINTS HERE
  // query the db for the given username
  dbprocedures.getUser(name,function(err, user) {
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

exports.restrictCommon = function (req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/');
  }
}

exports.restrictAdmin = function (req, res, next) {
  if (req.session.user && parseInt(req.session.user.priv) > 0 ) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/');
  }
}

exports.restrictSuper = function (req, res, next) {
  if (req.session.user && parseInt(req.session.user.priv) > 1 ) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/');
  }
}

exports.processLogin = function(req, res) {
  //console.log('POST: %s   /', req.connection.remoteAddress);

  //TODO: Sanitize input :3
  exports.authenticate(req.body.username, req.body.password, function(err, user){
    if (user) {
      // console.log('AUTH: %s   /             user: %s', req.connection.remoteAddress,user.username);
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
}

exports.processLogout = function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
}