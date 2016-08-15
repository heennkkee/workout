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
