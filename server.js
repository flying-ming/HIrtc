/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//这里是服务器的数据库模块
var mysql = require('mysql');

var clc = require('cli-color');
var SQL_DATABASE = 'chat';
var SQL_TABLE = 'user_info';

//数据库
//启动数据库
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'hf1234',
    port: '3306'
});

//创建数据库
connection.query('create database ' + SQL_DATABASE, function (err) {
    if (err && err.number != mysql.ERROR_DB_CREATE_EXISTS) {
        // throw err;
        return;
    }
});


//指定数据库，不指定回调函数，如果出错，则体现为客户端错误
connection.query('use ' + SQL_DATABASE);

//查询有无此表格，如果没有这个表格，则添加
connection.query('SHOW CREATE TABLE USER_INFO', function (err) {
    if (err) {

        // 创建表格,插入数据
        connection.query(
            'CREATE TABLE  IF NOT EXISTS ' + SQL_TABLE +
            '(user_id int(11) AUTO_INCREMENT not null primary key , ' +
            'user_name char(8), ' +
            'user_key char(16), ' +
            'user_status int(11),' +
            'user_socket char(50))'
            //  'primary key(user_id))'
        );

        // 字符集改成gbk
        connection.query(
            'alter table user_info modify user_name char(16) character set gbk'
        );
    }
});


//查询有无此表格，如果没有这个表格，则添加
connection.query('SHOW CREATE TABLE FRIEND_INFO', function (err) {
    if (err) {

        // 创建表格,插入数据
        var SQL_TABLE = 'friend_info';
        connection.query(
            'CREATE TABLE  IF NOT EXISTS ' + SQL_TABLE +
            ' (user_id int(11) not null, ' +
            'friend_id int(11) not null, ' +
            'category_id int(11) not null, ' +
            'friend_name char(16),' +
            'primary key(user_id,friend_id))'
        );

        // 字符集改成gbk
        connection.query(
            'alter table friend_info modify friend_name char(16) character set gbk'
        );
    }
});


//查询有无此表格，如果没有这个表格，则添加
connection.query('SHOW CREATE TABLE GROUP_INFO', function (err) {
    if (err) {

        // 创建表格,插入数据
        var SQL_TABLE = 'group_info';
        connection.query(
            'CREATE TABLE  IF NOT EXISTS ' + SQL_TABLE +
            ' (group_id int(11) not null auto_increment primary key, ' +
            'group_name char(16), ' +
            'owner_id int(11) not null, ' +
            'owner_name char(16))'
        );

        // 字符集改成gbk
        connection.query(
            'alter table group_info modify group_name char(16) character set gbk'
        );
    }
});

//查询有无此表格，如果没有这个表格，则添加
connection.query('SHOW CREATE TABLE GROUP_MEMBER', function (err) {
    if (err) {

        // 创建表格,插入数据
        var SQL_TABLE = 'group_member';
        connection.query(
            'CREATE TABLE  IF NOT EXISTS ' + SQL_TABLE +
            '(group_id int(11) not null , ' +
            'user_id int(11) not null, ' +
            'status int(11), ' +
            'primary key(group_id,user_id))'
        );
    }
});


//查询有无此表格，如果没有这个表格，则添加
connection.query('SHOW CREATE TABLE CATEGORY_INFO', function (err) {
    if (err) {

        // 创建表格,插入数据
        var SQL_TABLE = 'category_info';
        connection.query(
            'CREATE TABLE  IF NOT EXISTS ' + SQL_TABLE +
            '(category_id int(11) not null auto_increment primary key, ' +
            'user_id int(11) not null, ' +
            'category_name char(16))'
        );
    }
});

//更新登陆状态
var userModSql = 'update user_info set user_status=0';
connection.query(userModSql, function (err, result) {
    if (err) {
        console.log(clc.red('[ 错误 ]') +'[ADDUSER ERROR]-', err.message);
        return;
    }

});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var UUID = require('node-uuid');
var events = require('events');
var util = require('util');
var errorCb = function (rtc) {
    return function (error) {
        if (error) {
            rtc.emit("error", error);
        }
    };
};

