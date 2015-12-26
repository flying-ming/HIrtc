#一个简单的WEBRTC项目
---
##简介
这是一个使用webrtc框架的nodejs项目，能够音频、视频、文字聊天
参考了SkyRTC

##安装和使用
1. 安装Node.js及npm环境
2. 下载源码到本地，并解压缩
3. 移动到解压后的目录下
4. 使用命令`npm install`安装所需要的库
5. 运行命令`node server.js`，建议配合`forever`
6. 访问`localhost:3000#roomName`查看效果，其中`roomName`为进入的房间名，不同房间的用户无法互相通信

##功能说明
支持划分房间的在线音频、视频、文字聊天，提供房间内文件共享功能