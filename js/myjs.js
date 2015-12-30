/**
 * Created by lgq on 15-10-19.
 */


$(document).ready(function (e) {

    checkCookie();

    $(".theme").css("margin-right", (($(window).width() - 70) / 2 - 335) + "px");
    $("#hand").css("left", $(window).width() / 2 - 64 + "px");
    $("#hand").css("top", $(window).height() / 2 - 64 + "px");

    $("#top2").click(function () {
        var str = $("#mic").attr("src");
        var n = str.search("mic.png");
        if (n != -1) {
            $("#mic").attr("src", "image/micstop.png")
        }
        else {
            $("#mic").attr("src", "image/mic.png")
        }
    });

    $("#top3").click(function () {
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
    });

    $("#sign1").click(function () {
        //alert("hello world");
        $("#main").removeClass("col-md-12").addClass("col-md-9");
        $("#sidebar").removeClass("hide");
        $("#sign1").hide();
    });

    $("#sign2").click(function () {
        //alert("hello world");
        $("#sidebar").addClass("hide");
        $("#main").removeClass("col-md-9").addClass("col-md-12");
        $("#sign1").show();
    });

});

/*
 $(window).on('resizeend', 0, function() {
 NavLeft.Init();
 $(".theme").css("margin-right", (($(window).width() - 70) / 2 - 335) + "px");
 $(".sidebar").css("height", $(window).height() - 60 + "px");
 $(".sidebar").css("padding-top", ($(window).height() - 360) / 2 + "px");
 $(".sidebarchild").css("height", $(window).height() - 60 + "px");
 });
 */


window.onresize = function () {
    $(".theme").css("margin-right", (($(window).width() - 70) / 2 - 335) + "px");
    $("#hand").css("left", ($(window).width() / 2 - 64) + "px");
    $("#hand").css("top", ($(window).height() / 2 - 64) + "px");
};

function setCookie(value) {
    document.cookie = "starttime=" + value;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i].trim();
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return "";
}

function showCookie() {
    var time = parseInt(getCookie("starttime"), 10);
    var sec = time % 60;
    var min = parseInt(time / 60) % 60;
    var hour = parseInt(time / 3600) % 60;

    document.getElementById("timer").innerHTML = hour + " : " + min + " : " + sec;
    time = time + 1;
    setCookie(time);
    setTimeout(function () {
        showCookie();
    }, 1000);

}

function deleteCookie() {
    document.cookie = "starttime=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    document.cookie = "starttime; expires=Thu, 01 Jan 1970 00:00:00 GMT"
}

function checkCookie() {
    var time = getCookie("starttime");
    if (time != "" && time != "NaN") {
        showCookie();
    }
    else {
        setCookie(0);
        showCookie();
    }
}

function winclose() {
    deleteCookie();

    parent.location.reload();
}


