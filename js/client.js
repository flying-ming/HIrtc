var MyRTC = function () {
    var PeerConnection = (window.PeerConnection || window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
    var URL = (window.URL || window.webkitURL || window.msURL || window.oURL);
    var getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
    var nativeRTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);
    var nativeRTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription); // order is very important: "RTCSessionDescription" defined in Nighly but useless
    var moz = !!navigator.mozGetUserMedia;
    var iceServer = {
        "iceServers": [{
            "url": "stun:stun.l.google.com:19302"
            // "url": "stun:stun.services.mozilla.com"
        }]
    };
    var friendChatPanels = {};
    //保存这个客户端的 userId
    var userId = null;
    //保存这个客户端的username
    var userName;
    var packetSize = 1000;

    /**********************************************************/
    /*                                                        */
    /*                       事件处理器                       */
    /*                                                        */
    /**********************************************************/
    function EventEmitter() {
        this.events = {};
    }

    //绑定事件函数
    EventEmitter.prototype.on = function (eventName, callback) {
        this.events[eventName] = this.events[eventName] || [];
        this.events[eventName].push(callback);
    };
    //触发事件函数
    EventEmitter.prototype.emit = function (eventName, _) {
        var events = this.events[eventName],
            args = Array.prototype.slice.call(arguments, 1),
            i, m;

        if (!events) {
            return;
        }
        for (i = 0, m = events.length; i < m; i++) {
            events[i].apply(null, args);
        }
    };


    /**********************************************************/
    /*                                                        */
    /*                   流及信道建立部分                     */
    /*                                                        */
    /**********************************************************/


    /*******************基础部分*********************/
    function myrtc() {
        //本地media stream
        this.localMediaStream = null;
        //所在房间
        this.room = "";
        //接收文件时用于暂存接收文件
        this.fileData = {};
        //本地WebSocket连接
        this.socket = null;
        //本地socket的id，由后台服务器创建
        this.me = null;
        //保存所有已登录的群成员的 peer connection,键为socket id，值为PeerConnection类型
        //this.groupPeerConnections = {};
        //保存所有与本地相连的peer connection， 键为socket id，值为PeerConnection类型
        this.peerConnections = {};
        //保存所有与本地相连的peer connection， 键为socket id，值为{id:userId,name:userName}
        this.peerConnectionsName = {};
        //保存所有与本地连接的群成员socket的id
        this.groupConnections = [];
        //保存所有与本地连接的socket的id
        this.connections = [];
        //初始时需要构建链接的数目
        this.numStreams = 0;
        //初始时已经连接的数目
        this.initializedStreams = 0;
        //保存所有的data channel，键为socket id，值通过PeerConnection实例的createChannel创建
        this.dataChannels = {};
        //保存所有发文件的data channel及其发文件状态
        this.fileChannels = {};
        //保存所有接受到的文件
        this.receiveFiles = {};
        //保存现在正在聊天的好友id
        //this.curFriendId = null;
        ////保存目前好友列表中第一位的好友id
        //this.curFirstFriendId = null;
        //用来保存 登陆并且打开了视频的 用户    键是 socket.id ，值是 {name:userName,id:userid}
        this.readyUsers = {};
    }

    //继承自事件处理器，提供绑定事件和触发事件的功能
    myrtc.prototype = new EventEmitter();


    /*************************服务器连接部分***************************/


    //本地连接信道，信道为websocket
    myrtc.prototype.connect = function (server, room) {
        var socket,
            that = this;
        room = room || "";
        socket = this.socket = new WebSocket(server);
        socket.onopen = function () {
            socket.send(JSON.stringify({
                "eventName": "__join",
                "data": {
                    "room": room
                }
            }));
            that.emit("socket_opened", socket);
        };

        socket.onmessage = function (message) {
            var json = JSON.parse(message.data);
            if (json.eventName) {
                that.emit(json.eventName, json.data);
            } else {
                that.emit("socket_receive_message", socket, json);
            }
        };

        socket.onerror = function (error) {
            that.emit("socket_error", error, socket);
        };

        //这个socket关闭的时候
        socket.onclose = function (data) {
            that.localMediaStream.close();
            var pcs = that.peerConnections;
            var i;
            for (i = pcs.length; i--;) {
                that.closePeerConnection(pcs[i]);
            }
            that.peerConnections = [];
            that.peerConnectionsName = {};
            that.dataChannels = {};
            that.fileChannels = {};
            that.connections = [];
            that.fileData = {};
            that.emit('socket_closed', socket);
            socket.send(JSON.stringify({
                "eventName": "__close",
                "data": {
                    "socket": socket,
                    "userid": userId
                }
            }));
        };

        //接收到从服务器发来的私聊消息
        this.on('privMessage', function (data) {
            var privMsge = document.getElementById('content' + data.friendId);
            //检查是否有此好友 的聊天面板
            if(privMsge == undefined){
                //没有，重新创建聊天面板
                var panel;
                if (data.friendId in friendChatPanels) {
                    panel = friendChatPanels[data.friendId];
                } else {
                    panel = createFriendChatPanel(data.friendId);
                    friendChatPanels[data.friendId] = panel;
                    panel.append($('<span>你正在与 ' + data.friendName + '聊天</span>'));
                    panel.hide();
                    $('#panel2').prepend(panel);
                }
                privMsge = document.getElementById('content' + data.friendId);
            }
            //画到html上
            var div = document.createElement("div");
            div.innerText = data.friendName + ": " + data.message;
            privMsge.appendChild(div);
        });

        //接收到从服务器发来的私聊消息
        this.on('_waveHands', function (data) {
            //如果发起者是自己
            if (userId != data.userId){
                var ret = $("#hand").is(":hidden");
                if (ret == true) {
                    $("#hand").removeClass("hide");
                    $("#handimg").css({"animation-play-state": "running", "-webkit-animation-play-state": "running"});
                    setTimeout(function () {
                        $("#handimg").css({"animation-play-state": "paused", "-webkit-animation-play-state": "paused"});
                        //alert($("#handimg").css("-webkit-animation-play-state"))
                        $("#hand").addClass("hide");
                    }, 3000);
                }
            }
        });

        this.on('_peers', function (data) {
            //获取服务器上所有的socketid
            that.connections = data.connections;
            //将服务器上所有group成员socketid保存下来
            //that.groupConnections = data.groupConnections;
            that.me = data.you;
            //?????/
            that.emit("get_peers", that.connections);
            that.emit('connected', socket);
        });

        //接收到 对方传过来的 ice_candidate 信息
        this.on("_ice_candidate", function (data) {
            var candidate = new nativeRTCIceCandidate(data);
            var pc = that.peerConnections[data.socketId];
            pc.addIceCandidate(candidate);
            that.emit('get_ice_candidate', candidate);
        });

        //接收到 准备好之前存在的 开了视频用户的信息
        this.on("_old_readyVideo",function(data){
            this.window.rtc.readyUsers = data.readyUsers;
        });
        //接收到 准备好之后新开的 开了视频用户的信息
        this.on("_new_readyVideo",function(data){
            this.window.rtc.readyUsers[data.socketId] = {id:data.userId,name:userName};
            var that = this;
        });
        //接收到 视频用户离开的信息
        this.on("_video_friend_gone",function(data){
            delete this.window.rtc.readyUsers[data.socketId];
            var that = this;
        });

        //有新用户 连接服务器 把他加入 connections中保存
        //有好友的群成员连接服务器的话 把他加入 groupConnections中保存
        this.on('_new_peer', function (data) {
            //如果没登录  不执行这个操作
            if(userId == null)
                return ;
            that.connections.push(data.socketId);
            //that.groupConnections.push(data.socketId);
            var pc = that.createPeerConnection(data.socketId),
                i, m;
            pc.addStream(that.localMediaStream);
            that.emit('new_peer', data.socketId);
        });

        //有用户离开
        this.on('_remove_peer', function (data) {
            //如果客户端没有登录则不运行这个函数
            if(userId == undefined)
            return ;
            var sendId;
            that.closePeerConnection(that.peerConnections[data.socketId]);
            delete that.peerConnections[data.socketId];
            delete that.dataChannels[data.socketId];
            for (sendId in that.fileChannels[data.socketId]) {
                that.emit("send_file_error", new Error("Connection has been closed"), data.socketId, sendId, that.fileChannels[data.socketId][sendId].file);
            }
            delete that.fileChannels[data.socketId];
            that.emit("remove_peer", data.socketId);
        });

        //有已经登录的好友离开
        this.on('_friend_gone', function (data) {
            //将 相应的好友的 状态设置为 离线
            var frdBtnA = document.getElementById("frdBtn"+that.peerConnectionsName[data.socketId].id);
            if( frdBtnA != undefined){
                frdBtnA.style.color = "#d9d9d9";
            }
            //把 peerConnectionsName 相关的值删掉
            delete that.peerConnectionsName[data.socketId];

        });


        this.on('_offer', function (data) {
            that.receiveOffer(data.socketId, data.sdp);
            that.emit("get_offer", data);
        });

        this.on('_answer', function (data) {
            that.receiveAnswer(data.socketId, data.sdp);
            that.emit('get_answer', data);
        });

        this.on('send_file_error', function (error, socketId, sendId, file) {
            that.cleanSendFile(sendId, socketId);
        });

        this.on('receive_file_error', function (error, sendId) {
            that.cleanReceiveFile(sendId);
        });

        //本地视频准备好  后
        this.on('ready', function () {
            that.createPeerConnections();
            that.addStreams();
            that.addDataChannels();
            that.sendOffers();
        });

        //获得从服务器发来的验证登陆消息结果
        this.on('password', function (data) {
            //验证成功，登陆
            if (data.flag) {
                this.document.title = "用户" + userId;
                userId = data.userId;
                userName = data.userName;
                document.getElementById("userId").value = '';
                document.getElementById("loginbox").style.display = 'none';
                document.getElementById("chatBox").style.display = 'block';
                document.getElementById("side33").style.display = 'block';
                document.getElementById("sign1").style.display = 'block';
                //获得，所有好友的userName
                //将服务器上所有socketid对应的name记下来
                this.window.rtc.peerConnectionsName = data.userNames;
                this.window.rtc.getCategoryInfo();
                //将html中加上自己的名字
                $(".themetop").append(data.userName);
            } else {
                alert('登陆失败，密码错误或者重复登陆');
            }
        });

        //获得刚登陆的好友名字
        this.on('OtherName', function (data) {
            //获得好友的userName
            this.window.rtc.peerConnectionsName[data.socketId] = {id: data.userId, name: data.userName};
            //将 相应的好友的 状态设置为 在线
            var frdBtnA = document.getElementById("frdBtn"+that.peerConnectionsName[data.socketId].id);
            if( frdBtnA != undefined){
                frdBtnA.style.color = "green";
            }

        });

        this.on('register', function (data) {
            userId = data.userId;
            userName = data.userName;
            alert("注册成功！！" + "\n" + data.userId + "是你的用户id，下次登陆需要用到，务必记住哦，开始聊天把!");
            that.socket.send(JSON.stringify({
                "eventName": "__login",
                "data": {
                    "userId": userId,
                    "password": data.password
                }
            }));
        });

        this.on('showCategory', onShowCategory);
        function onShowCategory(data) {
            // alert("显示分组");
            // alert(data.catename);
            $('#accordion').empty();
            var groups = data.groups;
            for (var i = 0; i < groups.length; i++) {
                var group = groups[i];
                var groupEl = $('<li><div class="link" name="link"><i class="fa fa-globe"></i>' + group.groupName + '<i class="fa fa-chevron-down"></i></div><ul name="submenu" class="submenu"></ul></li>')
                var linkEl = groupEl.find('div.link');
                linkEl.click(onFriendListGroupDropDown)
                var groupFriendEl = groupEl.find('ul');
                //                cateTab.addEventListener("click", renameFunction);

                for (var friendIndex = 0; friendIndex < group.friends.length; friendIndex++) {
                    (function () {
                        var friend = group.friends[friendIndex];
                        var friendEl = $('<li><a id="frdBtn'+friend.id+'"href="#";>' + friend.name + '</a></li>');
                        //判断此时 friendId 是否在线
                        //在线 将字体颜色设置为 蓝色
                        var i;
                        for( i in that.peerConnectionsName){
                            if( that.peerConnectionsName[i].id == friend.id ){
                                friendEl[0].lastChild.style.color='green';
                            }
                        }
                        //好友按钮被点击的时候
                        friendEl.click(function () {
                            var panel;
                            if (friend.id in friendChatPanels) {
                                panel = friendChatPanels[friend.id];
                            } else {
                                panel = createFriendChatPanel(friend.id);
                                friendChatPanels[friend.id] = panel;
                                panel.append($('<span>你正在与 ' + friend.name + '聊天</span>'));
                                panel.hide();
                                $('#panel2').prepend(panel);
                            }

                            //切换到聊天页面
                            $('.leftbody .nav li.active').removeClass('active');
                            $('.leftbody .nav li.active a').attr('aria-expanded', false);

                            $('#nav-panel-priv-chat').addClass('active');
                            $('#nav-panel-priv-chat a').attr('aria-expanded', true);

                            $('.leftbody .tab-content .tab-pane.active').removeClass('active');
                            $('#panel2').addClass('active');

                            setCurrentFriendChatPanel(panel);
                        });

                        groupFriendEl.append(friendEl);
                    })();
                }
                $('#accordion').append(groupEl);
            }
        }

        ////FIXME Test Code
        //window.onShowCategory = onShowCategory;
        ////FIXME R

        function onFriendListGroupDropDown(e) {
            var $this = $(this),
                $next = $this.next();

            $next.slideToggle();
            $this.parent().toggleClass('open');

            $('#accordion').find('.submenu').not($next).slideUp().parent().removeClass('open');
        }

        /**********************************************************/
        /*                                                        */
        /*                       好友操作                          */
        /*                                                        */
        /**********************************************************/

        /*******************验证好友************************/
        this.on('_reqAddFriend', function (data) {
            alert("收到好友请求");
            if (data.flag == 1) {
                alert("请求好友错误");
                return;
            }
            //同意添加   不同意添加
            $('#friendapplication').modal('show');
            var modal = $('#friendapplication');
            modal.find('.friendinfo').text('id为' + data.reqFriendId + '名字为' + data.reqFriendName + '的好友请求添加你为好友！' + '验证消息为：' + data.reqFriendMessage);
            //var result = confirm("id为"+data.reqFriendId + '名字为'+data.reqFriendName+'的好友请求添加你为好友！'+"验证消息为："+data.reqFriendMessage);
            //同意 ,0为同意 ，1 为拒绝
            modal.find(".btn.btn-default").get(0).onclick = function () {
                //alert("default");
                //发送给服务端修改friend_info表
                that.socket.send(JSON.stringify({
                    "eventName": "refuse_addFreiend",
                    "data": {
                        "userId": userId,
                        "userName": userName,
                        "reqFriendId": data.reqFriendId,
                        "reqFriendName": data.reqFriendName,
                        "flag": 1
                    }
                }))
            };
            modal.find(".btn.btn-primary").get(0).onclick = function () {
                //alert("primary");
                that.socket.send(JSON.stringify({
                    "eventName": "__addFriend",
                    "data": {
                        "userId": userId,
                        "userName": userName,
                        "reqFriendId": data.reqFriendId,
                        "reqFriendName": data.reqFriendName,
                        "flag": 0
                    }
                }));
            };
        });

        /**************************拒绝添加好友***********************/

        this.on('refuse_addFreiend', function (data) {
            if (!data.flag) {
                alert(data.friend_name + '拒绝添加你为好友！');
            }
            else {
                return;
            }
        });
        /********************验证删除好友成功******************/
        this.on('delFriend', function (data) {

            if (!data.flag) {
                alert('删除成功');
            } else {
                return;
            }
        });
        /******************接到好友添加成功的消息*******************/
        this.on('_addFriend', function (data) {
            alert("你和" + data.friendName + "已经成为好友了，开始聊天吧");
            //通知服务器重新发一遍好友列表
            //var that = this;
            this.rtc.socket.send(JSON.stringify({
                "eventName": "getCategoryInfo",
                "data": {
                    "userId": userId
                }
            }));
        });
    };

    /*************************添加好友的申请*****************************/
    myrtc.prototype.reqfriend = function () {
        var that = this;
        var addfriend_id = document.getElementById("addfriend_id").value;
        var addfriend_text = document.getElementById("addfriend_text").value;
        //alert(addfriend_id);
        that.socket.send(JSON.stringify({
            "eventName": "__reqFriend",
            "data": {
                "friend_id": addfriend_id,
                "userId": userId,
                "userName": userName,
                "reqFriendMessage": addfriend_text
            }
        }));
    };

    /*************************删除好友****************************/
    myrtc.prototype.delfriend = function () {
        var that = this;
        var delfriend_id = document.getElementById("delfriend_id").value;

        that.socket.send(JSON.stringify({
            "eventName": "__delFriend",
            "data": {
                "friend_id": delfriend_id,
                "user_id": userId
            }
        }));
    };

    /*********************客户端登陆部分************************/
    myrtc.prototype.register = function () {
        var that = this;
        var userName = document.getElementById("nickname").value;
        var password = document.getElementById("registerPassword").value;
        var re_password = document.getElementById("re-registerPassword").value;
        if (userName == "" || password == "" || re_password == "") {
            alert("请输入内容！");
            return;
        }
        if (password !== re_password) {
            alert("两次密码不一致密码！");
            return;
        }
        that.socket.send(JSON.stringify({
            "eventName": "_register",
            "data": {
                "userName": userName,
                "password": password
            }
        }));
    };
    myrtc.prototype.clientLogin = function () {
        var that = this;
        var password = document.getElementById("password").value;
        userId = document.getElementById("userId").value;
        that.socket.send(JSON.stringify({
            "eventName": "__login",
            "data": {
                "userId": userId,
                "password": password
            }
        }));

    };
    myrtc.prototype.getCategoryInfo = function () {
        var that = this;
        that.socket.send(JSON.stringify({
            "eventName": "getCategoryInfo",
            "data": {
                "userId": userId
            }
        }));
    };

    /*************************视频招手*******************************/
    myrtc.prototype.wave = function () {
        //alert("挥手动作");
        var that = this;
        that.socket.send(JSON.stringify({
            "eventName": "__waveHands",
            "data": {
                "userId": userId
            }
        }));
    };

    /*************************流处理部分*******************************/

    //创建本地流
    //点击 开始 视频 运行的函数
    myrtc.prototype.createStream = function (options) {
        var that = this;

        options.video = !!options.video;
        options.audio = !!options.audio;

        if (getUserMedia) {
            this.numStreams++;
            getUserMedia.call(navigator, options, function (stream) {
                    that.localMediaStream = stream;
                    that.initializedStreams++;
                    that.emit("stream_created", stream);
                    if (that.initializedStreams === that.numStreams) {
                        that.emit("ready");
                        //此时通知服务器，已准备好 视频
                        that.socket.send(JSON.stringify({
                            "eventName": "_readyVideo",
                            "data": {
                                "userId": userId,
                                "userName":userName
                            }
                        }));
                    }
                },
                function (error) {
                    that.emit("stream_create_error", error);
                });
        } else {
            that.emit("stream_create_error", new Error('WebRTC is not yet supported in this browser.'));
        }
    };

    //将本地流添加到所有的PeerConnection实例中
    myrtc.prototype.addStreams = function () {
        var i, m,
            stream,
            connection;
        for (connection in this.peerConnections) {
            this.peerConnections[connection].addStream(this.localMediaStream);
        }
    };

    //将流绑定到video标签上用于输出
    myrtc.prototype.attachStream = function (stream, domId) {
        var element = document.getElementById(domId);
        if (navigator.mozGetUserMedia) {
            element.mozSrcObject = stream;
            element.play();
        } else {
            element.src = webkitURL.createObjectURL(stream);
        }
        element.src = webkitURL.createObjectURL(stream);
    };


    /***********************信令交换部分*******************************/


    //向所有PeerConnection发送Offer类型信令
    myrtc.prototype.sendOffers = function () {
        var i, m,
            pc,
            that = this,
            pcCreateOfferCbGen = function (pc, socketId) {
                return function (session_desc) {
                    pc.setLocalDescription(session_desc);
                    that.socket.send(JSON.stringify({
                        "eventName": "__offer",
                        "data": {
                            "sdp": session_desc,
                            "socketId": socketId
                        }
                    }));
                };
            },
            pcCreateOfferErrorCb = function (error) {
                console.log(error);
            };
        for (i = 0, m = this.connections.length; i < m; i++) {
            pc = this.peerConnections[this.connections[i]];
            pc.createOffer(pcCreateOfferCbGen(pc, this.connections[i]), pcCreateOfferErrorCb);
        }
    };

    //接收到Offer类型信令后作为回应返回answer类型信令
    myrtc.prototype.receiveOffer = function (socketId, sdp) {
        var pc = this.peerConnections[socketId];
        this.sendAnswer(socketId, sdp);
    };

    //发送answer类型信令
    myrtc.prototype.sendAnswer = function (socketId, sdp) {
        var pc = this.peerConnections[socketId];
        var that = this;
        pc.setRemoteDescription(new nativeRTCSessionDescription(sdp));
        pc.createAnswer(function (session_desc) {
            pc.setLocalDescription(session_desc);
            that.socket.send(JSON.stringify({
                "eventName": "__answer",
                "data": {
                    "socketId": socketId,
                    "sdp": session_desc
                }
            }));
        }, function (error) {
            console.log(error);
        });
    };

    //接收到answer类型信令后将对方的session描述写入PeerConnection中
    myrtc.prototype.receiveAnswer = function (socketId, sdp) {
        var pc = this.peerConnections[socketId];
        pc.setRemoteDescription(new nativeRTCSessionDescription(sdp));
    };


    /***********************点对点连接部分*****************************/


    //创建与其他用户连接的PeerConnections
    myrtc.prototype.createPeerConnections = function () {
        var i, m;
        for (i = 0, m = this.connections.length; i < m; i++) {
            this.createPeerConnection(this.connections[i]);
        }
    };

    //创建单个PeerConnection
    myrtc.prototype.createPeerConnection = function (socketId) {
        var that = this;
        var pc = new PeerConnection(iceServer);
        this.peerConnections[socketId] = pc;
        pc.onicecandidate = function (evt) {
            if (evt.candidate)
                that.socket.send(JSON.stringify({
                    "eventName": "__ice_candidate",
                    "data": {
                        "label": evt.candidate.sdpMLineIndex,
                        "candidate": evt.candidate.candidate,
                        "socketId": socketId
                        //"userName":peerConnectionsName[socketId]
                    }
                }));
            that.emit("pc_get_ice_candidate", evt.candidate, socketId, pc);
        };

        pc.onopen = function () {
            that.emit("pc_opened", socketId, pc);
        };

        pc.alert = function () {
            alert("调试");
        }

        //创建 其他用户的视频流
        pc.onaddstream = function (evt) {
            that.emit('pc_add_stream', evt.stream, socketId, pc);
            //alert("有视频接入");
        };

        pc.ondatachannel = function (evt) {
            that.addDataChannel(socketId, evt.channel);
            that.emit('pc_add_data_channel', evt.channel, socketId, pc);
        };
        return pc;
    };

    //关闭PeerConnection连接
    myrtc.prototype.closePeerConnection = function (pc) {
        if (!pc) return;
        pc.close();
    };


    /***********************数据通道连接部分*****************************/
        //私聊消息，基于websocket
    myrtc.prototype.privMessage = function (message, friendId) {
        //that = this;
        //需要判断此好友是否在线
        for (var i in this.peerConnectionsName) {
            if (this.peerConnectionsName[i].id == friendId) {
                //说明在线
                this.socket.send(JSON.stringify({
                    "eventName": "_privMessage",
                    "data": {
                        "message": message,
                        "friendId": friendId,
                        "userId": userId
                    }
                }));
                return;
            }
        }
        alert("此好友不在线哦");
    };

    //消息广播
    myrtc.prototype.broadcast = function (message) {
        var socketId;
        for (socketId in this.dataChannels) {
            this.sendMessage(message, socketId);
        }
    };

    //发送消息方法
    myrtc.prototype.sendMessage = function (message, socketId) {
        if (this.dataChannels[socketId].readyState.toLowerCase() === 'open') {
            this.dataChannels[socketId].send(JSON.stringify({
                type: "__msg",
                data: message
            }));
        }
    };

    //对所有的PeerConnections创建Data channel
    myrtc.prototype.addDataChannels = function () {
        var connection;
        for (connection in this.peerConnections) {
            this.createDataChannel(connection);
        }
    };

    //对某一个PeerConnection创建Data channel
    myrtc.prototype.createDataChannel = function (socketId, label) {
        var pc, key, channel;
        pc = this.peerConnections[socketId];

        if (!socketId) {
            this.emit("data_channel_create_error", socketId, new Error("attempt to create data channel without socket id"));
        }

        if (!(pc instanceof PeerConnection)) {
            this.emit("data_channel_create_error", socketId, new Error("attempt to create data channel without peerConnection"));
        }
        try {
            channel = pc.createDataChannel(label);
        } catch (error) {
            this.emit("data_channel_create_error", socketId, error);
        }

        return this.addDataChannel(socketId, channel);
    };

    //为Data channel绑定相应的事件回调函数
    myrtc.prototype.addDataChannel = function (socketId, channel) {
        var that = this;
        channel.onopen = function () {
            that.emit('data_channel_opened', channel, socketId);
        };

        channel.onclose = function (event) {
            delete that.dataChannels[socketId];
            that.emit('data_channel_closed', channel, socketId);
        };

        channel.onmessage = function (message) {
            var json;
            json = JSON.parse(message.data);
            if (json.type === '__file') {
                /*that.receiveFileChunk(json);*/
                that.parseFilePacket(json, socketId);
            } else {
                that.emit('data_channel_message', channel, socketId, json.data, that.peerConnectionsName[socketId].name);
            }
        };

        channel.onerror = function (err) {
            that.emit('data_channel_error', channel, socketId, err);
        };

        this.dataChannels[socketId] = channel;
        return channel;
    };


    /**********************************************************/
    /*                                                        */
    /*                       文件传输                         */
    /*                                                        */
    /**********************************************************/

    /************************公有部分************************/

        //解析Data channel上的文件类型包,来确定信令类型
    myrtc.prototype.parseFilePacket = function (json, socketId) {
        var signal = json.signal,
            that = this;
        if (signal === 'ask') {
            that.receiveFileAsk(json.sendId, json.name, json.size, socketId);
        } else if (signal === 'accept') {
            that.receiveFileAccept(json.sendId, socketId);
        } else if (signal === 'refuse') {
            that.receiveFileRefuse(json.sendId, socketId);
        } else if (signal === 'chunk') {
            that.receiveFileChunk(json.data, json.sendId, socketId, json.last, json.percent);
        } else if (signal === 'close') {
            //TODO
        }
    };

    /***********************发送者部分***********************/


        //通过Dtata channel向房间内所有其他用户广播文件
    myrtc.prototype.shareFile = function (dom) {
        var socketId,
            that = this;
        for (socketId in that.dataChannels) {
            that.sendFile(dom, socketId);
        }
    };

    //向某一单个用户发送文件
    myrtc.prototype.sendFile = function (dom, socketId) {
        var that = this,
            file,
            reader,
            fileToSend,
            sendId;
        if (typeof dom === 'string') {
            dom = document.getElementById(dom);
        }
        if (!dom) {
            that.emit("send_file_error", new Error("Can not find dom while sending file"), socketId);
            return;
        }
        if (!dom.files || !dom.files[0]) {
            that.emit("send_file_error", new Error("No file need to be sended"), socketId);
            return;
        }
        file = dom.files[0];
        that.fileChannels[socketId] = that.fileChannels[socketId] || {};
        sendId = that.getRandomString();
        fileToSend = {
            file: file,
            state: "ask"
        };
        that.fileChannels[socketId][sendId] = fileToSend;
        that.sendAsk(socketId, sendId, fileToSend);
        that.emit("send_file", sendId, socketId, file);
    };

    //发送多个文件的碎片
    myrtc.prototype.sendFileChunks = function () {
        var socketId,
            sendId,
            that = this,
            nextTick = false;
        for (socketId in that.fileChannels) {
            for (sendId in that.fileChannels[socketId]) {
                if (that.fileChannels[socketId][sendId].state === "send") {
                    nextTick = true;
                    that.sendFileChunk(socketId, sendId);
                }
            }
        }
        if (nextTick) {
            setTimeout(function () {
                that.sendFileChunks();
            }, 10);
        }
    };

    //发送某个文件的碎片
    myrtc.prototype.sendFileChunk = function (socketId, sendId) {
        var that = this,
            fileToSend = that.fileChannels[socketId][sendId],
            packet = {
                type: "__file",
                signal: "chunk",
                sendId: sendId
            },
            channel;

        fileToSend.sendedPackets++;
        fileToSend.packetsToSend--;


        if (fileToSend.fileData.length > packetSize) {
            packet.last = false;
            packet.data = fileToSend.fileData.slice(0, packetSize);
            packet.percent = fileToSend.sendedPackets / fileToSend.allPackets * 100;
            that.emit("send_file_chunk", sendId, socketId, fileToSend.sendedPackets / fileToSend.allPackets * 100, fileToSend.file);
        } else {
            packet.data = fileToSend.fileData;
            packet.last = true;
            fileToSend.state = "end";
            that.emit("sended_file", sendId, socketId, fileToSend.file);
            that.cleanSendFile(sendId, socketId);
        }

        channel = that.dataChannels[socketId];

        if (!channel) {
            that.emit("send_file_error", new Error("Channel has been destoried"), socketId, sendId, fileToSend.file);
            return;
        }
        channel.send(JSON.stringify(packet));
        fileToSend.fileData = fileToSend.fileData.slice(packet.data.length);
    };

    //发送文件请求后若对方同意接受,开始传输
    myrtc.prototype.receiveFileAccept = function (sendId, socketId) {
        var that = this,
            fileToSend,
            reader,
            initSending = function (event, text) {
                fileToSend.state = "send";
                fileToSend.fileData = event.target.result;
                fileToSend.sendedPackets = 0;
                fileToSend.packetsToSend = fileToSend.allPackets = parseInt(fileToSend.fileData.length / packetSize, 10);
                that.sendFileChunks();
            };
        fileToSend = that.fileChannels[socketId][sendId];
        reader = new window.FileReader(fileToSend.file);
        reader.readAsDataURL(fileToSend.file);
        reader.onload = initSending;
        that.emit("send_file_accepted", sendId, socketId, that.fileChannels[socketId][sendId].file);
    };

    //发送文件请求后若对方拒绝接受,清除掉本地的文件信息
    myrtc.prototype.receiveFileRefuse = function (sendId, socketId) {
        var that = this;
        that.fileChannels[socketId][sendId].state = "refused";
        that.emit("send_file_refused", sendId, socketId, that.fileChannels[socketId][sendId].file);
        that.cleanSendFile(sendId, socketId);
    };

    //清除发送文件缓存
    myrtc.prototype.cleanSendFile = function (sendId, socketId) {
        var that = this;
        delete that.fileChannels[socketId][sendId];
    };

    //发送文件请求
    myrtc.prototype.sendAsk = function (socketId, sendId, fileToSend) {
        var that = this,
            channel = that.dataChannels[socketId],
            packet;
        if (!channel) {
            that.emit("send_file_error", new Error("Channel has been closed"), socketId, sendId, fileToSend.file);
        }
        packet = {
            name: fileToSend.file.name,
            size: fileToSend.file.size,
            sendId: sendId,
            type: "__file",
            signal: "ask"
        };
        channel.send(JSON.stringify(packet));
    };

    //获得随机字符串来生成文件发送ID
    myrtc.prototype.getRandomString = function () {
        return (Math.random() * new Date().getTime()).toString(36).toUpperCase().replace(/\./g, '-');
    };

    /***********************接收者部分***********************/


        //接收到文件碎片
    myrtc.prototype.receiveFileChunk = function (data, sendId, socketId, last, percent) {
        var that = this,
            fileInfo = that.receiveFiles[sendId];
        if (!fileInfo.data) {
            fileInfo.state = "receive";
            fileInfo.data = "";
        }
        fileInfo.data = fileInfo.data || "";
        fileInfo.data += data;
        if (last) {
            fileInfo.state = "end";
            that.getTransferedFile(sendId);
        } else {
            that.emit("receive_file_chunk", sendId, socketId, fileInfo.name, percent);
        }
    };

    //接收到所有文件碎片后将其组合成一个完整的文件并自动下载
    myrtc.prototype.getTransferedFile = function (sendId) {
        var that = this,
            fileInfo = that.receiveFiles[sendId],
            hyperlink = document.createElement("a"),
            mouseEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            });
        hyperlink.href = fileInfo.data;
        hyperlink.target = '_blank';
        hyperlink.download = fileInfo.name || dataURL;

        hyperlink.dispatchEvent(mouseEvent);
        (window.URL || window.webkitURL).revokeObjectURL(hyperlink.href);
        that.emit("receive_file", sendId, fileInfo.socketId, fileInfo.name);
        that.cleanReceiveFile(sendId);
    };

    //接收到发送文件请求后记录文件信息
    myrtc.prototype.receiveFileAsk = function (sendId, fileName, fileSize, socketId) {
        var that = this;
        that.receiveFiles[sendId] = {
            socketId: socketId,
            state: "ask",
            name: fileName,
            size: fileSize
        };
        that.emit("receive_file_ask", sendId, socketId, fileName, fileSize);
    };

    //发送同意接收文件信令
    myrtc.prototype.sendFileAccept = function (sendId) {
        var that = this,
            fileInfo = that.receiveFiles[sendId],
            channel = that.dataChannels[fileInfo.socketId],
            packet;
        if (!channel) {
            that.emit("receive_file_error", new Error("Channel has been destoried"), sendId, socketId);
        }
        packet = {
            type: "__file",
            signal: "accept",
            sendId: sendId
        };
        channel.send(JSON.stringify(packet));
    };

    //发送拒绝接受文件信令
    myrtc.prototype.sendFileRefuse = function (sendId) {
        var that = this,
            fileInfo = that.receiveFiles[sendId],
            channel = that.dataChannels[fileInfo.socketId],
            packet;
        if (!channel) {
            that.emit("receive_file_error", new Error("Channel has been destoried"), sendId, socketId);
        }
        packet = {
            type: "__file",
            signal: "refuse",
            sendId: sendId
        };
        channel.send(JSON.stringify(packet));
        that.cleanReceiveFile(sendId);
    };

    //清除接受文件缓存
    myrtc.prototype.cleanReceiveFile = function (sendId) {
        var that = this;
        delete that.receiveFiles[sendId];
    };

    return new myrtc();
};
