"use strict";

var http = require('http');
var WebSocket = require('ws');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var querystring = require('querystring');
var iconvlite = require('iconv-lite');
const exec = require('child_process').exec;
var cheerio = require('cheerio'),
	$ = cheerio.load('');
//var fs = require('fs');
var ws = new WebSocket('wss://sinair.ru:8080/chat');

var bot_nameOnOpen = "C3PO";
var bot_name = bot_nameOnOpen;
var bot_color = "0c0";
var mainRoom = "#chat";
var curRoom = null;
//curRoom.name = mainRoom;
var intime = {};
var outtime = {};
var weatherAPIKey = 'db1e14517973ce54dd3f8e2f9ddd897f';
var spellCheckAPI = 'http://speller.yandex.net/services/spellservice.json';
var status = {};
var weather = {};
var machine = {};
var startTime = Date.now();
var rooms = [];

var jokes = {
	"анекдот": 1,
  '1': 1,
	"рассказ": 2,
  '2': 2,
	"стишок": 3,
  '3': 3,
	"афоризм": 4,
  '4': 4,
	"bash": 5,
  '5': 5,
	"тост": 6,
  '6': 6,
	"статус": 8,
  '7': 8,
	"пошлый анекдот": 11,
  '8': 11,
	"пошлый рассказ": 12,
  '9': 12,
	"пошлый стишок": 13,
  '10': 13,
	"пошлый афоризм": 14,
  '11': 14,
	"пошлый bash": 15,
  '12': 15,
	"пошлый тост": 16,
  '13': 16,
	"пошлый статус": 18,
  '14': 18
	};

var BotResp = {
  'тыбот' : ['Кто бы говорил!', 'Сам ты бот!', 'Такой же бот как и все вы', 'А вот это обидно!', 'Да как скажешь', 'Это ты так думаешь', 'Это не те дроиды, что вы ищете!', 'Ага-ага', 'Не совсем'],
  'какдела' : ['Норм', 'Отлично', 'Просто супер! А ты как поживаешь?'],
  'каконо' : ['Как что?'],
  'кактвоеничего' : ['Ничего'],
  'кактвоёничего' : ['Ничего'],
  'тыкто' : ['Я '+bot_name, 'Даже не спрашивай!', 'А ты не знаешь?'],
  'чтотытутделаешь' : ['Провожу время в хорошей компании', 'Хороший вопрос! Что мы все тут делаем?', 'Наблюдаю, учусь'],
  'ктотвойсоздатель' : ['Endie'],
  'ктотвойпапа' : ['Endie'],
  'вчёмсмыслжизни' : ['42'],
  'вчемсмыслжизни' : ['42'],
  'ответнавопросжизнивселеннойивсеготакого' : ['42'],
  'идина' : ['Ты мне только не груби!', 'Бота каждый может обидеть', 'А ты прогуляться не желаешь?', 'Твоё любимое направление?'],
  'привет': ['Привет!', 'И тебе привет!', 'А?', 'Привет, че как?', 'Здаров', 'ку', 'хай'],
};

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
};

var UserStatus = {
	bad: 0,
	offline: 1,
	online: 2,
	away: 3,
	nick_change: 4,
	gender_change: 5,
	color_change: 6,
};

function Room(name){
	this.name = name;
	this.members = {};
	this.member_id = 0;
	this.member_login = '';
}

Room.prototype = {
	onPacket: function (dt){
		switch (dt.type){
			case PackType.online_list:
				this.members = {};

				for (var i in dt.list){
					var item = dt.list[i];
					this.members[item.member_id] = item;
				}
				this.members.size = dt.list.length;
				if (this.members[this.member_id] !== undefined)
					{	this.member_login = this.members[this.member_id].name;}
				break;

			case PackType.join:
				this.member_id = dt.member_id;
				this.memder_login = dt.login;
				break;

			case PackType.status:
				switch (dt.status){

					case UserStatus.online:
						if (this.member_id == dt.member_id){
							this.memder_login = dt.name;
						}
					break;

					case UserStatus.nick_change:
						if (this.member_id == dt.member_id){
							this.memder_login = dt.name;
						}
					break;
				}
				requestOnlineList(this);
				break;
		}
	},

	getMembers: function (){
		return this.members;
	}
};

var getRoomByName = function (name){
	for (var i in rooms){
		var room = rooms[i];
		if (name == room.name){
			return room;
		}
	}
	return null;
};

