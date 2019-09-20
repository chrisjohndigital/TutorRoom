//Mocha dependencies
var assert = require('assert');
var socketURL = 'http://localhost:8080';
var options ={
    transports: ['websocket'],
    'force new connection': true,
    'reconnection delay' : 0,
    'reopen delay' : 0
};
//Mocha dependencies
var express = require('express');
var io = require('socket.io-client');
//Add token, can use the same token as being previewed in the browser if you wish
var token = '';
//Add token
var file='123456789';
var extension = '.txt';

describe('TutorRoom asynchronous tests', function(){
    var socket;
    before(function(done) {
    // Setup
        console.log('Establishing socket.io connection');
        socket = io.connect(socketURL, options);
        socket.on('connect', function () {
            console.log ('Socket connection: ' + socket.connected);
            console.log ('Proceed to tests');
            done();
        });
        socket.on('connect_failed', function () {
            console.log ('Socket connection: ' + socket.connected);
        });
        socket.on('connect_error', function () {
            console.log ('Socket connection: ' + socket.connected);
        });
        socket.on('handshake', function (data) {
            describe('Confirming handshake', function() {
                it('should be null', function(done){
                    assert.equal(null, data);
                    done();
                });
                socket.emit('setToken', token);
            });
        });
        socket.on('token-received', function (data) {
            describe('Confirming token', function() {
                it('should be ' + token, function(done){
                    assert.equal(token, data);
                    done();
                });
            });
            socket.emit('fileshare', file);
        });
        socket.on('offer', function (data) {
            describe('Confirming offer', function() {
                it('should not be null', function(done){
                    assert.notEqual(null, data);
                    done();
                });
            });
        });
        socket.on('ice', function (data) {
            describe('Confirming ice', function() {
                it('should not be null', function(done){
                    assert.notEqual(null, data);
                    done();
                });
            });
        });
        socket.on('fileshare', function (data) {
            var file = data;
            describe('Confirming file length', function() {
                it('should not be 0', function(done){
                    assert.notEqual(0, file.length);
                    done();
                });
            });
            socket.emit('fileshare-complete', extension);
        });
        socket.on('fileshare-complete', function (data) {
            describe('Confirming file share complete', function() {
                it('should be .txt', function(done){
                    assert.equal(extension, data);
                    done();
                });
            });
        });
    });
    describe('Confirming connection', function() {
        it('should be connected', function(){
            assert.equal(true, socket.connected);
        });
    });
})