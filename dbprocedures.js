var sqlite3 = require('sqlite3');
var db = new sqlite3.Database('./database.sqlite3');

exports.userInsert = function(user, pass, priv){
  //TODO: Sanitization
  var cmd = 'INSERT INTO "users" ("username", "password", "salt", "priv") '
  hash(pass, function(err, salt, hash){
    if (err) throw err;
    var t0 = 'SELECT "'+user+'", "'+hash+'", "'+salt+'", '+priv+' '; 
    var t1 = 'WHERE NOT EXISTS(SELECT 1 FROM "users" WHERE username= "'+user+'");';
    db.run(cmd+t0+t1);
  });
}

exports.eventInsert = function(name, start, end, admin){
  //TODO: Sanitization
  var cmd = 'INSERT INTO "events" ("name", "start", "end", "admin") '
  var t0 = 'SELECT "'+name+'", "'+start+'", "'+end+'", "'+admin+'"'; 
  var t1 = 'WHERE NOT EXISTS(SELECT 1 FROM "events" WHERE name= "'+name+'");'; // DEBUG
  db.run(cmd+t0+t1); //DEBUG
  //db.run(cmd+t0);
}

exports.challengeInsert = function(name, flag, value, eventid) {
  var cmd = 'INSERT INTO challenges (name, baseflag, value, eventid) ';
  cmd += 'SELECT "'+name+'", "'+flag+'", "'+value+'", "'+eventid+'" ';
  cmd += 'WHERE NOT EXISTS(SELECT 1 FROM "challenges" WHERE name= "'+name+'");';
  db.run(cmd);
}

exports.debugData = function(){
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
}

exports.getUser = function(username, fn) {
  db.get('SELECT username, password, salt, priv FROM users WHERE username = ?', username, function(err, row) {
    if (!row) return fn(err);
    //console.log('Query returned with username: %s', row.username);
    return fn(null, row);
  });
}

exports.getEvent = function(name, fn) {
  db.get('SELECT name, start, end, admin FROM events WHERE name = ?', name, function(err, row) {
    if (!row) return fn(err);
    return fn(null, row);
  });
}

exports.getEvents = function(fn, user) {
  if (user.priv == 0) {
    //Might be broken? check for `now` as a keyword
    db.all('SELECT id, name, start, end, admin FROM events WHERE start < \'now\'', function(err, row) {
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

exports.getEventById = function(fn, id, user) {
  if (user.priv == 0) {
    db.get('SELECT id, name, start, end, admin FROM events WHERE start < \'now\' AND id = ?', id, function(err, row) {
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

exports. getChallenges = function(fn, eventID, user) {
  if (user.priv >= 0) {
    //Make * more specific
    db.all('SELECT * FROM challenges WHERE NOT EXISTS (SELECT 1 FROM SOLVES WHERE username = ? AND solves.chalid = challenges.id) AND eventid = ?', user.username, eventID, function(err, row) {
      if (!row) return fn(err);
      return fn(null, row);
    });
  } 
}