function Myrtc() {
    this.sockets = [];
    this.rooms = {};
    //与客户端交互  客户端连接服务器
    //this.on（）对应着socket.send
    this.on('__join', function (data, socket) {
        console.log(clc.yellow('[ 调试 ]') +this.sockets.length);
        //ids是每个与服务端相连的socketid
        var ids = [],
            i, m,
            room = data.room || "__default",
            curSocket,
            curRoom;

        curRoom = this.rooms[room] = this.rooms[room] || [];

        //给在线的所有客户端发送新的用户的socketid
        for (i = 0, m = curRoom.length; i < m; i++) {
            curSocket = curRoom[i];
            if (curSocket.id === socket.id) {
                continue;
            }
            //给ids赋值
            ids.push(curSocket.id);
            //与客户端交互
            //curSocket.send()对应着myrtc.on()
            curSocket.send(JSON.stringify({
                "eventName": "_new_peer",
                "data": {
                    "socketId": socket.id
                }
            }), errorCb);
        }

        curRoom.push(socket);
        socket.room = room;
        //把所有连接服务器的客户端id发给这个新用户
        socket.send(JSON.stringify({
            "eventName": "_peers",
            "data": {
                "connections": ids,
                "you": socket.id
            }
        }), errorCb);
        //终端输出 有新用户连接服务器
        this.emit('new_peer', socket, room);
    });

    //注册
    this.on('_register', function (data, socket) {
        //首先在数据库里新增一个用户
        var SQL_TABLE = 'user_info';
        var userModSql = 'INSERT INTO' + '  ' + SQL_TABLE + ' ' + 'SET user_name=?,user_key =?,user_status=0';
        var userModSql_Params = [data.username, data.password];
        console.log(clc.green('[ 消息 ]') +"注册" + data.username + data.password);
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log(clc.red('[ 调试 ]') +'[ADDUSER ERROR]-', err.message);
                return;
            }
            //这时需要向客户端返回用户id
            connection.query(
                'SELECT  max(user_id) from user_info',
                function selectCb(err, results, fields) {
                    if (err) {
                        throw err;
                    }
                    // console.log("[ 消息 ]注册成功");
                    console.log(clc.yellow('[ 调试 ]') +results);
                    //这里得到最大的id
                    var maxid;
                    var id = results[0];
                    maxid = id['max(user_id)'];
                    console.log(clc.green('[ 消息 ]') + maxid + "注册成功");
                    //更新登陆状态
                    var userModSql = 'update user_info set user_status=1,user_socket=? where user_id=?';
                    var userModSql_Params = [socket.id, maxid];
                    connection.query(userModSql, userModSql_Params, function (err, result) {
                        if (err) {
                            console.log('[ADDUSER ERROR]-', err.message);
                            return;
                        }

                    });

                    socket.send(JSON.stringify({
                        "eventName": "register",
                        "data": {
                            "flag": 1,
                            "userid": maxid
                        }
                    }), errorCb);
                    //用uid赋值socket.name,作为以后socket标识
                    // socket.name = maxid;
                    //这里记录下每个用户登陆的socket
                    // socketId[socketId.length] = socket.id;
                    // console.log("注册时记录的id"+socket.id);
                    // socketUid[socketUid.length] = maxid;
                });
        });
    });

    //login,客户端登陆时与服务端的交互
    this.on('__login', function (data, socket) {

        console.log(clc.blue('[ 调试 ]') + "这是登陆时的socket   " + socket.id);
        console.log(clc.yellow('[ 调试 ]') +data.userid);
        console.log(clc.yellow('[ 调试 ]') +data.password);
        //先得到最大id，防止越界
        connection.query(
            'SELECT  max(user_id) from user_info',
            function selectCb(err, results, fields) {
                if (err) {
                    throw err;
                }
                // console.log("成功");
                // console.log(results);
                var maxid;
                var id = results[0];
                maxid = id['max(user_id)'];
                if (data.userid <= maxid) {


                    //需要从数据库验证密码
                    var userGetSql = 'SELECT * FROM user_info WHERE user_id=?';
                    var userGetSql_Params = [data.userid];

                    connection.query(userGetSql, userGetSql_Params, function (err, result) {
                        if (err) {
                            console.log('[SELECT ERROR] - ', err.message);
                            return;
                        }

                        console.log(clc.green('[ 消息 ]') + "id为" + data.userid + "的用户尝试登陆,他输入的密码" + data.password);
                        var res = result[0];
                        var password = res['user_key'];
                        var username = res['user_name'];
                        // console.log(res);
                        // console.log('password is  '+password);
                        if (data.password == password) {
                            //更新登陆状态
                            var userModSql = 'update user_info set user_status=1,user_socket=? where user_id=?';
                            var userModSql_Params = [socket.id, data.userid];
                            connection.query(userModSql, userModSql_Params, function (err, result) {
                                if (err) {
                                    console.log('[ADDUSER ERROR]-', err.message);
                                    return;
                                }

                            });
                            //此时还需验证这个用户是否已经登陆
                            // for (i = 0; i < socketUid.length; i++) {
                            //     if (socketUid[i] == data.userid) {
                            //         socket.emit('password', {
                            //             flag: 0,
                            //             username: username
                            //         });
                            //         console.log(clc.yellow("[ 警告 ]") + "登陆失败：重复登陆");
                            //         return;
                            //     }
                            // }
                            //这里记录下每个用户登陆的socket
                            // socketId[socketId.length] = socket.id;
                            // socketUid[socketUid.length] = data.userid;
                            // console.log(socketId);
                            // console.log(socketUid);

                            // console.log("[ 消息 ]登陆成功");
                            // socket.emit('password', {
                            //     flag: 1,
                            //     username: username
                            // });
                            socket.send(JSON.stringify({
                                "eventName": "password",
                                "data": {
                                    "flag": 1,
                                    "username": "gaoming"
                                }
                            }), errorCb);
                        } else {
                            socket.send(JSON.stringify({
                                "eventName": "password",
                                "data": {
                                    "flag": 0
                                }
                            }), errorCb);
                            console.log(clc.yellow("[ 警告 ]") + "登陆失败：密码错误");
                        }

                        //console.log('-----------------------------------------------------------------\n\n');
                    });
                } else {
                    return;
                }
            });
        // socket.send(JSON.stringify({
        //  "eventName": "__new",
        //  "data": {
        //      "name": "gaoming"
        //  }
        // }), errorCb);

    });

    // //获取好友分组，将好友分组发送给客户端
    this.on('getCategoryInfo', function (data, socket) {
        // console.log('[ 消息 ]'+' [ 获取分组 ]');

        var userid = data.userid;
        // 从 数据库中 提取出 分组信息


        // 测试阶段，先不用组名，而是用该用户自己的ｎｉｃｋｎａｍｅ代替，后期改回ｃａｔｅｇｏｒｙ


        console.log(clc.yellow('[ 调试 ]') +"userid " + data.userid);
        var userGetSql = 'select * from category_info where user_id=?';
        var userGetSql_Params = [userid];
        connection.query(userGetSql, userGetSql_Params, function (err, result) {
            if (err) {
                console.log('[SELECT ERROR] - ', err.message);
                return;
            }
            var res = result[0];

            var catenameList = new Array;
            var cateidList = new Array;
            if (res) {
                for (i = 0; res; i++) {
                    (function () {

                        var cateid = res['category_id'];
                        var catename = res['category_name'];
                        console.log(clc.yellow('[ 调试 ]') +"cateid" + cateid);
                        console.log(clc.yellow('[ 调试 ]') +"catename" + catename);
                        catenameList[catenameList.length] = catename;
                        cateidList[cateidList.length] = cateid;
                        res = result[i + 1];
                    }).apply(this);
                }
            }
            console.log(clc.yellow('[ 调试 ]') +cateidList);
            console.log(clc.yellow('[ 调试 ]') +catenameList);
            // var  user_id =  res['user_id'];
            // var cateid = [ "1","2","3","4"];
            // var catename = ["a","b","c","d"];
            // console.log("zu"+res['user_id']);
            //                  var catename = res['category_name'];
            //                  var cateid = res['category_id'];
            //              if (res) {
            //              for (i = 0; res; i++) {
            //                          (function() {
            //                              catenameList[catenameList.length] = catename;
            //                              cateidList[cateidList.length] = cateid;
            //                              res = result[i + 1];
            //                          }).apply(this);
            //                  }
            //                  }
            //发送数据给客户端
            // var soc = this.getSocket(data.socketId);
            socket.send(JSON.stringify({
                "eventName": "showCategory",
                "data": {
                    "catename": catenameList,
                    "cateid": cateidList
                    // "categoryInfo":user_id
                }
            }), errorCb);
        });
    });


    // 客户端 发起 好友请求
    this.on('__reqFriend', function (data, socket) {
        var soc = this.getSocket(data.socketId);


        //对应 好友 没上线或者没此好友的话返回错误
        var userModSql = 'select user_status from user_info where user_id=?';
        var userModSql_Params = [data.friend_id];
        //           console.log("  添加好友时" + userModSql_Params);
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log('[ADDUSER ERROR]-', err.message);
                return;
            }
            var res = result[0];

            if (res) {
                //将 好友请求 id 对应 的 socket 找到
                var userModSql = 'select user_socket,user_name from user_info where user_id=?';
                var userModSql_Params = [data.friend_id];
                connection.query(userModSql, userModSql_Params, function (err, result) {
                    if (err) {
                        console.log('[ADDUSER ERROR]-', err.message);
                        return;
                    }
                    var res = result[0];

                    var friend_socket = res['user_socket'];
                    var friend_name = res['user_name'];

                    console.log(clc.yellow('[ 调试 ]') +"  添加好友时 调试  " + friend_socket);

                   // 将 好友请求 发送给 相应的好友
                    if (friend_socket) {
                        soc.send(JSON.stringify({
                            "eventName": "_reqAddFriend",
                            "data": {
                                "friend_id": data.friend_id,
                                "friend_name": friend_name,
                                "req_socket": soc
                            }
                        }), errorCb);
                    }
                });




            } else {
                //没有此好友
                return;
            }

        });


    });

    //同意添加好友
    this.on('__addFriend', function (data, socket) {
        var soc = this.getSocket(data.socketId);
        var friend_socket = data.req_socket;


        //将好友信息存入数据库
        var userModSql = 'insert into friend_info  set user_id  = ? ,friend_id = ?,friend_name=?,category_id=1';
        var userModSql_Params = [data.user_id, data.friend_id, data.friend_name];
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log('[ADDUSER ERROR]-', err.message);
                return;
            }
        });
        var userModSql = 'insert into friend_info  set user_id  = ? ,friend_id = ?,friend_name=?,category_id=1';
        var userModSql_Params = [data.friend_id, data.user_id, data.user_name];
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log('[ADDUSER ERROR]-', err.message);
                return;
            } else {
                soc.send(JSON.stringify({
                    "eventName": "_addFriend",
                    "data": {
                        "flag": 0 //通知被加好友添加好友成功
                    }
                }), errorCb);
                req_socket.send(JSON.stringify({
                    "eventName": "_addFriend",
                    "data": {
                        "flag": 0 //通知申请好友添加还有成功
                    }
                }), errorCb);
            }

        });


    });


    //拒绝添加好友
    this.on('refuse_addFreiend', function (data, socket) {
        var soc = this.getSocket(data.socketId);
        var friend_socket = data.req_socket;

        friend_socket.send(JSON.stringify({
            "eventName": "refuse_addFreiend",
            "data": {
                "friend_name": data.friend_name,
                "flag": 0
            }
        }), errorCb);
    });

    //申请删除好友
    this.on('__delFriend', function (data, socket) {
        var soc = this.getSocket(data.socketId);


        //删除好友
        var userGetSql = 'delete  FROM friend_info WHERE  (user_id=? and friend_id=?) or (user_id=? and friend_id=?)';
        var userGetSql_Params = [data.user_id, data.friend_id, data.friend_id, data.user_id];
        connection.query(userGetSql, userGetSql_Params, function (err, result) {
            if (err) {
                console.log('[SELECT ERROR] - ', err.message);
                return;
            } else {
                soc.send(JSON.stringify({
                    "eventName": "delFriend",
                    "data": {
                        "flag": 0 //通知申请者删除好友成功
                    }
                }), errorCb);
            }

        });


    });


    //修改分组
    this.on('__alterCategory', function (data, socket) {
        var soc = this.getSocket(data.socketId);


        //对应 好友 没上线或者没此好友的话返回错误
        var userModSql = 'update  friend_info set  category_id=? where user_id=? and friend_id=?';
        var userModSql_Params = [data.category_id, data.user_id, data.friend_id];
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log('[ADDUSER ERROR]-', err.message);
                return;
            } else {
                soc.send(JSON.stringify({
                    "eventName": "_alterCategory",
                    "data": {
                        "flag": 0 //通知申请者修改好友分组成功
                    }
                }), errorCb);
            }
        });


    });

    //申请添加群
    this.on('__reqAddGroup', function (data, socket) {
        var soc = this.getSocket(data.socketId);

        var userModSql = 'insert into group_member set user_id=?,group_id=?,status=1';
        var userModSql_Params = [data.user_id, data.group_id];
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log('[ADDUSER ERROR]-', err.message);
                return;
            } else {
                soc.send(JSON.stringify({
                    "eventName": "_alterCategory",
                    "data": {
                        "flag": 0 //通知申请者申请入群成功
                    }
                }), errorCb);
            }

        });


    });


    //与客户端交互， 点对点连接部分 this.on() 对应着 myrtc.socket.send()
    this.on('__ice_candidate', function (data, socket) {
        var soc = this.getSocket(data.socketId);

        if (soc) {
            soc.send(JSON.stringify({
                "eventName": "_ice_candidate",
                "data": {
                    "label": data.label,
                    "candidate": data.candidate,
                    "socketId": socket.id
                }
            }), errorCb);

            this.emit('ice_candidate', socket, data);
        }
    });
    //与客户端交互，信令交互部分
    this.on('__offer', function (data, socket) {
        var soc = this.getSocket(data.socketId);

        if (soc) {
            soc.send(JSON.stringify({
                "eventName": "_offer",
                "data": {
                    "sdp": data.sdp,
                    "socketId": socket.id
                }
            }), errorCb);
        }
        this.emit('offer', socket, data);
    });
    //交互，信令交换部分
    this.on('__answer', function (data, socket) {
        var soc = this.getSocket(data.socketId);
        if (soc) {
            soc.send(JSON.stringify({
                "eventName": "_answer",
                "data": {
                    "sdp": data.sdp,
                    "socketId": socket.id
                }
            }), errorCb);
            this.emit('answer', socket, data);
        }
    });
}