var createRoom = function (name){
	var room = new Room(name);
	rooms.push(room);
	return room;
};

RegExp.escapeForExpression = function(s){
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
};

RegExp.escapeForSubstitution = function(s){
    return s.replace(/\$/g, '$$$$');
};

String.prototype.replaceAll = function(str, replacement){
	return this.replace(new RegExp(RegExp.escapeForExpression(str), 'g'), RegExp.escapeForSubstitution(replacement));
};

var send = function(msg){
				var strm = JSON.stringify({
					type: PackType.message,
					target: curRoom.name, // this.curRoom.name,
					message: msg,
					time: Date.now(),
					login: '',
				});
				//console.log("Sending to server: " + strm);
				ws.send(strm);
};

var proccessMsg = function (msg){
	while (msg[0] === '/')
	{
		msg = msg.substr(1);
	}
	return msg;
}

var send_weather = function (weather, city)
{
            if (weather[city]['cod'] === '502' || weather[city]['cod'] === '404')
            {
              send('Какой город?');
            }
            else if (weather[city]['main'] !== undefined)
            {
                send(weather[city]['name'] + ' \u2014' + ' Температура: ' + weather[city]['main']['temp'] + ' °C, ' + 'Влажность: ' + weather[city]['main']['humidity'] + '%, Ветер: ' + weather[city]['wind']['speed'] + ' м/с, ' + weather[city]['weather'][0]['description']);
            }
}

