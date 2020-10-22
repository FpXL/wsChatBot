"use strict";

var http = require('http');
var WebSocket = require('ws');
// var async = require('asyncawait/async');
// var await = require('asyncawait/await');
var querystring = require('querystring');
var iconvlite = require('iconv-lite');
const exec = require('child_process').exec;
var childProcess = require('child_process');
var cheerio = require('cheerio'),
	$ = cheerio.load('');

var PackType = {
	bad: 0,
	system: 1,
	message: 2,
	online_list: 3,
	auth: 4,
	status: 5,
	join: 6,
	leave: 7,
	create_room: 8,
	remove_room: 9,
	ping: 10,
};

// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// };

var mainF = function () {
	var ws = new WebSocket('wss://sinair.ru/ws/chat');

	ws.on('open', function open() {
		ws.send(JSON.stringify({
		type: PackType.join,
		target: "#chat",
		}));

	ws.send(JSON.stringify({
			type: PackType.online_list,
			target: "#chat",
		}));
	});


	ws.on('message', function(data, flags) {
	  var isOnline = false;
	  var dt = JSON.parse(data);
	  ws.close();
	  switch (dt.type){
	      case PackType.online_list:
	      	//console.log("> " + data);
					for (var i in dt.list){
						var item = dt.list[i];
						if (item.name == "C3PO") isOnline = true;						
					}
					console.log('C3PO is ' + ((isOnline) ? 'online':'offline'));
					if(!isOnline) {
						childProcess.fork('./bot.js');
						// exec('node bot.js >> log &', function callback(error, stdout, stderr){
						// 	console.log(error);
						// 	console.log(stderr);
						// });
					}
				break;
		}
	});
}
setInterval(() => mainF(), 15 * 60 * 1000);
// mainF();