util.inherits(Myrtc, events.EventEmitter);

Myrtc.prototype.addSocket = function (socket) {
    this.sockets.push(socket);
};

Myrtc.prototype.removeSocket = function (socket) {
    var i = this.sockets.indexOf(socket),
        room = socket.room;
    this.sockets.splice(i, 1);
    if (room) {
        i = this.rooms[room].indexOf(socket);
        this.rooms[room].splice(i, 1);
        if (this.rooms[room].length === 0) {
            delete this.rooms[room];
        }
    }
};

Myrtc.prototype.broadcast = function (data, errorCb) {
    var i;
    for (i = this.sockets.length; i--;) {
        this.sockets[i].send(data, errorCb);
    }
};

Myrtc.prototype.broadcastInRoom = function (room, data, errorCb) {
    var curRoom = this.rooms[room],
        i;
    if (curRoom) {
        for (i = curRoom.length; i--;) {
            curRoom[i].send(data, errorCb);
        }
    }
};

Myrtc.prototype.getRooms = function () {
    var rooms = [],
        room;
    for (room in this.rooms) {
        rooms.push(room);
    }
    return rooms;
};

Myrtc.prototype.getSocket = function (id) {
    var i,
        curSocket;
    if (!this.sockets) {
        return;
    }
    for (i = this.sockets.length; i--;) {
        curSocket = this.sockets[i];
        if (id === curSocket.id) {
            return curSocket;
        }
    }
    return;
};

