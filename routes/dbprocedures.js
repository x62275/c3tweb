var sqlite3 = require('sqlite3');
var db = new sqlite3.Database('./database.sqlite3');
var hash = require('./pass').hash;

exports.submitFunctions = {'getFlags':function(chalid, fn) {db.get('SELECT baseflag,secureflag FROM "challenges" WHERE id = ?', chalid, fn)},
                       'getSolvesByChalAndUser':function(chalid, user, fn){db.get('SELECT * FROM solves WHERE chalid = ? AND username = ?', chalid, user.username, fn)},
                       'insertSolve':function(chalid,user){db.run('INSERT INTO solves (chalid, username, time) VALUES (?, ?, time("now") )', chalid, user.username)},
                       'updateScore':function(user){db.run('UPDATE users SET score = score + (SELECT value FROM challenges WHERE id = (SELECT chalid FROM solves WHERE username = ? ORDER BY time DESC LIMIT 1)) WHERE username = ?', user.username, user.username)},
                       'checkSolve':function(chalid,user,fn){db.get('SELECT * FROM solves WHERE chalid = ? AND username = ?', chalid, user.username, fn)} };

exports.getScores = function(req,res) {
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
};

exports.userInsert = function(user, pass, priv){
  //TODO: Sanitization
  var cmd = 'INSERT INTO "users" ("username", "password", "salt", "priv") '
  hash(pass, function(err, salt, hash){
    if (err) throw err;
    var t0 = 'SELECT "'+user+'", "'+hash+'", "'+salt+'", '+priv+' '; 
    var t1 = 'WHERE NOT EXISTS(SELECT 1 FROM "users" WHERE username= "'+user+'");';
    db.run(cmd+t0+t1);
  });
};

exports.eventInsert = function(name, start, end){
  //TODO: Sanitization
  var cmd = 'INSERT INTO "events" ("name", "start", "end") '
  var t0 = 'SELECT "'+name+'", "'+start+'", "'+end+'"'; 
  var t1 = 'WHERE NOT EXISTS(SELECT 1 FROM "events" WHERE name= "'+name+'");'; // DEBUG
  db.run(cmd+t0+t1); //DEBUG
  //db.run(cmd+t0);
};

exports.challengeInsert = function(name, flag, value, eventid, description) {
  //TODO: Type checking for challenges
  //      Check to see if challenge with same name already exists
  // 
  var cmd = 'INSERT INTO challenges (name, baseflag, value, description, eventid) ';
  cmd += 'SELECT "'+name+'", "'+flag+'", "'+value+'", "'+description+'", "'+eventid+'" ';
  cmd += 'WHERE NOT EXISTS(SELECT 1 FROM "challenges" WHERE name= "'+name+'");';
  db.run(cmd);
};

exports.debugData = function(){
  exports.userInsert('guest','guest',0)
  exports.userInsert('admin','admin',1)
  exports.userInsert('admin2', 'admin',1)
  exports.userInsert('supervisor','supervisor',2)

  exports.eventInsert("ctf1", "now", "now");
  exports.eventInsert("ctf2", "now", "now");
  exports.eventInsert("oldctf", "01-15-1994 15:00", "now");

  exports.challengeInsert("sooperhard1", "lol123", "500", "1", "i am description");
  exports.challengeInsert("sooperhard1again", "lol123", "500", "1");
  exports.challengeInsert("sooperhard2", "lol123", "500", "2");
  exports.challengeInsert("sooperhard2again", "lol123", "500", "2");
  exports.challengeInsert("sooperhard3", "lol123", "500", "3");
  exports.challengeInsert("sooperhard3again", "lol123", "500", "3");
};

exports.getUser = function(username, fn) {
  db.get('SELECT username, password, salt, priv FROM users WHERE username = ?', username, function(err, row) {
    if (!row) return fn(err);
    //console.log('Query returned with username: %s', row.username);
    return fn(null, row);
  });
}

exports.getEvent = function(name, fn) {
  db.get('SELECT name, start, end FROM events WHERE name = ?', name, function(err, row) {
    if (!row) return fn(err);
    return fn(null, row);
  });
};

exports.getEvents = function(fn, user) {
  if (user.priv == 0) {
    //Might be broken? check for `now` as a keyword
    db.all('SELECT id, name, start, end FROM events WHERE start < \'now\'', function(err, row) {
      if (!row) return fn(err);
      return fn(null, row);
    });
  } else {
    db.all('SELECT id, name, start, end FROM events', function(err, row) {
      if (!row) return fn(err);
      return fn(null, row);
    });
  }
};

exports.getEventById = function(fn, id, user) {
  if (user.priv == 0) {
    db.get('SELECT id, name, start, end FROM events WHERE start < \'now\' AND id = ?', id, function(err, row) {
      if (!row) return fn(err);
      //console.log(row);
      return fn(null, row);
    });
  } else {
    db.get('SELECT id, name, start, end FROM events WHERE id = ?', id, function(err, row) {
      if (!row) return fn(err);
      //console.log(row);
      return fn(null, row);
    });
  }
};

exports.getAdminsByEvent = function (fn, eventID) {
  db.all('SELECT username FROM admins WHERE eventid = ?', eventID, function(err,row) {
    return fn(null, row);
  });
};

exports.getEventsByAdmin = function(fn, username) {
  db.all('SELECT eventid FROM admins WHERE username = ?', username, function(err,row) {
    return fn(null, row);
  });
};

exports.grantAdmin = function(username, eventid) {
  db.run('INSERT INTO admins (username,eventid) VALUES (?,?) WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = ? and eventid = ?)', username, eventid, username, eventid);
};

exports.getChallenges = function(fn, eventID, user) {
  if (user.priv >= 0) {
    //Make * more specific
    //console.log(user.username+" requests challenges from event #"+eventID);
    db.all('SELECT * FROM challenges WHERE NOT EXISTS (SELECT 1 FROM solves WHERE username = ? AND solves.chalid = challenges.id) AND eventid = ?', user.username, eventID, function(err, row) {
      if (!row) return fn(err);
      //console.log(row);
      return fn(null, row);
    });
  } 
};

exports.getChallengeByName = function(fn, eventID, name) {
  db.get('SELECT 1 FROM challenges WHERE eventid = ? and name = ?', eventID, name, function(err,row) {
    if (row) {
      fn(true);
    } else {
      fn(false);
    }
  });
};