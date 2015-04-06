var path = require('path');
var dbprocedures = require('./dbprocedures');

exports.register = function(req, res) {
	if (req.body.username && req.body.password && req.body.passwordagain) {
		if (req.body.password == req.body.passwordagain) {
			dbprocedures.userInsert(req.body.username, req.body.password, '0');
		} else { res.redirect('/register'); return; }
	}
	res.redirect('/login');
}

exports.createEvent = function(req,res) {
  if (req.body.name) {
    dbprocedures.eventInsert(req.body.name, req.body.start, req.body.stop, req.body.admin);
  }
  res.redirect('/events');
}

exports.getEvents = function(req,res) {
  dbprocedures.getEvents(function(err, row) {
    res.send(row);
  }, req.session.user);
}

exports.getAdminsByEvent = function(req,res) {
  dbprocedures.getAdminsByEvent(function(err,row) {
    res.send(row);
  }, req.body.eventid);
}

exports.getEventsByAdmin = function(req,res) {
  dbprocedures.getEventsByAdmin(function(err,row) {
    res.send(row);
  }, req.session.user.username);
}

exports.addEvent = function(req,res) {
  if (req.body.name && req.body.start && req.body.end) {
    if ( dbprocedures.getUser(req.body.admin, function(err, row) {return row;}) != 0) {
      dbprocedures.eventInsert(req.body.name, req.body.start, req.body.end, req.body.admin);
      res.send("good");
    }
  } else {
    res.send('nope');
  }
}

exports.grantAdmin = function(req, res) {
  if (req.body.username && req.body.eventid) {
    dbprocedures.grantAdmin(req.body.username,req.body.eventid);
  }
}


//MAKES THE SERVER SPLODE
exports.addChallenge = function(req,res) {
  if (req.body.name && req.body.value && req.body.flag && req.body.eventid && req.body.description) {
    dbprocedures.getChallengeByName( function (exists) {
      console.log('Exists is: '+exists+" !exists="+!exists);
      if ( !exists ) {
        dbprocedures.getAdminsByEvent(function(err,row) {
          row.forEach( function (entry) {
            if (entry.username == req.session.user.username) {
              dbprocedures.challengeInsert(req.body.name, req.body.flag, req.body.value, req.body.eventid, req.body.description);
              res.send('noerror');
            } else { res.send('error'); }
          });
        }, req.body.eventid);
      } else { res.send('error'); }
    }, req.body.eventid, req.body.name);
  } else { res.send('error'); }
}


exports.getChallenges = function(req, res) {
  dbprocedures.getEventById(function(err, row) {
    if (!row) { res.send({}); } else {
      dbprocedures.getChallenges(function(err, row) {
        res.send(row);
      }, row.id, req.session.user);
    }
  }, req.body.eventid, req.session.user);
}

exports.submitChallenge = function(req, res) {
  var sub = req.body.submission;
  var chalid = req.body.chalid;
  exports.checkSubmission(function (err, row) {
    res.send(row);
  }, chalid, req.session.user, sub);
}

exports.checkSubmission = function (fn, chalid, user, sub) {
  //checkSubmission
  if (user.priv >= 0) {
    //sanitize
    dbprocedures.submitFunctions['getFlags'](chalid, function(err, row) {
      if (!row) return fn(err);
      if (sub == row.baseflag) {
        dbprocedures.submitFunctions['getSolvesByChalAndUser'](chalid, user, function (err, row2) {
          if (row2) return fn(err);
          if (!row2) {
            dbprocedures.submitFunctions['insertSolve'](chalid, user);
            dbprocedures.submitFunctions['updateScore'](user);
            dbprocedures.submitFunctions['checkSolve'](chalid, user, function (err, row3) {
              if (!row) return fn(err);
              return fn(null, row3);
            });
          }
        }); 
      }
    });
  }
}