Myrtc.prototype.init = function (socket) {
    var that = this;
    socket.id = UUID.v4();
    that.addSocket(socket);
    //为新连接绑定事件处理器
    socket.on('message', function (data) {
        var json = JSON.parse(data);
        if (json.eventName) {
            that.emit(json.eventName, json.data, socket);
        } else {
            that.emit("socket_message", socket, data);
        }
    });
    //连接关闭后从RTC实例中移除连接，并通知其他连接
    socket.on('close', function () {
        var i, m,
            room = socket.room,
            curRoom;
        if (room) {
            curRoom = that.rooms[room];
            for (i = curRoom.length; i--;) {
                if (curRoom[i].id === socket.id) {
                    continue;
                }
                curRoom[i].send(JSON.stringify({
                    "eventName": "_remove_peer",
                    "data": {
                        "socketId": socket.id
                    }
                }), errorCb);
            }
        }

        that.removeSocket(socket);

        that.emit('remove_peer', socket.id, that);
    });
    that.emit('new_connect', socket);
};


function ListenRTC(server) {
    var RTCServer;
    if (typeof server === 'number') {
        RTCServer = new WebSocketServer({
            port: server
        });
    } else {
        RTCServer = new WebSocketServer({
            server: server
        });
    }

    RTCServer.rtc = new Myrtc();
    errorCb = errorCb(RTCServer.rtc);
    RTCServer.on('connection', function (socket) {
        this.rtc.init(socket);
    });

    return RTCServer;
}


