@echo off
del database.sqlite3
call sqlite3 database.sqlite3 < schema.sql