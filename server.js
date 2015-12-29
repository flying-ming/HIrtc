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
    password: 'ms888nnn',
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
            '(category_id int(11) not null ,' +
            'user_id int(11) not null, ' +
            'category_name char(16),' +
            'primary key(category_id,user_id))'
        );
    }
});

////查询有无此表格，如果没有这个表格，则添加
//connection.query('SHOW CREATE TABLE CATEGORY_INFO', function (err) {
//    if (err) {
//
//        // 创建表格,插入数据
//        var SQL_TABLE = 'category_info';
//        connection.query(
//            'CREATE TABLE  IF NOT EXISTS ' + SQL_TABLE +
//            '(category_id int(11) not null auto_increment primary key, ' +
//            'user_id int(11) not null, ' +
//            'category_name char(16))'
//        );
//    }
//});

//更新登陆状态
var userModSql = 'update user_info set user_status=0';
connection.query(userModSql, function (err, result) {
    if (err) {
        console.log(clc.red('[ 错误 ]') + '[ADDUSER ERROR]-', err.message);
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
    //用来保存 登陆用户的socket ，键是 userId ，值是 socket
    this.userSockets = {};
    this.sockets = [];
    //记录下 所有登陆成功的 user
    this.userId = [];
    this.rooms = {};
    //与客户端交互  客户端连接服务器
    //this.on（）对应着socket.send
    this.on('__join', function (data, socket) {
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
    //this.on('__close', function(data,socket){
    //    //把    this.userSockets  this.sockets  去掉
    //    var i;
    //    for(i=0;i<this.sockets.length;i++){
    //        if(data.socket == this.userSockets[i]){
    //            this.sockets.splice(i,1);
    //        }
    //        delete this.userSockets[data.userId];
    //    }
    //});
    //注册
    this.on('_register', function (data, socket) {
        var that = this;
        //首先在数据库里新增一个用户
        var SQL_TABLE = 'user_info';
        var userModSql = 'INSERT INTO' + '  ' + SQL_TABLE + ' ' + 'SET user_name=?,user_key =?,user_status=0';
        var userModSql_Params = [data.userName, data.password];
        console.log(clc.green('[ 消息 ]') + "注册" + data.userName + data.password);
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log(clc.red('[ 错误 ]') + '[ADDUSER ERROR]-', err.message);
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
                    console.log(clc.blue('[ 调试 ]') + results);
                    //这里得到最大的id
                    var maxid;
                    var id = results[0];
                    maxid = id['max(user_id)'];
                    console.log(clc.green('[ 消息 ]') + maxid + "注册成功");
                    //更新登陆状态 记录为在线
                    var userModSql = 'update user_info set user_status=1,user_socket=? where user_id=?';
                    var userModSql_Params = [socket.id, maxid];
                    connection.query(userModSql, userModSql_Params, function (err, result) {
                        if (err) {
                            console.log(clc.red('[ 错误 ]' + ':更新状态'), err.message);
                            return;
                        }
                        //创建默认分组
                        var userGetSql = 'insert into category_info set  category_name=? ,user_id=?,category_id=?';
                        var userGetSql_Params = ["myFriend", maxid, "1"];
                        connection.query(userGetSql, userGetSql_Params, function (err, result) {
                            if (err) {
                                console.log(clc.red('[ 错误 ]' + ':创建默认分组'), err.message);
                                return;
                            }
                        });
                        //创建默认会议群
                        //将此用户的socket加入服务器全局变量中
                        that.userId.push(maxid);
                        that.userSockets[maxid] = socket;
                        //告诉新用户，注册成功
                        socket.send(JSON.stringify({
                            "eventName": "register",
                            "data": {
                                "flag": 1,
                                "userId": maxid,
                                "userName": data.userName
                            }
                        }), errorCb);
                        console.log(clc.blue('[ 调试 ]') + maxid + "注册成功");
                    });

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
        var that = this;
        console.log(clc.blue('[ 调试 ]') + "这是登陆时的socket   " + socket.id);
        //console.log(clc.yellow('[ 调试 ]') + data.userId);
        //console.log(clc.yellow('[ 调试 ]') + data.password);
        //先得到最大id，防止越界
        connection.query(
            'SELECT  max(user_id) from user_info',
            function selectCb(err, results, fields) {
                if (err) {
                    throw err;
                }
                var maxid;
                var id = results[0];
                maxid = id['max(user_id)'];
                if (data.userId <= maxid) {
                    //验证是否重复登陆
                    console.log(clc.blue("[ 调试 ]") + "验证：是否重复登陆,user"+data.userId);
                    //console.log
                    for (var i = 0; i < that.userId.length; i++) {
                        console.log(clc.blue("[ 调试 ]") + "验证：是否重复登陆,server"+that.userId[i]);
                        if (data.userId == that.userId[i]) {
                            //登陆失败
                            socket.send(JSON.stringify({
                                "eventName": "password",
                                "data": {
                                    "flag": 0
                                }
                            }), errorCb);
                            console.log(clc.yellow("[ 警告 ]") + "登陆失败：重复登陆");
                            return;
                        }
                    }
                    //不是重复登陆
                    //需要从数据库验证密码
                    console.log(clc.blue("[ 调试 ]") + "不是重复登陆");
                    var userGetSql = 'SELECT * FROM user_info WHERE user_id=?';
                    var userGetSql_Params = [data.userId];
                    connection.query(userGetSql, userGetSql_Params, function (err, result) {
                        if (err) {
                            console.log('[SELECT ERROR] - ', err.message);
                            return;
                        }
                        console.log(clc.green('[ 消息 ]') + "id为" + data.userId + "的用户尝试登陆,他输入的密码" + data.password);
                        var res = result[0];
                        var password = res['user_key'];
                        var userName = res['user_name'];
                        //验证密码
                        if (data.password == password) {
                            //密码正确
                            //更新登陆状态
                            var userModSql = 'update user_info set user_status=1,user_socket=? where user_id=?';
                            var userModSql_Params = [socket.id, data.userId];
                            connection.query(userModSql, userModSql_Params, function (err, result) {
                                if (err) {
                                    console.log('[ADDUSER ERROR]-', err.message);
                                    return;
                                }
                                //将此用户的socket加入服务器全局变量中
                                var strUserid = '' + data.userId;
                                that.userId.push(data.userId);
                                that.userSockets[strUserid] = socket;
                                console.log(clc.green('[ 消息 ]') + "id为" + data.userId + "的用户登陆成功");
                                //给客户端发送登陆成功
                                socket.send(JSON.stringify({
                                    "eventName": "password",
                                    "data": {
                                        "flag": 1,
                                        "userName": userName,
                                        "userId": data.userId
                                    }
                                }), errorCb);
                            });
                        } else {
                            //登陆失败
                            socket.send(JSON.stringify({
                                "eventName": "password",
                                "data": {
                                    "flag": 0
                                }
                            }), errorCb);
                            console.log(clc.yellow("[ 警告 ]") + "登陆失败：密码错误");
                        }
                    });
                } else {
                    return;
                }
            });
    });

    //组的操作,目前项目只有一个默认组
    this.on('changeCategory', function (data, socket) {
        //flag 1 是创建组 。flag 2 是改名 。flag 3 增加/减少成员 。 flag  4 是删除组
        if (data.flag == 1) {
            //flag == 1 创建组
            // var obj = {
            // 	obj.name_Category=...;
            // }
            var userGetSql = 'insert into category_info set  category_name=? ,user_id=?';
            var userGetSql_Params = [data.name_Category, userid];
            connection.query(userGetSql, userGetSql_Params, function (err, result) {
                if (err) {
                    console.log('[SELECT ERROR] - ', err.message);
                    return;
                }
            });
            console.log(clc.blue('[ 调试 ]') + '创建组操作');
            //创建完成之后需要返回id_Category,默认123
            socket.emit('create_Category', 123);
        } else {
            if (data.flag == 2) {
                //flag ==2  组改名
                // var obj = {
                // 	obj.name_Category=...;
                //	obj.id_Category=...;
                // }
                //完成之后返回-1
                var userid = socket.name;
                var userGetSql = 'update  category_info set  category_name=? where user_id=? and category_id=?';
                var userGetSql_Params = [data.name_Category, userid, data.id_Category];
                connection.query(userGetSql, userGetSql_Params, function (err, result) {
                    if (err) {
                        console.log('[SELECT ERROR] - ', err.message);
                        return;
                    }
                });
                console.log(clc.blue('[ 调试 ]') + '组改名操作');
                socket.emit('rename_Category', -1);
            } else {
                if (data.flag == 3) {
                    //flag == 3 增加减少组成员
                    //修改属性
                    //var obj = {
                    // 	obj.fid=...;
                    //	obj.id_Category=...;
                    // }
                    //完成之后返回-1
                    var userid = socket.name;
                    var userGetSql = 'update  friend_info set  category_id=? where user_id=? and friend_id=?';
                    var userGetSql_Params = [data.id_Category, userid, data.fid];
                    connection.query(userGetSql, userGetSql_Params, function (err, result) {
                        if (err) {
                            console.log('[SELECT ERROR] - ', err.message);
                            return;
                        }
                    });
                    console.log(clc.blue('[ 调试 ]') + '组成员增减操作');
                    socket.emit('addMember_Category', -1);
                } else {
                    if (data.flag == 4) {
                        //flag == 4 删除组，假如原来组里还有成员，删除组之后，成员会转移到第一组里面
                        //var obj = {
                        // 	obj.fid=...;
                        //	obj.id_Category=...;
                        // }
                        //完成之后返回-1
                        console.log(clc.blue('[ 调试 ]') + '开始删除组操作');
                        var categoryid;

                        var userid = socket.name;


                        var userGetSql = 'delete from category_info where category_id=?';
                        var userGetSql_Params = [data.id_Category];
                        connection.query(userGetSql, userGetSql_Params, function (err, result) {
                            if (err) {
                                console.log('[SELECT ERROR] - ', err.message);
                                return;
                            }
                        });

                        var userGetSql = 'select  category_id from category_info where user_id=?';
                        var userGetSql_Params = [userid];
                        connection.query(userGetSql, userGetSql_Params, function (err, result) {
                            if (err) {
                                console.log('[SELECT ERROR] - ', err.message);
                                return;
                            }
                            var res = result[0];
                            categoryid = res['category_id'];
                            var userGetSql = 'update  friend_info set  category_id=? where category_id=?';
                            var userGetSql_Params = [categoryid, data.id_Category];
                            connection.query(userGetSql, userGetSql_Params, function (err, result) {
                                if (err) {
                                    console.log('[SELECT ERROR] - ', err.message);
                                    return;
                                }
                            });
                        });
                        console.log(clc.blue('[ 调试 ]') + '组删除操作');
                        socket.emit('del_Category', -1);
                    }
                }
            }
        }
        // socket.emit('changeCategory',)
    });


    // //获取好友分组，将好友分组发送给客户端
    // 一般发生在登陆和修改分组之后
    this.on('getCategoryInfo', function (data, socket) {
        // console.log('[ 消息 ]'+' [ 获取分组 ]');
        // 从 数据库中 提取出 分组信息
        console.log(clc.blue('[ 调试 ]') + "userid为" + data.userId + "的用户获取好友列表");
        // 从category_info表里面找出组id和组名
        var userGetSql = 'select * from category_info where user_id=?';
        var userGetSql_Params = [data.userId];
        connection.query(userGetSql, userGetSql_Params, function (err, result) {
            if (err) {
                console.log('[SELECT ERROR] - ', err.message);
                return;
            }
            console.log(clc.blue('[ 调试 ]') + "申请好友列表时的result为" + result);
            var res = result[0];
            var catenameList = res['category_name'];
            //目前项目默认分组id为1
            var cateidList = res['category_id'];
            //从friend_info表中找出对应组id的好友
            //var userid = socket.name;
            var groups = [];
            var currentGroup;
            //for(var cli = 0;cli<)
            var userGetSql = 'select * from friend_info  where user_id=? and category_id=?';
            var userGetSql_Params = [data.userId, "1"];
            connection.query(userGetSql, userGetSql_Params, function (err, result) {
                if (err) {
                    console.log('[SELECT ERROR] - ', err.message);
                    return;
                }
                var i;
                res = result[0];
                var friendIdList = res['friend_id'];
                var friendNameList = res['friend_name'];
                currentGroup={
                    groupId:cateidList,
                    groupName:catenameList,
                    friends:[]
                };
                for(i=0;i<friendIdList.length;i++){
                    currentGroup.friends.push({id:friendIdList[i],name:friendNameList[i]});
                }
                groups.push(currentGroup);
                socket.send(JSON.stringify({
                    "eventName": "showCategory",
                    "data": {
                        "groups":groups
                    }
                }), errorCb);
            });
        });
    });


    // 客户端 发起 好友请求
    this.on('__reqFriend', function (data, socket) {
        var that = this;
        //如果添加自己为好友，返回错误
        if(data.userId == data.friend_id) {
            console.log(clc.red('[ 错误 ]') + "添加自己为好友");
            that.userSockets[data.userId].send(JSON.stringify({
                "eventName":"_reqAddFriend",
                "data":{
                    flag:1
                }
            }),errorCb);
        }
        //对应 好友 没上线或者没此好友的话返回错误
        var userModSql = 'select user_status from user_info where user_id=?';
        var userModSql_Params = [data.friend_id];
        //console.log("  添加好友时" + userModSql_Params);
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log(clc.red('[ 错误 ]') + "好友不在线");
                console.log('[ADDUSER ERROR]-', err.message);
                return;
            }
            var res = result[0]['user_status'];
            //如果已经是好友，返回错误  没写
            //如果在线
            if (res) {
                that.userSockets[data.friend_id].send(JSON.stringify({
                    "eventName": "_reqAddFriend",
                    "data": {
                        "flag":0,
                        //"socketId": socket.id,
                        "reqFriendId": data.userId,
                        "reqFriendName": data.userName,
                        "reqFriendMessage": data.reqFriendMessage
                    }
                }), errorCb);

                //如果不在线
            } else {
                //没有此好友 或者 好友不在线
                that.userSockets[data.userId].send(JSON.stringify({
                    "eventName":"_reqAddFriend",
                    "data":{
                        "flag":1
                    }
                }),errorCb);
            }
        });
    });

    //同意添加好友
    this.on('__addFriend', function (data, socket) {
        var that = this;
        //var soc = this.getSocket(data.socketId);
        //var friend_socket = data.req_socket;
        console.log(clc.blue('[ 调试 ]') + "进入添加好友程序");
        //将信息写入分组信息库
        //将好友信息存入数据库
        var userModSql = 'insert into friend_info  set user_id  = ? ,friend_id = ?,friend_name=?,category_id=1';
        var userModSql_Params = [data.userId, data.reqFriendId, data.reqFriendName];
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log('[ADDUSER ERROR]-', err.message);
                return;
            }
        });
        var userModSql = 'insert into friend_info  set user_id  = ? ,friend_id = ?,friend_name=?,category_id=1';
        var userModSql_Params = [data.reqFriendId, data.userId, data.userName];
        connection.query(userModSql, userModSql_Params, function (err, result) {
            if (err) {
                console.log('[ADDUSER ERROR]-', err.message);
                return;
            } else {
                that.userSockets[data.userId].send(JSON.stringify({
                    "eventName": "_addFriend",
                    "data": {
                        "flag": 0 //通知被加好友添加好友成功
                    }
                }), errorCb);
                that.userSockets[data.reqFriendId].send(JSON.stringify({
                    "eventName": "_addFriend",
                    "data": {
                        "flag": 0 //通知申请好友添加好友成功
                    }
                }), errorCb);
            }
        });
    });

    //拒绝添加好友
    this.on('refuse_addFreiend', function (data, socket) {
        //console.log(clc.blue('[ 调试 ]') + "请求发起者是" + data.reqFriendId);
        console.log(clc.blue('[ 调试 ]') + "进入拒绝添加好友程序");
        //告诉发起请求者，请求被拒绝
        this.userSockets[data.reqFriendId].send(JSON.stringify({
            "eventName": "refuse_addFreiend",
            "data": {
                "friend_name": data.reqFriendName,
                "friend_id": data.reqFriendId,
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
    console.log(clc.green('[ 消息 ]') + '创建新连接');
});

RTC.rtc.on('remove_peer', function (socketId) {
    console.log(clc.green('[ 消息 ]') + socketId + "用户离开");
});

RTC.rtc.on('new_peer', function (socket, room) {
    console.log(clc.green('[ 消息 ]') + "新用户" + socket.id + "加入房间" + room);
});

RTC.rtc.on('socket_message', function (socket, msg) {
    console.log(clc.blue('[ 调试 ]') + "接收到来自" + socket.id + "的新消息：" + msg);
});

RTC.rtc.on('ice_candidate', function (socket, ice_candidate) {
    console.log(clc.blue('[ 调试 ]') + "接收到来自" + socket.id + "的ICE Candidate");
});

RTC.rtc.on('offer', function (socket, offer) {
    console.log(clc.blue('[ 调试 ]') + "接收到来自" + socket.id + "的Offer");
});

RTC.rtc.on('answer', function (socket, answer) {
    console.log(clc.blue('[ 调试 ]') + "接收到来自" + socket.id + "的Answer");
});

RTC.rtc.on('error', function (error) {
    console.log(clc.red('[ 错误 ]') + "发生错误：" + error.message);
});