// module.exports.listen = function(server) {
//  var RTCServer;
//  if (typeof server === 'number') {
//      RTCServer = new WebSocketServer({
//          port: server
//      });
//  } else {
//      RTCServer = new WebSocketServer({
//          server: server
//      });
//  }

//  RTCServer.rtc = new Myrtc();
//  errorCb = errorCb(RTCServer.rtc);
//  RTCServer.on('connection', function(socket) {
//      this.rtc.init(socket);
//  });

//  return RTCServer;
// };
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


var express = require('express');
var app = express();

var fs = require('fs');

var options = {
    key: fs.readFileSync('./pem/www.example.localhost.com.dec.key.pem'),
    cert: fs.readFileSync('./pem/www.example.localhost.com.cert.pem')
};

var WebSocketServer = require('ws').Server;
var server = require('https').createServer(options, app);
//var RTC = require('rtc').listen(server);
var RTC = ListenRTC(server);
var path = require("path");

var port = process.env.PORT || 3000;
server.listen(port);


app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});


app.get('/js/bootstrap.js', function (req, res) {
    res.sendfile(__dirname + '/js/bootstrap.js');
});

// app.get('/js_1/bootstrap.min.js', function(req, res) {
//     res.sendfile(__dirname + '/js_1/bootstrap.min.js');
// });

