function edit(target, id) {
    var loc = myUrl() + target + '/edit/' + id;
    window.location = loc;
}

function newLink(target) {
    var loc = myUrl() + target + '/new';
    window.location = loc;
}

function goTo(target) {
    event.preventDefault();
    var loc = myUrl() + target;
    window.location = loc;
}

function myUrl() {
    return 'http://lushi.asuscomm.com:1337/';

}

function validate(form) {

}

function toggleFullscreen() {
    var doc = window.document;
    var docEl = doc.documentElement;

    var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    }
    else {
        cancelFullScreen.call(doc);
    }
}
