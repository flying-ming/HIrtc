function createFriendChatPanel(friendId) {
    var el = $('<div class="chat-content"></div>');
    el.friendId = friendId;
    return el;
}
var currentChatPanel = null;
function setCurrentFriendChatPanel(panel) {
    if (currentChatPanel) {
        currentChatPanel.hide();
    }
    currentChatPanel = panel;
    panel.show();
}

function appendChatMessageToCurrentPanel(el) {
    if (!currentChatPanel)
        return;

    currentChatPanel.append(el);
}

//currentChatPanel.friendId
//appendChatMessageToCurrentPanel($('<div>'+message+'</div>'));