app.get('/js/jquery.js', function (req, res) {
    res.sendfile(__dirname + '/js/jquery.js');
});

// app.get('/js_1/jquery.min.js', function(req, res) {
//     res.sendfile(__dirname + '/js_1/jquery.min.js');
// });

// app.get('/js_1/jquery.resizeend.js', function(req, res) {
//     res.sendfile(__dirname + '/js_1/resizeend.js');
// });

app.get('/js/jquery-ui.js', function (req, res) {
    res.sendfile(__dirname + '/js/jquery-ui.js');
});

// app.get('/js_1/jquery-ui.min.js', function(req, res) {
//     res.sendfile(__dirname + '/js_1/jquery-ui.min.js');
// });

app.get('/js/myjs.js', function (req, res) {
    res.sendfile(__dirname + '/js/myjs.js');
});

// app.get('/js_1/npm.js', function(req, res) {
//     res.sendfile(__dirname + '/js_1/npm.js');
// });


// app.get('/jquery.js', function(req, res) {
//     res.sendfile(__dirname + '/js/jquery.js');
// });

app.get('/js/client.js', function (req, res) {
    res.sendfile(__dirname + '/js/client.js');
});


app.get('/client.css', function (req, res) {
    res.sendfile(__dirname + '/css/client.css');
});

