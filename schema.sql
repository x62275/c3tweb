CREATE TABLE "users" (
    "username" TEXT PRIMARY KEY UNIQUE,
    "password" TEXT, -- sha256 hash of the plain-text password
    "salt" TEXT, -- salt that is appended to the password before it is hashed
    "score" INT DEFAULT 0,
    "priv" INT DEFAULT 0
);

CREATE TABLE "events" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "name" TEXT UNIQUE,
    "start" DATE,
    "end" DATE
);

CREATE TABLE "challenges" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "baseflag" TEXT,
    "secureflag" TEXT,
    "description" TEXT,
    "link" TEXT,
    "category" TEXT,
    "value" INTEGER,
    "eventid" INTEGER,
    FOREIGN KEY (eventid) REFERENCES events(id)
);

CREATE TABLE "solves" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"username" TEXT,
	"chalid" INTEGER,
	"eventid", INTEGER,
    	"time" DATE,
	FOREIGN KEY (username) REFERENCES users(username),
	FOREIGN KEY (chalid) REFERENCES challenges(id)
	FOREIGN KEY (eventid) REFERENCES events(id)
);

CREATE TABLE "admins" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "username" TEXT,
    "eventid" INTEGER,
    FOREIGN KEY (username) REFERENCES users(username),
    FOREIGN KEY (eventid) REFERENCES events(id)
);