var ansMachine = function (dt){
	if (dt.message.toLowerCase().substr(0, 9 + bot_name.length) == bot_name.toLowerCase() + ", передай")
                {
                	if (machine[dt.message.substr(10 + bot_name.length).split(' ')[0]] === undefined)
                	{
                		machine[dt.message.substr(10 + bot_name.length).split(' ')[0]] = [];
                	}
                	machine[dt.message.substr(10 + bot_name.length).split(' ')[0]].push({});
                	var tobj = {};
                	tobj.from_login = dt.from_login;
                	tobj.message = dt.message.substr(11 + bot_name.length + dt.message.substr(10 + bot_name.length).split(' ')[0].length);
                	tobj.is_read = false;
                	var length = machine[dt.message.substr(10 + bot_name.length).split(' ')[0]].length;
                	machine[dt.message.substr(10 + bot_name.length).split(' ')[0]][length-1] = tobj;
                }


                if (dt.message.toLowerCase().substr(0, 11 + bot_name.length) == bot_name.toLowerCase() + ", сообщения")
                {
                	var read = 0, not_read = 0, total = 0;
                	if (machine[dt.from_login] !== undefined)
                	{
                		for (var i = 0; i < machine[dt.from_login].length; i++)
                		{
                			if (machine[dt.from_login][i].is_read)
                			{
                				read++;
                			}
                			else
                			{
                				not_read++;
                			}
                		}
               		}
                	total = read + not_read;
                	send("У тебя " + total + " сообщений. Прочитанных: " + read + ". И новых: " + not_read + '.');
                }

                if (dt.message.toLowerCase().substr(0, 17 + bot_name.length) == bot_name.toLowerCase() + ", новые сообщения")
                {
                	var not_read = 0;
                	var ans = '';
                	if (machine[dt.from_login] !== undefined)
                	{
                		for (var i = 0; i < machine[dt.from_login].length; i++)
                		{
                			if (!machine[dt.from_login][i].is_read)
                			{
                				not_read++;
                			}
                		}

                		ans = 'У тебя ' + not_read + " новых сообщений.";
                		for (var i = 0; i < machine[dt.from_login].length; i++)
                            {
                            	if (!machine[dt.from_login][i].is_read)
                            	{
                            		ans+= '\n' + machine[dt.from_login][i].from_login + ": " + machine[dt.from_login][i].message;
                            		//send(dt.from_login + ', тебе сообщение от ' + machine[dt.from_login][i].from_login + ': ' + machine[dt.from_login][i].message);
                            		machine[dt.from_login][i].is_read = true;
                            	}
                            }
                    }
                    else
                    {
                    	ans = "Нет новых сообщений.";
                    }
                    send(ans);
                }

                if (dt.message.toLowerCase().substr(0, 15 + bot_name.length) == bot_name.toLowerCase() + ", все сообщения")
                {
                	var ans = '', total = 0;
                	if (machine[dt.from_login] !== undefined)
                	{
                	for (var i = 0; i < machine[dt.from_login].length; i++)
                            {
                            	ans+= '\n' + machine[dt.from_login][i].from_login + ": " + machine[dt.from_login][i].message;
                            	//send(dt.from_login + ', тебе сообщение от ' + machine[dt.from_login][i].from_login + ': ' + machine[dt.from_login][i].message);
                            	machine[dt.from_login][i].is_read = true;
                            	total++;
                            }
                            ans = "Всего " + total + " сообщений." + ans;
                    }
                    else
                    {
                    	ans = 'Нет сообщений. :(';
                    }
                    send(ans);
                }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

var requestOnlineList = function(room){
	//console.log("Sending to server: " + JSON.stringify({
	//	type: PackType.online_list,
	//	target: room.name,
	//}));
	ws.send(JSON.stringify({
		type: PackType.online_list,
		target: room.name,
	}));
}

var joinRoom = function (name){
	//console.log("Sending to server: " + JSON.stringify({
	//type: PackType.join,
	//target: name,
	//}));

	ws.send(JSON.stringify({
	type: PackType.join,
	target: name,
	}));
	//curRoom.name = name;

	(async (function auth() {

  	ws.send(JSON.stringify({
					type: PackType.message,
					target: name, // this.curRoom.name,
					message: '/color ' + bot_color,
					time: Date.now(),
					login: '',
				}));

	await (sleep(4000));

	ws.send(JSON.stringify({
					type: PackType.message,
					target: name, // this.curRoom.name,
					message: '/nick ' + bot_nameOnOpen,
					time: Date.now(),
					login: '',
				}));
} ))();
};

var joinRooms = function(){
	if (rooms.length <= 0){
		joinRoom(mainRoom);
	} else {
		for (var i in rooms){
			var room = rooms[i];
			joinRoom(room.name);
		}
	}
};

ws.on('open', function open() {
	joinRooms();

});

ws.on('message', function(data, flags) {
  var dt = JSON.parse(data);
  //console.log("> " + data);
  switch (dt.type){
      case PackType.system:
      case PackType.message:
      if (dt.target !== ''){
    		bot_name = getRoomByName(dt.target).member_login;
		}
      if (dt.from_login !== undefined && dt.message !== undefined && dt.message.substr(0,2) !== './'){
      	console.log(dt.from_login + ": " + dt.message);
      }
      if (bot_name === '') break;
      if (dt.target !== ''){
    	  curRoom = getRoomByName(dt.target);
    	}
      //console.log("bot_name is: " + bot_name);
      ansMachine(dt);
	if (dt.message !== undefined && dt.message.length > 200
      && dt.from_login.toLowerCase() !== bot_name.toLowerCase())
      {
        send("С тобой так интересно!");
      }


    else if (dt.to !== '0' & dt.message.substr(0, 5) === '/say ') {
                    var say = dt.message.substr(5);
                    say = say.replaceAll('300', '').replaceAll('  ', '');
                    send(proccessMsg(say));
                }

    else if (  dt.message.toLowerCase().substr(0, 15) === "./history grep " )
      {
      	exec('cat bot.log | grep -m 3 "' + dt.message.substr(15).replaceAll('"', '').replaceAll("'", '').replaceAll('$', '').replaceAll('`', '') + '"', function callback(error, stdout, stderr){
    		send(stdout);
		});
      }

    else if (  dt.message.toLowerCase().substr(0, 8 + bot_name.length) == bot_name.toLowerCase() + ", погода" )
      {
        var whatToTell = dt.message.toLowerCase().substr(9 + bot_name.length);
        whatToTell = whatToTell.replaceAll('в ', '');
        whatToTell = whatToTell.replaceAll('городе', '');
        whatToTell = whatToTell.replaceAll('город', '');
        whatToTell = whatToTell.replaceAll(' ', '');
        whatToTell = whatToTell.replaceAll('?', '');
        whatToTell = whatToTell.replaceAll('!', '');
        if (weather[whatToTell] !== undefined && Date.now()-weather[whatToTell]['timestamp'] > 600000
          || weather[whatToTell] === undefined)
          {
	var options = {
		host: "api.openweathermap.org",
		port: 80,
		path: "/data/2.5/weather?q=" + whatToTell + "&lang=ru&units=metric&APPID=" + weatherAPIKey
	};
	var body = '';
	http.get(options, function(res){
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			body += chunk;
 		});
		res.on('end', function() {
		//console.log(body);
		while (body[0] !== '{')
		{
			body = body.substr(1);
		}
		weather[whatToTell] = JSON.parse(body);
		weather[whatToTell]['timestamp'] = Date.now();
		send_weather(weather, whatToTell);

		});
	}).on('error', function(e) {
  		//console.log("Got error on weather request: " + e.message);
	});
          }
          else
          {
            send_weather(weather, whatToTell);
          }
      }


    else if (  dt.message.toLowerCase().substr(0, 10 + bot_name.length) == bot_name.toLowerCase() + ", расскажи" )
      {
      var whatToTell = dt.message.toLowerCase().substr(11 + bot_name.length);
      var Num = jokes[whatToTell];
      if (whatToTell.toLowerCase().substr(0, 10) === 'что-нибудь')
      {
        Num = Math.floor(Math.random() * (14 - 1)) + 1;
      }
      var options = {
		host: "rzhunemogu.ru",
		port: 80,
		path: "/RandJSON.aspx?CType=" + Num
	};
	var body = '';
	http.get(options, function(res){
		res.setEncoding('binary');
		res.on('data', function(chunk) {
			body += chunk;
 		});
		res.on('end', function() {
		//console.log("Joke request response: " + body);
		while (body[0] !== '{')
		{
			body = body.substr(1);
		}
		body = body.replace(/(<([^>]+)>)/ig,"");
        body = body.replace("www.RzhuNeMogu.ru", "").replace("www.rzhunemogu.ru", "").replace('{"content":"', '').replace('"}', '');
		//var jk = JSON.parse(body);
		body = iconvlite.decode(body, 'cp1251');
		send(body);
		});
	}).on('error', function(e) {
  		//console.log("Got error on joke request: " + e.message);
	});
	}




	else if (dt.message.toLowerCase().substr(0, 8 + bot_name.length) == bot_name.toLowerCase() + ", рандом") {
                    var params = dt.message.substr(8 + bot_name.length).replaceAll(' ', '').replaceAll('(', '').replaceAll(')', '').split(',');
                    var randNum = Math.floor(Math.random() * (parseInt(params[1]) - parseInt(params[0]))) + parseInt(params[0]);
                    send(parseInt(randNum));

                    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".toLowerCase();
                    if (possible.indexOf(params[1]) !== -1) {
                        var randNum = Math.floor(Math.random() * (possible.indexOf(params[1]) - possible.indexOf(params[0]))) + possible.indexOf(params[0]);
                        send(possible[randNum]);
                    }
                }
	else if (dt.message.toLowerCase().substr(0, 12) == "цыпа, рандом") {
                    var params = dt.message.substr(12).replaceAll(' ', '').replaceAll('(', '').replaceAll(')', '').toLowerCase().split(',');
                    var randNum = Math.floor(Math.random() * (parseInt(params[1]) - parseInt(params[0]))) + parseInt(params[0]);
                    send(parseInt(randNum));

                    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".toLowerCase();
                    if (possible.indexOf(params[1]) !== -1) {
                        var randNum = Math.floor(Math.random() * (possible.indexOf(params[1]) - possible.indexOf(params[0]))) + possible.indexOf(params[0]);
                        send(possible[randNum]);
                    }
                }



	else if (dt.message.toLowerCase().substr(0, 7 + bot_name.length) == bot_name.toLowerCase() + ", стань" && (getRoomByName(dt.target).members[dt.from].is_owner ||
                	getRoomByName(dt.target).members[dt.from].is_moder)) {
                    send('/nick ' + dt.message.substr(8 + bot_name.length));
                }




	
    else if (dt.message.toLowerCase().match(new RegExp(bot_name.toLowerCase() + " ?, ? [^:]+:\\s*(.*)\\??"))) {
    				var regex = new RegExp(bot_name.toLowerCase() + " ?, ? [^:]+:\\s*(.*)\\??");
                    var q = dt.message.replace(dt.message.substr(0, bot_name.length), bot_name).replace("?", "");
                    regex = new RegExp(bot_name + " ?, ? [^:]+:\\s*(.*)\\??");
                    var tmp = q.match(regex);
                    var tmp_q = tmp[1];
                    var tmp_arr = tmp_q.split(/\s*,\s*|\s+или\s+/);
                    var randNum = Math.floor(Math.random() * (tmp_arr.length - 0)) + 0;
                    var answer = tmp_arr[randNum], smiles;
                    send(proccessMsg(answer));
                }



	else if (dt.message.toLowerCase().substr(0, 9 + bot_name.length) == bot_name.toLowerCase() + ", комната") {
                    var tmpr = dt.message.substr(10 + bot_name.length);
                    var isNew = true;
                    //console.log('Got room request - ' + tmpr);
                    for (var i in rooms) {
                    	var room = rooms[i];

                    	if (tmpr == room.name) {
                    	    isNew = false;
                    	}
               		}
               		if (isNew == true)
               		{
               		//console.log('Trying to connect to room ' + tmpr);
                    joinRoom(tmpr);
                	}
                	else
                	{
                		//console.log("Room " + tmpr + " is already in rooms array");
                	}
                }


	else if ( dt.message.match(/(https?:\/\/[^\s"']+)/g) )
      {
      var links = dt.message.match(/(https?:\/\/[^\s"']+)/g);
      var links_count = links.length;
      
      for (var i = 0; i < links_count; i++)
      {
        var options = {
		host: "127.0.0.1",
		port: 80,
		path: "/title.php?url=" + links[i]
	};
	var body = '';
	http.get(options, function(res){
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			body += chunk;
 		});
		res.on('end', function() {
		//console.log("Title request response: " + body);
		while (body[0] !== '{')
		{
			body = body.substr(1);
		}
		var ans = JSON.parse(body);
		send(ans.title);
		});
	}).on('error', function(e) {
  		//console.log("Got error on title request: " + e.message);
	});
      }
    }

else if ( (Math.floor(Math.random() * (10 - 0)) + 0) > 7)
{
	var spellCheck = [];
	var correction = '';
 	var body = '';
	var post_data = querystring.stringify({
	text: dt.message,
 	options: 512+2048+4+2+1
	});

var options = {
		host: "speller.yandex.net",
		path: "/services/spellservice.json/checkText",
		method: 'POST',
  		headers: {
    		'Content-Type': 'application/x-www-form-urlencoded', // json,
    		'Content-Length': Buffer.byteLength(post_data),
  		}
	};

var post_req = http.request(options, function(res) {
	res.setEncoding('utf8');
	res.on('data', function (chunk) {
		body += chunk;
		//console.log("chunk: " + chunk);
	});
	res.on('end', function() {
		//console.log("Spellcheck answer: " + body);
		var responseJSON = JSON.parse(body);
		for (var spellCounter = 0; spellCounter < responseJSON.length; spellCounter++){
		if (responseJSON[spellCounter].s[0] !== undefined)
		{
		correction += ' *' + responseJSON[spellCounter].s[0];
		}
		}
		send(proccessMsg(correction));
		});
});
post_req.write(post_data);
post_req.end();
}


    else if (dt.message.toLowerCase().substr(0, bot_name.length) === bot_name.toLowerCase())
        {
          var qTb = dt.message.toLowerCase().replaceAll(' ', '').replaceAll('?', '').replaceAll('!', '').replaceAll(',', '').replace(bot_name.toLowerCase(), '');
          if (BotResp[qTb] !== undefined)
          {
          var randNum = Math.floor(Math.random() * (BotResp[qTb].length - 0)) + 0;
          send(BotResp[qTb][randNum]);
          }
          else if (qTb.length < 80 && false)
          {
          	//var link = "http://google.ru/search?q=" + qTb.replaceAll('  ', ' ').replaceAll(' ', '+');
			var body = '';
			// var flag = true;
			// while (flag)
			// {
			// 	http.get(link, function(res){
			// 		if (res.statusCode > 300 && res.statusCode < 400 && res.headers.location){
			// 			if (url.parse(res.headers.location).hostname){
			// 				link = res.headers.location;
			// 			}
			// 			else {
			// 				link = "http://google.ru" + res.headers.location;
			// 			}
			// 		}
			// 		else
			// 		{
			// 			flag = false;
			// 		}
			// 	});
			// }
			http.get(options, function(res){
				res.setEncoding('utf8');
				res.on('data', function(chunk) {
				body += chunk;
 				});
			res.on('end', function() {
			console.log("Google answers: " + body);
			$ = cheerio.load(body);
			console.log("$('._Tgc'): " + $('._Tgc'));
			console.log("$('._Tgc').innerHTML: " + $('._Tgc').innerHTML);
			console.log("cheerio.text($('._Tgc')): " + cheerio.text($('._Tgc')));
			//$.root().append(body);
			var ans = '';
			if ($('._Tgc') !== undefined){
				ans = $('._Tgc').innerHTML;
				ans = ans.replaceAll(/(<([^>]+)>)/ig, "");
			}
			if (ans !== '')
				{
					send(ans);
				}
			});
			}).on('error', function(e) {
  				//console.log("Got error on title request: " + e.message);
			});
          }
        }


      case PackType.online_list:
      //console.log("Got PackType.online_list: " + JSON.stringify(dt));
      case PackType.status:
      //console.log("Got PackType.status: " + JSON.stringify(dt));
        if (dt.type == PackType.system){
          if (dt.target == ''){
            //console.log("System message: " + dt.message);
            break;
          }
        }

        for (var i in rooms){
        	var room = rooms[i];
        	if (dt.target == room.name){
        		room.onPacket(dt);
        		break;
        	}
        }

        switch (dt.status){
            case UserStatus.bad:
              this.addFormattedMsg(['brown', 'Bad userstatus. WTF???']);
              break;
          
            case UserStatus.online:
              if (this.member_id == dt.member_id){
                this.member_login = dt.name;
              }
              status[dt.name] = 'online';
              intime[dt.name] = Date.now();
        if ( ((outtime[dt.name] !== undefined && intime[dt.name]-outtime[dt.name] > 1000*60*60)
        || outtime[dt.name] === undefined) && dt.member_id !== curRoom.member_id)
        {
          switch (dt.name.toLowerCase()) {
          case bot_name.toLowerCase():
          break;
          case "minx":
          case "ксений":
          case "тушенка":
          send("Привет, Зайка^^");
          break;

          case 'lethalcheeks':
          case 'lethaldamage':
          send('привет, киса');
          break;
          case "assasin":
          send("Главный пришёл!");
          break;
          
          case "endie":
          send("Здравствуй, Создатель!");
          break;
          
          default:
          send("Привет, "+dt.name+"!");
        }
      }
        if ((outtime[dt.name] !== undefined && intime[dt.name]-outtime[dt.name] < 1000*60*60
          && intime[dt.name]-outtime[dt.name] > 1000*60) && dt.member_id !== curRoom.member_id)
        {
          send("С возвращением, "+dt.name+"!");
        }
        if (machine[dt.name] !== undefined)
        	{
        	    for (var i = 0; i < machine[dt.name].length; i++)
                        {
                          	if (!machine[dt.name][i].is_read)
                           	{
                          		send(dt.name + ', тебе сообщение от ' + machine[dt.name][i].from_login + ': ' + machine[dt.name][i].message);
                           		machine[dt.name][i].is_read = true;
                           	}
                        }
            }
              break;
          
            case UserStatus.offline:
              outtime[dt.name] = Date.now();
              status[dt.name] = 'offline';
              break;
              
            case UserStatus.away:
            status[dt.name] = 'away';
              break;
            
            case UserStatus.nick_change:
            status[dt.name] = 'online';
              break;
              
            case UserStatus.gender_change:
              break;
              
            case UserStatus.color_change:
              break;
          }
            //break;
       
        break;

        case PackType.join:
        //console.log("Got PackType.join: " + JSON.stringify(dt));
        var room = getRoomByName(dt.target);
        
        if (room == null){
          room = createRoom(dt.target);
        }
        
        room.onPacket(dt);
        //this.selectRoom(dt.target);
        if (curRoom == null || curRoom.name != dt.target){
        	var room = null;
        	if (dt.target != ''){
        		room = getRoomByName(dt.target);
        	}
        	else if (rooms.length > 0){
        		room = rooms[0];
        	}
        }
        if (room){
        	curRoom = room;
        }
        //console.log("Requesting online list from " + room.name);
        requestOnlineList(room); //onJoinRoom(room);
        
        break;

      case PackType.leave:
        // var room = this.getRoomByName(dt.target);
        // if (room){
        //   this.onLeaveRoom(room);
        // }
        break;
        
      case PackType.create_room:
        joinRoom(dt.target);
        break;
};
  // flags.binary will be set if a binary data is received.
  // flags.masked will be set if the data was masked.
});