app.get('/css/bootstrap.min.css', function (req, res) {
    res.sendfile(__dirname + '/css/bootstrap.min.css');
});

app.get('/css/bootstrap-theme.css', function (req, res) {
    res.sendfile(__dirname + '/css/bootstrap-theme.css');
});

app.get('/css/font-awesome.min.css', function (req, res) {
    res.sendfile(__dirname + '/css/font-awesome.min.css');
});

app.get('/css/mycss.css', function (req, res) {
    res.sendfile(__dirname + '/css/mycss.css');
});

app.get('/css/awesome.min.css', function (req, res) {
    res.sendfile(__dirname + '/css/awesome.min.css');
});

app.get('/css/show_user_data.css', function (req, res) {
    res.sendfile(__dirname + '/css/show_user_data.css');
});

app.get('/css/bootstrap.css', function (req, res) {
    res.sendfile(__dirname + '/css/bootstrap.css');
});


//pictures
app.get('/image/friends.png', function (req, res) {
    res.sendfile(__dirname + '/image/friends.png');
});

app.get('/image/grouptalk.png', function (req, res) {
    res.sendfile(__dirname + '/image/grouptalk.png');
});

app.get('/image/left.png', function (req, res) {
    res.sendfile(__dirname + '/image/left.png');
});

app.get('/image/right.png', function (req, res) {
    res.sendfile(__dirname + '/image/right.png');
});

app.get('/image/exit.png', function (req, res) {
    res.sendfile(__dirname + '/image/exit.png');
});


app.get('/image/exit.png', function (req, res) {
    res.sendfile(__dirname + '/image/exit.png');
});

app.get('/image/handup.png', function (req, res) {
    res.sendfile(__dirname + '/image/handup.png');
});

app.get('/image/invite.png', function (req, res) {
    res.sendfile(__dirname + '/image/invite.png');
});

app.get('/image/mic.png', function (req, res) {
    res.sendfile(__dirname + '/image/mic.png');
});

app.get('/image/micstop.png', function (req, res) {
    res.sendfile(__dirname + '/image/micstop.png');
});

app.get('/image/session.png', function (req, res) {
    res.sendfile(__dirname + '/image/session.png');
});

app.get('/image/upload.png', function (req, res) {
    res.sendfile(__dirname + '/image/upload.png');
});

app.get('/image/video.png', function (req, res) {
    res.sendfile(__dirname + '/image/video.png');
});

app.get('/image/whiteboard.png', function (req, res) {
    res.sendfile(__dirname + '/image/whiteboard.png');
});

RTC.rtc.on('new_connect', function (socket) {
    console.log(clc.green('[ 消息 ]') +'创建新连接');
});

RTC.rtc.on('remove_peer', function (socketId) {
    console.log(clc.green('[ 消息 ]') +socketId + "用户离开");
});

RTC.rtc.on('new_peer', function (socket, room) {
    console.log(clc.green('[ 消息 ]') +"新用户" + socket.id + "加入房间" + room);
});

RTC.rtc.on('socket_message', function (socket, msg) {
    console.log(clc.yellow('[ 调试 ]') + "接收到来自" + socket.id + "的新消息：" + msg);
});

RTC.rtc.on('ice_candidate', function (socket, ice_candidate) {
    console.log(clc.yellow('[ 调试 ]') +"接收到来自" + socket.id + "的ICE Candidate");
});

RTC.rtc.on('offer', function (socket, offer) {
    console.log(clc.yellow('[ 调试 ]') +"接收到来自" + socket.id + "的Offer");
});

RTC.rtc.on('answer', function (socket, answer) {
    console.log(clc.yellow('[ 调试 ]') +"接收到来自" + socket.id + "的Answer");
});

RTC.rtc.on('error', function (error) {
    console.log(clc.red('[ 错误 ]') +"发生错误：" + error.message);
});
